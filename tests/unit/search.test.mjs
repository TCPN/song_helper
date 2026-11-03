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
  matched_lyric_lines, match_song, RANK_EXACT, RANK_PREFIX, RANK_TITLE, RANK_LYRICS } from '../../js/search.js';

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

const song1 = { id: 1, name: '春之歌', tone: 'C' };

test('match_song：標題符合時不看歌詞；只有歌詞符合時傳回那一句', () => {
  let calls = 0;
  const lyrics = () => { calls++; return lyric_search_index([{ paragraphs: [['春天來了', '花開了']] }]); };
  assert.deepEqual(match_song(make_song_finder('歌'), song1, lyrics), { rank: RANK_TITLE, lyric: null });
  assert.equal(calls, 0);
  assert.deepEqual(match_song(make_song_finder('了花'), song1, lyrics), { rank: RANK_LYRICS, lyric: '春天來了 花開了' });
  assert.equal(match_song(make_song_finder('秋'), song1, lyrics), null);
  assert.equal(match_song(make_song_finder('秋'), song1, () => lyric_search_index([])), null);
});

test('match_song：排序等級：完全符合 → 歌名開頭 → 標題任一處 → 歌詞', () => {
  const none = () => lyric_search_index([]);
  const rank = (pattern, song) => match_song(make_song_finder(pattern), song, none).rank;
  assert.equal(rank('春之歌', song1), RANK_EXACT);
  assert.equal(rank('^春.*歌$', song1), RANK_EXACT);
  assert.equal(rank('1', { id: 1, name: '歌', tone: 'C' }), RANK_EXACT); // 曲號完全符合
  assert.equal(rank('春之', song1), RANK_PREFIX);
  assert.equal(rank('之歌', song1), RANK_TITLE);
  assert.equal(rank('C調', song1), RANK_TITLE);
  assert.equal(rank('1', { id: 12, name: '歌', tone: 'C' }), RANK_TITLE);
  assert.ok(RANK_EXACT < RANK_PREFIX && RANK_PREFIX < RANK_TITLE && RANK_TITLE < RANK_LYRICS);
});

test('match_song：正規表達式也照樣比對歌詞（跨行接起來的那串）', () => {
  const lyrics = () => lyric_search_index([{ paragraphs: [['春天來了', '花開了']] }]);
  const song = { id: 1, name: '歌', tone: 'C' };
  assert.deepEqual(match_song(make_song_finder('來.花'), song, lyrics), { rank: RANK_LYRICS, lyric: '春天來了 花開了' });
  assert.deepEqual(match_song(make_song_finder('^春'), song, lyrics), { rank: RANK_LYRICS, lyric: '春天來了' });
  assert.deepEqual(match_song(make_song_finder('開了$'), song, lyrics), { rank: RANK_LYRICS, lyric: '花開了' });
  // 幾乎全符合的式子先符合標題，不顯示歌詞
  assert.equal(match_song(make_song_finder('.'), song, lyrics).lyric, null);
});

import { parse_search_scope, DEFAULT_SEARCH_SCOPE, sort_by_rank } from '../../js/search.js';

test('parse_search_scope：預設只搜尋標題；壞掉或兩個都關時用預設值', () => {
  assert.deepEqual(DEFAULT_SEARCH_SCOPE, { title: true, lyrics: false });
  assert.deepEqual(parse_search_scope(null), { title: true, lyrics: false });
  assert.deepEqual(parse_search_scope('壞掉'), { title: true, lyrics: false });
  assert.deepEqual(parse_search_scope('{"title":true,"lyrics":true}'), { title: true, lyrics: true });
  assert.deepEqual(parse_search_scope('{"title":false,"lyrics":true}'), { title: false, lyrics: true });
  assert.deepEqual(parse_search_scope('{"title":false,"lyrics":false}'), { title: true, lyrics: false });
});

test('match_song：依 scope 只比對標題或只比對歌詞', () => {
  const lyrics = () => lyric_search_index([{ paragraphs: [['春天來了']] }]);
  const song = { id: 1, name: '春之歌', tone: 'C' };
  assert.equal(match_song(make_song_finder('春天'), song, lyrics, { title: true, lyrics: false }), null);
  assert.equal(match_song(make_song_finder('之歌'), song, lyrics, { title: false, lyrics: true }), null);
  // 只搜尋歌詞時，歌名也有的字照樣顯示歌詞那一句
  assert.deepEqual(match_song(make_song_finder('春'), song, lyrics, { title: false, lyrics: true }),
    { rank: RANK_LYRICS, lyric: '春天來了' });
});

test('sort_by_rank：依 rank 再依原本順序，不符合的放最後', () => {
  const sorted = sort_by_rank([
    { rank: 3, order: 0 }, { rank: null, order: 1 }, { rank: 1, order: 2 }, { rank: 3, order: 3 }, { rank: 1, order: 4 },
  ]);
  assert.deepEqual(sorted.map((e) => e.order), [2, 4, 0, 3, 1]);
});

import { unmoved } from '../../js/search.js';

test('unmoved：留下最多不用搬的元素，其他的依序搬過去就排好', () => {
  const apply = (current, desired) => {
    const keep = unmoved(current, desired);
    const list = current.slice();
    for (let k = desired.length - 1; k >= 0; k--) {
      if (keep.has(desired[k])) continue;
      list.splice(list.indexOf(desired[k]), 1);
      const anchor = desired[k + 1];
      list.splice(anchor === undefined ? list.length : list.indexOf(anchor), 0, desired[k]);
    }
    return { list, moved: current.length - keep.size };
  };
  assert.deepEqual(apply([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]), { list: [1, 2, 3, 4, 5], moved: 0 });
  assert.deepEqual(apply([1, 2, 3, 4, 5], [4, 2, 1, 3, 5]), { list: [4, 2, 1, 3, 5], moved: 2 });
  assert.deepEqual(apply([5, 4, 3, 2, 1], [1, 2, 3, 4, 5]), { list: [1, 2, 3, 4, 5], moved: 4 });
  // 搜尋後只有幾列被移到最上面，清空時只要把那幾列搬回去
  const after = [7, 3, 0, 1, 2, 4, 5, 6, 8, 9];
  assert.equal(apply(after, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).moved, 2);
  assert.deepEqual(unmoved([], []), new Set());
});
