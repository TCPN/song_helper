#!/bin/bash
# 在自己的電腦上執行：把 ws1 的 song_helper 網站更新到指定 branch 的最新 commit。
#
#   scripts/ws1/update.sh            # 列出最近的 branch，選一個
#   scripts/ws1/update.sh <branch>   # 直接指定
#
# 用自己的 ssh 登入 ws1，把同目錄的 remote-update.sh 送過去執行（ws1 上不用先裝任何東西）。
set -euo pipefail

HOST="${WS1_HOST:-r04922053@ws1.csie.ntu.edu.tw}"
here=$(cd "$(dirname "$0")" && pwd)
branch="${1:-}"

if [ -z "$branch" ]; then
  git -C "$here" fetch --quiet --prune origin
  mapfile -t branches < <(git -C "$here" for-each-ref --sort=-committerdate --count=15 \
    --format='%(refname:lstrip=3)' refs/remotes/origin | grep -vx HEAD)
  echo "最近更新的 branch："
  for i in "${!branches[@]}"; do
    printf '%3d) %s\n' $((i + 1)) "${branches[$i]}"
  done
  read -rp "選號碼或輸入 branch 名稱（Enter = master）：" answer
  if [ -z "$answer" ]; then
    branch=master
  elif [[ "$answer" =~ ^[0-9]+$ ]] && [ "$answer" -ge 1 ] && [ "$answer" -le "${#branches[@]}" ]; then
    branch="${branches[$((answer - 1))]}"
  else
    branch="$answer"
  fi
fi

# 名稱會經過 ws1 的 shell，先在這裡擋掉奇怪的字元
[[ "$branch" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]] || { echo "branch 名稱不合法：$branch" >&2; exit 1; }

echo "更新 ws1 到 $branch …"
ssh "$HOST" bash -s -- "$branch" < "$here/remote-update.sh"
