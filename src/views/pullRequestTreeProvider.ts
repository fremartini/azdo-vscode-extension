import * as vscode from "vscode";
import {
  PullRequest,
  PullRequestStatus,
  pullRequestUrl,
} from "../models/pullRequest";
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

export class PullRequestTreeProvider
  implements vscode.TreeDataProvider<PullRequest>, vscode.Disposable
{
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private readonly storeSubscription: vscode.Disposable;

  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(private readonly store: PullRequestStore) {
    this.storeSubscription = store.onDidChange(() => this.changeEmitter.fire());
  }

  getChildren(element?: PullRequest): PullRequest[] {
    if (element) {
      return [];
    }
    return [...this.store.getAll()].sort(
      (a, b) =>
        a.Organization.localeCompare(b.Organization) ||
        a.Project.localeCompare(b.Project) ||
        a.Repository.localeCompare(b.Repository) ||
        a.Id.localeCompare(b.Id, undefined, { numeric: true }),
    );
  }

  getTreeItem(pr: PullRequest): vscode.TreeItem {
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
    this.storeSubscription.dispose();
    this.changeEmitter.dispose();
  }
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
