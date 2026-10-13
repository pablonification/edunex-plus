## Agent skills

### Issue tracker

Issues and specs live in this repo's GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Pull requests

- Titles are Conventional Commits in plain words that say why the change matters for the student
  (`fix(presence): say the day an attendance window closes`). Pull requests are squash-merged, so the
  title becomes the commit on `main`.
- The body follows `.github/pull_request_template.md`: outcome, why (the problem, then the fix), before
  and after for anything on screen (the same state, light and dark, from the demo), verification, risk.
- Tools are not authors: no `Co-authored-by`, "Generated with" or similar line naming an AI tool, in
  commits or pull requests.
