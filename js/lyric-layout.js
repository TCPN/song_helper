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

// 一個變動 → 警告訊息裡的一句話，例如：刪掉「甘」、加了「啊」、「甜」改成「田」（前後的字放在「…」旁邊看位置）
export function describe_change(change) {
  var where = (text) => (change.before ? '…' + change.before : '') + text + (change.after ? change.after + '…' : '');
  if (!change.added)
    return `刪掉「${change.removed}」（${where('▲')}）`;
  if (!change.removed)
    return `加了「${change.added}」（${where('▲')}）`;
  return `「${change.removed}」改成「${change.added}」（${where('▲')}）`;
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
