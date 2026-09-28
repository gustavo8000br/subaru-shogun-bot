export type DiscordOperation = "create" | "edit" | "delete" | "send" | "fetch";
export type FakeChannel = { id: string; guildId?: string; ownershipMarker?: string; operationId?: string; name?: string };
export type FakeProvisioningOperation = {
  id: string;
  guildId: string;
  squadId: string;
  channelId: string;
  terminalFailure: boolean;
};
export type CallResult = FakeChannel | { id: string; message: string } | boolean | null | undefined;

export type DiscordCall = {
  operation: DiscordOperation;
  input: unknown;
  result?: CallResult;
  error?: string;
};

/** Minimal test adapter. It models calls and failures, not Discord permissions/API behavior. */
export class FakeDiscordAdapter {
  readonly calls: DiscordCall[] = [];
  readonly cache = new Map<string, FakeChannel>();
  private readonly remoteChannels = new Map<string, FakeChannel>();
  private readonly operations = new Map<string, FakeProvisioningOperation>();
  private readonly failures = new Map<DiscordOperation, string[]>();
  private nextId = 1;

  failNext(operation: DiscordOperation, message = `${operation} failed`): void {
    const queued = this.failures.get(operation) ?? [];
    queued.push(message);
    this.failures.set(operation, queued);
  }

  registerProvisioningOperation(operation: FakeProvisioningOperation): void {
    this.operations.set(operation.id, { ...operation });
  }

  getProvisioningOperation(id: string): FakeProvisioningOperation | null {
    const operation = this.operations.get(id);
    return operation ? { ...operation } : null;
  }

  async create(input: { name: string; ownershipMarker: string; guildId?: string; operationId?: string }): Promise<FakeChannel> {
    const created = this.invoke("create", input, () => {
      const channel = { id: `fake-channel-${this.nextId++}`, ...input };
      this.remoteChannels.set(channel.id, channel);
      this.cache.set(channel.id, channel);
      return channel;
    });
    return created as FakeChannel;
  }

  async edit(id: string, changes: Partial<Pick<FakeChannel, "name">>): Promise<FakeChannel> {
    return this.invoke("edit", { id, changes }, () => {
      const channel = this.remoteChannels.get(id);
      if (!channel) throw new Error("channel absent");
      const updated = { ...channel, ...changes };
      this.remoteChannels.set(id, updated);
      this.cache.set(id, updated);
      return updated;
    }) as FakeChannel;
  }

  async delete(id: string): Promise<boolean> {
    return this.invoke("delete", { id }, () => {
      const existed = this.remoteChannels.delete(id);
      this.cache.delete(id);
      return existed;
    }) as boolean;
  }

  async send(channelId: string, content: string): Promise<{ id: string; message: string }> {
    return this.invoke("send", { channelId, content }, () => ({
      id: `fake-message-${this.nextId++}`,
      message: content,
    })) as { id: string; message: string };
  }

  async fetch(id: string): Promise<FakeChannel | null> {
    return this.invoke("fetch", { id }, () => {
      const channel = this.remoteChannels.get(id) ?? null;
      if (channel) this.cache.set(id, channel);
      return channel;
    }) as FakeChannel | null;
  }

  private invoke<T extends CallResult>(operation: DiscordOperation, input: unknown, action: () => T): T {
    const failure = this.failures.get(operation)?.shift();
    const call: DiscordCall = { operation, input };
    this.calls.push(call);
    if (failure) {
      call.error = failure;
      throw new Error(failure);
    }
    try {
      call.result = action();
      return call.result as T;
    } catch (error) {
      call.error = error instanceof Error ? error.message : "unknown failure";
      throw error;
    }
  }
}

/** Safe test helper: only a durable matching ownership marker allows deletion. */
export async function deleteOwnedChannel(
  adapter: FakeDiscordAdapter,
  channel: FakeChannel,
  expected: { guildId: string; squadId: string; operationId: string },
): Promise<boolean> {
  if (!channel.id || !expected.guildId || !expected.squadId || !expected.operationId) return false;

  const operation = adapter.getProvisioningOperation(expected.operationId);
  if (
    !operation ||
    !operation.terminalFailure ||
    operation.guildId !== expected.guildId ||
    operation.squadId !== expected.squadId ||
    operation.channelId !== channel.id
  ) return false;

  // Never trust the caller/cache representation: confirm current remote state.
  const remoteChannel = await adapter.fetch(channel.id);
  if (
    !remoteChannel ||
    remoteChannel.id !== operation.channelId ||
    remoteChannel.guildId !== operation.guildId ||
    remoteChannel.ownershipMarker !== operation.squadId ||
    remoteChannel.operationId !== operation.id
  ) return false;

  return adapter.delete(remoteChannel.id);
}
