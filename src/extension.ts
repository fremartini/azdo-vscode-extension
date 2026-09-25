// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as azdo from "./azdo";
import { PullRequestStore } from "./pullRequestStore";
import { PullRequestTreeProvider } from "./views/pullRequestTreeProvider";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  const pullRequestStore = new PullRequestStore(context.extensionUri);
  const pullRequestTreeProvider = new PullRequestTreeProvider(pullRequestStore);
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

  const refreshPullRequests = vscode.commands.registerCommand(
    "azdo-monitor.refreshPullRequests",
    () => pullRequestStore.load(),
  );

  context.subscriptions.push(
    pullRequestStore,
    pullRequestTreeProvider,
    pullRequestTreeView,
    refreshPullRequests,
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
        var result = await azdo.registerPullRequest(userInput);
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
        var result = await azdo.unregisterPullRequest(userInput);
        if (result !== null) {
          vscode.window.showInformationMessage(result);
        }
      }
    },
  );

  context.subscriptions.push(registerPullRequest, unregisterPullRequest);

  await pullRequestStore.load();
}

// This method is called when your extension is deactivated
export function deactivate() {}

/*
Pipelines:
	- Register pipeline for monitoring
	- Remove pipeline as being monitored
	- Get pipeline status (Waiting, Running, Failed)
PRs:
	- Register PR for monitoring
	- Remove PR as being monitored
	- Get PR status (No review, Waiting for author, Approved, Rejected)
	- Check for unresolved comments
	- Check for build gates failed
*/
