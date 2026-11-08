// 歌詞排版編輯：在歌詞檢視裡按「編輯排版」（鉛筆）打開，蓋在歌詞上面。
// 整首一個文字區（<textarea>），段和段之間空一行；段名浮在文字區左邊（對齊那段的第一行），空行中間畫一條線，
// 所以段名不能選取、也刪不掉；刪到段和段之間的空行、或在空行上打字時改回去（段落標記不能改）。文字區裡可以加減空格與換行，
// 空一行是段內分段（投影片換頁）。隨時把去掉空白後的字和原本的歌詞（「投影片」欄或從譜上抽出的）比對，不一樣時顯示警告。
// 復原／重做用自己的紀錄（跨所有段；Ctrl+Z、Ctrl+Shift+Z、Ctrl+Y 也是），存檔存在這台裝置的 localStorage
// （「投影片」欄的格式，之後可以直接貼回試算表）。編輯狀態不放進網址。
import { click_on_enter, message_icon } from './dom.js';
import { UNNAMED, half_width_spaces } from './slide-lyrics.js';
import { section_to_text, sections_to_cell, apply_texts, layout_changes, word_diff, trim_diff, parse_saved_layouts,
  create_history, history_record, history_undo, history_redo, can_undo, can_redo,
  join_sections, split_sections, apply_edit, SEPARATOR } from './lyric-layout.js';

// localStorage：{ 歌號: 「投影片」欄格式的文字 }
const STORAGE_KEY = 'lyrics_layout';

function load_all() {
  try { return parse_saved_layouts(localStorage.getItem(STORAGE_KEY)); } catch (e) { return {}; }
}

// 這首歌暫存的排版（沒有時 null）
export function load_local_layout(song_id) {
  var saved = load_all()[song_id];
  return saved === undefined ? null : saved;
}

// text 是 null 時刪掉這首歌的暫存；存不了（無痕模式等）時傳回 false
function save_local_layout(song_id, text) {
  try {
    var all = load_all();
    if (text === null)
      delete all[song_id];
    else
      all[song_id] = text;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch (e) {
    return false;
  }
}

// 編輯中：{ song_id, sections, source_cell, original_texts, compare_whole, saved, history, boundaries, last_value, before_input, composition_start, changed }
// 復原紀錄的每一步是 { text, boundaries }；boundaries 是每段開頭在 text 裡的位置
var editing = null;
var on_change = () => {};

const $ = (selector) => document.querySelector(selector);

export function is_editing_lyrics() {
  return editing !== null;
}

export function editing_song_id() {
  return editing ? editing.song_id : null;
}

function textarea() {
  return $('#lyrics_editor_text');
}

function snapshot() {
  return { text: textarea().value, boundaries: editing.boundaries.slice() };
}

function same(a, b) {
  return a.text == b.text && a.boundaries.length == b.boundaries.length && a.boundaries.every((x, i) => x == b.boundaries[i]);
}

function current_texts() {
  return split_sections(textarea().value, editing.boundaries);
}

function is_dirty() {
  return editing !== null && !same(snapshot(), editing.saved);
}

// 文字區的高度跟著內容（不出現捲軸），再把段名、分隔線、有變動的底色放到對的位置
// marks 為 false 時只調高度（接著會呼叫 update()，由它放）
function layout(marks = true) {
  var area = textarea();
  area.style.height = 'auto';
  area.style.height = area.scrollHeight + (area.offsetHeight - area.clientHeight) + 'px';
  if (marks)
    place_marks();
}

// 量每段第一行在文字區裡的高度：用一個樣式和文字區一樣、看不見的 div 排同樣的字，在每段開頭放一個記號
function line_tops() {
  var area = textarea();
  var style = getComputedStyle(area);
  var mirror = document.createElement('div');
  for (const key of ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth',
    'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight',
    'letterSpacing', 'wordSpacing', 'tabSize'])
    mirror.style[key] = style[key];
  Object.assign(mirror.style, { position: 'absolute', top: '0', left: '0', visibility: 'hidden', borderStyle: 'solid',
    whiteSpace: 'pre-wrap', overflowWrap: style.overflowWrap, wordBreak: style.wordBreak, width: area.offsetWidth + 'px' });
  var text = area.value;
  var markers = editing.boundaries.map((start, i) => {
    mirror.append(text.slice(i ? editing.boundaries[i - 1] : 0, start));
    // 記號：寬 0、和一行一樣高、貼齊行的上緣，它的上緣就是那一行的上緣
    var marker = document.createElement('span');
    Object.assign(marker.style, { display: 'inline-block', width: '0', height: style.lineHeight, verticalAlign: 'top' });
    mirror.append(marker);
    return marker;
  });
  mirror.append(text.slice(editing.boundaries[editing.boundaries.length - 1]) + '​');
  area.parentNode.appendChild(mirror);
  // 用 getBoundingClientRect 量（offsetTop 會四捨五入成整數 px）
  var origin = mirror.getBoundingClientRect().top;
  var tops = markers.map((m) => m.getBoundingClientRect().top - origin);
  mirror.remove();
  return tops;
}

function place_marks() {
  var area = textarea();
  var tops = line_tops();
  var line = parseFloat(getComputedStyle(area).lineHeight) || 24;
  var bottom = area.offsetHeight - (parseFloat(getComputedStyle(area).paddingBottom) || 0);
  // 段名在那段第一行的正上方，和檢視時一樣（段名的上下 margin 和高度見 style.css 的 .lyrics-name；
  // absolute 的 top 加上 margin-top 才是框的位置）。centers：段名框的中線，段和段之間的線畫在這裡
  var centers = [...document.querySelectorAll('#lyrics_editor_names .lyrics-editor-name')].map((name, i) => {
    var name_style = getComputedStyle(name);
    var height = name.getBoundingClientRect().height;
    var outer = height + parseFloat(name_style.marginTop) + parseFloat(name_style.marginBottom);
    name.style.top = tops[i] - outer + 'px';
    return tops[i] - outer + parseFloat(name_style.marginTop) + height / 2;
  });
  // 有變動的段用 update() 最後一次比對的結果（組字中不重新比對）
  var changed = editing.changed;
  $('#lyrics_editor_marks').replaceChildren(...tops.flatMap((top, i) => {
    var marks = [];
    // 這段到下一段的空行之前（最後一段到文字區底）
    var end = i + 1 < tops.length ? tops[i + 1] - line : bottom;
    if (changed.has(i)) {
      var band = document.createElement('div');
      band.className = 'lyrics-editor-changed';
      Object.assign(band.style, { top: top + 'px', height: Math.max(end - top, line) + 'px' });
      marks.push(band);
    }
    if (i > 0) {
      var divider = document.createElement('div');
      divider.className = 'lyrics-editor-divider';
      // 在上面那個空行裡，從段名框的中間穿過（段名是白底，看起來像線上的標籤）
      divider.style.top = Math.round(centers[i] ?? top - line / 2) + 'px';
      marks.push(divider);
    }
    return marks;
  }));
}

// 打開編輯：sections 是現在顯示的段（有暫存就是暫存的），source_sections 是原本的段（比對文字用）
export function open_lyrics_editor(song_id, sections, source_sections) {
  // 空白一律用半形（全形空白換成半形，長度一樣，位置不變）
  var texts = sections.map(section_to_text).map(half_width_spaces);
  var original = source_sections.map(section_to_text);
  // 暫存的段和原本的段對不起來（例如之後試算表的「投影片」欄改了段落）時，整首一起比
  var compare_whole = sections.length != source_sections.length || sections.some((s, i) => s.name !== source_sections[i].name);
  var { text, boundaries } = join_sections(texts);
  var start = { text, boundaries };
  editing = { song_id, sections, source_cell: sections_to_cell(source_sections), compare_whole,
    original_texts: compare_whole ? [original.join('\n')] : original, saved: start, history: create_history(start),
    boundaries: boundaries.slice(), last_value: text, before_input: null, changed: new Set() };
  // 段名：不是文字區的一部分，不能選取、刪不掉；點了游標移到那段的開頭
  $('#lyrics_editor_names').replaceChildren(...sections.map((section, i) => {
    var name = document.createElement('div');
    name.className = 'lyrics-name lyrics-editor-name';
    name.dataset.s = i;
    name.textContent = section.name || UNNAMED;
    return name;
  }));
  textarea().value = text;
  $('#lyrics_view').classList.add('editing');
  $('#lyrics_editor').classList.remove('hide');
  set_status('');
  layout(false);
  update();
}

// 關閉編輯；force 為 false 時，還沒存檔要先確認。傳回有沒有關掉
export function close_lyrics_editor(force = true) {
  if (!editing)
    return true;
  if (!force && is_dirty() && !confirm('還沒存檔，確定要關閉嗎？'))
    return false;
  editing = null;
  $('#lyrics_view').classList.remove('editing');
  $('#lyrics_editor').classList.add('hide');
  textarea().value = '';
  $('#lyrics_editor_names').replaceChildren();
  $('#lyrics_editor_marks').replaceChildren();
  return true;
}

function set_status(text) {
  $('#lyrics_editor_status').textContent = text;
}

function set_disabled(selector, disabled) {
  var button = $(selector);
  button.classList.toggle('disabled', disabled);
  button.setAttribute('aria-disabled', disabled);
}

// 現在的字和原本的比對
function changes() {
  var texts = current_texts();
  return layout_changes(editing.original_texts, editing.compare_whole ? [texts.join('\n')] : texts);
}

// 文字和原本不一樣的段（位置的集合）
function changed_sections(found) {
  if (editing.compare_whole)
    return new Set(found.length ? editing.boundaries.map((b, i) => i) : []);
  return new Set(found.map((c) => c.index));
}

// 有變動的段：段名和那段的底色變黃，上方列出警告
function update() {
  var found = changes();
  var changed = changed_sections(found);
  editing.changed = changed;
  for (const name of document.querySelectorAll('#lyrics_editor_names .lyrics-editor-name'))
    name.classList.toggle('changed', changed.has(Number(name.dataset.s)));
  $('#lyrics_editor_warnings').replaceChildren(...found.map(({ index }) => {
    var li = document.createElement('li');
    li.className = 'lyrics-message warning';
    var where = editing.compare_whole ? '整首' : editing.sections[index].name || UNNAMED;
    var name = document.createElement('span');
    name.className = 'lyrics-diff-name';
    name.textContent = where;
    // word diff：刪掉的字紅底加刪除線，加上的字綠底；沒變的太長只留靠近變動的幾個字
    var texts = editing.compare_whole ? [current_texts().join('\n')] : current_texts();
    var diff = document.createElement('span');
    diff.className = 'lyrics-diff';
    diff.append(...trim_diff(word_diff(editing.original_texts[index], texts[index])).map(({ type, text }) => {
      if (type == 'same')
        return text;
      var mark = document.createElement(type == 'added' ? 'ins' : 'del');
      mark.textContent = text;
      return mark;
    }));
    li.append(message_icon('warning'), '文字變更：', name, ' ', diff);
    return li;
  }));
  place_marks();
  set_disabled('#lyrics_undo', !can_undo(editing.history));
  set_disabled('#lyrics_redo', !can_redo(editing.history));
  set_disabled('#lyrics_save', !is_dirty());
  // 改到字時存檔按鈕換成警告的顏色（按下去會先確認）
  $('#lyrics_save').classList.toggle('warning', found.length > 0);
}

// 游標在第幾段
function section_at(pos) {
  var i = 0;
  while (i + 1 < editing.boundaries.length && editing.boundaries[i + 1] <= pos)
    i++;
  return i;
}

// 連續打字、連續刪除（同一段）合成一步；換行、空格、貼上等每次都是一步
function merge_key(event) {
  var s = section_at(textarea().selectionEnd);
  if (event.inputType == 'insertText' && event.data && !/\s/.test(event.data))
    return 'type:' + s;
  if (/^delete(Content|Word)/.test(event.inputType || ''))
    return 'delete:' + s;
  return null;
}

// 記一步（內容和上一步一樣時不記，例如 Safari 組字結束後又來一次 input）
function record(key) {
  var now = snapshot();
  if (same(now, editing.history.stack[editing.history.index])) {
    place_marks();
    return;
  }
  history_record(editing.history, now, key, Date.now());
  set_status('');
  update();
}

// 每次改動先算段的開頭移到哪裡；刪到段和段之間的換行就改回去（段落標記不能刪）。
// 注音、拼音等輸入法組字中（isComposing）只調位置：半成品不記成一步、也不拿去比對，組字結束（compositionend）時才記
function on_input(event) {
  var area = textarea();
  var moved = apply_edit(editing.last_value, area.value, area.selectionEnd, editing.boundaries);
  if (!moved) {
    // 組字中不能改回去（會打斷輸入法），等組字結束再檢查
    if (event.isComposing)
      return;
    var before = editing.before_input || { start: area.selectionEnd, end: area.selectionEnd };
    revert(editing.last_value, editing.boundaries, before);
    return;
  }
  editing.boundaries = moved;
  if (!event.isComposing)
    use_half_width_spaces();
  editing.last_value = area.value;
  layout(event.isComposing);
  if (event.isComposing)
    return;
  record(merge_key(event));
}

// 打進來的全形空白換成半形（一個換一個，段的開頭和游標位置都不變）；組字中不換，以免打斷輸入法
function use_half_width_spaces() {
  var area = textarea();
  if (!area.value.includes('\u3000'))
    return;
  var { selectionStart, selectionEnd } = area;
  area.value = half_width_spaces(area.value);
  area.setSelectionRange(selectionStart, selectionEnd);
}

function revert(text, boundaries, selection) {
  var area = textarea();
  area.value = text;
  editing.boundaries = boundaries.slice();
  editing.last_value = text;
  area.setSelectionRange(selection.start, selection.end);
  layout();
  set_status('段落之間的空行不能修改');
}

// 組字開始時的內容：組字結果動到段落之間的空行時改回這裡
function on_composition_start() {
  var area = textarea();
  editing.composition_start = { text: area.value, boundaries: editing.boundaries.slice(),
    selection: { start: area.selectionStart, end: area.selectionEnd } };
}

function on_composition_end() {
  var area = textarea();
  var moved = apply_edit(editing.last_value, area.value, area.selectionEnd, editing.boundaries);
  if (!moved) {
    var start = editing.composition_start || { text: editing.last_value, boundaries: editing.boundaries,
      selection: { start: area.selectionEnd, end: area.selectionEnd } };
    revert(start.text, start.boundaries, start.selection);
    return;
  }
  editing.boundaries = moved;
  use_half_width_spaces();
  editing.last_value = area.value;
  layout(false);
  record('type:' + section_at(area.selectionEnd));
}

// 復原／重做：放回那一步的內容，游標放在第一個不一樣的地方
function restore(step) {
  if (!step)
    return;
  var area = textarea();
  var old = area.value;
  var at = 0;
  while (at < old.length && at < step.text.length && old[at] == step.text[at])
    at++;
  area.value = step.text;
  editing.boundaries = step.boundaries.slice();
  editing.last_value = step.text;
  layout(false);
  area.focus();
  area.setSelectionRange(at, at);
  set_status('');
  update();
}

function undo() {
  if (editing)
    restore(history_undo(editing.history));
}

function redo() {
  if (editing)
    restore(history_redo(editing.history));
}

function save() {
  if (!editing || !is_dirty())
    return;
  if (changes().length && !confirm('已修改文字內容，確認要儲存此變更嗎？'))
    return;
  var texts = current_texts();
  var cell = sections_to_cell(apply_texts(editing.sections, texts));
  // 和原本一模一樣時不用暫存，刪掉這首歌的暫存（歌詞檢視回到原本的來源）
  var ok = save_local_layout(editing.song_id, cell == editing.source_cell ? null : cell);
  if (!ok) {
    set_status('無法存檔（這個瀏覽器不能用 localStorage）');
    return;
  }
  editing.saved = snapshot();
  set_status('已存檔');
  update();
  on_change();
}

function close() {
  if (close_lyrics_editor(false))
    on_change();
}

// Ctrl+Z 復原、Ctrl+Shift+Z／Ctrl+Y 重做、Ctrl+S 存檔（Mac 是 Cmd）
function on_keydown(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey)
    return;
  var key = event.key.toLowerCase();
  if (key == 'z' && !event.shiftKey) {
    event.preventDefault();
    undo();
  } else if ((key == 'z' && event.shiftKey) || key == 'y') {
    event.preventDefault();
    redo();
  } else if (key == 's') {
    event.preventDefault();
    save();
  }
}

// 註冊編輯器的事件；changed：存檔或關閉後呼叫（歌詞檢視重新列出）
export function setup_lyrics_editor({ changed } = {}) {
  on_change = changed || (() => {});
  var area = textarea();
  area.addEventListener('input', on_input);
  area.addEventListener('compositionstart', on_composition_start);
  area.addEventListener('compositionend', on_composition_end);
  area.addEventListener('beforeinput', (event) => {
    // 瀏覽器自己的復原／重做（選單、手機搖一搖等）改走我們的紀錄
    if (event.inputType == 'historyUndo' || event.inputType == 'historyRedo') {
      event.preventDefault();
      event.inputType == 'historyUndo' ? undo() : redo();
      return;
    }
    // 改動前的選取範圍：刪到段落標記、要改回去時放回這裡
    editing.before_input = { start: area.selectionStart, end: area.selectionEnd };
  });
  // 點段名：游標移到那段的開頭
  var names = $('#lyrics_editor_names');
  names.addEventListener('mousedown', (event) => { event.preventDefault(); });
  names.addEventListener('click', (event) => {
    var name = event.target.closest('.lyrics-editor-name');
    if (!name || !editing)
      return;
    var at = editing.boundaries[Number(name.dataset.s)];
    area.focus();
    area.setSelectionRange(at, at);
  });
  for (const area of ['#lyrics_editor', '#lyrics_editor_bar'])
    $(area).addEventListener('keydown', on_keydown);
  var buttons = [['#lyrics_undo', undo], ['#lyrics_redo', redo], ['#lyrics_save', save], ['#lyrics_editor_close', close]];
  for (const [id, action] of buttons) {
    var button = $(id);
    // 按按鈕時焦點留在文字區（手機上鍵盤不會收起來）
    button.addEventListener('mousedown', (event) => { event.preventDefault(); });
    button.addEventListener('click', action);
    click_on_enter(button);
  }
  window.addEventListener('resize', () => {
    if (editing)
      layout();
  });
  // 還沒存檔就要離開頁面時提醒
  window.addEventListener('beforeunload', (event) => {
    if (is_dirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}
