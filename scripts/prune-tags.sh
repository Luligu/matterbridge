#!/usr/bin/env bash
set -euo pipefail

KEEP_PREFIX="${1:-}"
REMOTE="${2:-origin}"

if [[ -z "$KEEP_PREFIX" ]]; then
  echo "Usage: $0 <tag-prefix-to-keep> [remote]"
  echo "Example: $0 2. origin"
  exit 1
fi

echo "Keeping tags starting with: '$KEEP_PREFIX'"
echo "Remote: $REMOTE"
echo

# Escape prefix for regex (so '2.' means literal dot, not "any char")
KEEP_PREFIX_REGEX="$(printf '%s' "$KEEP_PREFIX" | sed 's/[][(){}.^$*+?|\\/]/\\&/g')"

REMOTE_TAGS="$(
  git ls-remote --tags "$REMOTE" \
    | awk '{print $2}' \
    | sed 's#refs/tags/##' \
    | sed 's/\^{}//' \
    | sort -u
)"

if [[ -z "$REMOTE_TAGS" ]]; then
  echo "No tags found on remote '$REMOTE'."
  exit 0
fi

TAGS_TO_DELETE="$(
  printf '%s\n' "$REMOTE_TAGS" \
    | grep -vE "^${KEEP_PREFIX_REGEX}" || true
)"

if [[ -z "$TAGS_TO_DELETE" ]]; then
  echo "No tags to delete. All remote tags already match prefix '$KEEP_PREFIX'."
  echo
  echo "Remote tags:"
  printf '%s\n' "$REMOTE_TAGS"
  exit 0
fi

echo "Tags to delete:"
printf '%s\n' "$TAGS_TO_DELETE"
echo

read -r -p "Proceed? [y/N] " CONFIRM
if [[ "${CONFIRM:-}" != "y" && "${CONFIRM:-}" != "Y" ]]; then
  echo "Aborted."
  exit 1
fi

echo
echo "Deleting remote tags..."
printf '%s\n' "$TAGS_TO_DELETE" | xargs -r -n 50 git push "$REMOTE" --delete tag

echo
echo "Pruning local tags from remote..."
git fetch --prune --prune-tags

echo
echo "Deleting local tags (if present)..."
printf '%s\n' "$TAGS_TO_DELETE" | xargs -r git tag -d || true

echo
echo "Expiring reflogs and running GC..."
git reflog expire --expire=now --all
git gc --prune=now

echo
echo "Done. Remaining local tags:"
git tag
