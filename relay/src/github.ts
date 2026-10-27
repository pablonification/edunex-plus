// The relay's one door to GitHub: open an issue, read one, change its text, comment on it. Its
// token can do nothing else (a fine-grained token for this repository's issues, docs/relay.md).

export interface Issue {
  number: number;
  url: string;
}

/** An issue as it is now: its text (the maintainer may have edited it), and whether it's closed. */
export interface IssueNow {
  body: string;
  closedAt: number | null;
  /** Why it was closed: "completed", "not_planned", … */
  reason: string | null;
}

export interface GitHub {
  open(issue: { title: string; body: string; labels: string[] }): Promise<Issue>;
  read(number: number): Promise<IssueNow>;
  edit(number: number, body: string): Promise<void>;
  comment(number: number, body: string): Promise<void>;
}

/** GitHub didn't do it. Try again later, unless the issue is `gone` (deleted). */
export class GitHubError extends Error {
  readonly status: number | null;

  constructor(status: number | null, message: string) {
    super(message);
    this.status = status;
  }

  get gone(): boolean {
    return this.status === 404 || this.status === 410;
  }
}

/** GitHub's REST API for one repository ("owner/name"). */
export function gitHubApi({ repo, token, api = "https://api.github.com" }: { repo: string; token: string; api?: string }): GitHub {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${api}/repos/${repo}${path}`, {
        method,
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "user-agent": "edunex-plus-relay",
          "x-github-api-version": "2022-11-28",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new GitHubError(null, `GitHub didn't answer ${method} ${path}: ${String(error)}`);
    }
    if (!response.ok)
      throw new GitHubError(response.status, `GitHub answered ${response.status} to ${method} ${path}: ${(await response.text()).slice(0, 200)}`);
    return (await response.json()) as T;
  }

  return {
    async open(issue) {
      const opened = await call<{ number: number; html_url: string }>("POST", "/issues", issue);
      return { number: opened.number, url: opened.html_url };
    },
    async read(number) {
      const issue = await call<{ body: string | null; closed_at: string | null; state_reason: string | null }>("GET", `/issues/${number}`);
      return { body: issue.body ?? "", closedAt: issue.closed_at ? Date.parse(issue.closed_at) : null, reason: issue.state_reason };
    },
    async edit(number, body) {
      await call("PATCH", `/issues/${number}`, { body });
    },
    async comment(number, body) {
      await call("POST", `/issues/${number}/comments`, { body });
    },
  };
}
