// 歌詞檢視：一首歌的另一種檢視方式（網址 mode=lyrics）。列出各段歌詞（前面標段名），
// 每一節的每一行是一個勾選單位，勾選後複製成純文字；工具列的「檢視歌詞」／「檢視歌譜」切換
import { state } from './state.js';
import { song_slide_lyrics, lyrics_messages, lines_text } from './slide-lyrics.js';
import { update_hash } from './route.js';
import { click_on_enter } from './dom.js';

const CONTAINER = '#score_popup_container';

// 目前列出的段（勾選框的 data-s／data-p／data-l 是在這裡的位置）
var shown_sections = [];
// 列出的是哪首歌的哪份歌詞；資料沒變時重畫不清掉勾選
var shown_key = null;

export function is_lyrics_mode() {
  return state.viewMode == 'lyrics';
}

// 切換歌譜（'score'）／歌詞（'lyrics'）檢視；不改網址（由 route.js 依網址呼叫）
export function set_view_mode(mode) {
  state.viewMode = mode == 'lyrics' ? 'lyrics' : 'score';
  var lyrics = is_lyrics_mode();
  document.querySelector(CONTAINER).classList.toggle('lyrics-mode', lyrics);
  document.querySelector('#lyrics_view').classList.toggle('hide', !lyrics);
  for (const button of document.querySelectorAll('.view-mode-button'))
    button.textContent = lyrics ? '檢視歌譜' : '檢視歌詞';
  refresh_lyrics();
}

// 歌詞檢視開著時，依 state.displayingSong 重新列出歌詞（換歌、試算表資料更新後呼叫）
export function refresh_lyrics() {
  var song = state.displayingSong;
  if (!is_lyrics_mode() || !song)
    return;
  var key = JSON.stringify([song.id, song.slides, song.abc]);
  if (key == shown_key)
    return;
  shown_key = key;
  var lyrics = song_slide_lyrics(song);
  shown_sections = lyrics.sections;
  document.querySelector('#lyrics_messages').replaceChildren(...lyrics_messages(lyrics).map((text) => {
    var li = document.createElement('li');
    li.textContent = text;
    return li;
  }));
  document.querySelector('#lyrics_sections').replaceChildren(...shown_sections.map(section_element));
  set_status('');
  update_checks();
}

// 關閉譜面時：回到歌譜檢視，下次打開重新列出
export function reset_lyrics_view() {
  shown_key = null;
  set_view_mode('score');
}

function checkbox(dataset) {
  var input = document.createElement('input');
  input.type = 'checkbox';
  Object.assign(input.dataset, dataset);
  return input;
}

// 資料來自試算表，一律當成文字（不用 innerHTML）
function section_element(section, s) {
  var element = document.createElement('section');
  element.className = 'lyrics-section';
  // 段名：點了整段全選；已經全選時全部取消
  var head = document.createElement('span');
  head.className = 'lyrics-name';
  head.dataset.section = s;
  head.setAttribute('role', 'button');
  head.tabIndex = 0;
  head.textContent = '[' + (section.name || '無段名') + ']';
  click_on_enter(head);
  element.appendChild(head);
  section.paragraphs.forEach((paragraph, p) => {
    var block = document.createElement('div');
    block.className = 'lyrics-paragraph';
    paragraph.forEach((line, l) => {
      var row = document.createElement('label');
      row.className = 'lyrics-line';
      var text = document.createElement('span');
      text.textContent = line;
      row.append(checkbox({ s, p, l }), text);
      block.appendChild(row);
    });
    element.appendChild(block);
  });
  return element;
}

function line_checkboxes(section) {
  var scope = section === undefined ? '' : `[data-s="${section}"]`;
  return [...document.querySelectorAll(`#lyrics_sections input[data-l]${scope}`)];
}

function is_selected(s, p, l) {
  var input = document.querySelector(`#lyrics_sections input[data-s="${s}"][data-p="${p}"][data-l="${l}"]`);
  return !!(input && input.checked);
}

function set_status(text) {
  document.querySelector('#lyrics_status').textContent = text;
}

// 有勾選的行時才能複製
function update_checks() {
  for (const line of line_checkboxes())
    line.closest('.lyrics-line').classList.toggle('selected', line.checked);
  var none = !line_checkboxes().some((c) => c.checked);
  var copy = document.querySelector('#lyrics_copy');
  copy.classList.toggle('disabled', none);
  copy.setAttribute('aria-disabled', none);
}

function set_all(checked) {
  for (const c of line_checkboxes())
    c.checked = checked;
  set_status('');
  update_checks();
}

async function copy_selected() {
  var text = lines_text(shown_sections, is_selected);
  if (!text)
    return;
  var count = line_checkboxes().filter((c) => c.checked).length;
  var copied = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // 沒有權限或不是 https（學校網頁用 http 開時）時，改用選取文字＋execCommand
    copied = copy_with_textarea(text);
  }
  set_status(copied ? `已複製 ${count} 行` : '無法複製，請手動選取文字');
}

function copy_with_textarea(text) {
  var area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  var ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {}
  area.remove();
  return ok;
}

// 註冊工具列的切換按鈕與歌詞檢視的事件
export function setup_lyrics_view() {
  for (const button of document.querySelectorAll('.view-mode-button')) {
    // 網址改了之後由 route.js 的 exec_hash 切換
    button.addEventListener('click', ()=>{ update_hash('mode', is_lyrics_mode() ? undefined : 'lyrics'); });
    click_on_enter(button);
  }
  var sections = document.querySelector('#lyrics_sections');
  sections.addEventListener('change', ()=>{
    set_status('');
    update_checks();
  });
  // 點段名：整段全選，已經全選時全部取消
  sections.addEventListener('click', (event)=>{
    var head = event.target.closest('.lyrics-name');
    if (!head)
      return;
    var lines = line_checkboxes(head.dataset.section);
    var all = lines.every((c) => c.checked);
    for (const c of lines)
      c.checked = !all;
    set_status('');
    update_checks();
  });
  for (const [id, checked] of [['#lyrics_select_all', true], ['#lyrics_select_none', false]]) {
    var button = document.querySelector(id);
    button.addEventListener('click', ()=>{ set_all(checked); });
    click_on_enter(button);
  }
  var copy = document.querySelector('#lyrics_copy');
  copy.addEventListener('click', copy_selected);
  click_on_enter(copy);
}
