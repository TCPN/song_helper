import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score_kind, tempo_text, key_display_name } from '../../js/abc.js';

const HEAD = 'X:1\nT:t\nM:4/4\nL:1/4\nK:C\n';

test('score_kind：只有旋律為 note', () => {
  assert.equal(score_kind(HEAD + 'CDEF|'), 'note');
});

test('score_kind：有 "和弦" 為 chord', () => {
  assert.equal(score_kind(HEAD + '"C"CDEF|'), 'chord');
});

test('score_kind：K: 行之後沒有內容就不算有譜', () => {
  assert.equal(score_kind('X:1\nK:C'), null);
  assert.equal(score_kind('X:1\nK:C\n'), null);
  assert.equal(score_kind('X:1\nK:C\n   \n'), null);
});

test('score_kind：Windows 換行也可以', () => {
  assert.equal(score_kind('X:1\r\nK:G\r\nGABc|'), 'note');
});

test('score_kind：沒有 abc 為 null', () => {
  assert.equal(score_kind(''), null);
  assert.equal(score_kind(null), null);
  assert.equal(score_kind(undefined), null);
});

test('tempo_text：常見的拍子單位換成音符符號', () => {
  assert.equal(tempo_text(HEAD.replace('K:C', 'Q:1/4=80\nK:C')), '𝅘𝅥=80');
  assert.equal(tempo_text('Q: 1/8 = 120'), '𝅘𝅥𝅮=120');
  assert.equal(tempo_text('Q:3/8=60'), '𝅘𝅥𝅮𝅘𝅥𝅮𝅘𝅥𝅮=60');
});

test('tempo_text：不在對照表的單位原樣顯示', () => {
  assert.equal(tempo_text('Q:1/3=80'), '1/3=80');
});

test('tempo_text：沒有 = 的寫法原樣顯示', () => {
  assert.equal(tempo_text('Q:120'), '120');
});

test('tempo_text：沒有 Q: 或沒有 abc 時為空字串', () => {
  assert.equal(tempo_text(HEAD + 'CDEF|'), '');
  assert.equal(tempo_text(''), '');
  assert.equal(tempo_text(null), '');
});

test('key_display_name：升降記號換成 ♯ ♭，保留調式', () => {
  assert.equal(key_display_name({ root: 'F', acc: '#', mode: 'm' }), 'F♯m');
  assert.equal(key_display_name({ root: 'B', acc: 'b', mode: '' }), 'B♭');
  assert.equal(key_display_name({ root: 'C', acc: '', mode: '' }), 'C');
});

test('key_display_name：全部為空時顯示 C', () => {
  assert.equal(key_display_name({ root: '', acc: '', mode: '' }), 'C');
});

test('key_display_name：拿不到調號時為空字串', () => {
  assert.equal(key_display_name(undefined), '');
});
