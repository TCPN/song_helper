// 歌詞檢視：一首歌的另一種檢視方式（網址 view=lyrics）。列出各段歌詞（前面標段名），
// 用一般的文字選取選歌詞，複製時整理成純文字（不含段名，換段落或換段時空一行）；「檢視」選單的「檢視歌譜」／「檢視歌詞」切換
import { state } from './state.js';
import { song_slide_lyrics, lyrics_messages, lines_text, map_lines, UNNAMED, SPACE_MODES, normalize_space_mode } from './slide-lyrics.js';
import { update_hash } from './route.js';
import { click_on_enter, message_icon, setup_dropdown, toggle_menu } from './dom.js';
import { setup_lyrics_editor, open_lyrics_editor, close_lyrics_editor, load_local_layout, editing_song_id } from './lyrics-editor.js';

const CONTAINER = '#score_popup_container';

// 目前列出的段（每一行的 data-s／data-p／data-l 是在這裡的位置）
var shown_sections = [];
// 目前列出的歌詞（js/slide-lyrics.js 的 song_slide_lyrics，沒去除空格）：編輯排版從這裡開始
var shown_lyrics = null;
// 列出的是哪首歌的哪份歌詞；資料沒變時不重畫，選取的文字留著
var shown_key = null;

// 空格的顯示方式（hide／half／full，js/slide-lyrics.js 的 SPACE_MODES）：記在 localStorage，下次沿用（不放進網址）。
// 舊版的「去除空格」開關（lyrics_strip_spaces = '1'）當成隱藏空格
const SPACE_MODE_KEY = 'lyrics_space_mode';
const OLD_STRIP_KEY = 'lyrics_strip_spaces';
const SPACE_LABELS = { hide: '隱藏', half: '半形', full: '全形' };
var space_mode = 'half';
// 無痕模式等情況 localStorage 可能無法使用，讀不到就用預設值、存不了就算了
function load_space_mode() {
  try {
    var saved = localStorage.getItem(SPACE_MODE_KEY);
    if (saved === null && localStorage.getItem(OLD_STRIP_KEY) == '1')
      saved = 'hide';
    return normalize_space_mode(saved);
  } catch (e) {
    return normalize_space_mode(null);
  }
}
function save_space_mode() {
  try { localStorage.setItem(SPACE_MODE_KEY, space_mode); } catch (e) {}
}

export function is_lyrics_mode() {
  return state.viewMode == 'lyrics';
}

// 切換歌譜（'score'）／歌詞（'lyrics'）檢視；不改網址（由 route.js 依網址呼叫）
export function set_view_mode(mode) {
  state.viewMode = mode == 'lyrics' ? 'lyrics' : 'score';
  var lyrics = is_lyrics_mode();
  // 回到歌譜檢視時不再編輯（沒存的修改不留）
  if (!lyrics)
    close_lyrics_editor();
  document.querySelector(CONTAINER).classList.toggle('lyrics-mode', lyrics);
  document.querySelector('#lyrics_view').classList.toggle('hide', !lyrics);
  for (const item of document.querySelectorAll('#view-menu [data-view-mode]')) {
    item.classList.toggle('selected', item.dataset.viewMode == state.viewMode);
    item.setAttribute('aria-checked', item.dataset.viewMode == state.viewMode);
  }
  refresh_lyrics();
}

// 歌詞檢視開著時，依 state.displayingSong 重新列出歌詞（換歌、試算表資料更新後呼叫）
export function refresh_lyrics() {
  var song = state.displayingSong;
  if (!is_lyrics_mode() || !song)
    return;
  // 換歌時不再編輯上一首
  if (editing_song_id() !== null && editing_song_id() != song.id)
    close_lyrics_editor();
  var local = load_local_layout(song.id);
  var key = JSON.stringify([song.id, song.name, song.slides, song.abc, space_mode, local]);
  if (key == shown_key)
    return;
  shown_key = key;
  var lyrics = song_slide_lyrics(song, local);
  shown_lyrics = lyrics;
  // 畫面上和複製出來的都照空格的顯示方式
  shown_sections = map_lines(lyrics.sections, SPACE_MODES[space_mode]);
  document.querySelector('#lyrics_title').textContent = song.name || '';
  document.querySelector('#lyrics_messages').replaceChildren(...lyrics_messages(lyrics).map(({ type, text }) => {
    var li = document.createElement('li');
    li.className = 'lyrics-message ' + type;
    li.append(message_icon(type), text);
    return li;
  }));
  document.querySelector('#lyrics_sections').replaceChildren(...shown_sections.map(section_element));
  set_status('');
  update_checks();
  var edit = document.querySelector('#lyrics_edit');
  edit.classList.toggle('disabled', !lyrics.sections.length);
  edit.setAttribute('aria-disabled', !lyrics.sections.length);
}

// 「編輯排版」：用目前列出的段（有暫存就是暫存的）開編輯器，和原本（格子或譜上）的字比對
function edit_layout() {
  var song = state.displayingSong;
  if (!shown_lyrics || !song || !shown_lyrics.sections.length)
    return;
  open_lyrics_editor(song.id, shown_lyrics.sections, shown_lyrics.source_sections || shown_lyrics.sections);
}

// 關閉譜面時：回到歌譜檢視，下次打開重新列出
export function reset_lyrics_view() {
  shown_key = null;
  set_view_mode('score');
}

// 資料來自試算表，一律當成文字（不用 innerHTML）
function section_element(section, s) {
  var element = document.createElement('section');
  element.className = 'lyrics-section';
  // 段名：不會被選取、不會被複製；點了選取整段，已經選取整段時取消
  var head = document.createElement('span');
  head.className = 'lyrics-name';
  head.dataset.section = s;
  head.setAttribute('role', 'button');
  head.tabIndex = 0;
  head.textContent = section.name || UNNAMED;
  click_on_enter(head);
  element.appendChild(head);
  section.paragraphs.forEach((paragraph, p) => {
    var block = document.createElement('div');
    block.className = 'lyrics-paragraph';
    paragraph.forEach((line, l) => {
      var row = document.createElement('div');
      row.className = 'lyrics-line';
      Object.assign(row.dataset, { s, p, l });
      row.textContent = line;
      block.appendChild(row);
    });
    element.appendChild(block);
  });
  return element;
}

function line_elements(section) {
  var scope = section === undefined ? '' : `[data-s="${section}"]`;
  return [...document.querySelectorAll(`#lyrics_sections .lyrics-line${scope}`)];
}

// 目前選取的文字在每一行選到的部分：Map('段.段落.行' → 文字)；沒有選到歌詞時是空的
function selected_parts() {
  var parts = new Map();
  var selection = document.getSelection();
  if (!selection || selection.rangeCount == 0 || selection.isCollapsed)
    return parts;
  var range = selection.getRangeAt(0);
  for (const line of line_elements()) {
    if (!range.intersectsNode(line))
      continue;
    var part = document.createRange();
    part.selectNodeContents(line);
    if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0)
      part.setStart(range.startContainer, range.startOffset);
    if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0)
      part.setEnd(range.endContainer, range.endOffset);
    var text = part.toString().trim();
    if (text)
      parts.set(`${line.dataset.s}.${line.dataset.p}.${line.dataset.l}`, text);
  }
  return parts;
}

// 選取的歌詞 → 複製用的純文字（js/slide-lyrics.js 的 lines_text：只選到一行的一部分時只放那部分）
function selected_text() {
  var parts = selected_parts();
  return { count: parts.size, text: lines_text(shown_sections, (s, p, l) => parts.get(`${s}.${p}.${l}`) || false) };
}

// 選取從 first 這一行的開頭到 last 這一行的結尾；沒有行時取消選取
function select_lines(first, last) {
  var selection = document.getSelection();
  selection.removeAllRanges();
  if (!first)
    return;
  var range = document.createRange();
  range.setStart(first, 0);
  range.setEnd(last, last.childNodes.length);
  selection.addRange(range);
}

function update_space_menu() {
  document.querySelector('#lyrics_space_label').textContent = SPACE_LABELS[space_mode];
  for (const item of document.querySelectorAll('#lyrics_space_menu [data-space-mode]')) {
    item.classList.toggle('selected', item.dataset.spaceMode == space_mode);
    item.setAttribute('aria-checked', item.dataset.spaceMode == space_mode);
  }
}

function set_status(text) {
  document.querySelector('#lyrics_status').textContent = text;
}

// 有選取歌詞時才能複製
function update_checks() {
  var none = selected_parts().size == 0;
  var copy = document.querySelector('#lyrics_copy');
  copy.classList.toggle('disabled', none);
  copy.setAttribute('aria-disabled', none);
}

async function copy_selected() {
  var { count, text } = selected_text();
  if (!text)
    return;
  try {
    await navigator.clipboard.writeText(text);
    set_status(`已複製 ${count} 行`);
  } catch (e) {
    // 沒有權限或不是 https（學校網頁用 http 開時）時，改用 execCommand 複製目前選取的文字：
    // 會觸發下面的 copy 事件，一樣整理成純文字，選取也留著
    var copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (e) {}
    if (!copied)
      set_status('無法複製，請用 Ctrl+C 或手機的「複製」');
  }
}

// 註冊「檢視」選單的切換項目與歌詞檢視的事件
export function setup_lyrics_view() {
  for (const item of document.querySelectorAll('#view-menu [data-view-mode]')) {
    // 網址改了之後由 route.js 的 exec_hash 切換
    item.addEventListener('click', ()=>{ update_hash('view', item.dataset.viewMode == 'lyrics' ? 'lyrics' : undefined); });
    click_on_enter(item);
  }
  var sections = document.querySelector('#lyrics_sections');
  // 按段名時不要先把選取的文字取消掉（才判斷得出是不是已經選了整段）
  sections.addEventListener('mousedown', (event)=>{
    if (event.target.closest('.lyrics-name'))
      event.preventDefault();
  });
  // 點段名：選取整段，已經選取整段時取消
  sections.addEventListener('click', (event)=>{
    var head = event.target.closest('.lyrics-name');
    if (!head)
      return;
    var lines = line_elements(head.dataset.section);
    var parts = selected_parts();
    var whole = lines.length > 0 && parts.size == lines.length && lines.every((l) => parts.get(`${l.dataset.s}.${l.dataset.p}.${l.dataset.l}`) == l.textContent.trim());
    select_lines(whole ? null : lines[0], lines[lines.length - 1]);
  });
  // 用 Ctrl+C（或手機的「複製」）複製選取的歌詞時，也整理成純文字：不含段名，換段落或換段時空一行
  sections.addEventListener('copy', (event)=>{
    var { count, text } = selected_text();
    if (!text)
      return;
    event.clipboardData.setData('text/plain', text);
    event.preventDefault();
    set_status(`已複製 ${count} 行`);
  });
  document.addEventListener('selectionchange', ()=>{
    if (!is_lyrics_mode())
      return;
    set_status('');
    update_checks();
  });
  // 編輯器存檔或關閉後重新列出（暫存的排版可能變了）
  setup_lyrics_editor({ changed: refresh_lyrics });
  space_mode = load_space_mode();
  update_space_menu();
  var space_button = document.querySelector('#lyrics_space_button');
  var space_menu = document.querySelector('#lyrics_space_menu');
  setup_dropdown(space_button, space_menu);
  // 按選單時不要把選取的文字取消掉
  for (const target of [space_button, space_menu])
    target.addEventListener('mousedown', (event)=>{ event.preventDefault(); });
  for (const item of space_menu.querySelectorAll('[data-space-mode]')) {
    item.addEventListener('click', ()=>{
      space_mode = normalize_space_mode(item.dataset.spaceMode);
      save_space_mode();
      update_space_menu();
      toggle_menu(space_button, space_menu);
      refresh_lyrics();
    });
    click_on_enter(item);
  }
  var buttons = [['#lyrics_select_all', ()=>{ var lines = line_elements(); select_lines(lines[0], lines[lines.length - 1]); }],
    ['#lyrics_copy', copy_selected],
    ['#lyrics_edit', edit_layout]];
  for (const [id, action] of buttons) {
    var button = document.querySelector(id);
    // 按按鈕時不要把選取的文字取消掉
    button.addEventListener('mousedown', (event)=>{ event.preventDefault(); });
    button.addEventListener('click', action);
    click_on_enter(button);
  }
}
