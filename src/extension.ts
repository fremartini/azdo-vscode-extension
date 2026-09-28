import * as vscode from "vscode";
import { getAzdoAccessToken, SIGN_IN_COMMAND } from "./auth";
import * as azdo from "./azdo";
import { PollStatus } from "./pollStatus";
import { Poller } from "./pullRequestPoller";
import { initPullRequestStore } from "./pullRequestStore";
import { PullRequestTreeProvider } from "./views/pullRequestTreeProvider";
import { PullRequest } from "./models/pullRequest";

const PULL_REQUEST_POLL_INTERVAL_MS = 30_000;
const SAVED_PULL_REQUEST_KEY = "trackedPullRequests";

export async function activate(context: vscode.ExtensionContext) {
  console.log("activating extension AzDOMonitor");

  const addToStore = async (pr: PullRequest[]) =>
    await context.globalState.update(
      SAVED_PULL_REQUEST_KEY,
      JSON.stringify(pr),
    );
  const readFromStore = () => {
    const trackedPullRequests = context.globalState.get(SAVED_PULL_REQUEST_KEY);
    return JSON.parse((trackedPullRequests as string) ?? "[]");
  };

  const pullRequestStore = initPullRequestStore(addToStore, readFromStore);
  const pollStatus = new PollStatus(PULL_REQUEST_POLL_INTERVAL_MS);

  const pullRequestTreeProvider = new PullRequestTreeProvider(
    pullRequestStore,
    pollStatus,
  );

  const pullRequestTreeView = vscode.window.createTreeView(
    "azdoMonitor.pullRequests",
    { treeDataProvider: pullRequestTreeProvider },
  );

  const updateBadge = () => {
    const count = pullRequestStore.getAll().length;
    pullRequestTreeView.badge = count
      ? { value: count, tooltip: `${count} tracked pull request(s)` }
      : undefined;
  };

  pullRequestStore.onDidChange(updateBadge);

  const pullRequestPoller = new Poller(
    () =>
      pollStatus.track(() => azdo.refreshPullRequestStatuses(pullRequestStore)),
    PULL_REQUEST_POLL_INTERVAL_MS,
  );

  const signIn = vscode.commands.registerCommand(SIGN_IN_COMMAND, async () => {
    if (await getAzdoAccessToken(true)) {
      vscode.window.showInformationMessage("Signed in to Azure DevOps.");
      await pullRequestPoller.pollNow();
    }
  });

  // A different tenant means a different token, so re-check right away.
  const tenantChange = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("azdoMonitor.tenantId")) {
      void pullRequestPoller.pollNow();
    }
  });

  context.subscriptions.push(
    pullRequestStore,
    pollStatus,
    pullRequestTreeProvider,
    pullRequestTreeView,
    pullRequestPoller,
    signIn,
    tenantChange,
  );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const registerPullRequest = vscode.commands.registerCommand(
    "azdo-monitor.registerPullRequest",
    async () => {
      const userInput = await vscode.window.showInputBox({
        prompt: "Enter a value",
        placeHolder: "Type here...",
      });

      if (userInput !== undefined) {
        var result = await azdo.registerPullRequest(
          userInput,
          pullRequestStore,
        );

        if (result !== null) {
          vscode.window.showInformationMessage(result);
        }
      }
    },
  );

  const unregisterPullRequest = vscode.commands.registerCommand(
    "azdo-monitor.unregisterPullRequest",
    async () => {
      const userInput = await vscode.window.showInputBox({
        prompt: "Enter a value",
        placeHolder: "Type here...",
      });

      if (userInput !== undefined) {
        var result = await azdo.unregisterPullRequest(
          userInput,
          pullRequestStore,
        );

        if (result !== null) {
          vscode.window.showInformationMessage(result);
        }
      }
    },
  );

  context.subscriptions.push(registerPullRequest, unregisterPullRequest);

  console.info("activated extension AzDOMonitor");
}

export function deactivate() {}
