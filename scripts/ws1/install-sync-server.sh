#!/bin/bash
# 在自己的電腦上執行：把同步網頁（sync-server.mjs）裝到 ws1 並啟動。
# 再執行一次就會更新程式並重新啟動。網址：http://ws1.csie.ntu.edu.tw:18771/
#
# 裝在 ws1 的 ~/song-helper-sync/（不在 htdocs 裡，密碼檔不會被公開）：
#   sync-server.mjs、remote-update.sh、token（密碼，第一次安裝時產生）、server.log
# crontab 每 5 分鐘檢查一次，伺服器沒在跑（被清掉或重開機）就重新啟動；flock 確保只跑一份。
set -euo pipefail

HOST="${WS1_HOST:-r04922053@ws1.csie.ntu.edu.tw}"
PORT="${PORT:-18771}"
here=$(cd "$(dirname "$0")" && pwd)

echo "1/3 複製程式到 ws1:~/song-helper-sync/"
tar -C "$here" -cf - sync-server.mjs remote-update.sh \
  | ssh "$HOST" 'mkdir -p ~/song-helper-sync && chmod 700 ~/song-helper-sync && tar -C ~/song-helper-sync -xf - && chmod 755 ~/song-helper-sync/remote-update.sh'

echo "2/3 設定密碼與 crontab"
ssh "$HOST" bash -s -- "$PORT" <<'REMOTE'
set -euo pipefail
cd ~/song-helper-sync
if [ ! -s token ]; then
  (umask 077; head -c 18 /dev/urandom | base64 | tr '+/' '-_' > token)
  echo "   新密碼：$(cat token)"
  echo "   （存在 ws1:~/song-helper-sync/token，忘記時可以去那裡看）"
fi
cat > run.sh <<RUN
#!/bin/bash
cd "\$HOME/song-helper-sync" || exit 1
exec flock -n server.lock env PORT=$1 node sync-server.mjs >> server.log 2>&1
RUN
chmod 755 run.sh
line="*/5 * * * * \$HOME/song-helper-sync/run.sh"
{ crontab -l 2>/dev/null | grep -v 'song-helper-sync/run.sh' || true
  echo "@reboot \$HOME/song-helper-sync/run.sh"
  echo "$line"
} | crontab -
REMOTE

echo "3/3 重新啟動"
ssh "$HOST" 'pkill -u "$(id -u)" -f "[n]ode sync-server.mjs" || true; sleep 1; setsid nohup ~/song-helper-sync/run.sh >/dev/null 2>&1 < /dev/null & sleep 2; tail -n 1 ~/song-helper-sync/server.log'
echo "打開 http://${HOST#*@}:$PORT/"
