import * as vscode from "vscode";
import {
  PullRequest,
  PullRequestStatus,
  pullRequestUrl,
} from "../models/pullRequest";
import { PollState, PollStatus } from "../pollStatus";
import { PullRequestStore } from "../pullRequestStore";

interface StatusStyle {
  label: string;
  icon: string;
  color: string;
}

const DEFAULT_STYLE: StatusStyle = {
  label: "No status",
  icon: "git-pull-request",
  color: "charts.blue",
};

const STATUS_STYLES: Record<PullRequestStatus, StatusStyle> = {
  Approved: { label: "Approved", icon: "pass-filled", color: "testing.iconPassed" },
  ApprovedWithSuggestions: {
    label: "Approved with suggestions",
    icon: "pass",
    color: "testing.iconPassed",
  },
  WaitingForAuthor: {
    label: "Waiting for author",
    icon: "clock",
    color: "charts.yellow",
  },
  Rejected: { label: "Rejected", icon: "error", color: "testing.iconFailed" },
  NoReview: {
    label: "No review",
    icon: "circle-large-outline",
    color: "descriptionForeground",
  },
};

function statusStyle(pr: PullRequest): StatusStyle {
  return (pr.Status && STATUS_STYLES[pr.Status]) || DEFAULT_STYLE;
}

/** Sentinel for the poll status row pinned to the top of the tree. */
const POLL_STATUS_NODE = { kind: "pollStatus" } as const;
type Node = PullRequest | typeof POLL_STATUS_NODE;

const POLL_STATE_STYLES: Record<PollState, StatusStyle> = {
  Pending: { label: "Waiting for first update", icon: "history", color: "descriptionForeground" },
  Updating: { label: "Updating…", icon: "sync~spin", color: "descriptionForeground" },
  UpToDate: { label: "Up to date", icon: "check", color: "testing.iconPassed" },
  PartiallyFailed: { label: "Some updates failed", icon: "warning", color: "list.warningForeground" },
  Failed: { label: "Update failed", icon: "error", color: "testing.iconFailed" },
  Stale: { label: "Out of date", icon: "warning", color: "list.warningForeground" },
};

export class PullRequestTreeProvider
  implements vscode.TreeDataProvider<Node>, vscode.Disposable
{
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private readonly subscriptions: vscode.Disposable[];

  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(
    private readonly store: PullRequestStore,
    private readonly pollStatus: PollStatus,
  ) {
    this.subscriptions = [
      store.onDidChange(() => this.changeEmitter.fire()),
      pollStatus.onDidChange(() => this.changeEmitter.fire()),
    ];
  }

  getChildren(element?: Node): Node[] {
    if (element) {
      return [];
    }
    const pullRequests = [...this.store.getAll()].sort(
      (a, b) =>
        a.Organization.localeCompare(b.Organization) ||
        a.Project.localeCompare(b.Project) ||
        a.Repository.localeCompare(b.Repository) ||
        a.Id.localeCompare(b.Id, undefined, { numeric: true }),
    );
    // With nothing tracked the tree stays empty so the welcome view shows.
    return pullRequests.length ? [POLL_STATUS_NODE, ...pullRequests] : [];
  }

  getTreeItem(node: Node): vscode.TreeItem {
    return node === POLL_STATUS_NODE
      ? this.getPollStatusItem()
      : this.getPullRequestItem(node as PullRequest);
  }

  private getPollStatusItem(): vscode.TreeItem {
    const status = this.pollStatus;
    const style = POLL_STATE_STYLES[status.state];
    const item = new vscode.TreeItem(style.label);
    item.iconPath = new vscode.ThemeIcon(style.icon, new vscode.ThemeColor(style.color));
    item.description = status.lastSuccess ? formatTime(status.lastSuccess) : undefined;
    item.tooltip = buildPollStatusTooltip(status, style);
    item.contextValue = "pollStatus";
    return item;
  }

  private getPullRequestItem(pr: PullRequest): vscode.TreeItem {
    const url = pullRequestUrl(pr);
    const item = new vscode.TreeItem(`${pr.Repository} #${pr.Id}`);
    item.description = `${pr.Organization} / ${pr.Project}`;
    const style = statusStyle(pr);
    item.iconPath = new vscode.ThemeIcon(style.icon, new vscode.ThemeColor(style.color));
    item.tooltip = buildTooltip(pr, url, style);
    item.contextValue = "pullRequest";
    item.command = {
      command: "vscode.open",
      title: "Open Pull Request",
      arguments: [vscode.Uri.parse(url)],
    };
    return item;
  }

  dispose(): void {
    this.subscriptions.forEach((s) => s.dispose());
    this.changeEmitter.dispose();
  }
}

function buildPollStatusTooltip(status: PollStatus, style: StatusStyle): vscode.MarkdownString {
  const md = new vscode.MarkdownString(undefined, true);
  md.appendMarkdown(`$(${style.icon.replace("~spin", "")}) **${style.label}**\n\n`);
  md.appendMarkdown(
    `$(check) Last successful update: ${status.lastSuccess ? formatTime(status.lastSuccess, true) : "never"}\n\n`,
  );
  if (status.lastAttempt && status.lastAttempt !== status.lastSuccess) {
    md.appendMarkdown(`$(history) Last attempt: ${formatTime(status.lastAttempt, true)}\n\n`);
  }
  if (status.state === "Stale") {
    md.appendMarkdown(
      `$(warning) No successful update in over ${Math.round(status.staleAfterMs / 1000)} seconds; polling may have stalled.\n\n`,
    );
  }
  if (status.error) {
    md.appendMarkdown(`$(error) ${escape(status.error)}\n\n`);
  }
  if (status.failures.length) {
    md.appendMarkdown(`Could not update:\n\n`);
    for (const { pr, error } of status.failures) {
      md.appendMarkdown(`- ${escape(`${pr.Repository} #${pr.Id}`)}: ${escape(error)}\n`);
    }
    md.appendMarkdown("\n");
  }
  md.appendMarkdown(`_Polling every ${Math.round(status.intervalMs / 1000)} seconds_`);
  return md;
}

/** Time of day, plus the date when it isn't today (or when `withDate` is set). */
function formatTime(date: Date, withDate = false): string {
  const time = date.toLocaleTimeString();
  const isToday = date.toDateString() === new Date().toDateString();
  return withDate || !isToday ? `${date.toLocaleDateString()} ${time}` : time;
}

function buildTooltip(
  pr: PullRequest,
  url: string,
  style: StatusStyle,
): vscode.MarkdownString {
  const md = new vscode.MarkdownString(undefined, true);
  md.appendMarkdown(`$(git-pull-request) **Pull Request #${escape(pr.Id)}**\n\n`);
  md.appendMarkdown(`$(${style.icon}) ${style.label}\n\n`);
  md.appendMarkdown(`$(organization) ${escape(pr.Organization)}\n\n`);
  md.appendMarkdown(`$(project) ${escape(pr.Project)}\n\n`);
  md.appendMarkdown(`$(repo) ${escape(pr.Repository)}\n\n`);
  md.appendMarkdown(`[Open in Azure DevOps](${url})`);
  return md;
}

function escape(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!|<>]/g, "\\$&");
}
