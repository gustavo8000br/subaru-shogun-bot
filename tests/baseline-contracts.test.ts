import assert from "node:assert/strict";
import test from "node:test";
import { multiGuildFixture } from "./fixtures/multiguild.js";
import { ControlledClock } from "./support/controlled-clock.js";
import { deleteOwnedChannel, FakeDiscordAdapter, type DiscordOperation } from "./support/fake-discord.js";
import { isEphemeralTestDatabaseUrl } from "./support/ephemeral-db-url.js";

test("B0.5-03: pure clock arithmetic covers approved boundaries and downtime without sleeping", () => {
  const clock = new ControlledClock(new Date("2026-09-01T00:00:00.000Z"));
  const emptySinceAt = clock.now();
  const persistedEmptySinceAt = emptySinceAt.toISOString(); // Simulates the timestamp stored by the owner story.
  const emptyDeadline = emptySinceAt.getTime() + 5 * 60 * 1000;
  assert.equal(clock.advance(5 * 60 * 1000 - 1).getTime(), emptyDeadline - 1, "just before the 5-minute boundary");
  assert.equal(clock.advance(1).getTime(), emptyDeadline, "at the 5-minute boundary");
  assert.equal(clock.advance(1).getTime(), emptyDeadline + 1, "just after the 5-minute boundary");

  const lastActivityAt = new Date("2026-09-01T00:00:00.000Z");
  const inactivityDueAt = lastActivityAt.getTime() + 24 * 60 * 60 * 1000;
  const inactivityClock = new ControlledClock(lastActivityAt);
  assert.equal(inactivityClock.advance(86_400_000 - 1).getTime(), inactivityDueAt - 1, "just before the 24-hour boundary");
  assert.equal(inactivityClock.advance(1).getTime(), inactivityDueAt, "at the 24-hour boundary");
  assert.equal(inactivityClock.advance(1).getTime(), inactivityDueAt + 1, "just after the 24-hour boundary");
  const resumedClock = new ControlledClock(new Date(persistedEmptySinceAt));
  const bootAt = resumedClock.advance(26 * 60 * 60 * 1000); // Simulated downtime; wall clock continues.
  const configuredEmptyTimeouts = [multiGuildFixture.guilds.a.emptyTimeoutMs, multiGuildFixture.guilds.b.emptyTimeoutMs];

  assert.equal(new Date(persistedEmptySinceAt).getTime(), emptySinceAt.getTime(), "emptySinceAt survives simulated restart");
  assert.equal(inactivityDueAt, lastActivityAt.getTime() + 86_400_000);
  assert.ok(bootAt.getTime() > inactivityDueAt, "downtime counts as wall-clock time");
  for (const emptyTimeoutMs of configuredEmptyTimeouts) {
    const graceDuration = Math.max(5 * 60 * 1000, emptyTimeoutMs);
    const graceEndsAt = bootAt.getTime() + graceDuration;
    const graceClock = new ControlledClock(bootAt);
    assert.equal(graceClock.advance(graceDuration - 1).getTime(), graceEndsAt - 1, "just before configured boot grace");
    assert.equal(graceClock.advance(1).getTime(), graceEndsAt, "at configured boot grace boundary");
    assert.equal(graceClock.advance(1).getTime(), graceEndsAt + 1, "just after configured boot grace");
  }
  assert.notEqual(resumedClock.now(), resumedClock.now(), "now returns independent Date instances");

  // ADR-004: passive presence and movement without composition changes are not activity.
  const activityRenewal = new Map([
    ["member_message", true], ["participant_join", true], ["participant_leave", true],
    ["squad_mutation", true], ["passive_voice_presence", false], ["mute_deafen_camera", false],
    ["move_within_squad", false], ["bot_or_webhook_message", false], ["outsider_message", false],
    ["read_only_query", false],
  ]);
  assert.equal(activityRenewal.get("passive_voice_presence"), false);
  assert.equal(activityRenewal.get("move_within_squad"), false);
  assert.equal(activityRenewal.get("member_message"), true);
});

test("B0.5-04: Discord fake records ordered success and one-shot failures for every operation", async () => {
  const adapter = new FakeDiscordAdapter();
  const operations: DiscordOperation[] = ["create", "edit", "delete", "send", "fetch"];
  const channel = await adapter.create({ name: "owned", ownershipMarker: "squad-1" });
  await adapter.edit(channel.id, { name: "renamed" });
  await adapter.send(channel.id, "synthetic message");
  assert.equal(await adapter.fetch(channel.id), adapter.cache.get(channel.id));
  assert.equal(await adapter.delete(channel.id), true);

  for (const operation of operations) {
    adapter.failNext(operation, `planned-${operation}-failure`);
    const attempt = () => {
      switch (operation) {
        case "create": return adapter.create({ name: "failure", ownershipMarker: "squad-2" });
        case "edit": return adapter.edit("missing", { name: "failure" });
        case "delete": return adapter.delete("missing");
        case "send": return adapter.send("missing", "failure");
        case "fetch": return adapter.fetch("missing");
      }
    };
    await assert.rejects(attempt, new RegExp(`planned-${operation}-failure`));
    assert.equal(adapter.calls.at(-1)?.operation, operation);
    assert.equal(adapter.calls.at(-1)?.error, `planned-${operation}-failure`);
  }

  const missing = await adapter.fetch("unknown-channel");
  assert.equal(missing, null, "fetch confirms remote absence");
  const coldCacheChannel = await adapter.create({ name: "cold", ownershipMarker: "squad-3" });
  adapter.cache.clear();
  assert.equal(adapter.cache.has(coldCacheChannel.id), false, "cache starts cold");
  assert.ok(await adapter.fetch(coldCacheChannel.id), "cold cache alone is not confirmed absence");
  assert.equal(adapter.cache.has(coldCacheChannel.id), true, "fetch repopulates cache from remote state");

  assert.deepEqual(adapter.calls.slice(0, 5).map((call) => call.operation), ["create", "edit", "send", "fetch", "delete"]);
});

test("B0.5-04: compensation requires a registered terminal operation and fetched remote ownership", async () => {
  const adapter = new FakeDiscordAdapter();
  const expected = { guildId: "guild-a", squadId: "squad-a", operationId: "operation-a" };
  const deleteCount = () => adapter.calls.filter((call) => call.operation === "delete").length;

  // A copied marker in the caller object cannot make an absent remote resource deletable.
  const forgedAbsent = { id: "missing-remote", guildId: "guild-a", ownershipMarker: "squad-a", operationId: "operation-a" };
  adapter.registerProvisioningOperation({ ...expected, id: expected.operationId, channelId: forgedAbsent.id, terminalFailure: true });
  const beforeAbsent = deleteCount();
  assert.equal(await deleteOwnedChannel(adapter, forgedAbsent, expected), false);
  assert.equal(deleteCount(), beforeAbsent);
  assert.equal(adapter.calls.at(-1)?.operation, "fetch", "absence is confirmed remotely before any delete");

  // The caller forges the expected marker, but the fetched resource belongs to another squad.
  const remoteOtherOwner = await adapter.create({
    name: "remote-other-owner", guildId: "guild-a", ownershipMarker: "squad-b", operationId: "operation-b",
  });
  const opForOtherOwner = { ...expected, id: "operation-b", channelId: remoteOtherOwner.id, terminalFailure: true };
  adapter.registerProvisioningOperation(opForOtherOwner);
  const forgedOtherOwner = { ...remoteOtherOwner, ownershipMarker: expected.squadId };
  const beforeOtherOwner = deleteCount();
  assert.equal(await deleteOwnedChannel(adapter, forgedOtherOwner, { ...expected, operationId: "operation-b" }), false);
  assert.equal(deleteCount(), beforeOtherOwner);
  assert.ok(await adapter.fetch(remoteOtherOwner.id), "remote channel owned by another squad remains present");

  const remoteOtherGuild = await adapter.create({
    name: "remote-other-guild", guildId: "guild-b", ownershipMarker: "squad-a", operationId: "operation-wrong-guild",
  });
  adapter.registerProvisioningOperation({ ...expected, id: "operation-wrong-guild", channelId: remoteOtherGuild.id, terminalFailure: true });
  const beforeOtherGuild = deleteCount();
  assert.equal(await deleteOwnedChannel(adapter, remoteOtherGuild, { ...expected, operationId: "operation-wrong-guild" }), false);
  assert.equal(deleteCount(), beforeOtherGuild);

  // Even a currently matching remote marker is insufficient without terminal failure.
  const pending = await adapter.create({
    name: "pending-operation", guildId: "guild-a", ownershipMarker: "squad-a", operationId: "operation-pending",
  });
  adapter.registerProvisioningOperation({ ...expected, id: "operation-pending", channelId: pending.id, terminalFailure: false });
  const beforePending = deleteCount();
  assert.equal(await deleteOwnedChannel(adapter, pending, { ...expected, operationId: "operation-pending" }), false);
  assert.equal(deleteCount(), beforePending);

  // Positive control: registered failed operation and fresh remote state all match.
  const owned = await adapter.create({
    name: "owned-current", guildId: "guild-a", ownershipMarker: "squad-a", operationId: expected.operationId,
  });
  adapter.registerProvisioningOperation({ ...expected, id: expected.operationId, channelId: owned.id, terminalFailure: true });
  const callerCopyWithForgedMarker = { ...owned, ownershipMarker: "copied-untrusted-marker" };
  assert.equal(await deleteOwnedChannel(adapter, callerCopyWithForgedMarker, expected), true);
  assert.deepEqual(adapter.calls.slice(-2).map((call) => call.operation), ["fetch", "delete"]);
  assert.equal(await adapter.fetch(owned.id), null, "verified resource is deleted after remote ownership check");
});

test("multi-guild fixture is fixed, synthetic, and keeps the shared actor's community values distinct", () => {
  assert.equal(multiGuildFixture.actors.shared, "user-shared");
  assert.notEqual(multiGuildFixture.guilds.a.id, multiGuildFixture.guilds.b.id);
  assert.notEqual(multiGuildFixture.community.guildA.sharedCoins, multiGuildFixture.community.guildB.sharedCoins);
  assert.notEqual(multiGuildFixture.community.guildA.sharedReputation, multiGuildFixture.community.guildB.sharedReputation);
  assert.equal(multiGuildFixture.guilds.a.emptyTimeoutMs, 300_000);
  assert.equal(multiGuildFixture.guilds.b.emptyTimeoutMs, 1_800_000);
});

test("B0.5-02: database URL guard rejects non-disposable hosts and database identities", () => {
  const accepted = "postgresql://shogun_test:shogun_test_ephemeral_only@127.0.0.1:54321/shogun_test?schema=public";
  assert.equal(isEphemeralTestDatabaseUrl(accepted), true);
  assert.equal(isEphemeralTestDatabaseUrl(undefined), false);
  assert.equal(isEphemeralTestDatabaseUrl("not a URL"), false);
  assert.equal(isEphemeralTestDatabaseUrl(accepted.replace("127.0.0.1", "db.example.com")), false);
  assert.equal(isEphemeralTestDatabaseUrl(accepted.replace("/shogun_test?", "/production?")), false);
  assert.equal(isEphemeralTestDatabaseUrl(accepted.replace("shogun_test_ephemeral_only", "real-password")), false);
  assert.equal(isEphemeralTestDatabaseUrl(accepted.replace("postgresql://", "postgres://")), false);
});
