// 歌詞自動排版（投影片用）：依「每頁行數、最多行數、每行字數、空格」把每一段的歌詞重新分行、分頁（純函式，不碰 DOM）
//
// 規則：
// - 同一段的行先接起來，再重新換行：每個字和字之間有一個「斷句分數」，在每行字數之內，挑分數高、各行長度又平均的地方換行
//   （動態規劃，見 break_lines）。分數的來源：
//   - 譜（hints，js/slide-lyrics.js 的 sections_from_abc）：後面有休止符、延長記號、換氣記號、長音、小節線、譜的行尾；
//   - 文字：中文之間的空格（片語）、標點、原本的換行與分頁（沒有譜的分數時，原本的換行算很強的斷點）；
//   - 斷詞（Intl.Segmenter）：詞的中間不換行；英文單字、`-` 連起來的音節也不拆。
//   一行裝得下的片語盡量放在同一行，只有很強的斷點（例如休止符加長音）才會把裝得下的兩句分開。
// - 寬度用全形字算：中文、全形標點、全形空格算 1，英數、半形空格算 0.5；空格照歌詞檢視的空格顯示方式
//   （js/slide-lyrics.js 的 SPACE_MODES：隱藏／半形／全形）換過之後再算。
// - 每段各自分頁（段一定從新的一頁開始），原本段裡的分頁不管，重新分：頁數盡量讓每頁有「每頁行數」到「最多行數」行，
//   各頁的行數平均（前面的頁多一行）；換頁的地方往前或往後挪一行，挑斷句分數比較高的地方。
// 結果是編輯區的文字格式（js/lyric-layout.js 的 section_to_text：一行一句，換頁空一行），存的時候空格一律半形。

import { CJK, SPACE_MODES, normalize_space_mode } from './slide-lyrics.js';
import { text_to_paragraphs } from './lyric-layout.js';

export const DEFAULT_AUTO_LAYOUT = {
  // 每頁的預設行數
  lines: 2,
  // 每頁最多行數（為了不留只有一兩行的頁，可以多放到這麼多行）
  max_lines: 3,
  // 每行最多幾個字（全形字的寬度）
  width: 13,
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

// ---- 斷句分數 ----

// 全形標點：不放在行首，接在前一個字後面
const CJK_PUNCT = /[　-〿！-／：-＠［-｀｛-･]/;
// 句子或片語結尾的標點
const END_PUNCT = /[，。！？；：、,.!?;:]$/;
const WORD = /[A-Za-z0-9À-ɏ'’]/;

// 文字的斷句分數（加在譜的分數上）
export const TEXT_SCORES = {
  cjk_space: 3, // 中文和中文之間的空格（片語）
  word_space: 0.5, // 英文等單字之間的空格
  punct: 4, // 標點之後
  line: 20, // 原本的換行（沒有譜的分數時，當成人排好的，幾乎一定保留；有譜時是 1，譜的行尾已經算過）
  paragraph: 20, // 原本的分頁（同上）
  hinted_line: 1,
};

// 動態規劃的成本：每多一行 LINE；每行空出來的比例平方乘上 SLACK（整段只有一行時不算）；切在詞中間 FORBIDDEN；超過寬度 OVERFLOW。
// 換行的地方：分數 GOOD（中文片語的空格）以上算好的斷點，越高越好（每多 1 分少 1）；不到 GOOD 的每少 1 分多 WEAK
const COST = { LINE: 6, SLACK: 6, FORBIDDEN: 30, OVERFLOW: 100, GOOD: 3, WEAK: 4 };

function break_cost(score) {
  if (score === null)
    return COST.FORBIDDEN;
  return score >= COST.GOOD ? -(score - COST.GOOD) : (COST.GOOD - score) * COST.WEAK;
}

// 斷詞：Intl.Segmenter 不能用時（很舊的瀏覽器）傳回 null，就不管詞的邊界
var segmenter;
function word_segmenter() {
  if (segmenter === undefined) {
    try {
      segmenter = new Intl.Segmenter('zh-Hant', { granularity: 'word' });
    } catch (e) {
      segmenter = null;
    }
  }
  return segmenter;
}

// 一行字 → 詞的開頭位置（字串索引的集合）；不能斷詞時 null
function word_starts(text) {
  var seg = word_segmenter();
  if (!seg)
    return null;
  return new Set([...seg.segment(text)].map((part) => part.index));
}

// 譜的分數對到這段文字的字：source（[{ c, s }]）和 text 去掉空白後的字做最長共同子序列，對到的字用譜的 s，
// 對不到的是 undefined（沒有分數）。source 是 null 或空的時候傳回 null
export function align_hints(text, source) {
  if (!source || !source.length)
    return null;
  var a = [...String(text).replace(/\s+/g, '')];
  var b = source;
  var n = a.length, m = b.length;
  var width = m + 1;
  var lcs = new Uint16Array((n + 1) * width);
  for (var i = n - 1; i >= 0; i--)
    for (var j = m - 1; j >= 0; j--)
      lcs[i * width + j] = a[i] == b[j].c ? lcs[(i + 1) * width + j + 1] + 1 : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
  var result = new Array(n).fill(undefined);
  i = 0; j = 0;
  while (i < n && j < m) {
    if (a[i] == b[j].c) {
      result[i] = b[j].s;
      i++; j++;
    } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return result;
}

// 從譜上抽出的各段（sections_from_abc(abc, { hints: true })）裡，挑這段要用的分數：
// 段名（或 [段名 = A1] 的 A1）一樣的那段；沒有時用整首接起來的分數
export function hints_for(abc_sections, name, source = null) {
  if (!abc_sections || !abc_sections.length)
    return null;
  var same = abc_sections.find((s) => s.hints && (s.name === source || s.name === name));
  if (same)
    return same.hints;
  var all = abc_sections.flatMap((s) => s.hints || []);
  return all.length ? all : null;
}

// 一段的文字 → 字塊（中文一個字一塊、英數連在一起一塊、標點接在前一塊）與每塊後面的空隙：
// [{ text, gap: { space, line_end, para_end, hint, inside_word } }]；hints 是 align_hints 的結果（或 null）
function atoms_of(text, hints) {
  var atoms = [];
  var paragraphs = text_to_paragraphs(text);
  var k = 0; // 第幾個非空白字（對 hints）
  paragraphs.forEach((paragraph, p) => {
    paragraph.forEach((line, l) => {
      var compact = line.replace(/[ 　]+/g, '');
      var starts = word_starts(compact);
      var pos = 0; // 在 compact 裡的位置
      var line_atoms = [];
      var space = false;
      for (const c of line) {
        if (c == ' ' || c == '　') {
          space = true;
          continue;
        }
        var last = line_atoms[line_atoms.length - 1];
        var cjk = CJK.test(c);
        var attach = last && !space && (CJK_PUNCT.test(c) || /[,.!?;:)\]」』]/.test(c) || (!cjk && !CJK.test(last.text[last.text.length - 1])));
        if (last && space)
          last.gap.space = true;
        if (attach) {
          last.text += c;
          last.end = pos;
          last.hint = hints ? hints[k] : undefined;
        } else {
          if (last)
            last.gap.inside_word = !!(starts && cjk && CJK.test(last.text[last.text.length - 1]) && !last.gap.space && !starts.has(pos));
          line_atoms.push({ text: c, end: pos, hint: hints ? hints[k] : undefined, gap: { space: false, line_end: false, para_end: false, inside_word: false } });
        }
        space = false;
        pos += c.length;
        k++;
      }
      var tail = line_atoms[line_atoms.length - 1];
      if (tail) {
        tail.gap.line_end = true;
        tail.gap.para_end = l == paragraph.length - 1 && p < paragraphs.length - 1;
      }
      atoms.push(...line_atoms);
    });
  });
  for (const atom of atoms) {
    atom.gap.hint = atom.hint;
    delete atom.hint;
    delete atom.end;
  }
  return atoms;
}

// 一個空隙的斷句分數；不能斷（英文單字中間、`-` 連起來的音節、詞的中間）時 null
export function gap_score(atom, next, hinted) {
  var gap = atom.gap;
  if (gap.hint === null)
    return null;
  if (gap.inside_word && !gap.line_end)
    return null;
  var score = gap.hint || 0;
  if (gap.space)
    score += CJK.test(atom.text[atom.text.length - 1]) || (next && CJK.test(next.text[0])) ? TEXT_SCORES.cjk_space : TEXT_SCORES.word_space;
  if (END_PUNCT.test(atom.text))
    score += TEXT_SCORES.punct;
  if (gap.para_end)
    score += hinted ? TEXT_SCORES.hinted_line : TEXT_SCORES.paragraph;
  else if (gap.line_end)
    score += hinted ? TEXT_SCORES.hinted_line : TEXT_SCORES.line;
  return score;
}

// 原本換行的地方接起來時，分數到這裡（例如有休止符）才在中間空格
const JOIN_SPACE = 5;

// 兩塊放在同一行時中間要不要空格：原本有空格、英數和英數之間；原本換行的地方（接起來時）中文之間看分數，
// 分數夠高（片語結尾）才空格
function joiner(atom, next, score) {
  var a = atom.text[atom.text.length - 1], b = next.text[0];
  var words = WORD.test(a) && WORD.test(b);
  if (atom.gap.space || words)
    return ' ';
  if (atom.gap.line_end && score !== null && score >= JOIN_SPACE)
    return ' ';
  if (atom.gap.line_end && !CJK.test(a) && !CJK.test(b))
    return ' ';
  return '';
}

// 字塊 → 行：每行寬度不超過 width（一塊本身就超過時自己一行），成本最低的換法。
// 傳回 [{ text, score }]：score 是這一行後面那個空隙的斷句分數（最後一行是 Infinity）
export function break_lines(atoms, width, space_mode = 'half', hinted = false) {
  var n = atoms.length;
  if (!n)
    return [];
  var scores = atoms.map((atom, i) => (i < n - 1 ? gap_score(atom, atoms[i + 1], hinted) : Infinity));
  var best = new Array(n + 1).fill(Infinity);
  var from = new Array(n + 1).fill(-1);
  best[0] = 0;
  for (var i = 0; i < n; i++) {
    if (best[i] == Infinity)
      continue;
    var text = '';
    for (var j = i; j < n; j++) {
      text += (j > i ? joiner(atoms[j - 1], atoms[j], scores[j - 1]) : '') + atoms[j].text;
      var w = text_width(text, space_mode);
      if (w > width && j > i)
        break;
      var cost = COST.LINE + (w > width ? COST.OVERFLOW : 0);
      // 空出來的部分：只有一行時不算（最後一行也算，各行才會平均）
      if (i > 0 || j < n - 1)
        cost += COST.SLACK * (Math.max(0, width - w) / width) ** 2;
      if (j < n - 1)
        cost += break_cost(scores[j]);
      if (best[i] + cost < best[j + 1]) {
        best[j + 1] = best[i] + cost;
        from[j + 1] = i;
      }
    }
  }
  var lines = [];
  for (var end = n; end > 0; end = from[end]) {
    var start = from[end];
    var line = atoms[start].text;
    for (var t = start + 1; t < end; t++)
      line += joiner(atoms[t - 1], atoms[t], scores[t - 1]) + atoms[t].text;
    lines.unshift({ text: line, score: scores[end - 1] === null ? -COST.FORBIDDEN : scores[end - 1] });
  }
  return lines;
}

// 換頁的位置（第幾行之前換頁）往前或往後挪一行，挑前一行斷句分數比較高的地方（一樣時不挪）；
// 挪了之後每頁還是不超過 max_lines 行、也不會空頁
function adjust_breaks(sizes, line_scores, max_lines) {
  if (!sizes.length)
    return sizes;
  var breaks = [];
  var at = 0;
  sizes.slice(0, -1).forEach((size) => breaks.push(at += size));
  var total = at + sizes[sizes.length - 1];
  breaks.forEach((b, i) => {
    var prev = i > 0 ? breaks[i - 1] : 0;
    var next = i + 1 < breaks.length ? breaks[i + 1] : total;
    var choice = b;
    for (const c of [b - 1, b + 1]) {
      if (c > prev && c < next && c - prev <= max_lines && next - c <= max_lines && line_scores[c - 1] > line_scores[choice - 1])
        choice = c;
    }
    breaks[i] = choice;
  });
  var result = [];
  var last = 0;
  for (const b of [...breaks, total]) {
    result.push(b - last);
    last = b;
  }
  return result;
}

// 一段的文字（編輯區格式）→ 自動排版後的文字（同樣格式；空格一律半形）。
// hints：譜的斷句分數（align_hints 的結果，對到這段去掉空白後的每個字）；沒有譜時 null
export function auto_layout_text(text, options, space_mode = 'half', hints = null) {
  var { lines, max_lines, width } = normalize_auto_layout(options);
  var hinted = !!(hints && hints.some((h) => h !== undefined));
  var broken = break_lines(atoms_of(text, hinted ? hints : null), width, space_mode, hinted);
  var sizes = adjust_breaks(page_sizes(broken.length, lines, max_lines), broken.map((l) => l.score), max_lines);
  var pages = [];
  var at = 0;
  for (const size of sizes) {
    pages.push(broken.slice(at, at + size).map((l) => l.text).join('\n'));
    at += size;
  }
  return pages.join('\n\n');
}
