interface PullRequest {
  Organization: string;
  Project: string;
  Repository: string;
  Id: string;
}

interface Repository {
  Id: string;
  Name: string;
}

export async function registerPullRequest(
  input: string,
): Promise<string | null> {
  const azDoUrl = parseAzureDevOpsPullRequestUrl(input);

  if (azDoUrl === null) {
    return "Invalid Azure DevOps format";
  }

  const repositories = await getRepositories(
    azDoUrl.Organization,
    azDoUrl.Project,
  );

  if (!repositories.ok) {
    return repositories.error;
  }

  const repo = repositories.value.find((r) => r.Name === azDoUrl.Repository);

  if (!repo) {
    return `could not find repository with name ${azDoUrl.Repository}`;
  }

  const status = await getPullRequestStatus(
    azDoUrl.Organization,
    azDoUrl.Project,
    repo.Id,
    azDoUrl.Id,
  );

  console.log(status);

  return null;
}

// https://dev.azure.com/hmanagedcloud/AzurePlatform/_git/hmc-az-image-factory/pullrequest/15317

export async function unregisterPullRequest(
  input: string,
): Promise<string | null> {
  var azDoUrl = parseAzureDevOpsPullRequestUrl(input);

  if (azDoUrl === null) {
    return "Invalid Azure DevOps format";
  }

  console.log(azDoUrl.Id);
  console.log(azDoUrl.Organization);
  console.log(azDoUrl.Project);
  console.log(azDoUrl.Repository);

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

  return {
    ok: true,
    value: (await response.json()) as Repository[],
  };
}

async function getPullRequestStatus(
  organization: string,
  project: string,
  repositoryId: string,
  pullrequestId: string,
): Promise<string | string> {
  const url = `https://dev.azure.com/${organization}/${project}/_apis/git/${repositoryId}/pullrequests/${pullrequestId}?api-version=7.1`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${PAT}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return response.statusText as string;
  }

  return (await response.json()) as string;
}

function parseAzureDevOpsPullRequestUrl(url: string): PullRequest | null {
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
