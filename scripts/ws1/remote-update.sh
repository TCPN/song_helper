#!/bin/bash
# 在 ws1 上執行：把 ~/htdocs/song_helper（一個 git clone）更新到指定 branch 在 GitHub 上的最新 commit。
#
#   remote-update.sh <branch>
#
# 也可以當 ssh 的 forced command（authorized_keys 的 command="…"）：
# 這時 branch 來自 client 送來的指令字串（$SSH_ORIGINAL_COMMAND），金鑰只能做這件事。
# 只動 ~/htdocs/song_helper；不碰 ~/htdocs/score，也不碰沒被追蹤的檔案（例如 songs.json）。
set -euo pipefail

REPO_DIR="${SONG_HELPER_DIR:-$HOME/htdocs/song_helper}"
SITE_URL="https://www.csie.ntu.edu.tw/~r04922053/song_helper/"

branch="${1:-${SSH_ORIGINAL_COMMAND:-}}"

fail() { echo "錯誤：$*" >&2; exit 1; }

[ -n "$branch" ] || fail "沒有指定 branch"
[[ "$branch" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]] || fail "branch 名稱不合法：$branch"
git check-ref-format "refs/heads/$branch" || fail "branch 名稱不合法：$branch"

cd "$REPO_DIR" || fail "找不到 $REPO_DIR"

# 同時只跑一個
if command -v flock >/dev/null; then
  exec 9>"$(git rev-parse --git-dir)/song-helper-update.lock"
  flock -n 9 || fail "另一個更新正在進行"
fi

# 有人在 ws1 上直接改了被追蹤的檔案時不要蓋掉
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short --untracked-files=no >&2
  fail "$REPO_DIR 有未提交的修改，沒有更新"
fi

before=$(git rev-parse --short HEAD)
git fetch --quiet origin "+refs/heads/$branch:refs/remotes/origin/$branch" \
  || fail "抓不到 origin 的 branch：$branch"
git checkout --quiet --detach "refs/remotes/origin/$branch"

echo "已更新到 $branch：$(git log -1 --format='%h %s（%cr）')"
[ "$before" = "$(git rev-parse --short HEAD)" ] && echo "（原本就是這個 commit）"
echo "$SITE_URL"
