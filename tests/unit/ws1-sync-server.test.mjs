import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSyncServer, isValidBranchName } from '../../scripts/ws1/sync-server.mjs';

const UPDATE_SCRIPT = fileURLToPath(new URL('../../scripts/ws1/remote-update.sh', import.meta.url));
const TOKEN = 'test-token-1234567890';

let dir, site, server, base;

function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' }).trim();
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'sync-server-'));
  git(dir, 'init', '-q', '--bare', 'origin.git');
  git(dir, 'clone', '-q', 'origin.git', 'work');
  const work = join(dir, 'work');
  writeFileSync(join(work, 'index.html'), 'one');
  git(work, 'add', '.');
  git(work, 'commit', '-q', '-m', 'one');
  git(work, 'push', '-q', 'origin', 'HEAD:refs/heads/master');
  git(work, 'checkout', '-q', '-b', 'claude/feature');
  writeFileSync(join(work, 'index.html'), 'two');
  git(work, 'commit', '-q', '-am', 'two');
  git(work, 'push', '-q', 'origin', 'claude/feature');
  git(dir, 'clone', '-q', '--branch', 'master', 'origin.git', 'site');
  site = join(dir, 'site');

  server = createSyncServer({ repoDir: site, token: TOKEN, updateScript: UPDATE_SCRIPT });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  rmSync(dir, { recursive: true, force: true });
});

function api(path, body, token = TOKEN) {
  return fetch(base + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

test('branch 名稱檢查', () => {
  for (const ok of ['master', 'claude/project-thread-l89vlj', 'v1.2']) assert.ok(isValidBranchName(ok), ok);
  for (const bad of ['', '-x', 'a b', 'a;rm', 'a..b', 'a/', '$(id)', 'x.lock', null]) assert.ok(!isValidBranchName(bad), String(bad));
});

test('首頁不用密碼，API 要密碼', async () => {
  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /抓最新 branches/);
  assert.equal((await api('/api/branches', {}, 'wrong')).status, 401);
  assert.equal((await fetch(base + '/api/branches', { method: 'POST' })).status, 401);
});

test('列出 origin 的 branch，最新的在前', async () => {
  const res = await api('/api/branches');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data.branches.map((b) => b.name).sort(), ['claude/feature', 'master']);
  assert.equal(data.head, git(site, 'rev-parse', '--short', 'HEAD'));
});

test('同步到指定 branch', async () => {
  const res = await api('/api/sync', { branch: 'claude/feature' });
  const data = await res.json();
  assert.equal(res.status, 200, data.output);
  assert.equal(data.head.subject, 'two');
  assert.equal(git(site, 'log', '-1', '--format=%s'), 'two');
});

test('不存在或不合法的 branch 不會動到網站', async () => {
  const before = git(site, 'rev-parse', 'HEAD');
  for (const branch of ['nope', 'master; touch pwned', '../x']) {
    const res = await api('/api/sync', { branch });
    assert.equal(res.status, 400, branch);
  }
  assert.equal(git(site, 'rev-parse', 'HEAD'), before);
});

test('請求內容不是 JSON 時回 400', async () => {
  const res = await fetch(base + '/api/sync', { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: 'not json' });
  assert.equal(res.status, 400);
});
