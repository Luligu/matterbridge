#!/usr/bin/env bash
set -euo pipefail

# ./scripts/git-status.sh          # top 30 largest blobs
# ./scripts/git-status.sh 50       # top 50
# ./scripts/git-status.sh 100      # deep audit

TOP_N="${1:-30}"
REMOTE="${2:-origin}"

hr() { printf '%*s\n' "${COLUMNS:-80}" '' | tr ' ' '-'; }
section() { hr; echo "$1"; hr; }

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "Not a git repository."
  exit 1
}

# ------------------------------------------------------------------
section "Repository status"

echo "Repo:        $(basename "$(git rev-parse --show-toplevel)")"
echo "Branch:      $(git branch --show-current 2>/dev/null || echo '(detached)')"
echo "HEAD:        $(git rev-parse --short HEAD)"
echo "Dirty:       $(test -n "$(git status --porcelain)" && echo yes || echo no)"
echo "Remote:      ${REMOTE}"
echo

# ------------------------------------------------------------------
section "Object database size"

git count-objects -vH
echo

# ------------------------------------------------------------------
section "Tag reachability"

TAG_ONLY_COUNT="$(git rev-list --tags --not --branches --count 2>/dev/null || echo 0)"
echo "Tag-only commits (should be 0): ${TAG_ONLY_COUNT}"

if git remote get-url "$REMOTE" >/dev/null 2>&1; then
  REMOTE_TAG_COUNT="$(
    git ls-remote --tags "$REMOTE" \
      | awk '{print $2}' \
      | sed 's#refs/tags/##' \
      | sed 's/\^{}//' \
      | sort -u \
      | wc -l | tr -d ' '
  )"
  echo "Remote tag count (${REMOTE}): ${REMOTE_TAG_COUNT}"
else
  echo "Remote tag count: (remote not found)"
fi
echo

# ------------------------------------------------------------------
section "Integrity check (fsck)"

if git fsck --full --no-reflogs >/dev/null 2>&1; then
  echo "fsck: OK"
else
  echo "fsck: PROBLEMS FOUND"
  echo
  git fsck --full --no-reflogs
  exit 2
fi
echo

# ------------------------------------------------------------------
section "Largest blobs ever committed (history-wide, top ${TOP_N})"

git rev-list --objects --all \
  | git cat-file --batch-check='%(objecttype) %(objectsize) %(rest)' \
  | awk '$1=="blob"{print $2"\t"$3}' \
  | sort -n -r \
  | head -n "${TOP_N}" \
  | awk -F'\t' '
      BEGIN { printf "%-12s %-10s %s\n", "bytes", "human", "   path" }
      {
        b=$1; p=$2;
        hum=b; unit="B";
        if (hum>=1024){hum/=1024;unit="KB"}
        if (hum>=1024){hum/=1024;unit="MB"}
        if (hum>=1024){hum/=1024;unit="GB"}
        printf "%-12d %-10.2f %s %s\n", b, hum, unit, p
      }'
echo

# ------------------------------------------------------------------
section "Largest files in HEAD (current tree, top ${TOP_N})"

git ls-tree -r --long HEAD \
  | awk '{print $4"\t"$5}' \
  | sort -n -r \
  | head -n "${TOP_N}" \
  | awk -F'\t' '
      BEGIN { printf "%-12s %-10s %s\n", "bytes", "human", "   path" }
      {
        b=$1; p=$2;
        hum=b; unit="B";
        if (hum>=1024){hum/=1024;unit="KB"}
        if (hum>=1024){hum/=1024;unit="MB"}
        if (hum>=1024){hum/=1024;unit="GB"}
        printf "%-12d %-10.2f %s %s\n", b, hum, unit, p
      }'
echo

# ------------------------------------------------------------------
section "History summary"

PATH_COUNT="$(git rev-list --all --objects | awk 'NF==2{print $2}' | sort -u | wc -l | tr -d ' ')"
echo "Unique paths ever in history: ${PATH_COUNT}"
echo
