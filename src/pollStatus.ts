import * as vscode from "vscode";
import { PullRequest } from "./models/pullRequest";

export interface PollFailure {
  pr: PullRequest;
  error: string;
}

export interface PollResult {
  total: number;
  failures: PollFailure[];
}

export type PollState =
  | "Pending" // no poll has completed yet
  | "Updating"
  | "UpToDate"
  | "PartiallyFailed"
  | "Failed"
  | "Stale"; // no successful poll for too long (missed or hung polls)

/**
 * Tracks the outcome of status polling so the UI can show when data was last
 * fetched and whether it can be trusted.
 */
export class PollStatus implements vscode.Disposable {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private staleTimer: ReturnType<typeof setTimeout> | undefined;
  private updating = false;

  lastAttempt: Date | undefined;
  lastSuccess: Date | undefined;
  failures: PollFailure[] = [];
  error: string | undefined;

  readonly onDidChange = this.changeEmitter.event;

  constructor(readonly intervalMs: number) {}

  /** Data older than this is considered out of date (allows one missed poll plus slack). */
  get staleAfterMs(): number {
    return this.intervalMs * 2 + 5_000;
  }

  get state(): PollState {
    if (this.updating) {
      return "Updating";
    }
    if (!this.lastAttempt) {
      return "Pending";
    }
    if (!this.lastSuccess || Date.now() - this.lastSuccess.getTime() > this.staleAfterMs) {
      return this.error || this.failures.length ? "Failed" : "Stale";
    }
    if (this.error) {
      return "Failed";
    }
    if (this.failures.length) {
      return "PartiallyFailed";
    }
    return "UpToDate";
  }

  /** Wraps a poll so its start, outcome and timing are recorded. */
  async track(poll: () => Promise<PollResult>): Promise<void> {
    this.updating = true;
    this.changeEmitter.fire();
    try {
      const result = await poll();
      this.lastAttempt = new Date();
      this.failures = result.failures;
      this.error =
        result.total > 0 && result.failures.length === result.total
          ? "Every pull request failed to update."
          : undefined;
      if (!this.error) {
        this.lastSuccess = this.lastAttempt;
      }
    } catch (err) {
      this.lastAttempt = new Date();
      this.failures = [];
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.updating = false;
      this.scheduleStaleCheck();
      this.changeEmitter.fire();
    }
  }

  /** Re-renders once the data turns stale, even if no further poll completes. */
  private scheduleStaleCheck(): void {
    clearTimeout(this.staleTimer);
    if (this.lastSuccess) {
      const dueIn = this.lastSuccess.getTime() + this.staleAfterMs - Date.now();
      this.staleTimer = setTimeout(() => this.changeEmitter.fire(), Math.max(dueIn, 0) + 100);
    }
  }

  dispose(): void {
    clearTimeout(this.staleTimer);
    this.changeEmitter.dispose();
  }
}
