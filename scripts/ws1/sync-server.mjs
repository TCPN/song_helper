#!/usr/bin/env node
// 在 ws1 上常駐的小網頁：按「抓最新 branches」列出 GitHub 上的 branch，
// 選一個按「同步」就用 remote-update.sh 把 ~/htdocs/song_helper 切到那個 branch 的最新 commit。
// 只用 Node 內建模組，不需要 npm install。用 install-sync-server.sh 安裝，不要直接從 htdocs 執行。
//
// 環境變數：
//   PORT              預設 18771
//   SONG_HELPER_DIR   預設 ~/htdocs/song_helper
//   SYNC_TOKEN_FILE   預設與本檔同目錄的 token（每個 API 請求都要帶 Authorization: Bearer <token>）

import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { timingSafeEqual, createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRANCH_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function isValidBranchName(name) {
  return typeof name === 'string' && name.length <= 200 && BRANCH_RE.test(name)
    && !name.includes('..') && !name.endsWith('/') && !name.endsWith('.lock');
}

function sameSecret(a, b) {
  // 先雜湊成同長度再比，避免長度不同時 timingSafeEqual 丟例外
  const h = (s) => createHash('sha256').update(String(s)).digest();
  return timingSafeEqual(h(a), h(b));
}

function run(cmd, args, options) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 60_000, maxBuffer: 1 << 20, ...options }, (error, stdout, stderr) => {
      resolve({ ok: !error, code: error ? (error.code ?? 1) : 0, stdout, stderr });
    });
  });
}

export function createSyncServer({ repoDir, token, updateScript }) {
  const git = (...args) => run('git', args, { cwd: repoDir });
  const failures = new Map(); // 來源 IP → 最近一分鐘密碼錯誤的時間

  async function listBranches() {
    const fetched = await git('fetch', '--quiet', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*');
    if (!fetched.ok) throw new Error(`git fetch 失敗：${fetched.stderr.trim()}`);
    const refs = await git('for-each-ref', '--sort=-committerdate',
      '--format=%(refname:lstrip=3)%09%(objectname:short)%09%(committerdate:relative)%09%(subject)',
      'refs/remotes/origin');
    const head = await git('rev-parse', '--short', 'HEAD');
    const branches = refs.stdout.split('\n').filter(Boolean)
      .map((line) => { const [name, sha, date, subject] = line.split('\t'); return { name, sha, date, subject }; })
      .filter((b) => b.name !== 'HEAD');
    return { head: head.stdout.trim(), branches };
  }

  async function currentHead() {
    const head = await git('log', '-1', '--format=%h%x09%s%x09%cr');
    const [sha, subject, date] = head.stdout.trim().split('\t');
    return { sha, subject, date };
  }

  async function sync(branch) {
    if (!isValidBranchName(branch)) return { ok: false, output: `branch 名稱不合法：${branch}` };
    // 只接受 origin 上真的有的 branch
    const exists = await run('git', ['ls-remote', '--exit-code', '--heads', 'origin', `refs/heads/${branch}`], { cwd: repoDir });
    if (!exists.ok) return { ok: false, output: `GitHub 上沒有這個 branch：${branch}` };
    const result = await run(updateScript, [branch], { env: { ...process.env, SONG_HELPER_DIR: repoDir } });
    return { ok: result.ok, output: (result.stdout + result.stderr).trim() };
  }

  function authorized(req) {
    // 依來源分開計數，別人亂試不會把自己鎖住
    const ip = req.socket.remoteAddress;
    const now = Date.now();
    const recent = (failures.get(ip) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= 10) return 'locked';
    const header = req.headers.authorization ?? '';
    const given = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (given && sameSecret(given, token)) return 'ok';
    recent.push(now);
    failures.set(ip, recent);
    if (failures.size > 1000) failures.clear();
    return 'no';
  }

  function send(res, status, body, type = 'application/json; charset=utf-8') {
    res.writeHead(status, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    });
    res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
  }

  // 讀不到合法的 JSON 時回 null（呼叫端回 400）
  async function readJson(req) {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 10_000) { req.destroy(); return null; }
    }
    try { return raw ? JSON.parse(raw) : {}; } catch { return null; }
  }

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/') return send(res, 200, PAGE, 'text/html; charset=utf-8');
      if (req.method !== 'POST' || !url.pathname.startsWith('/api/')) return send(res, 404, { error: '找不到' });

      const auth = authorized(req);
      if (auth === 'locked') return send(res, 429, { error: '密碼錯太多次，請一分鐘後再試' });
      if (auth !== 'ok') return send(res, 401, { error: '密碼不對' });

      if (url.pathname === '/api/status') return send(res, 200, { head: await currentHead() });
      if (url.pathname === '/api/branches') return send(res, 200, await listBranches());
      if (url.pathname === '/api/sync') {
        const body = await readJson(req);
        if (!body) return send(res, 400, { error: '請求格式不對' });
        const { branch } = body;
        const result = await sync(branch);
        return send(res, result.ok ? 200 : 400, { ...result, head: await currentHead() });
      }
      return send(res, 404, { error: '找不到' });
    } catch (error) {
      return send(res, 500, { error: String(error.message ?? error) });
    }
  });
}

const PAGE = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>同步 ws1 測試站</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 0 auto; padding: 16px; line-height: 1.5; }
  input, select, button { font: inherit; padding: 6px 10px; }
  select, input[type=password] { width: 100%; box-sizing: border-box; margin: 4px 0 12px; }
  button { margin-right: 8px; }
  pre { background: #f4f4f4; padding: 10px; white-space: pre-wrap; word-break: break-all; }
  .muted { color: #666; font-size: 0.9em; }
</style>
</head>
<body>
<h1>同步 ws1 測試站</h1>
<p class="muted">把 <a href="https://www.csie.ntu.edu.tw/~r04922053/song_helper/" target="_blank">~r04922053/song_helper</a> 切到某個 branch 在 GitHub 上的最新 commit。</p>
<label>密碼<input type="password" id="token" autocomplete="current-password"></label>
<p>目前：<span id="head">（輸入密碼後按「抓最新 branches」）</span></p>
<button id="refresh">抓最新 branches</button>
<select id="branch" disabled><option>（還沒抓）</option></select>
<button id="sync" disabled>同步到這個 branch</button>
<pre id="out" hidden></pre>
<script>
  const $ = (id) => document.getElementById(id);
  try { $('token').value = localStorage.getItem('sync-token') || ''; } catch {}
  async function api(path, body) {
    const token = $('token').value;
    try { localStorage.setItem('sync-token', token); } catch {}
    const res = await fetch(path, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const data = await res.json();
    if (!res.ok && data.error) throw new Error(data.error);
    return data;
  }
  function show(text) { $('out').hidden = false; $('out').textContent = text; }
  function showHead(h) { $('head').textContent = h.sha + ' ' + h.subject + '（' + h.date + '）'; }
  $('refresh').onclick = async () => {
    $('refresh').disabled = true; show('抓取中…');
    try {
      const data = await api('/api/branches');
      const select = $('branch'); select.textContent = '';
      for (const b of data.branches) {
        const o = document.createElement('option');
        o.value = b.name;
        o.textContent = (b.sha === data.head ? '● ' : '') + b.name + ' — ' + b.date + ' — ' + b.subject;
        select.append(o);
      }
      select.disabled = $('sync').disabled = data.branches.length === 0;
      showHead((await api('/api/status')).head);
      show('共 ' + data.branches.length + ' 個 branch，● 是目前的版本');
    } catch (e) { show('錯誤：' + e.message); }
    $('refresh').disabled = false;
  };
  $('sync').onclick = async () => {
    const branch = $('branch').value;
    $('sync').disabled = true; show('同步到 ' + branch + ' …');
    try {
      const data = await api('/api/sync', { branch });
      if (data.head) showHead(data.head);
      show(data.output || data.error);
    } catch (e) { show('錯誤：' + e.message); }
    $('sync').disabled = false;
  };
</script>
</body>
</html>
`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const tokenFile = process.env.SYNC_TOKEN_FILE ?? join(HERE, 'token');
  const token = readFileSync(tokenFile, 'utf8').trim();
  if (token.length < 16) throw new Error(`${tokenFile} 裡的密碼太短（至少 16 字元）`);
  const port = Number(process.env.PORT ?? 18771);
  const server = createSyncServer({
    repoDir: process.env.SONG_HELPER_DIR ?? join(homedir(), 'htdocs/song_helper'),
    token,
    updateScript: join(HERE, 'remote-update.sh'),
  });
  server.listen(port, () => console.log(`${new Date().toISOString()} 同步網頁在 port ${port}`));
}
