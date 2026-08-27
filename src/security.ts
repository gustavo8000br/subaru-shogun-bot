export const MAX_EXTERNAL_MESSAGE_LENGTH = 1_500;

export function normalizeExternalText(value: string, maxLength = MAX_EXTERNAL_MESSAGE_LENGTH): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export class SlidingWindowRateLimiter {
  private readonly events = new Map<string, number[]>();

  constructor(private readonly maxEvents: number, private readonly windowMs: number) {}

  public allow(key: string): boolean {
    const now = Date.now();
    const recent = (this.events.get(key) ?? []).filter((timestamp) => now - timestamp < this.windowMs);
    if (recent.length >= this.maxEvents) {
      this.events.set(key, recent);
      return false;
    }
    recent.push(now);
    this.events.set(key, recent);
    return true;
  }
}