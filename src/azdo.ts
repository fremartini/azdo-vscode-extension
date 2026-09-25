import * as models from "./models/pullRequest";
import { PullRequestStore } from "./pullRequestStore";

interface Repository {
  id: string;
  name: string;
}

export async function registerPullRequest(
  input: string,
  store: PullRequestStore,
): Promise<string | null> {
  const azDoUrl = parseAzureDevOpsPullRequestUrl(input);

  if (azDoUrl === null) {
    return "Invalid Azure DevOps format";
  }

  const repositories: Result<Repository[], string> = await getRepositories(
    azDoUrl.Organization,
    azDoUrl.Project,
  );

  if (!repositories.ok) {
    return repositories.error;
  }

  const repo = repositories.value.find((r) => r.name === azDoUrl.Repository);

  if (!repo) {
    return `could not find repository with name ${azDoUrl.Repository}`;
  }

  const status = await getPullRequestStatus(
    azDoUrl.Organization,
    azDoUrl.Project,
    repo.id,
    azDoUrl.Id,
  );

  if (!status.ok) {
    return status.error;
  }

  return null;
}

export async function unregisterPullRequest(
  input: string,
  store: PullRequestStore,
): Promise<string | null> {
  var azDoUrl = parseAzureDevOpsPullRequestUrl(input);

  if (azDoUrl === null) {
    return "Invalid Azure DevOps format";
  }

  return null;
}

const PAT = "";

type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

async function getRepositories(
  organization: string,
  project: string,
): Promise<Result<Repository[], string>> {
  const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories?api-version=7.1`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${PAT}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      error: response.statusText as string,
    };
  }

  const repositories = (await response.json()) as {
    count: number;
    value: Repository[];
  };

  return { ok: true, value: repositories.value };
}

async function getPullRequestStatus(
  organization: string,
  project: string,
  repositoryId: string,
  pullrequestId: string,
): Promise<Result<models.PullRequest, string>> {
  const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repositoryId}/pullrequests/${pullrequestId}?api-version=7.1`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${PAT}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      error: response.statusText,
    };
  }

  return {
    ok: true,
    value: (await response.json()) as models.PullRequest,
  };
}

function parseAzureDevOpsPullRequestUrl(
  url: string,
): models.PullRequest | null {
  const pattern =
    /^https:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)\/pullrequest\/(\d+)\/?$/i;
  const match = url.match(pattern);

  if (!match) {
    return null;
  }

  const [, organization, project, repository, id] = match;

  return {
    Organization: decodeURIComponent(organization),
    Project: decodeURIComponent(project),
    Repository: decodeURIComponent(repository),
    Id: id,
  };
}
