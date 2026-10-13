#!/usr/bin/env bash
# Posts a pull request comment, or updates the one posted before under the same
# key, so each check keeps one comment that follows the pull request instead of
# adding a new one on every push.
#
#   GH_TOKEN=... GITHUB_REPOSITORY=owner/repo bash scripts/ci/sticky-comment.sh <pr-number> <key> <body-file>
set -euo pipefail

pr=$1
key=$2
body_file=$3
marker="<!-- edunex-plus:${key} -->"
body="${marker}
$(cat "$body_file")"

ids=$(gh api --paginate "repos/${GITHUB_REPOSITORY}/issues/${pr}/comments" \
  --jq ".[] | select(.user.login == \"github-actions[bot]\" and (.body | startswith(\"${marker}\"))) | .id")
id=${ids%%$'\n'*}

if [ -n "$id" ]; then
  gh api --method PATCH "repos/${GITHUB_REPOSITORY}/issues/comments/${id}" -f body="$body" > /dev/null
else
  gh api --method POST "repos/${GITHUB_REPOSITORY}/issues/${pr}/comments" -f body="$body" > /dev/null
fi
