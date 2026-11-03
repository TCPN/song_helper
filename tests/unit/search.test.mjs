import { test } from 'node:test';
import assert from 'node:assert/strict';
import { search_pattern_to_regexp, make_song_matcher } from '../../js/search.js';

test('search_pattern_to_regexp：不合法的正規表達式傳回 null', () => {
  assert.equal(search_pattern_to_regexp('('), null);
  assert.equal(search_pattern_to_regexp('['), null);
  assert.equal(search_pattern_to_regexp('*'), null);
  assert.ok(search_pattern_to_regexp('a.c') instanceof RegExp);
});

test('make_song_matcher：當成正規表達式比對', () => {
  const m = make_song_matcher('^1\\.');
  assert.equal(m('1.奇異恩典G調'), true);
  assert.equal(m('11.奇異恩典G調'), false);
});

test('make_song_matcher：直接包含輸入的文字也算符合', () => {
  // "歌(一)" 當正規表達式是「歌一」，但原文包含這串字
  assert.equal(make_song_matcher('歌(一)')('3.歌(一)C調'), true);
  assert.equal(make_song_matcher('(')('3.歌(一)C調'), true);
  assert.equal(make_song_matcher('(')('3.歌一C調'), false);
});

test('make_song_matcher：空字串符合全部', () => {
  assert.equal(make_song_matcher('')('任何文字'), true);
});

test('make_song_matcher：區分大小寫（現況）', () => {
  assert.equal(make_song_matcher('amazing')('Amazing Grace'), false);
});

import { make_song_finder, song_title_text, lyric_search_index, song_lyric_search_index,
  matched_lyric_lines, match_song } from '../../js/search.js';

test('make_song_finder：傳回符合的位置與長度', () => {
  assert.deepEqual(make_song_finder('b+')('abbc'), { index: 1, length: 2 });
  // 不合法的正規表達式：直接找文字
  assert.deepEqual(make_song_finder('(')('a(b'), { index: 1, length: 1 });
  assert.equal(make_song_finder('x')('abc'), null);
});

test('song_title_text：和列表那一列的字一樣', () => {
  assert.equal(song_title_text({ id: 3, name: '歌', tone: 'Am' }), '3.歌Am調');
});

test('lyric_search_index：去掉中文旁的空格，跨行接起來', () => {
  const index = lyric_search_index([
    { paragraphs: [['春天 來了', '花 開了'], ['Hello world']] },
    { paragraphs: [['good night']] },
  ]);
  assert.equal(index.text, '春天來了花開了Hello world good night');
  assert.deepEqual(index.lines, ['春天來了', '花開了', 'Hello world', 'good night']);
  assert.deepEqual(index.starts, [0, 4, 7, 19]);
});

test('lyric_search_index：沒有歌詞時是空字串', () => {
  assert.deepEqual(lyric_search_index([]), { text: '', lines: [], starts: [] });
});

test('song_lyric_search_index：從 w: 抽出，去掉音節分隔符號', () => {
  const abc = 'X:1\nK:C\nCDEF|GABc|]\nw:春-天 來_ 了 小-鳥 * 唱\n';
  assert.equal(song_lyric_search_index({ abc }).text, '春天來了小鳥唱');
  const en = 'X:1\nK:C\nCDEF|]\nw:sun-shine is~here\n';
  assert.equal(song_lyric_search_index({ abc: en }).text, 'sunshine is here');
});

test('song_lyric_search_index：「投影片」欄有字時用它', () => {
  const song = { abc: 'X:1\nK:C\nCD|]\nw:譜 上\n', slides: '[A]\n格子 裡的 歌詞' };
  assert.equal(song_lyric_search_index(song).text, '格子裡的歌詞');
  assert.equal(song_lyric_search_index({ abc: null }).text, '');
});

test('matched_lyric_lines：符合處所在的行；跨行時接起來', () => {
  const index = lyric_search_index([{ paragraphs: [['春天來了', '花開了', '鳥叫了']] }]);
  assert.equal(matched_lyric_lines(index, { index: 5, length: 2 }), '花開了');
  assert.equal(matched_lyric_lines(index, { index: 2, length: 4 }), '春天來了 花開了');
  assert.equal(matched_lyric_lines(index, { index: 0, length: 0 }), '春天來了');
});

test('match_song：標題符合時不看歌詞；只有歌詞符合時傳回那一句', () => {
  let calls = 0;
  const lyrics = () => { calls++; return lyric_search_index([{ paragraphs: [['春天來了', '花開了']] }]); };
  assert.deepEqual(match_song(make_song_finder('歌'), '1.春之歌C調', lyrics), { lyric: null });
  assert.equal(calls, 0);
  assert.deepEqual(match_song(make_song_finder('了花'), '1.春之歌C調', lyrics), { lyric: '春天來了 花開了' });
  assert.equal(match_song(make_song_finder('秋'), '1.春之歌C調', lyrics), null);
  assert.equal(match_song(make_song_finder('秋'), '1.春之歌C調', () => lyric_search_index([])), null);
});

test('match_song：正規表達式也照樣比對歌詞（跨行接起來的那串）', () => {
  const lyrics = () => lyric_search_index([{ paragraphs: [['春天來了', '花開了']] }]);
  assert.deepEqual(match_song(make_song_finder('來.花'), '1.歌C調', lyrics), { lyric: '春天來了 花開了' });
  assert.deepEqual(match_song(make_song_finder('^春'), '1.歌C調', lyrics), { lyric: '春天來了' });
  assert.deepEqual(match_song(make_song_finder('開了$'), '1.歌C調', lyrics), { lyric: '花開了' });
  // 幾乎全符合的式子先符合標題，不顯示歌詞
  assert.deepEqual(match_song(make_song_finder('.'), '1.歌C調', lyrics), { lyric: null });
});
