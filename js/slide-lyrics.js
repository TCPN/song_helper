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
//    段名：有 P: → 段落名稱＋第幾節（A1、A2、B1…）；沒有 P: → 整首一段，只有一節叫 Verse，多節 Verse1、Verse2…
//    W:（譜後的歌詞）放在最後一段「W」，空的 W: 行是段內分段。
//
// 段的格式：{ name, source, paragraphs: [[行, …], …] }
//   name：段名（格子裡沒寫段名的段是 null）；source：「= A1」的 A1，沒有時 null

import { has_part_marks, has_lyrics } from './song-checks.js';

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

// 一行譜裡有歌詞的音符數，與段落標記、小節線的位置（都以「之前有幾個音符」表示）
// → { marks: [{ name, at }]（[P:B] 的段名與位置）, bars: [位置…] }
// 休止符（z x Z X）、裝飾音 {…}、和弦記號 "…"、裝飾 !…! +…+ 不算音符；[CEG] 和音算一個
export function music_line_marks(line) {
  var marks = [];
  var bars = [];
  var notes = 0;
  var i = 0;
  var skip_to = (ch) => {
    var j = line.indexOf(ch, i + 1);
    i = j < 0 ? line.length : j + 1;
  };
  while (i < line.length) {
    var c = line[i];
    if (c == '%')
      break;
    if (c == '"' || c == '!' || c == '+') {
      skip_to(c);
    } else if (c == '{') {
      skip_to('}');
    } else if (c == '[') {
      var field = line.slice(i).match(/^\[([A-Za-z]):([^\]]*)\]/);
      if (field) {
        if (field[1] == 'P')
          marks.push({ name: field[2].trim(), at: notes });
        i += field[0].length;
      } else if (line[i + 1] == '|' || /\d/.test(line[i + 1] || '')) {
        // [| 小節線、[1 [2 反覆結尾
        i++;
      } else {
        // 和音：整組算一個音符
        notes++;
        skip_to(']');
      }
    } else if (c == '|' || c == ':') {
      while (i < line.length && /[|:\]\[]/.test(line[i]) && !(line[i] == '[' && /[A-Za-z]/.test(line[i + 1] || '')))
        i++;
      bars.push(notes);
    } else {
      if (/[A-Ga-g]/.test(c))
        notes++;
      i++;
    }
  }
  return { marks, bars };
}

// 一行 w: 的內容（不含「w:」）→ 每個音符對到的音節：[{ text, hyphen }]
// text 空字串是沒有字的音符（`_` 延長、`*` 跳過、單獨的 `-`）；hyphen：和下一個音節是同一個字（後面接 `-`）
// `|` 跳到下一個小節（bars 是小節線前的音符數，見 music_line_marks），`~` 是同一個音下的空格，`\-` 是連字號
export function w_slots(w, bars = []) {
  var slots = [];
  var tokens = [...w.replace(/\\-/g, '\u0000').matchAll(/[^\s\-_*|]+|\S/g)];
  tokens.forEach((m, k) => {
    var token = m[0];
    var prev = slots[slots.length - 1];
    var attached = m.index > 0 && !/\s/.test(w[m.index - 1]) && k > 0;
    if (token == '-') {
      // 緊接在音節後面：同一個字；前面是空格或 -：自己算一個音符
      if (attached && prev && tokens[k - 1][0] != '-' && tokens[k - 1][0] != '_' && tokens[k - 1][0] != '*' && tokens[k - 1][0] != '|')
        prev.hyphen = true;
      else
        slots.push({ text: '', hyphen: true });
    } else if (token == '_') {
      slots.push({ text: '', hyphen: !!(prev && prev.hyphen) });
    } else if (token == '*') {
      slots.push({ text: '', hyphen: false });
    } else if (token == '|') {
      var next = bars.find((b) => b >= slots.length);
      while (next !== undefined && slots.length < next)
        slots.push({ text: '', hyphen: false });
    } else {
      slots.push({ text: token.replace(/~/g, ' ').replace(/\u0000/g, '-'), hyphen: false });
    }
  });
  return slots;
}

// 音節 → 純文字：同一個字（hyphen）直接相連；字和字之間中文直接相連，英文等隔一個空格
export function slots_text(slots) {
  var words = [];
  var word = '';
  var joined = false;
  for (const slot of slots) {
    if (slot.text) {
      if (!joined && word) {
        words.push(word);
        word = '';
      }
      word += slot.text;
    }
    joined = slot.hyphen;
  }
  if (word)
    words.push(word);
  var text = '';
  for (const w of words) {
    if (text && !CJK.test(text[text.length - 1]) && !CJK.test(w[0]))
      text += ' ';
    text += w;
  }
  return text.replace(/ {2,}/g, ' ').trim();
}

// 一行 w: 的內容 → 純文字（不對音符，例如測試用）
export function w_line_text(w) {
  return slots_text(w_slots(w));
}

// ABC → 從 w: 產生的段（{ name, source, paragraphs } 的陣列）
// 行中間的 [P:B]：這行 w: 從那個音符開始的字都算 B 段（依音符數對齊 w: 的音節）
export function sections_from_abc(abc) {
  var lines = String(abc || '').split(/\r?\n/);
  var k = lines.findIndex((line) => /^K:/.test(line));
  var parts = []; // 依出現順序：{ name, verses: [[行…]…] }；name 是 null 表示第一個 P: 之前（或沒有 P:）
  var current = null; // 目前的段名
  var segments = [{ at: 0, name: null }]; // 目前這行譜的段：從第幾個音符開始是哪一段
  var bars = [];
  var verse = 0; // 目前這行譜下面的第幾行 w:
  var w_text = []; // W: 的行（空字串 = 分段）
  function add_line(name, verse, text) {
    var p = parts.find((p) => p.name === name);
    if (!p)
      parts.push(p = { name, verses: [] });
    (p.verses[verse] = p.verses[verse] || []).push(text);
  }
  for (const line of k < 0 ? [] : lines.slice(k + 1)) {
    var m;
    if ((m = line.match(/^w:(.*)$/))) {
      var slots = w_slots(m[1], bars);
      segments.forEach((seg, i) => {
        var end = i + 1 < segments.length ? segments[i + 1].at : slots.length;
        var text = slots_text(slots.slice(seg.at, end));
        if (text)
          add_line(seg.name, verse, text);
      });
      verse++;
      continue;
    }
    if ((m = line.match(/^W:(.*)$/))) {
      w_text.push(m[1]);
      continue;
    }
    if ((m = line.match(/^P:\s*(.*?)\s*$/))) {
      current = m[1];
      segments = [{ at: 0, name: current }];
      continue;
    }
    // 其他欄位、註解、%% 指令、空行都不是一行譜
    if (/^[A-Za-z+]:/.test(line) || /^\s*%/.test(line) || !line.trim())
      continue;
    // 一行譜：之後的 w: 從第一節算起
    verse = 0;
    var info = music_line_marks(line);
    bars = info.bars;
    segments = [{ at: 0, name: current }];
    for (const mark of info.marks) {
      var last = segments[segments.length - 1];
      if (mark.at == last.at)
        last.name = mark.name;
      else
        segments.push({ at: mark.at, name: mark.name });
    }
    current = segments[segments.length - 1].name;
  }
  var sections = [];
  for (const p of parts) {
    // 沒有 P: 的歌整首一段：只有一節時叫 Verse，多節時 Verse1、Verse2…；第一個 P: 之前的歌詞也一樣
    var verses = p.verses.map((verse_lines) => (verse_lines || []).filter(Boolean));
    var single = p.name === null && verses.filter((kept) => kept.length).length == 1;
    verses.forEach((kept, i) => {
      if (kept.length)
        sections.push({ name: single ? UNNAMED : (p.name === null ? UNNAMED : p.name) + (i + 1), source: null, paragraphs: [kept] });
    });
  }
  var w_paragraphs = to_paragraphs(w_text);
  if (w_paragraphs.length)
    sections.push({ name: 'W', source: null, paragraphs: w_paragraphs });
  return sections;
}

// 沒有段名的段：譜上沒有 P: 的歌詞、「投影片」欄第一個 [段名] 之前的文字
export const UNNAMED = 'Verse';

// 一首歌投影片用的歌詞：「投影片」欄有字就用它，不然從 ABC 產生
// → { from: 'cell' | 'abc', order, sections, score_has_lyrics, score_has_parts, cell_has_headers }
//   score_has_lyrics／score_has_parts：譜上有沒有 w: 歌詞、P: 段落標記（js/song-checks.js 的規則）；
//   cell_has_headers：「投影片」欄有沒有 [段名]（沒用格子時為 null）
export function song_slide_lyrics(song) {
  var abc = song && song.abc;
  var score = { score_has_lyrics: has_lyrics(abc), score_has_parts: has_part_marks(abc) };
  var cell = song && song.slides;
  if (cell != null && String(cell).trim()) {
    var parsed = parse_slide_cell(cell);
    return { from: 'cell', order: parsed.order, sections: parsed.sections, ...score,
      cell_has_headers: parsed.sections.some((s) => s.name !== null) };
  }
  return { from: 'abc', order: null, sections: sections_from_abc(abc), ...score, cell_has_headers: null };
}

// 歌詞上方的訊息，一則一行：{ type, text }。type 'info'：歌詞從哪裡來（「投影片」欄不寫）；'warning'：缺少段落標記
export function lyrics_messages(lyrics) {
  var messages = [];
  if (lyrics.from == 'abc')
    messages.push({ type: 'info', text: lyrics.sections.length ? '從歌譜中自動抽出' : '這首歌沒有歌詞' });
  if (lyrics.score_has_lyrics && !lyrics.score_has_parts)
    messages.push({ type: 'warning', text: '歌譜缺少段落標記（P:）' });
  if (lyrics.cell_has_headers === false)
    messages.push({ type: 'warning', text: '投影片欄缺少段落標記（[段名]）' });
  return messages;
}

// 複製用的純文字：selected(段, 段落, 行) 為 true 的行，一行一句；換段落或換段時空一行；不放段名
// selected 傳回字串時用那個字串代替整行（只選到一行的一部分）
export function lines_text(sections, selected = () => true) {
  var text = '';
  var last = null;
  sections.forEach((section, s) => section.paragraphs.forEach((paragraph, p) => paragraph.forEach((line, l) => {
    var pick = selected(s, p, l);
    if (!pick)
      return;
    if (last)
      text += last.s == s && last.p == p ? '\n' : '\n\n';
    text += typeof pick == 'string' ? pick : line;
    last = { s, p };
  })));
  return text;
}
