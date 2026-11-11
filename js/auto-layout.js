// 歌詞自動排版（投影片用）：依「每頁行數、最多行數、每行字數、空格」把每一段的歌詞重新分行、分頁（純函式，不碰 DOM）
//
// 規則：
// - 原本的一行（譜上的一行、「投影片」欄的一行）放得下就不動；太長時在空格（片語之間）斷開，
//   斷成最少的行數，各行盡量一樣長；一個片語本身就太長時再從字中間斷（中文一個字一個字，英文單字不拆）。
//   原本的行不會合併（不知道哪裡是句子的結尾）。
// - 寬度用全形字算：中文、全形標點、全形空格算 1，英數、半形空格算 0.5；空格照歌詞檢視的空格顯示方式
//   （js/slide-lyrics.js 的 SPACE_MODES：隱藏／半形／全形）換過之後再算。
// - 每段各自分頁（段一定從新的一頁開始），原本段裡的分頁不管，重新分：頁數盡量讓每頁有「每頁行數」到「最多行數」行，
//   各頁的行數平均（前面的頁多一行）；換頁的地方盡量不要切在同一個原本的行斷成的幾行中間。
// 結果是編輯區的文字格式（js/lyric-layout.js 的 section_to_text：一行一句，換頁空一行），存的時候空格一律半形。

import { CJK, SPACE_MODES, normalize_space_mode } from './slide-lyrics.js';
import { text_to_paragraphs } from './lyric-layout.js';

export const DEFAULT_AUTO_LAYOUT = {
  // 每頁的預設行數
  lines: 4,
  // 每頁最多行數（為了不留只有一兩行的頁，可以多放到這麼多行）
  max_lines: 6,
  // 每行最多幾個字（全形字的寬度）
  width: 16,
};

export const AUTO_LAYOUT_STEPS = {
  lines: { step: 1, min: 1, max: 12 },
  max_lines: { step: 1, min: 1, max: 12 },
  width: { step: 1, min: 4, max: 40 },
};

function clamp(value, { min, max }) {
  return Math.min(max, Math.max(min, value));
}

// 不認識的欄位丟掉；沒有、型別不對或超出範圍的值用預設值或拉回範圍內；最多行數不少於每頁行數
export function normalize_auto_layout(options) {
  var source = options && typeof options == 'object' ? options : {};
  var result = { ...DEFAULT_AUTO_LAYOUT };
  for (const [key, range] of Object.entries(AUTO_LAYOUT_STEPS)) {
    if (typeof source[key] == 'number' && Number.isFinite(source[key]))
      result[key] = clamp(Math.round(source[key]), range);
  }
  result.max_lines = Math.max(result.max_lines, result.lines);
  return result;
}

// localStorage 裡的字串（可能沒有或被改壞）轉成設定
export function parse_auto_layout(text) {
  try {
    return normalize_auto_layout(JSON.parse(text));
  } catch (e) {
    return normalize_auto_layout(null);
  }
}

// 調整一個數值設定（steps 格）。改每頁行數時最多行數跟著不少於它；改最多行數時每頁行數跟著不多於它
export function step_auto_layout(options, key, steps) {
  var current = normalize_auto_layout(options);
  var range = AUTO_LAYOUT_STEPS[key];
  if (!range)
    return current;
  var value = clamp(current[key] + steps * range.step, range);
  var next = { ...current, [key]: value };
  if (key == 'max_lines' && next.lines > value)
    next.lines = value;
  return normalize_auto_layout(next);
}

// 已經到上下限，−／＋ 不能按
export function auto_layout_at_limit(options, key, steps) {
  var range = AUTO_LAYOUT_STEPS[key];
  var value = normalize_auto_layout(options)[key];
  return steps < 0 ? value <= range.min : value >= range.max;
}

// 一行字顯示出來的寬度（全形字的寬度）：中文、全形字 1，其他 0.5；空格先照顯示方式換過
export function text_width(text, space_mode = 'half') {
  var shown = SPACE_MODES[normalize_space_mode(space_mode)](String(text));
  var width = 0;
  for (const c of shown)
    width += CJK.test(c) ? 1 : 0.5;
  return width;
}

// pieces（{ text, space }：space 是和前一塊之間有沒有空格）接成一行
function join_pieces(pieces) {
  return pieces.reduce((line, p, i) => line + (i && p.space ? ' ' : '') + p.text, '');
}

// 照順序把 pieces 塞進每行寬度不超過 cap 的行（一塊本身超過 cap 時自己一行）→ 行的陣列（每行是 pieces 的陣列）
function fill(pieces, cap, space_mode) {
  var lines = [];
  var current = [];
  for (const piece of pieces) {
    if (current.length && text_width(join_pieces([...current, piece]), space_mode) > cap) {
      lines.push(current);
      current = [];
    }
    current.push(piece);
  }
  if (current.length)
    lines.push(current);
  return lines;
}

// 分成最少的行數，各行盡量一樣長：先用 width 塞出最少的行數，再找能塞成這麼多行的最小寬度
function balanced(pieces, width, space_mode) {
  var lines = fill(pieces, width, space_mode);
  if (lines.length <= 1)
    return lines;
  var count = lines.length;
  var total = text_width(join_pieces(pieces), space_mode);
  for (var cap = Math.ceil(total / count * 2) / 2; cap < width; cap += 0.5) {
    var tried = fill(pieces, cap, space_mode);
    if (tried.length <= count)
      return tried;
  }
  return lines;
}

// 一個片語（沒有空格）從字中間斷開用的單位：中文一個字一個，英數等連在一起的算一個（單字不拆）
function units(phrase) {
  return phrase.match(new RegExp(CJK.source + '|[^' + CJK.source.slice(1, -1) + ']+', 'g')) || [];
}

// 原本的一行 → 自動排版後的幾行
export function wrap_line(line, width, space_mode = 'half') {
  var text = String(line).trim().replace(/[ 　]+/g, ' ');
  if (!text || text_width(text, space_mode) <= width)
    return text ? [text] : [];
  var pieces = [];
  for (const phrase of text.split(' ')) {
    if (text_width(phrase, space_mode) <= width) {
      pieces.push({ text: phrase, space: true });
      continue;
    }
    // 片語本身太長：從字中間斷成幾塊，塊和塊之間沒有空格
    var parts = balanced(units(phrase).map((u) => ({ text: u, space: false })), width, space_mode);
    parts.forEach((part, i) => pieces.push({ text: join_pieces(part), space: i == 0 }));
  }
  return balanced(pieces, width, space_mode).map(join_pieces);
}

// 一段有幾行 → 每頁幾行：頁數盡量讓每頁有 lines 到 max_lines 行（行數不夠時一頁），各頁平均、前面的頁多一行
export function page_sizes(count, lines, max_lines) {
  if (count <= 0)
    return [];
  max_lines = Math.max(max_lines, lines);
  var pages = Math.max(1, Math.ceil(count / max_lines), Math.floor(count / lines));
  var base = Math.floor(count / pages);
  var extra = count % pages;
  return Array.from({ length: pages }, (_, i) => base + (i < extra ? 1 : 0));
}

// 換頁的位置（第幾行之前換頁）盡量放在原本的行和行之間（starts：原本每一行的開頭是第幾行）：
// 切在原本的一行中間時，往前或往後挪一行，挪了之後每頁還是不超過 max_lines 行、也不會空頁
function adjust_breaks(sizes, starts, max_lines) {
  if (!sizes.length)
    return sizes;
  var breaks = [];
  var at = 0;
  sizes.slice(0, -1).forEach((size) => breaks.push(at += size));
  var total = at + sizes[sizes.length - 1];
  var is_start = (b) => starts.includes(b);
  breaks.forEach((b, i) => {
    if (is_start(b))
      return;
    var prev = i > 0 ? breaks[i - 1] : 0;
    var next = i + 1 < breaks.length ? breaks[i + 1] : total;
    for (const c of [b - 1, b + 1]) {
      if (is_start(c) && c > prev && c < next && c - prev <= max_lines && next - c <= max_lines) {
        breaks[i] = c;
        return;
      }
    }
  });
  var result = [];
  var last = 0;
  for (const b of [...breaks, total]) {
    result.push(b - last);
    last = b;
  }
  return result;
}

// 一段的文字（編輯區格式）→ 自動排版後的文字（同樣格式；空格一律半形）
export function auto_layout_text(text, options, space_mode = 'half') {
  var { lines, max_lines, width } = normalize_auto_layout(options);
  var wrapped = [];
  var starts = [];
  for (const line of text_to_paragraphs(text).flat()) {
    starts.push(wrapped.length);
    wrapped.push(...wrap_line(line, width, space_mode));
  }
  var sizes = adjust_breaks(page_sizes(wrapped.length, lines, max_lines), starts, max_lines);
  var pages = [];
  var at = 0;
  for (const size of sizes) {
    pages.push(wrapped.slice(at, at + size).join('\n'));
    at += size;
  }
  return pages.join('\n\n');
}
