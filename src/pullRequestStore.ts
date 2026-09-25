import * as vscode from "vscode";
import { PullRequest, PullRequestStatus } from "./models/pullRequest";

type PullRequestKey = Pick<PullRequest, "Organization" | "Project" | "Repository" | "Id">;

/**
 * In-memory state of tracked pull requests. The tree view listens to
 * `onDidChange`, so every change here is reflected in the UI.
 */
export class PullRequestStore implements vscode.Disposable {
  private pullRequests: PullRequest[] = [];
  private readonly changeEmitter = new vscode.EventEmitter<void>();

  readonly onDidChange = this.changeEmitter.event;

  getAll(): readonly PullRequest[] {
    return this.pullRequests;
  }

  /** Replaces the tracked pull requests and refreshes the UI. */
  set(pullRequests: readonly PullRequest[]): void {
    this.pullRequests = [...pullRequests];
    this.changeEmitter.fire();
  }

  /**
   * Starts tracking a pull request and refreshes the UI. If it is already
   * tracked, its entry is updated (e.g. a new Status) and false is returned.
   */
  add(pr: PullRequest): boolean {
    const index = this.pullRequests.findIndex((existing) => isSamePullRequest(existing, pr));
    if (index === -1) {
      this.set([...this.pullRequests, pr]);
      return true;
    }
    this.set(this.pullRequests.map((existing, i) => (i === index ? pr : existing)));
    return false;
  }

  /**
   * Updates the status of a tracked pull request. Does nothing (and returns
   * false) if it is no longer tracked or the status is unchanged, so a poll
   * can't re-add a PR removed mid-flight or trigger needless UI refreshes.
   */
  updateStatus(pr: PullRequestKey, status: PullRequestStatus): boolean {
    const existing = this.pullRequests.find((candidate) => isSamePullRequest(candidate, pr));
    if (!existing || existing.Status === status) {
      return false;
    }
    this.set(
      this.pullRequests.map((candidate) =>
        candidate === existing ? { ...candidate, Status: status } : candidate,
      ),
    );
    return true;
  }

  /** Stops tracking a pull request. Returns false if it was not tracked. */
  remove(pr: PullRequestKey): boolean {
    const remaining = this.pullRequests.filter((existing) => !isSamePullRequest(existing, pr));
    if (remaining.length === this.pullRequests.length) {
      return false;
    }
    this.set(remaining);
    return true;
  }

  dispose(): void {
    this.changeEmitter.dispose();
  }
}

let sharedStore: PullRequestStore | undefined;

/** Creates the store the UI is bound to. Called once from `activate()`. */
export function initPullRequestStore(): PullRequestStore {
  sharedStore = new PullRequestStore();
  return sharedStore;
}

/**
 * Returns the store the UI is bound to. Use this rather than constructing a
 * new `PullRequestStore`, otherwise changes won't reach the tree view.
 */
export function getPullRequestStore(): PullRequestStore {
  if (!sharedStore) {
    throw new Error("PullRequestStore is not initialised; the extension has not activated yet.");
  }
  return sharedStore;
}

/** Azure DevOps names are case-insensitive. */
function isSamePullRequest(a: PullRequestKey, b: PullRequestKey): boolean {
  return (
    a.Organization.toLowerCase() === b.Organization.toLowerCase() &&
    a.Project.toLowerCase() === b.Project.toLowerCase() &&
    a.Repository.toLowerCase() === b.Repository.toLowerCase() &&
    a.Id === b.Id
  );
}
