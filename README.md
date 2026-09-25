# AzDO Monitor

Keep an eye on your Azure DevOps pull requests without leaving VS Code. AzDO Monitor adds a sidebar view that lists the pull requests you track and shows each one's review status. The statuses refresh automatically every 30 seconds.

## Features

- **Pull Requests view.** Select the AzDO Monitor icon in the Activity Bar to see every tracked pull request as `repository #id`, with its organization and project. A badge on the icon shows how many are tracked. Hover a pull request for details, or select it to open it in Azure DevOps.
- **Review status at a glance.** The icon next to each pull request reflects the reviewers' votes. The most blocking vote wins:

  | Icon | Status |
  |---|---|
  | Red error | Rejected |
  | Yellow clock | Waiting for author |
  | Green filled check | Approved |
  | Green check | Approved with suggestions |
  | Grey circle | No review yet |

- **Automatic refresh.** Statuses are fetched from Azure DevOps every 30 seconds.
- **Freshness indicator.** The row at the top of the view shows whether the data is current: *Up to date*, *Updating…*, *Some updates failed*, *Update failed* or *Out of date* (no successful update for over a minute). The time of the last successful update appears next to it. Hover the row for the full timestamp and the reason for any failure.
- **No personal access tokens.** The extension signs in with your Microsoft Entra ID account through VS Code's built-in Microsoft sign-in, so there is no secret to create or store.

## Requirements

- VS Code 1.138 or later.
- An Azure DevOps organization connected to Microsoft Entra ID (most work or school organizations). Organizations that use personal Microsoft accounts are not supported.
- Read access to the repositories whose pull requests you want to track.

## Usage

1. **Track a pull request.** Select **+** in the Pull Requests view (or run **Register Pull Request** from the Command Palette). Paste the pull request URL, for example:

   ```
   https://dev.azure.com/{organization}/{project}/_git/{repository}/pullrequest/{id}
   ```

   The first time, VS Code asks you to sign in with your Microsoft account.
2. **Stop tracking a pull request.** Run **Unregister Pull Request** from the Command Palette and paste the same URL.
3. **Sign in again.** If the view shows *Not signed in*, run **AzDO Monitor: Sign in to Azure DevOps**. Background refreshes never show a sign-in prompt on their own.

The tracked list is kept in memory, so it starts empty each time VS Code starts.

## Extension settings

| Setting | Description |
|---|---|
| `azdoMonitor.tenantId` | Optional. The Microsoft Entra tenant (a GUID or a domain like `contoso.onmicrosoft.com`) to sign in to. Leave it empty to use your account's default tenant. Set it when your account belongs to several tenants and requests fail with *Access denied*. |

## Build and install

You build the extension into a `.vsix` file, which you can install or share with your team.

### Build the package

```
npm install
npm run package
```

This compiles the extension and creates `azdo-monitor-<version>.vsix` in the project folder.

### Install it

Either run:

```
code --install-extension azdo-monitor-0.0.1.vsix
```

or open the Extensions view, select **…** > **Install from VSIX…**, and pick the file. Reload VS Code afterwards.

To share the extension, send the `.vsix` file to colleagues and have them install it the same way. When you release a new build, increase `version` in `package.json` before packaging. To remove the extension, uninstall **AzDO Monitor** from the Extensions view.

## Development

- `npm run watch` recompiles on every change.
- Press **F5** to launch an Extension Development Host with the extension loaded. If the host starts but the extension never activates (the log shows *Extension host did not start in 10 seconds*), the debugger failed to attach. Use **Ctrl+F5** (Run Without Debugging) instead.
- After changing code, run **Developer: Reload Window** in the development host to pick up the new build.
- `npm run lint` checks the code.
