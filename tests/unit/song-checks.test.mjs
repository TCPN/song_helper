import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { has_part_marks, has_lyrics, run_checks, SONG_CHECKS } from '../../js/song-checks.js';

const HEAD = 'X:1\nT:t\nM:4/4\nL:1/4\nK:C\n';

test('has_part_marks：譜本體有 P: 行', () => {
  assert.equal(has_part_marks(HEAD + 'P:A\nCDEF|\nP:B\nGABc|'), true);
});

test('has_part_marks：行內 [P:…]', () => {
  assert.equal(has_part_marks(HEAD + 'CDEF|[P:Chorus]GABc|'), true);
});

test('has_part_marks：K: 之前的 P:（演唱順序）不算', () => {
  assert.equal(has_part_marks('X:1\nP:ABAB\nK:C\nCDEF|'), false);
});

test('has_part_marks：沒有 P:、沒有 K:、沒有 abc 都是 false', () => {
  assert.equal(has_part_marks(HEAD + 'CDEF|\nw:do re mi fa'), false);
  assert.equal(has_part_marks('X:1\nP:A\nCDEF|'), false);
  assert.equal(has_part_marks(null), false);
  assert.equal(has_part_marks(''), false);
});

test('has_part_marks：Windows 換行也可以', () => {
  assert.equal(has_part_marks('X:1\r\nK:C\r\nP:A\r\nCDEF|'), true);
});

test('has_lyrics：有 w: 行才算', () => {
  assert.equal(has_lyrics(HEAD + 'CDEF|\nw:do re mi fa'), true);
  assert.equal(has_lyrics(HEAD + 'CDEF|\nW:譜後歌詞'), false);
  assert.equal(has_lyrics(null), false);
});

const SONGS = [
  { id: 1, name: '有段落', abc: HEAD + 'P:A\nCDEF|\nw:do re mi fa' },
  { id: 2, name: '沒有段落', abc: HEAD + 'CDEF|\nw:do re mi fa' },
  { id: 3, name: '沒有歌詞', abc: HEAD + 'CDEF|' },
  { id: 4, name: '沒有譜', abc: null },
];

test('run_checks：no-parts 只列出有歌詞但沒有 P: 的歌，只放編號與歌名', () => {
  assert.deepEqual(run_checks(SONGS), [{
    id: 'no-parts',
    title: SONG_CHECKS[0].title,
    songs: [{ id: 2, name: '沒有段落' }],
  }]);
});

test('check-songs --snapshot --json：讀快照輸出結果', () => {
  const dir = mkdtempSync(join(tmpdir(), 'check-songs-'));
  const snapshot = join(dir, 'songs.json');
  writeFileSync(snapshot, JSON.stringify({ updated: '2026-01-01T00:00:00Z', songs: SONGS }));
  const script = fileURLToPath(new URL('../../scripts/check-songs.mjs', import.meta.url));
  const out = JSON.parse(execFileSync(process.execPath, [script, '--snapshot', snapshot, '--json'], { encoding: 'utf8' }));
  assert.equal(out.total, 4);
  assert.deepEqual(out.checks.map((check) => [check.id, check.songs.map((song) => song.id)]), [['no-parts', [2]]]);
});

test('check-songs --only：不認得的檢查名稱會失敗', () => {
  const script = fileURLToPath(new URL('../../scripts/check-songs.mjs', import.meta.url));
  assert.throws(() => execFileSync(process.execPath, [script, '--only', 'nope', '--snapshot', 'x.json'], { stdio: 'pipe' }));
});
