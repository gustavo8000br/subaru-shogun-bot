/** Deterministic wall clock for tests; advancing it never waits on real time. */
export class ControlledClock {
  private instant: number;

  constructor(start: Date | number) {
    this.instant = start instanceof Date ? start.getTime() : start;
    if (!Number.isFinite(this.instant)) throw new RangeError("Clock start must be a valid instant");
  }

  now(): Date {
    return new Date(this.instant);
  }

  advance(milliseconds: number): Date {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new RangeError("Clock can only advance by a non-negative finite duration");
    }
    this.instant += milliseconds;
    return this.now();
  }
}
