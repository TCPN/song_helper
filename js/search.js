// 歌曲列表的搜尋比對（不碰 DOM）
import { song_slide_lyrics, strip_spaces } from './slide-lyrics.js';

// 搜尋文字當成正規表達式；不是合法的正規表達式（例如單獨的 "("、"["、"*"）時傳回 null
export function search_pattern_to_regexp(pattern) {
  try {
    return new RegExp(pattern);
  } catch (e) {
    return null;
  }
}

// 傳回在文字裡找符合處的函式：找到時傳回 { index, length }，找不到時 null
// 正規表達式符合，或直接包含輸入的文字，都算符合（所以輸入完整的 "歌(一)" 也找得到）
export function make_song_finder(pattern) {
  var regexp = search_pattern_to_regexp(pattern);
  return function(text) {
    var m = regexp && regexp.exec(text);
    if (m)
      return { index: m.index, length: m[0].length };
    var index = text.indexOf(pattern);
    return index < 0 ? null : { index, length: pattern.length };
  };
}

// 傳回判斷一列文字是否符合的函式
export function make_song_matcher(pattern) {
  var find = make_song_finder(pattern);
  return function(text) {
    return !!find(text);
  };
}

// 列表上一首歌的標題文字（編號、歌名、調性），和列表那一列顯示的字一樣
export function song_title_text(song) {
  return song.id + '.' + song.name + song.tone + '調';
}

// 段（js/slide-lyrics.js 的 { paragraphs }）→ 搜尋用的歌詞：{ text, lines, starts }
// 每行先去掉中文旁的空格（strip_spaces），再全部接成一串 text，跨行的句子也找得到：
// 中文接中文不加空格，英文單字之間留一個空格。starts[i] 是第 i 行在 text 裡的開頭位置
export function lyric_search_index(sections) {
  var lines = [];
  for (const section of sections)
    for (const paragraph of section.paragraphs)
      for (const line of paragraph) {
        var text = strip_spaces(line).trim();
        if (text)
          lines.push(text);
      }
  var text = '';
  var starts = [];
  for (const line of lines) {
    if (text && strip_spaces(text[text.length - 1] + ' ' + line[0]).length == 3)
      text += ' ';
    starts.push(text.length);
    text += line;
  }
  return { text, lines, starts };
}

// 一首歌的搜尋用歌詞（「投影片」欄有字就用它，不然從 ABC 的 w:／W: 抽出）
export function song_lyric_search_index(song) {
  return lyric_search_index(song_slide_lyrics(song).sections);
}

// 符合處（{ index, length }，位置是 index.text 裡的）所在的歌詞行；跨行時把那幾行用空格接起來
export function matched_lyric_lines(index, match) {
  var first = last_start_at_or_before(index.starts, match.index);
  var last = last_start_at_or_before(index.starts, match.index + Math.max(match.length, 1) - 1);
  return index.lines.slice(first, last + 1).join(' ');
}

function last_start_at_or_before(starts, at) {
  var k = 0;
  while (k + 1 < starts.length && starts[k + 1] <= at)
    k++;
  return k;
}

// 搜尋範圍（搜尋框旁的開關，存在 localStorage）：預設只搜尋標題（編號、歌名、調性）
export const DEFAULT_SEARCH_SCOPE = { title: true, lyrics: false };

// localStorage 存的字串（JSON）→ { title, lyrics }；壞掉或兩個都關時用預設值（至少要搜尋一樣）
export function parse_search_scope(text) {
  var scope;
  try {
    scope = JSON.parse(text);
  } catch (e) {
    scope = null;
  }
  if (!scope || typeof scope != 'object')
    return { ...DEFAULT_SEARCH_SCOPE };
  var result = { title: scope.title !== false, lyrics: scope.lyrics === true };
  return result.title || result.lyrics ? result : { ...DEFAULT_SEARCH_SCOPE };
}

// 搜尋結果的排序（數字小的在前，同一級照原本的順序）
export const RANK_EXACT = 0;   // 歌名（或曲號）完全符合
export const RANK_PREFIX = 1;  // 比對到歌名開頭
export const RANK_TITLE = 2;   // 比對到標題（編號、歌名、調性）任一處
export const RANK_LYRICS = 3;  // 只有歌詞符合

// 符合處是不是剛好整串文字
function whole(m, text) {
  return !!m && m.index == 0 && m.length == text.length;
}

// 符合的列排在前面，依 rank 再依原本的順序（order）；不符合的列（rank 是 null）照原本的順序排在最後
// entries：[{ rank, order, … }] → 新陣列
export function sort_by_rank(entries) {
  var key = (e) => (e.rank == null ? Infinity : e.rank);
  return entries.slice().sort((a, b) => key(a) - key(b) || a.order - b.order);
}

// 把 current 的順序排成 desired（同一組元素）時，哪些元素不用動：
// 留下最長的「在 current 裡位置遞增」的子序列，其他的才搬，搬動的次數最少
// → Set（不用動的元素）
export function unmoved(current, desired) {
  var position = new Map(current.map((x, k) => [x, k]));
  var pos = desired.map((x) => position.get(x));
  // 最長遞增子序列（O(n log n)）：tails[l] = 長度 l+1 的子序列結尾在 desired 的 index
  var tails = [];
  var prev = new Array(desired.length);
  pos.forEach((p, i) => {
    var lo = 0, hi = tails.length;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (pos[tails[mid]] < p) lo = mid + 1; else hi = mid;
    }
    prev[i] = lo > 0 ? tails[lo - 1] : -1;
    tails[lo] = i;
  });
  var keep = new Set();
  for (var i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i])
    keep.add(desired[i]);
  return keep;
}

// 一首歌是否符合：先比對標題；標題不符合才比對歌詞
// → null（不符合）或 { rank, lyric }；lyric 只有在只有歌詞符合時才是符合的那一句，否則 null
// get_lyrics() 傳回 song_lyric_search_index 的結果；只在標題不符合時才呼叫，可以留給呼叫端快取
// scope：要比對哪些（見 parse_search_scope），預設兩個都比對
export function match_song(find, song, get_lyrics, scope = { title: true, lyrics: true }) {
  if (scope.title) {
    var name = String(song.name == null ? '' : song.name);
    var id = String(song.id);
    var in_name = find(name);
    if (whole(in_name, name) || whole(find(id), id))
      return { rank: RANK_EXACT, lyric: null };
    if (in_name && in_name.index == 0)
      return { rank: RANK_PREFIX, lyric: null };
    if (find(song_title_text(song)))
      return { rank: RANK_TITLE, lyric: null };
  }
  if (!scope.lyrics)
    return null;
  var lyrics = get_lyrics();
  if (!lyrics.text)
    return null;
  var m = find(lyrics.text);
  return m ? { rank: RANK_LYRICS, lyric: matched_lyric_lines(lyrics, m) } : null;
}
