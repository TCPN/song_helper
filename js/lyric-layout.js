// 歌詞排版編輯（js/lyrics-editor.js）用的純函式：段 ↔ 編輯區的文字、和原本的字比對、存成「投影片」欄格式、復原／重做
// 不碰 DOM。段的格式見 js/slide-lyrics.js：{ name, source, paragraphs: [[行, …], …] }

import { to_paragraphs } from './slide-lyrics.js';

// 一段 → 編輯區裡的文字：一行一句，段內分段（投影片換頁）空一行
export function section_to_text(section) {
  return section.paragraphs.map((paragraph) => paragraph.join('\n')).join('\n\n');
}

// 編輯區裡的文字 → 段落：每行去掉前後空白，連續的空行當一個（和「投影片」欄的規則一樣）
export function text_to_paragraphs(text) {
  return to_paragraphs(String(text).split(/\r?\n/));
}

// 段 → 「投影片」欄格式的文字（js/slide-lyrics.js 的 parse_slide_cell 讀得回來）：
// 有段名的段前面加 [段名] 或 [段名 = A1]；沒有段名的段（只會是第一段）不加
export function sections_to_cell(sections) {
  return sections.map((section) => {
    var body = section_to_text(section);
    if (section.name === null)
      return body;
    var head = '[' + section.name + (section.source ? ' = ' + section.source : '') + ']';
    return body ? head + '\n' + body : head;
  }).filter((block) => block !== '').join('\n\n');
}

// 比對用：拿掉所有空白（半形、全形、換行），只剩字
export function strip_whitespace(text) {
  return String(text).replace(/\s+/g, '');
}

// 兩段文字去掉空白後比較：一樣時 null，不一樣時 { removed, added, before, after }：
// removed／added 是原本的字被換掉的部分與換上去的部分（去掉頭尾相同的字），before／after 是前後各幾個沒變的字（看位置用）
export function text_change(original, edited, context = 3) {
  var a = [...strip_whitespace(original)];
  var b = [...strip_whitespace(edited)];
  var start = 0;
  while (start < a.length && start < b.length && a[start] == b[start])
    start++;
  if (start == a.length && start == b.length)
    return null;
  var end = 0;
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] == b[b.length - 1 - end])
    end++;
  return {
    removed: a.slice(start, a.length - end).join(''),
    added: b.slice(start, b.length - end).join(''),
    before: a.slice(Math.max(0, start - context), start).join(''),
    after: a.slice(a.length - end, a.length - end + context).join(''),
  };
}

// 每一段原本的文字和編輯後的文字 → 有變動的段：[{ index, change }]
export function layout_changes(original_texts, edited_texts) {
  var changes = [];
  original_texts.forEach((original, index) => {
    var change = text_change(original, edited_texts[index] ?? '');
    if (change)
      changes.push({ index, change });
  });
  return changes;
}

// 編輯區的文字放回段裡（段名、source 照舊）
export function apply_texts(sections, texts) {
  return sections.map((section, i) => ({ ...section, paragraphs: text_to_paragraphs(texts[i] ?? '') }));
}

// localStorage 裡暫存的排版：{ 歌號: 「投影片」欄格式的文字 }；壞掉或不是物件時當成沒有
export function parse_saved_layouts(json) {
  try {
    var value = JSON.parse(json);
    if (value && typeof value == 'object' && !Array.isArray(value))
      return Object.fromEntries(Object.entries(value).filter(([, text]) => typeof text == 'string'));
  } catch (e) {}
  return {};
}

// 復原／重做：記錄每一步之後的內容（snapshot 由呼叫的人決定格式）。
// merge_key 一樣、而且距離上一步不到 merge_ms 的連續動作（例如連續打字、連續刪除）合成一步；merge_key 為 null 時一定是新的一步
export function create_history(initial, merge_ms = 1000) {
  return { stack: [initial], index: 0, merge_key: null, time: 0, merge_ms };
}

export function history_record(history, snapshot, merge_key = null, time = 0) {
  var last = history.index == history.stack.length - 1;
  if (merge_key !== null && last && history.index > 0 && merge_key == history.merge_key && time - history.time < history.merge_ms) {
    history.stack[history.index] = snapshot;
  } else {
    history.stack = history.stack.slice(0, history.index + 1);
    history.stack.push(snapshot);
    history.index++;
  }
  history.merge_key = merge_key;
  history.time = time;
}

export function can_undo(history) {
  return history.index > 0;
}

export function can_redo(history) {
  return history.index < history.stack.length - 1;
}

// 往回／往前一步，傳回那一步的內容；不能時傳回 null。復原或重做之後的下一個動作一定是新的一步
export function history_undo(history) {
  if (!can_undo(history))
    return null;
  history.merge_key = null;
  return history.stack[--history.index];
}

export function history_redo(history) {
  if (!can_redo(history))
    return null;
  history.merge_key = null;
  return history.stack[++history.index];
}

// ---- 整首一個編輯區：各段的文字接在一起，段和段之間空一行（SEPARATOR），段的開頭記成位置（boundaries，第一段是 0） ----
// 段和段之間的空行是段落標記：不能刪、也不能在裡面打字

export const SEPARATOR = '\n\n';

// 段的文字 → { text, boundaries }
export function join_sections(texts) {
  var boundaries = [];
  var text = '';
  texts.forEach((t, i) => {
    if (i > 0)
      text += SEPARATOR;
    boundaries.push(text.length);
    text += t;
  });
  return { text, boundaries };
}

// { text, boundaries } → 每段的文字（不含段和段之間的空行）
export function split_sections(text, boundaries) {
  return boundaries.map((start, i) =>
    text.slice(start, i + 1 < boundaries.length ? boundaries[i + 1] - SEPARATOR.length : text.length));
}

// 編輯區的內容從 before 變成 after（caret：改完之後游標的位置）→ 新的段開頭位置；
// 改動刪到或打字在段和段之間的空行（段落標記）時傳回 null（不允許，呼叫的人要把內容改回去）。
// 改動的範圍用頭尾相同的字找；同樣的字連在一起（例如在換行旁邊再按換行）時，用游標決定改動是從哪裡開始
export function apply_edit(before, after, caret, boundaries) {
  var min = Math.min(before.length, after.length);
  var p = 0;
  while (p < min && before[p] == after[p])
    p++;
  var s = 0;
  while (s < min - p && before[before.length - 1 - s] == after[after.length - 1 - s])
    s++;
  var removed = before.length - s - p;
  var inserted = after.length - s - p;
  // 往前挪到游標的位置（挪過的那幾個字前後都一樣，改動等價）
  var start = Math.min(p, Math.max(0, caret - inserted));
  if (before.slice(start + removed) != after.slice(start + inserted))
    start = p;
  var added = after.slice(start, start + inserted);
  var gap = SEPARATOR.length;
  var moved = [];
  for (const [i, b] of boundaries.entries()) {
    if (i == 0) {
      moved.push(0);
      continue;
    }
    // 刪到空行
    if (removed && start < b && start + removed > b - gap)
      return null;
    var shift = b > start;
    // 打字在兩個換行中間：前後有換行時等於加在上一段的最後（結尾是換行）或下一段的開頭（開頭是換行），不然不允許
    if (start > b - gap && start < b) {
      if (added.endsWith('\n'))
        shift = true;
      else if (added.startsWith('\n'))
        shift = false;
      else
        return null;
    }
    moved.push(shift ? b + inserted - removed : b);
  }
  // 保險：每個段的開頭前面都還是空行
  if (moved.some((b, i) => i > 0 && after.slice(b - gap, b) != SEPARATOR))
    return null;
  return moved;
}

// ---- 文字變更的顯示（word diff）：英數連在一起算一個詞，其他（中文、標點）一個字一個；空白不算 ----

export function diff_tokens(text) {
  return String(text).match(/[A-Za-z0-9À-ɏ']+|\S/g) || [];
}

// 兩段文字 → [{ type: 'same' | 'removed' | 'added', text }]（最長共同子序列；換掉的地方先列刪掉的再列加上的；相鄰同類合併，詞和詞之間依需要加空格）
export function word_diff(original, edited) {
  var a = diff_tokens(original);
  var b = diff_tokens(edited);
  var n = a.length, m = b.length;
  var lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (var i = n - 1; i >= 0; i--)
    for (var j = m - 1; j >= 0; j--)
      lcs[i][j] = a[i] == b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  var parts = [];
  var push = (type, token) => {
    var last = parts[parts.length - 1];
    if (last && last.type == type)
      last.tokens.push(token);
    else
      parts.push({ type, tokens: [token] });
  };
  i = 0; j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] == b[j]) {
      push('same', a[i]); i++; j++;
    } else if (j < m && (i == n || lcs[i][j + 1] > lcs[i + 1][j])) {
      push('added', b[j]); j++;
    } else {
      push('removed', a[i]); i++;
    }
  }
  return parts.map(({ type, tokens }) => ({ type, text: join_tokens(tokens) }));
}

// 詞接回來：兩個英數詞之間空一格，其他直接相連
function join_tokens(tokens) {
  var word = /^[A-Za-z0-9À-ɏ']/;
  return tokens.reduce((text, t) => text + (text && word.test(text[text.length - 1]) && word.test(t) ? ' ' : '') + t, '');
}

// 沒變的部分太長時只留靠近變動的幾個字（前後各 context 個字），中間用「…」
export function trim_diff(parts, context = 4) {
  return parts.map((part, k) => {
    if (part.type != 'same')
      return part;
    var chars = [...part.text];
    var keep_start = k > 0 ? context : 0; // 前面有變動：留開頭幾個字
    var keep_end = k < parts.length - 1 ? context : 0; // 後面有變動：留結尾幾個字
    if (chars.length <= keep_start + keep_end + 1)
      return part;
    var text = (keep_start ? chars.slice(0, keep_start).join('') : '') + '…' + (keep_end ? chars.slice(-keep_end).join('') : '');
    return { type: 'same', text };
  });
}
