import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeExternalText,
  SlidingWindowRateLimiter,
} from "../src/security.js";
import { resolveTwitchConfig } from "../src/services/twitchConfig.js";
import { shouldPurgeChatHistory } from "../src/services/twitchMonitor.js";

const twitchConfig = (record: unknown) =>
  ({
    twitchConfig: { findUnique: async () => record },
  }) as never;

test("normalizes control characters, mentions remain inert text, and truncates input", () => {
  const value = normalizeExternalText("@everyone\u0000 hello\nworld", 17);
  assert.equal(value, "@everyone hello w");
});

test("rate limiter rejects bursts and allows events after the window", async () => {
  const limiter = new SlidingWindowRateLimiter(2, 10);
  assert.equal(limiter.allow("guild:user"), true);
  assert.equal(limiter.allow("guild:user"), true);
  assert.equal(limiter.allow("guild:user"), false);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(limiter.allow("guild:user"), true);
});

test("Twitch only activates after explicit guild opt-in and complete guild configuration", async () => {
  const originalEnvironment = {
    TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
    TWITCH_CHANNEL_NAME: process.env.TWITCH_CHANNEL_NAME,
    TWITCH_CHAT_DISCORD_CHANNEL_ID: process.env.TWITCH_CHAT_DISCORD_CHANNEL_ID,
    TWITCH_ANNOUNCE_DISCORD_CHANNEL_ID:
      process.env.TWITCH_ANNOUNCE_DISCORD_CHANNEL_ID,
    TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
  };
  process.env.TWITCH_CLIENT_ID = "global-client-id";
  process.env.TWITCH_CHANNEL_NAME = "global-channel";
  process.env.TWITCH_CHAT_DISCORD_CHANNEL_ID = "global-chat";
  process.env.TWITCH_ANNOUNCE_DISCORD_CHANNEL_ID = "global-announce";
  process.env.TWITCH_CLIENT_SECRET = "runtime-only-test-secret";

  try {
    assert.equal(
      await resolveTwitchConfig(twitchConfig(null), "guild-without-opt-in"),
      null,
    );
    assert.equal(
      await resolveTwitchConfig(
        twitchConfig({
          guildId: "guild-with-partial-config",
          clientId: null,
          channelName: null,
          chatChannelId: null,
          announceChannelId: null,
        }),
        "guild-with-partial-config",
      ),
      null,
    );
    const resolved = await resolveTwitchConfig(
      twitchConfig({
        id: "config-1",
        guildId: "guild-opted-in",
        clientId: "guild-client-id",
        channelName: "guild-channel",
        chatChannelId: "guild-chat",
        announceChannelId: "guild-announce",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      "guild-opted-in",
    );
    assert.equal(resolved?.clientId, "guild-client-id");
    assert.equal(resolved?.channelName, "guild-channel");
  } finally {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("Twitch purge remains disabled and cannot delete generic messages", () => {
  assert.equal(shouldPurgeChatHistory(), false);
});
