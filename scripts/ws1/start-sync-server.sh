#!/bin/bash
# 在自己的電腦上執行：把同步網頁（sync-server.mjs）的最新版複製到 ws1，並在 ws1 上（重新）啟動它。
#
#   scripts/ws1/start-sync-server.sh
#
# 網址：http://ws1.csie.ntu.edu.tw:18771/
# 程式放在 ws1 的 ~/song-helper-sync/（不在 htdocs 裡，密碼檔不會被公開）：
#   sync-server.mjs、remote-update.sh、token（密碼，第一次執行時產生）、server.log
# 伺服器在背景執行，登出 ws1 也會繼續跑；ws1 重開機或程序被清掉後，再執行一次這個指令即可。
set -euo pipefail

HOST="${WS1_HOST:-r04922053@ws1.csie.ntu.edu.tw}"
PORT="${PORT:-18771}"
here=$(cd "$(dirname "$0")" && pwd)

tar -C "$here" -cf - sync-server.mjs remote-update.sh \
  | ssh "$HOST" 'mkdir -p ~/song-helper-sync && chmod 700 ~/song-helper-sync && tar -C ~/song-helper-sync -xf - && chmod 755 ~/song-helper-sync/remote-update.sh'

ssh "$HOST" bash -s -- "$PORT" <<'REMOTE'
set -euo pipefail
cd ~/song-helper-sync
if [ ! -s token ]; then
  (umask 077; head -c 18 /dev/urandom | base64 | tr '+/' '-_' > token)
  echo "新密碼：$(cat token)（存在 ws1:~/song-helper-sync/token）"
fi
# [n] 讓 pkill 不會比對到這個 shell 自己的指令列
pkill -u "$(id -u)" -f '[n]ode sync-server.mjs' && sleep 1 || true
PORT=$1 setsid nohup node sync-server.mjs >> server.log 2>&1 < /dev/null &
sleep 1
tail -n 1 server.log
REMOTE
echo "打開 http://${HOST#*@}:$PORT/"
