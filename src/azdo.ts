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

  const added = store.add({ ...azDoUrl, Status: status.value });
  const label = `${azDoUrl.Repository} #${azDoUrl.Id}`;
  return added ? `Now tracking ${label}` : `${label} is already tracked`;
}

export async function unregisterPullRequest(
  input: string,
  store: PullRequestStore,
): Promise<string | null> {
  var azDoUrl = parseAzureDevOpsPullRequestUrl(input);

  if (azDoUrl === null) {
    return "Invalid Azure DevOps format";
  }

  const label = `${azDoUrl.Repository} #${azDoUrl.Id}`;
  return store.remove(azDoUrl)
    ? `Stopped tracking ${label}`
    : `${label} is not tracked`;
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

/** Subset of the Azure DevOps GitPullRequest response that we use. */
interface AzdoPullRequest {
  reviewers?: { vote: number }[];
}

/**
 * Collapses reviewer votes into one status, most blocking first.
 * Azure DevOps votes: 10 approved, 5 approved with suggestions,
 * 0 no vote, -5 waiting for author, -10 rejected.
 */
function toStatus(pr: AzdoPullRequest): models.PullRequestStatus {
  const votes = (pr.reviewers ?? []).map((r) => r.vote);
  if (votes.includes(-10)) {
    return "Rejected";
  }
  if (votes.includes(-5)) {
    return "WaitingForAuthor";
  }
  if (votes.includes(10)) {
    return "Approved";
  }
  if (votes.includes(5)) {
    return "ApprovedWithSuggestions";
  }
  return "NoReview";
}

async function getPullRequestStatus(
  organization: string,
  project: string,
  repositoryId: string,
  pullrequestId: string,
): Promise<Result<models.PullRequestStatus, string>> {
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
    value: toStatus((await response.json()) as AzdoPullRequest),
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
