import * as vscode from "vscode";

/**
 * Runs `poll` every `intervalMs`. A poll that is still running when the next
 * tick fires is not overlapped; that tick is skipped.
 */
export class Poller implements vscode.Disposable {
  private readonly timer: ReturnType<typeof setInterval>;
  private inFlight = false;

  constructor(
    private readonly poll: () => Promise<void>,
    intervalMs: number,
  ) {
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  /** Polls immediately (unless a poll is already running). */
  pollNow(): Promise<void> {
    return this.tick();
  }

  private async tick(): Promise<void> {
    if (this.inFlight) {
      return;
    }
    this.inFlight = true;
    try {
      await this.poll();
    } catch (err) {
      console.error("AzDO Monitor: poll failed", err);
    } finally {
      this.inFlight = false;
    }
  }

  dispose(): void {
    clearInterval(this.timer);
  }
}
