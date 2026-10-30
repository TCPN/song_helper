#!/bin/bash
# 一次性設定 GitHub Actions「更新 ws1」按鈕（.github/workflows/update-ws1.yml）。
# 在自己的電腦上執行，需要能 ssh 到 ws1；之後 remote-update.sh 有改時再執行一次即可（會換一把新金鑰）。
#
# 1. 把 remote-update.sh 裝到 ws1 的 ~/bin/song-helper-update.sh
# 2. 產生一把新金鑰，公鑰加到 ws1 的 ~/.ssh/authorized_keys，限定只能執行上面那支腳本
#    （不能開 shell、不能轉送連線；最多只能把網站切到 GitHub 上已有的某個 branch）
# 3. 把私鑰和 ws1 的 host key 設成 repo 的 secrets：WS1_SSH_KEY、WS1_KNOWN_HOSTS
#    （有登入的 gh 就自動設，否則印出來讓你貼到 GitHub）
set -euo pipefail

HOST="${WS1_HOST:-r04922053@ws1.csie.ntu.edu.tw}"
HOSTNAME_ONLY="${HOST#*@}"
REPO="${GITHUB_REPO:-TCPN/song_helper}"
COMMENT=song_helper-github-actions
here=$(cd "$(dirname "$0")" && pwd)

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "1/4 安裝更新腳本到 ws1:~/bin/song-helper-update.sh"
ssh "$HOST" 'mkdir -p ~/bin && cat > ~/bin/song-helper-update.sh && chmod 755 ~/bin/song-helper-update.sh' \
  < "$here/remote-update.sh"

echo "2/4 產生金鑰並加到 ws1 的 authorized_keys（取代舊的 $COMMENT）"
ssh-keygen -q -t ed25519 -N '' -C "$COMMENT" -f "$tmp/key"
pub=$(cat "$tmp/key.pub")
# 公鑰只有 base64、空白和註解，可以直接放進單引號
ssh "$HOST" bash -s <<EOF
set -e
umask 077
mkdir -p ~/.ssh
touch ~/.ssh/authorized_keys
{ grep -v ' $COMMENT\$' ~/.ssh/authorized_keys || true
  echo "command=\"\$HOME/bin/song-helper-update.sh\",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty $pub"
} > ~/.ssh/song-helper-ak.tmp
cat ~/.ssh/song-helper-ak.tmp > ~/.ssh/authorized_keys
rm ~/.ssh/song-helper-ak.tmp
EOF

echo "3/4 確認新金鑰只能執行更新腳本"
ssh-keyscan -q "$HOSTNAME_ONLY" > "$tmp/known_hosts"
check=$(ssh -T -i "$tmp/key" -o IdentitiesOnly=yes -o UserKnownHostsFile="$tmp/known_hosts" \
  -o StrictHostKeyChecking=yes "$HOST" 2>&1 || true)
case "$check" in
  *沒有指定\ branch*) echo "   OK" ;;
  *) echo "   金鑰測試結果不如預期：$check" >&2; exit 1 ;;
esac

echo "4/4 設定 GitHub secrets"
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh secret set WS1_SSH_KEY -R "$REPO" < "$tmp/key"
  gh secret set WS1_KNOWN_HOSTS -R "$REPO" < "$tmp/known_hosts"
  echo "   已設定。到 https://github.com/$REPO/actions/workflows/update-ws1.yml 按 Run workflow 試試。"
else
  echo "   沒有登入的 gh，請到 https://github.com/$REPO/settings/secrets/actions 新增兩個 secret："
  echo
  echo "=== WS1_SSH_KEY（整段，含 BEGIN/END 兩行）==="
  cat "$tmp/key"
  echo "=== WS1_KNOWN_HOSTS ==="
  cat "$tmp/known_hosts"
  echo "==="
  echo "貼完後把這個終端機的內容清掉。"
fi
