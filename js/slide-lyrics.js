// 投影片用的歌詞：分段、分行的純文字（不碰 DOM、不呼叫 abcjs）
//
// 來源有兩個（#67）：
// 1. 試算表的「投影片」欄（song.slides）。格式：
//      順序: 主歌1 副歌        ← 演唱順序，第一版先讀起來保留，不使用
//      [主歌1 = A1]            ← 開新的一段；「= A1」對到譜上的段（第二版比對用）
//      奇異恩典 何等甘甜
//      我罪已得赦免             ← 換行 = 換行
//                              ← 空一行 = 段內分段（投影片換頁）
//      ...
//    也接受單行的寫法：`/` = 空一格、`//` = 換行、`///` = 空一行。第一個 [段名] 之前的文字算一段沒有名字的段。
// 2. 格子空白時從 ABC 的 w: 自動產生：第幾行 w: 就是第幾節，譜上一行 = 歌詞一行。
//    段名：有 P: → 段落名稱＋第幾節（A1、A2、B1…）；沒有 P: → 整首一段，V1、V2…
//    W:（譜後的歌詞）放在最後一段「W」，空的 W: 行是段內分段。
//
// 段的格式：{ name, source, paragraphs: [[行, …], …] }
//   name：段名（格子裡沒寫段名的段是 null）；source：「= A1」的 A1，沒有時 null

import { has_part_marks } from './song-checks.js';

// 一行裡的 `/` `//` `///`（三條以上都當 ///）換成空格、換行、空一行，前後的空白一起拿掉
function expand_slashes(text) {
  return text.replace(/[ \t]*\/{3,}[ \t]*/g, '\n\n')
    .replace(/[ \t]*\/\/[ \t]*/g, '\n')
    .replace(/[ \t]*\/[ \t]*/g, ' ');
}

// 多行文字 → 段落（空行分開），每行去掉前後空白
function to_paragraphs(lines) {
  var paragraphs = [];
  var current = [];
  for (const line of lines) {
    var text = line.trim();
    if (text) {
      current.push(text);
    } else if (current.length) {
      paragraphs.push(current);
      current = [];
    }
  }
  if (current.length)
    paragraphs.push(current);
  return paragraphs;
}

const HEADER = /^\s*\[([^\]=]*?)\s*(?:=\s*([^\]]*?)\s*)?\]\s*$/;
const ORDER = /^\s*順序\s*[:：](.*)$/;

// 「投影片」欄的文字 → { order, sections }；order 是段名的陣列（沒有「順序:」行時為 null）
export function parse_slide_cell(text) {
  var order = null;
  var sections = [];
  var current = { name: null, source: null, lines: [] };
  for (const raw of String(text || '').split(/\r?\n/)) {
    var m;
    if ((m = raw.match(ORDER))) {
      order = m[1].trim().split(/\s+/).filter(Boolean);
      continue;
    }
    if ((m = raw.match(HEADER))) {
      sections.push(current);
      current = { name: m[1].trim(), source: m[2] ? m[2].trim() : null, lines: [] };
      continue;
    }
    current.lines.push(...expand_slashes(raw).split('\n'));
  }
  sections.push(current);
  sections = sections
    .map(({ name, source, lines }) => ({ name, source, paragraphs: to_paragraphs(lines) }))
    // 沒有名字又沒有字的段（例如第一個段名之前的空行）不算；有段名的空段保留
    .filter((s) => s.name !== null || s.paragraphs.length);
  return { order, sections };
}

// 中日韓文字（含全形標點）：兩個音節之間如果有一邊是這種字，接起來時不加空格
const CJK = /[\u2E80-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/;

// 一行 w: 的內容（不含「w:」）→ 純文字。音節用空格分開時接回來：中文直接相連，英文等隔一個空格；
// `-` 是同一個字的音節（直接相連），`_` `*` 是延長／空白音節，`|` 是小節，`~` 是同一個音下的空格，`\-` 是連字號
export function w_line_text(w) {
  var words = [];
  var word = '';
  var joined = false; // 下一個音節要接在 word 後面（前面是 -）
  function end_word() {
    if (word)
      words.push(word);
    word = '';
  }
  var tokens = w.replace(/\\-/g, '\u0000').match(/[^\s\-_*|]+|-|\S/g) || [];
  for (const token of tokens) {
    if (token == '-') {
      joined = true;
      continue;
    }
    if (token == '_' || token == '*' || token == '|')
      continue;
    var syllable = token.replace(/~/g, ' ').replace(/\u0000/g, '-');
    if (!joined)
      end_word();
    word += syllable;
    joined = false;
  }
  end_word();
  var text = '';
  for (const w of words) {
    if (text && !CJK.test(text[text.length - 1]) && !CJK.test(w[0]))
      text += ' ';
    text += w;
  }
  return text.replace(/ {2,}/g, ' ').trim();
}

// ABC → 從 w: 產生的段（{ name, source, paragraphs } 的陣列）
// 行首的 [P:B] 從這行開始換段；行中間的 [P:C] 從下一行譜開始（第一版不把一行歌詞切開）
export function sections_from_abc(abc) {
  var lines = String(abc || '').split(/\r?\n/);
  var k = lines.findIndex((line) => /^K:/.test(line));
  var parts = []; // 依出現順序：{ name, verses: [[行…]…] }；name 是 null 表示第一個 P: 之前（或沒有 P:）
  var part = null;
  var next_part = null; // 行中間的 [P:]，下一行譜才換
  var verse = 0; // 目前這行譜下面的第幾行 w:
  var w_text = []; // W: 的行（空字串 = 分段）
  function get_part(name) {
    var p = parts.find((p) => p.name === name);
    if (!p)
      parts.push(p = { name, verses: [] });
    return p;
  }
  for (const line of k < 0 ? [] : lines.slice(k + 1)) {
    var m;
    if ((m = line.match(/^w:(.*)$/))) {
      if (!part)
        part = get_part(null);
      (part.verses[verse] = part.verses[verse] || []).push(w_line_text(m[1]));
      verse++;
      continue;
    }
    if ((m = line.match(/^W:(.*)$/))) {
      w_text.push(m[1]);
      continue;
    }
    if ((m = line.match(/^P:\s*(.*?)\s*$/))) {
      part = get_part(m[1]);
      next_part = null;
      continue;
    }
    // 其他欄位、註解、%% 指令、空行都不是一行譜
    if (/^[A-Za-z+]:/.test(line) || /^\s*%/.test(line) || !line.trim())
      continue;
    // 一行譜：之後的 w: 從第一節算起
    verse = 0;
    if (next_part !== null) {
      part = get_part(next_part);
      next_part = null;
    }
    var marks = [...line.matchAll(/\[P:\s*([^\]]*?)\s*\]/g)];
    if (marks.length && /^\s*\[P:/.test(line))
      part = get_part(marks.shift()[1]);
    if (marks.length)
      next_part = marks[marks.length - 1][1];
    if (!part)
      part = get_part(null);
  }
  var sections = [];
  for (const p of parts) {
    // 沒有 P: 的歌整首一段：V1、V2…；第一個 P: 之前的歌詞也叫 V1…
    var prefix = p.name === null ? 'V' : p.name;
    p.verses.forEach((verse_lines, i) => {
      var kept = (verse_lines || []).filter(Boolean);
      if (kept.length)
        sections.push({ name: prefix + (i + 1), source: null, paragraphs: [kept] });
    });
  }
  var w_paragraphs = to_paragraphs(w_text);
  if (w_paragraphs.length)
    sections.push({ name: 'W', source: null, paragraphs: w_paragraphs });
  return sections;
}

// 一首歌投影片用的歌詞：「投影片」欄有字就用它，不然從 ABC 產生
// → { from: 'cell' | 'abc', order, has_parts, sections }；has_parts：譜上有沒有 P: 段落標記（js/song-checks.js 的規則）
export function song_slide_lyrics(song) {
  var abc = song && song.abc;
  var has_parts = has_part_marks(abc);
  var cell = song && song.slides;
  if (cell != null && String(cell).trim()) {
    var parsed = parse_slide_cell(cell);
    return { from: 'cell', order: parsed.order, has_parts, sections: parsed.sections };
  }
  return { from: 'abc', order: null, has_parts, sections: sections_from_abc(abc) };
}

// 複製用的純文字：段內一行一句、段落之間空一行，段與段之間也空一行；不放段名
export function sections_text(sections) {
  return sections
    .map((s) => s.paragraphs.map((p) => p.join('\n')).join('\n\n'))
    .filter(Boolean)
    .join('\n\n');
}
