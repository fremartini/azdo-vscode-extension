export type PullRequestStatus =
  | "Approved"
  | "ApprovedWithSuggestions"
  | "WaitingForAuthor"
  | "Rejected"
  | "NoReview";

export interface PullRequest {
  Organization: string;
  Project: string;
  Repository: string;
  Id: string;
  /** Approval status. When absent (or unrecognised) the default icon is shown. */
  Status?: PullRequestStatus;
}

export function pullRequestUrl(pr: PullRequest): string {
  const segments = [pr.Organization, pr.Project, "_git", pr.Repository, "pullrequest", pr.Id];
  return `https://dev.azure.com/${segments.map(encodeURIComponent).join("/")}`;
}
