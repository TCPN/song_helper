// 歌詞排版編輯：在歌詞檢視裡按「編輯排版」（鉛筆）打開，蓋在歌詞上面。
// 每一段一個文字區（<textarea>），段名放在文字區外面，所以不能選取、也刪不掉；文字區裡可以加減空格與換行，
// 空一行是段內分段（投影片換頁）。隨時把去掉空白後的字和原本的歌詞（「投影片」欄或從譜上抽出的）比對，不一樣時顯示警告。
// 復原／重做用自己的紀錄（跨所有段；Ctrl+Z、Ctrl+Shift+Z、Ctrl+Y 也是），存檔存在這台裝置的 localStorage
// （「投影片」欄的格式，之後可以直接貼回試算表）。編輯狀態不放進網址。
import { click_on_enter, message_icon } from './dom.js';
import { UNNAMED } from './slide-lyrics.js';
import { section_to_text, sections_to_cell, apply_texts, layout_changes, describe_change, parse_saved_layouts,
  create_history, history_record, history_undo, history_redo, can_undo, can_redo } from './lyric-layout.js';

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

var editing = null; // { song_id, sections, source_cell, original_texts, compare_whole, saved_texts, history }
var on_change = () => {};

const $ = (selector) => document.querySelector(selector);

export function is_editing_lyrics() {
  return editing !== null;
}

export function editing_song_id() {
  return editing ? editing.song_id : null;
}

function textareas() {
  return [...document.querySelectorAll('#lyrics_editor_sections textarea')];
}

function current_texts() {
  return textareas().map((t) => t.value);
}

function same(a, b) {
  return a.length == b.length && a.every((text, i) => text == b[i]);
}

function is_dirty() {
  return editing !== null && !same(current_texts(), editing.saved_texts);
}

// 文字區的高度跟著內容（不出現捲軸）
function fit(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + (textarea.offsetHeight - textarea.clientHeight) + 'px';
}

// 打開編輯：sections 是現在顯示的段（有暫存就是暫存的），source_sections 是原本的段（比對文字用）
export function open_lyrics_editor(song_id, sections, source_sections) {
  var texts = sections.map(section_to_text);
  var original = source_sections.map(section_to_text);
  // 暫存的段和原本的段對不起來（例如之後試算表的「投影片」欄改了段落）時，整首一起比
  var compare_whole = sections.length != source_sections.length || sections.some((s, i) => s.name !== source_sections[i].name);
  editing = { song_id, sections, source_cell: sections_to_cell(source_sections), compare_whole,
    original_texts: compare_whole ? [original.join('\n')] : original, saved_texts: texts, history: create_history(texts) };
  $('#lyrics_editor_sections').replaceChildren(...sections.map((section, s) => {
    var element = document.createElement('section');
    element.className = 'lyrics-editor-section';
    // 段名：不是文字區的一部分，不能選取、刪不掉
    var name = document.createElement('div');
    name.className = 'lyrics-name lyrics-editor-name';
    name.textContent = section.name || UNNAMED;
    var textarea = document.createElement('textarea');
    textarea.className = 'lyrics-editor-text';
    textarea.value = texts[s];
    textarea.spellcheck = false;
    textarea.rows = 1;
    textarea.dataset.s = s;
    textarea.setAttribute('aria-label', name.textContent);
    element.append(name, textarea);
    return element;
  }));
  $('#lyrics_view').classList.add('editing');
  $('#lyrics_editor').classList.remove('hide');
  set_status('');
  for (const textarea of textareas())
    fit(textarea);
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
  $('#lyrics_editor_sections').replaceChildren();
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

// 現在的字和原本的比對：有變動的段加上 changed，上方列出警告
function changes() {
  var texts = current_texts();
  return layout_changes(editing.original_texts, editing.compare_whole ? [texts.join('\n')] : texts);
}

function update() {
  var found = changes();
  var areas = textareas();
  for (const textarea of areas)
    textarea.classList.toggle('changed', editing.compare_whole ? found.length > 0 : found.some((c) => c.index == textarea.dataset.s));
  $('#lyrics_editor_warnings').replaceChildren(...found.map(({ index, change }) => {
    var li = document.createElement('li');
    li.className = 'lyrics-message warning';
    var where = editing.compare_whole ? '歌詞' : `「${editing.sections[index].name || UNNAMED}」`;
    li.append(message_icon('warning'), `${where}的文字和原本不一樣：${describe_change(change)}`);
    return li;
  }));
  set_disabled('#lyrics_undo', !can_undo(editing.history));
  set_disabled('#lyrics_redo', !can_redo(editing.history));
  set_disabled('#lyrics_save', !is_dirty());
}

// 連續打字、連續刪除合成一步；換行、空格、貼上等每次都是一步
function merge_key(event, s) {
  if (event.inputType == 'insertText' && event.data && !/\s/.test(event.data))
    return 'type:' + s;
  if (/^delete(Content|Word)/.test(event.inputType || ''))
    return 'delete:' + s;
  return null;
}

// 記一步（內容和上一步一樣時不記，例如 Safari 組字結束後又來一次 input）
function record(key) {
  var texts = current_texts();
  if (same(texts, editing.history.stack[editing.history.index]))
    return;
  history_record(editing.history, texts, key, Date.now());
  set_status('');
  update();
}

// 注音、拼音等輸入法組字中（isComposing）只調高度：半成品不記成一步、也不拿去比對，組字結束（compositionend）時才記
function on_input(event) {
  var textarea = event.target;
  fit(textarea);
  if (event.isComposing)
    return;
  record(merge_key(event, textarea.dataset.s));
}

function on_composition_end(event) {
  record('type:' + event.target.dataset.s);
}

// 復原／重做：放回那一步的內容，游標放在第一個不一樣的地方
function restore(texts) {
  if (!texts)
    return;
  var areas = textareas();
  var focus = null;
  areas.forEach((textarea, i) => {
    if (textarea.value == texts[i])
      return;
    var old = textarea.value;
    var at = 0;
    while (at < old.length && at < texts[i].length && old[at] == texts[i][at])
      at++;
    textarea.value = texts[i];
    fit(textarea);
    if (!focus)
      focus = { textarea, at };
  });
  if (focus) {
    focus.textarea.focus();
    focus.textarea.setSelectionRange(focus.at, focus.at);
  }
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
  if (changes().length && !confirm('有些字和原本的歌詞不一樣，仍要存檔嗎？'))
    return;
  var texts = current_texts();
  var cell = sections_to_cell(apply_texts(editing.sections, texts));
  // 和原本一模一樣時不用暫存，刪掉這首歌的暫存（歌詞檢視回到原本的來源）
  var ok = save_local_layout(editing.song_id, cell == editing.source_cell ? null : cell);
  if (!ok) {
    set_status('無法存檔（這個瀏覽器不能用 localStorage）');
    return;
  }
  editing.saved_texts = texts;
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
  var sections = $('#lyrics_editor_sections');
  sections.addEventListener('input', on_input);
  sections.addEventListener('compositionend', on_composition_end);
  // 瀏覽器自己的復原／重做（選單、手機搖一搖等）改走我們的紀錄
  sections.addEventListener('beforeinput', (event) => {
    if (event.inputType == 'historyUndo' || event.inputType == 'historyRedo') {
      event.preventDefault();
      event.inputType == 'historyUndo' ? undo() : redo();
    }
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
      textareas().forEach(fit);
  });
  // 還沒存檔就要離開頁面時提醒
  window.addEventListener('beforeunload', (event) => {
    if (is_dirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}
