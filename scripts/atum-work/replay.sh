#!/usr/bin/env bash
set -euo pipefail

# Replay the carried commits on the previous stable, then forward over the actual upstream bump.
from=${1:-v0.1.10}
to=${2:-v0.1.11}
base=${3:-$to}
head=${4:-HEAD}
brand_map=${5:-}
repo=$(git rev-parse --show-toplevel)
head=$(git -C "$repo" rev-parse "$head")
git -C "$repo" merge-base --is-ancestor "$base" "$head"
commits=$(git -C "$repo" rev-list --reverse --ancestry-path "$base..$head")
[[ -n "$commits" ]] || { echo "No fork patches to replay." >&2; exit 1; }
scratch=$(mktemp -d)
export GIT_COMMITTER_NAME="Atum Release Engineering"
export GIT_COMMITTER_EMAIL="release-engineering@users.noreply.github.com"
trap 'git -C "$repo" worktree remove --force "$scratch/replay" 2>/dev/null || true; rmdir "$scratch"' EXIT
started=$SECONDS
git -C "$repo" worktree add --quiet --detach "$scratch/replay" "$from"
cd "$scratch/replay"
while IFS= read -r commit; do
  git -c core.hooksPath=/dev/null cherry-pick "$commit"
done <<< "$commits"
node scripts/atum-work/brand.mjs --check-identity
if [[ -n "$brand_map" ]]; then node scripts/atum-work/brand.mjs --check "$brand_map"; fi
git -c core.hooksPath=/dev/null -c rebase.updateRefs=false rebase --onto "$to" "$from"
git diff --check "$to..HEAD"
node scripts/atum-work/brand.mjs --check-identity
if [[ -n "$brand_map" ]]; then node scripts/atum-work/brand.mjs --check "$brand_map"; fi

if [[ $(git rev-parse "$base") == "$(git rev-parse "$to")" ]]; then
  test "$(git rev-parse HEAD^{tree})" = "$(git rev-parse "$head^{tree}")"
fi
echo "Replayed $from -> $to ($(wc -l <<< "$commits" | tr -d ' ') commits, $((SECONDS-started)) seconds, zero conflicts)."
