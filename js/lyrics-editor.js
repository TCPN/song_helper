// 歌詞排版編輯：在歌詞檢視裡按「編輯排版」（鉛筆）打開，蓋在歌詞上面。
// 整首一個文字區（<textarea>），段和段之間空一行；段名浮在文字區左邊（對齊那段的第一行），空行中間畫一條線，
// 所以段名不能選取、也刪不掉；刪到段和段之間的空行、或在空行上打字時改回去（段落標記不能改）。文字區裡可以加減空格與換行，
// 空一行是段內分段（投影片換頁）。段落標籤：游標停在段內的空行時左邊出現「＋段落標籤」，點了輸入段名、從那裡切成新的一段；
// 點段名出現選單，可以改名或移除段落標籤（和上一段合併，中間的空行留著）。字都不變，只改段的開頭和段名。隨時把去掉空白後的字和原本的歌詞（「投影片」欄或從譜上抽出的）比對，不一樣時顯示警告。
// 復原／重做用自己的紀錄（跨所有段；Ctrl+Z、Ctrl+Shift+Z、Ctrl+Y 也是），存檔存在這台裝置的 localStorage
// （「投影片」欄的格式；歌詞檢視的「存回試算表」再寫進試算表，見 js/lyrics-view.js）。編輯狀態不放進網址。
import { click_on_enter, message_icon } from './dom.js';
import { auto_layout_text, parse_auto_layout, step_auto_layout, auto_layout_at_limit, align_hints, hints_for } from './auto-layout.js';
import { UNNAMED, half_width_spaces, sections_from_abc } from './slide-lyrics.js';
import { section_to_text, sections_to_cell, apply_texts, layout_changes, word_diff, trim_diff, parse_saved_layouts,
  create_history, history_record, history_undo, history_redo, can_undo, can_redo,
  join_sections, split_sections, apply_edit, label_slots, add_boundary, remove_boundary, clean_label_name } from './lyric-layout.js';

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

// 刪掉這首歌的暫存（已經存回試算表時）
export function clear_local_layout(song_id) {
  return save_local_layout(song_id, null);
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

// 自動排版的設定（js/auto-layout.js）：所有歌共用，存在 localStorage
const AUTO_KEY = 'lyrics_auto_layout';
var auto_options = parse_auto_layout(null);

function load_auto_options() {
  try { return parse_auto_layout(localStorage.getItem(AUTO_KEY)); } catch (e) { return parse_auto_layout(null); }
}

function save_auto_options() {
  try { localStorage.setItem(AUTO_KEY, JSON.stringify(auto_options)); } catch (e) {}
}

// 空格的顯示方式（歌詞檢視的設定，由 js/lyrics-view.js 傳入）：自動排版算寬度時用
var space = { get: () => 'half', set: () => {} };

// 編輯中：{ song_id, labels, source_cell, source_names, original_sections, original_whole, whole, saved, history, boundaries,
//   last_value, before_input, composition_start, changed, add_slot, naming }
// labels：每段的段名 [{ name, source }]（和 boundaries 一樣長）；復原紀錄的每一步是 { text, boundaries, labels }；
// boundaries 是每段開頭在 text 裡的位置
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
  return { text: textarea().value, boundaries: editing.boundaries.slice(), labels: editing.labels.slice() };
}

function same(a, b) {
  return a.text == b.text && a.boundaries.length == b.boundaries.length && a.boundaries.every((x, i) => x == b.boundaries[i])
    && a.labels.every((l, i) => l.name === b.labels[i].name && l.source === b.labels[i].source);
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

// 量文字區裡幾個位置（由小到大）所在那一行的上緣：用一個樣式和文字區一樣、看不見的 div 排同樣的字，在每個位置放一個記號
function line_tops(positions = editing.boundaries) {
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
  var markers = positions.map((start, i) => {
    mirror.append(text.slice(i ? positions[i - 1] : 0, start));
    // 記號：寬 0、和一行一樣高、貼齊行的上緣，它的上緣就是那一行的上緣
    var marker = document.createElement('span');
    Object.assign(marker.style, { display: 'inline-block', width: '0', height: style.lineHeight, verticalAlign: 'top' });
    mirror.append(marker);
    return marker;
  });
  mirror.append(text.slice(positions[positions.length - 1]) + '​');
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
  var centers = [...document.querySelectorAll('#lyrics_editor_names .lyrics-editor-name')].map((name, i) => put_above(name, tops[i]));
  place_add_button();
  if (editing.naming)
    put_above(name_input(), editing.naming.at === null ? tops[editing.naming.index] : line_tops([editing.naming.at])[0]);
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

// 段名框（.lyrics-name 的樣式）放在某一行（上緣在 top）的正上方，和檢視時段名的位置一樣；傳回框的中線
function put_above(box, top) {
  var style = getComputedStyle(box);
  var height = box.getBoundingClientRect().height;
  var outer = height + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
  box.style.top = top - outer + 'px';
  return top - outer + parseFloat(style.marginTop) + height / 2;
}

// 段名：不是文字區的一部分，不能選取、刪不掉；點了游標移到那段的開頭，並出現改名／移除的選單
function render_names() {
  $('#lyrics_editor_names').replaceChildren(...editing.labels.map((label, i) => {
    var name = document.createElement('div');
    name.className = 'lyrics-name lyrics-editor-name';
    name.dataset.s = i;
    name.textContent = label.name || UNNAMED;
    name.title = '重新命名或移除標籤';
    name.tabIndex = 0;
    name.setAttribute('role', 'button');
    return name;
  }));
}

// 打開編輯：sections 是現在顯示的段（有暫存就是暫存的），source_sections 是原本的段（比對文字用）
// abc：這首歌的 ABC（自動排版看譜決定斷句位置用，沒有時 null）
export function open_lyrics_editor(song_id, sections, source_sections, abc = null) {
  // 空白一律用半形（全形空白換成半形，長度一樣，位置不變）
  var texts = sections.map(section_to_text).map(half_width_spaces);
  var original = source_sections.map(section_to_text);
  var { text, boundaries } = join_sections(texts);
  var labels = sections.map(({ name, source }) => ({ name, source }));
  var start = { text, boundaries, labels };
  editing = { song_id, labels: labels.slice(), source_cell: sections_to_cell(source_sections),
    source_names: source_sections.map((s) => s.name), original_sections: original, original_whole: original.join('\n'),
    whole: false, saved: start, history: create_history(start), boundaries: boundaries.slice(), last_value: text,
    before_input: null, changed: new Set(), add_slot: null, naming: null, abc, abc_sections: undefined };
  render_names();
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
  close_label_menu();
  hide(name_input());
  hide($('#lyrics_editor_add'));
  editing = null;
  show_auto_panel(false);
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

// 段和原本的段對不起來（段數或段名不一樣：加減了段落標籤、改了段名，或之後試算表的「投影片」欄改了段落）時，整首一起比
function compare_whole() {
  return editing.labels.length != editing.source_names.length || editing.labels.some((l, i) => l.name !== editing.source_names[i]);
}

// 比對用的原本的字和現在的字：一段一段，或整首一個
function compared_texts() {
  var texts = current_texts();
  return editing.whole ? [[editing.original_whole], [texts.join('\n')]] : [editing.original_sections, texts];
}

// 現在的字和原本的比對
function changes() {
  editing.whole = compare_whole();
  return layout_changes(...compared_texts());
}

// 文字和原本不一樣的段（位置的集合）
function changed_sections(found) {
  if (editing.whole)
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
  var [originals, texts] = compared_texts();
  $('#lyrics_editor_warnings').replaceChildren(...found.map(({ index }) => {
    var li = document.createElement('li');
    li.className = 'lyrics-message warning';
    var where = editing.whole ? '整首' : editing.labels[index].name || UNNAMED;
    var name = document.createElement('span');
    name.className = 'lyrics-diff-name';
    name.textContent = where;
    // word diff：刪掉的字紅底加刪除線，加上的字綠底；沒變的太長只留靠近變動的幾個字
    var diff = document.createElement('span');
    diff.className = 'lyrics-diff';
    diff.append(...trim_diff(word_diff(originals[index], texts[index])).map(({ type, text }) => {
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
  set_status('段落之間的空行不能修改（點段名可以移除段落標籤）');
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

// ---- 段落標籤：「＋段落標籤」按鈕、段名的輸入框、段名的選單 ----

function hide(el) {
  el.classList.add('hide');
}

function name_input() {
  return $('#lyrics_editor_name_input');
}

// 游標（沒有選取範圍）停在段內的空行時，空行左邊出現「＋段落標籤」（位置和段名一樣）
function place_add_button() {
  var button = $('#lyrics_editor_add');
  var area = textarea();
  var slot = null;
  var focused = document.activeElement == area || document.activeElement == button;
  if (!editing.naming && focused && area.selectionStart == area.selectionEnd) {
    var caret = area.selectionEnd;
    slot = label_slots(area.value, editing.boundaries).find((s) => s.at <= caret && caret <= s.end) || null;
  }
  editing.add_slot = slot;
  button.classList.toggle('hide', !slot);
  if (slot)
    put_above(button, line_tops([slot.end + 1])[0]);
}

// 輸入段名：index 是要改名的段；at 不是 null 時是新增（slot：在哪個空行加，at：新的一段開頭的位置，量高度用）
function start_naming(naming, value) {
  close_label_menu();
  editing.naming = naming;
  hide($('#lyrics_editor_add'));
  var input = name_input();
  input.value = value;
  input.classList.remove('hide');
  fit_name_input();
  place_marks();
  input.focus();
  input.select();
}

// 輸入框的寬度跟著字（中文算兩格）
function fit_name_input() {
  var input = name_input();
  var width = [...(input.value || input.placeholder)].reduce((w, c) => w + (c.charCodeAt(0) > 0x2E80 ? 2 : 1), 0);
  input.style.width = 'calc(' + (Math.max(width, 4) + 1) + 'ch + 0.8em + 2px)';
}

// 結束輸入：commit 為 false 或段名是空的時不改。傳回新加的段是第幾段（沒有新加時 null）
// focus 為 false 時（輸入框失焦，使用者點了別的地方）焦點不搶回文字區
function finish_naming(commit, focus = true) {
  if (!editing || !editing.naming)
    return null;
  var naming = editing.naming;
  var name = clean_label_name(name_input().value);
  editing.naming = null;
  hide(name_input());
  var area = textarea();
  if (focus)
    area.focus();
  if (commit && name && naming.slot) {
    // 輸入期間文字沒變才加（保險：找同一個空行）
    var slot = label_slots(area.value, editing.boundaries).find((s) => s.at == naming.slot.at && s.end == naming.slot.end);
    if (slot) {
      var added = add_boundary(area.value, editing.boundaries, slot);
      area.value = added.text;
      editing.boundaries = added.boundaries;
      editing.last_value = added.text;
      editing.labels.splice(added.index, 0, { name, source: null });
      structure_changed(added.boundaries[added.index], focus);
      return added.index;
    }
  } else if (commit && name && !naming.slot && name !== editing.labels[naming.index].name) {
    editing.labels[naming.index] = { ...editing.labels[naming.index], name };
    structure_changed(editing.boundaries[naming.index], focus);
    return null;
  }
  var caret = naming.slot ? naming.slot.at : editing.boundaries[naming.index];
  area.setSelectionRange(caret, caret);
  place_marks();
  return null;
}

function cancel_naming() {
  if (editing && editing.naming) {
    editing.naming = null;
    hide(name_input());
  }
}

// 段名或段的開頭改了：重畫段名、記一步，游標放在 caret
function structure_changed(caret, focus = true) {
  render_names();
  layout(false);
  var area = textarea();
  if (focus)
    area.focus();
  area.setSelectionRange(caret, caret);
  record(null);
}

// 點段名出現的選單：改名、移除段落標籤（第一段不能移除）
function open_label_menu(index) {
  var menu = $('#lyrics_editor_label_menu');
  var name = document.querySelector(`#lyrics_editor_names .lyrics-editor-name[data-s="${index}"]`);
  menu.dataset.s = index;
  menu.querySelector('[data-label-action="remove"]').classList.toggle('hide', index == 0);
  menu.classList.remove('hide');
  menu.style.top = name.offsetTop + name.offsetHeight + 4 + 'px';
  menu.style.left = name.offsetLeft + 'px';
}

function close_label_menu() {
  hide($('#lyrics_editor_label_menu'));
}

function label_action(action) {
  var menu = $('#lyrics_editor_label_menu');
  var index = Number(menu.dataset.s);
  close_label_menu();
  if (!editing || !(index < editing.labels.length))
    return;
  if (action == 'rename') {
    start_naming({ index, at: null, slot: null }, editing.labels[index].name || '');
  } else if (action == 'remove' && index > 0) {
    // 合併到上一段，游標放在原本段落標記的空行
    var at = editing.boundaries[index] - 1;
    editing.boundaries = remove_boundary(editing.boundaries, index);
    editing.labels.splice(index, 1);
    structure_changed(at);
  }
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
  close_label_menu();
  cancel_naming();
  area.value = step.text;
  editing.boundaries = step.boundaries.slice();
  editing.labels = step.labels.slice();
  editing.last_value = step.text;
  render_names();
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
  var cell = sections_to_cell(apply_texts(editing.labels, texts));
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

// ---- 自動排版 ----
// 打開面板時，用那時的文字（auto.base）依設定重排每一段；面板開著時改設定，從同一份文字重排，整段過程合成復原的一步。
// 重排完又改了文字之後再改設定，從改過的文字開始（新的一步）

function auto_panel_open() {
  return !$('#lyrics_auto_panel').classList.contains('hide');
}

function show_auto_panel(open) {
  $('#lyrics_auto_panel').classList.toggle('hide', !open);
  $('#lyrics_auto_button').setAttribute('aria-expanded', open);
}

// 面板上的數值、−／＋ 能不能按、選中的空格
function show_auto_options() {
  var panel = $('#lyrics_auto_panel');
  for (const output of panel.querySelectorAll('[data-auto-value]'))
    output.value = auto_options[output.dataset.autoValue];
  for (const button of panel.querySelectorAll('[data-auto-step]'))
    button.setAttribute('aria-disabled', auto_layout_at_limit(auto_options, button.dataset.autoStep, Number(button.dataset.steps)));
  for (const choice of panel.querySelectorAll('[data-auto-space]'))
    choice.setAttribute('aria-checked', choice.dataset.autoSpace == space.get());
}

function auto_layout() {
  if (!editing)
    return;
  close_label_menu();
  cancel_naming();
  var now = snapshot();
  if (!editing.auto || !same(now, editing.auto.result)) {
    // 譜的斷句分數（第一次自動排版時才算），對到每段的字
    if (editing.abc_sections === undefined)
      editing.abc_sections = editing.abc ? sections_from_abc(editing.abc, { hints: true }) : null;
    var base = current_texts();
    var hints = base.map((t, i) => align_hints(t, hints_for(editing.abc_sections, editing.labels[i].name, editing.labels[i].source)));
    editing.auto = { base, hints, key: 'auto:' + Date.now(), result: null };
  }
  var { text, boundaries } = join_sections(editing.auto.base.map((t, i) => auto_layout_text(t, auto_options, space.get(), editing.auto.hints[i])));
  var area = textarea();
  area.value = text;
  editing.boundaries = boundaries;
  editing.last_value = text;
  layout(false);
  var next = snapshot();
  editing.auto.result = next;
  // 時間固定傳 0：同一次自動排版（同一個 key）的每次重排都合成一步
  if (!same(next, editing.history.stack[editing.history.index]))
    history_record(editing.history, next, editing.auto.key, 0);
  // 不顯示狀態文字（窄螢幕放不下）：「自動排版」按鈕亮著就表示設定開著、改設定會重排
  set_status('');
  update();
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
  // 段名的輸入框裡用瀏覽器自己的復原；存檔時先確定正在輸入的段名
  if (event.target == name_input()) {
    if (key == 's') {
      event.preventDefault();
      finish_naming(true);
      save();
    }
    return;
  }
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
// space_mode：{ get, set } 讀、改歌詞檢視的空格顯示方式
export function setup_lyrics_editor({ changed, space_mode } = {}) {
  on_change = changed || (() => {});
  if (space_mode)
    space = space_mode;
  auto_options = load_auto_options();
  var auto_button = $('#lyrics_auto_button');
  var auto_panel = $('#lyrics_auto_panel');
  // 按「自動排版」打開設定就排；再按一次收起設定（排好的留著）
  auto_button.addEventListener('click', () => {
    if (!editing)
      return;
    var open = !auto_panel_open();
    show_auto_panel(open);
    if (open) {
      show_auto_options();
      auto_layout();
    }
  });
  click_on_enter(auto_button);
  for (const target of [auto_button, auto_panel])
    target.addEventListener('mousedown', (event) => { event.preventDefault(); });
  for (const button of auto_panel.querySelectorAll('[data-auto-step]')) {
    button.addEventListener('click', () => {
      auto_options = step_auto_layout(auto_options, button.dataset.autoStep, Number(button.dataset.steps));
      save_auto_options();
      show_auto_options();
      auto_layout();
    });
    click_on_enter(button);
  }
  for (const choice of auto_panel.querySelectorAll('[data-auto-space]')) {
    choice.addEventListener('click', () => {
      space.set(choice.dataset.autoSpace);
      show_auto_options();
      auto_layout();
    });
    click_on_enter(choice);
  }
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
  // 點段名：游標移到那段的開頭，出現改名／移除段落標籤的選單
  var names = $('#lyrics_editor_names');
  names.addEventListener('mousedown', (event) => { event.preventDefault(); });
  names.addEventListener('click', (event) => {
    var name = event.target.closest('.lyrics-editor-name');
    if (!name || !editing)
      return;
    var index = Number(name.dataset.s);
    // 正在新增的段名先確定（新的段在被點的段前面時，被點的段往後一個）
    var added = finish_naming(true);
    if (added !== null && added <= index)
      index++;
    var at = editing.boundaries[index];
    area.focus();
    area.setSelectionRange(at, at);
    open_label_menu(index);
    // 用鍵盤打開（Enter／空白鍵，click 的 detail 是 0）時焦點移到選單的第一項
    if (event.detail == 0)
      menu.querySelector('.menu-item').focus();
  });
  // 段名可以用 Tab 移過去，Enter／空白鍵打開選單
  names.addEventListener('keydown', (event) => {
    if (event.target.closest('.lyrics-editor-name') && (event.key == 'Enter' || event.key == ' ')) {
      event.preventDefault();
      event.target.click();
    }
  });
  var menu = $('#lyrics_editor_label_menu');
  menu.addEventListener('mousedown', (event) => { event.preventDefault(); });
  menu.addEventListener('keydown', (event) => {
    if (event.key == 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close_label_menu();
      area.focus();
    }
  });
  for (const item of menu.querySelectorAll('[data-label-action]')) {
    item.addEventListener('click', () => label_action(item.dataset.labelAction));
    click_on_enter(item);
  }
  // 選單以外的地方按下去、按 Esc、打字時收起來
  document.addEventListener('mousedown', (event) => {
    if (!menu.classList.contains('hide') && !menu.contains(event.target) && !names.contains(event.target))
      close_label_menu();
  });
  area.addEventListener('keydown', (event) => {
    if (!menu.classList.contains('hide') && event.key == 'Escape') {
      event.preventDefault();
      close_label_menu();
    }
  });
  area.addEventListener('input', close_label_menu);
  // 「＋段落標籤」：在游標所在的空行加段落標籤（先輸入段名）
  var add = $('#lyrics_editor_add');
  add.addEventListener('mousedown', (event) => { event.preventDefault(); });
  click_on_enter(add);
  add.addEventListener('click', () => {
    if (!editing || !editing.add_slot)
      return;
    var slot = editing.add_slot;
    start_naming({ index: null, at: slot.end + 1, slot }, '');
  });
  // 游標移動時決定「＋段落標籤」要不要出現；離開文字區時收起來
  document.addEventListener('selectionchange', () => {
    if (editing && !editing.naming)
      place_add_button();
  });
  // 焦點從文字區用 Tab 移到「＋段落標籤」時留著（鍵盤也能加），移到別的地方才收起來
  area.addEventListener('blur', (event) => {
    if (editing && event.relatedTarget != add)
      hide(add);
  });
  add.addEventListener('blur', (event) => {
    if (editing && event.relatedTarget != area)
      hide(add);
  });
  var input = name_input();
  input.addEventListener('input', fit_name_input);
  input.addEventListener('keydown', (event) => {
    if (event.isComposing)
      return;
    if (event.key == 'Enter') {
      event.preventDefault();
      finish_naming(true);
    } else if (event.key == 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish_naming(false);
    }
  });
  input.addEventListener('blur', () => finish_naming(true, false));
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
