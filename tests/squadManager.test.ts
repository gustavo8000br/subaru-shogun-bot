import assert from "node:assert/strict";
import test from "node:test";
import {
  COUNTED_SQUAD_STATUSES,
  getDynamicSquadChannelNames,
  isControlledSquadChannelName,
  isSquadCreationChannel,
} from "../src/squadManager.js";
import {
  buildReputationMemberOptions,
  buildSquadMemberOptions,
  getReputationMemberLabel,
} from "../src/commands/adminCommands.js";

test("recognizes the dynamic squad trigger by exact name or configured ID", () => {
  assert.equal(
    isSquadCreationChannel("➕ · Criar Squad", "voice-1", "voice-2"),
    true,
  );
  assert.equal(
    isSquadCreationChannel("Outro canal", "voice-2", "voice-2"),
    true,
  );
  assert.equal(
    isSquadCreationChannel("➕ criar squad", "voice-1", "voice-2"),
    false,
  );
  assert.equal(
    isSquadCreationChannel("Outro canal", "voice-1", "voice-2"),
    false,
  );
});

test("builds the exact dynamic squad channel names", () => {
  assert.deepEqual(getDynamicSquadChannelNames("Tavo"), {
    voiceName: "🔊 · Squad de Tavo",
    textName: "💬 · squad-de-Tavo",
  });
});

test("uses the current display name for reputation labels and keeps fallback data private", () => {
  assert.equal(
    getReputationMemberLabel({
      displayName: "Nome da Guild",
      user: { username: "username" },
    }),
    "Nome da Guild",
  );
  assert.equal(
    getReputationMemberLabel({
      displayName: "   ",
      user: { username: "username" },
    }),
    "username",
  );
  assert.equal(getReputationMemberLabel(undefined), "Membro da guild");
});

test("truncates reputation labels to Discord 100-character limit by Unicode characters", () => {
  assert.equal(
    getReputationMemberLabel({ displayName: "😀".repeat(101) }),
    "😀".repeat(100),
  );
});

test("keeps reputation option values as IDs while labels use current names", () => {
  const members = new Map([
    ["user-1", { displayName: "Nome Atual", user: { username: "username-1" } }],
    ["user-2", { displayName: null, user: { username: "username-2" } }],
  ]);
  const guild = { members: { cache: members } };

  assert.deepEqual(buildReputationMemberOptions(guild, ["user-1", "user-2"]), [
    { label: "Nome Atual", value: "user-1" },
    { label: "username-2", value: "user-2" },
  ]);
});

test("limits squad member actions to Discord's 25-option maximum", () => {
  const members = Array.from({ length: 30 }, (_, index) => ({
    userId: `user-${index}`,
  }));
  const options = buildSquadMemberOptions(members);
  assert.equal(options.length, 25);
  assert.equal(options.at(-1)?.value, "user-24");
});

test("counts provisioning and pending squads against the channel limit", () => {
  assert.deepEqual(COUNTED_SQUAD_STATUSES, [
    "active",
    "provisioning",
    "pending_reconciliation",
  ]);
});

test("recognizes only bot-controlled squad channel names as orphan candidates", () => {
  assert.equal(isControlledSquadChannelName(2, "🔊 · Squad de Tavo"), true);
  assert.equal(
    isControlledSquadChannelName(0, "canal-que-o-usuario-criou"),
    false,
  );
});
