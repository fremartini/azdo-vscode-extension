import * as vscode from "vscode";
import { PullRequest } from "./models/pullRequest";

/**
 * In-memory state of tracked pull requests. Currently loaded from the bundled
 * data/pullRequests.json; the backend can later feed it via `set()`.
 */
export class PullRequestStore implements vscode.Disposable {
  private pullRequests: PullRequest[] = [];
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private readonly watcher: vscode.FileSystemWatcher;
  private readonly fileUri: vscode.Uri;

  readonly onDidChange = this.changeEmitter.event;

  constructor(extensionUri: vscode.Uri) {
    this.fileUri = vscode.Uri.joinPath(extensionUri, "data", "pullRequests.json");
    this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(extensionUri, "data/pullRequests.json"),
    );
    this.watcher.onDidChange(() => this.load());
    this.watcher.onDidCreate(() => this.load());
    this.watcher.onDidDelete(() => this.set([]));
  }

  getAll(): readonly PullRequest[] {
    return this.pullRequests;
  }

  set(pullRequests: PullRequest[]): void {
    this.pullRequests = pullRequests;
    this.changeEmitter.fire();
  }
  async load(): Promise<void> {
    let raw: unknown;
    try {
      const bytes = await vscode.workspace.fs.readFile(this.fileUri);
      raw = JSON.parse(new TextDecoder().decode(bytes));
    } catch (err) {
      vscode.window.showWarningMessage(
        `AzDO Monitor: could not read pull requests (${err instanceof Error ? err.message : String(err)}).`,
      );
      return;
    }

    if (!Array.isArray(raw)) {
      vscode.window.showWarningMessage(
        "AzDO Monitor: pullRequests.json must contain an array.",
      );
      return;
    }

    const valid = raw.filter(isPullRequest);
    if (valid.length < raw.length) {
      vscode.window.showWarningMessage(
        `AzDO Monitor: skipped ${raw.length - valid.length} pull request(s) missing Organization, Project, Repository or Id (all must be strings).`,
      );
    }
    this.set(valid);
  }

  dispose(): void {
    this.watcher.dispose();
    this.changeEmitter.dispose();
  }
}

function isPullRequest(value: unknown): value is PullRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const pr = value as Record<string, unknown>;
  return (
    typeof pr.Organization === "string" &&
    typeof pr.Project === "string" &&
    typeof pr.Repository === "string" &&
    typeof pr.Id === "string"
  );
}
