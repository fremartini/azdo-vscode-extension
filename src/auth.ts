import * as vscode from "vscode";

/** Azure DevOps' well-known Entra ID resource id. */
const AZDO_SCOPE = "499b84ac-1321-427f-aa17-267ca6975798/.default";

export const SIGN_IN_COMMAND = "azdo-monitor.signIn";

function getScopes(): string[] {
  const tenantId = vscode.workspace
    .getConfiguration("azdoMonitor")
    .get<string>("tenantId", "")
    .trim();
  // VSCODE_TENANT picks the tenant when an account belongs to several.
  return tenantId ? [AZDO_SCOPE, `VSCODE_TENANT:${tenantId}`] : [AZDO_SCOPE];
}

/**
 * Returns an Entra ID access token for Azure DevOps via VS Code's built-in
 * Microsoft account provider, or undefined when no token is available.
 *
 * `interactive` may show the sign-in prompt; use it only for user-initiated
 * actions. Background work (polling) must stay silent.
 */
export async function getAzdoAccessToken(interactive: boolean): Promise<string | undefined> {
  try {
    const session = await vscode.authentication.getSession(
      "microsoft",
      getScopes(),
      interactive ? { createIfNone: true } : { silent: true },
    );
    return session?.accessToken;
  } catch {
    // The user cancelled or dismissed the sign-in prompt.
    return undefined;
  }
}

export function notSignedInMessage(): string {
  return "Not signed in to Azure DevOps. Run 'AzDO Monitor: Sign in to Azure DevOps'.";
}
