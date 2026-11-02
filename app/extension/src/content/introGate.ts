/** How long the "Take a breath" screen stays up before the interviewer may speak. */
export const MIN_CALM_MS = 5000;

/**
 * Holds socket messages while closed so the opening audio is never played during the calm
 * screen and never lost. Once opened, messages pass straight through.
 */
export class IntroGate<T> {
  private held: T[] = [];
  private open_ = false;

  /** Returns true when the message was held; false when the caller should handle it now. */
  offer(msg: T): boolean {
    if (this.open_) return false;
    this.held.push(msg);
    return true;
  }

  /** Opens the gate and hands back the held messages in arrival order, exactly once. */
  open(): T[] {
    this.open_ = true;
    const drained = this.held;
    this.held = [];
    return drained;
  }

  get isOpen(): boolean {
    return this.open_;
  }
}
