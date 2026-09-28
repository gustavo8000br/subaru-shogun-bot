/** Fixed, synthetic identifiers and values from QA_PLAN_UNIVERSAL_BOT.md §6. */
export const multiGuildFixture = {
  guilds: {
    a: { id: "story-0-5-guild-a", maxSquadsPerGame: 1, maxMembersPerSquad: 2, emptyTimeoutMs: 300_000, inactivityTimeoutMs: 86_400_000, twitchEnabled: false, economyEnabled: true },
    b: { id: "story-0-5-guild-b", maxSquadsPerGame: 2, maxMembersPerSquad: 3, emptyTimeoutMs: 1_800_000, inactivityTimeoutMs: 86_400_000, twitchEnabled: true, economyEnabled: false },
  },
  actors: {
    shared: "user-shared", ownerA: "owner-a", ownerB: "owner-b", staffA: "staff-a", staffB: "staff-b",
    memberA: "member-a", memberB: "member-b", outsider: "outsider", exMember: "ex-member",
  },
  gameName: "Arena",
  community: {
    guildA: { sharedCoins: 100, sharedReputation: 9, sharedRank: "gold", panelId: "panel-a" },
    guildB: { sharedCoins: 7, sharedReputation: 2, sharedRank: "bronze", panelId: "panel-b" },
  },
  unownedChannel: { id: "channel-not-owned-by-bot" },
} as const;
