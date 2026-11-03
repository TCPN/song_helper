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

// 一首歌是否符合：先比對標題文字；標題不符合才比對歌詞
// → null（不符合）、{ lyric: null }（標題符合）、{ lyric: '符合的那一句' }（只有歌詞符合）
// get_lyrics() 傳回 song_lyric_search_index 的結果；只在標題不符合時才呼叫，可以留給呼叫端快取
export function match_song(find, title, get_lyrics) {
  if (find(title))
    return { lyric: null };
  var lyrics = get_lyrics();
  if (!lyrics.text)
    return null;
  var m = find(lyrics.text);
  return m ? { lyric: matched_lyric_lines(lyrics, m) } : null;
}
