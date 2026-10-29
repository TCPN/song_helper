// 歌詞檢視：一首歌的另一種檢視方式（網址 mode=lyrics）。列出各段歌詞（前面標段名），
// 每一節的每一行是一個選取單位（點那一行），選取後複製成純文字；工具列的「檢視歌詞」／「檢視歌譜」切換
import { state } from './state.js';
import { song_slide_lyrics, lyrics_messages, lines_text } from './slide-lyrics.js';
import { update_hash } from './route.js';
import { click_on_enter } from './dom.js';

const CONTAINER = '#score_popup_container';

// 目前列出的段（每一行的 data-s／data-p／data-l 是在這裡的位置）
var shown_sections = [];
// 列出的是哪首歌的哪份歌詞；資料沒變時重畫不清掉選取
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
  head.textContent = section.name || '無段名';
  click_on_enter(head);
  element.appendChild(head);
  section.paragraphs.forEach((paragraph, p) => {
    var block = document.createElement('div');
    block.className = 'lyrics-paragraph';
    paragraph.forEach((line, l) => {
      // 每一行是一個選取單位：點了選取／取消（沒有勾選框）
      var row = document.createElement('div');
      row.className = 'lyrics-line';
      Object.assign(row.dataset, { s, p, l });
      row.setAttribute('role', 'checkbox');
      row.setAttribute('aria-checked', 'false');
      row.tabIndex = 0;
      row.textContent = line;
      click_on_enter(row);
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

function selected(line) {
  return line.getAttribute('aria-checked') == 'true';
}

function set_selected(line, value) {
  line.setAttribute('aria-checked', value);
  line.classList.toggle('selected', value);
}

function is_selected(s, p, l) {
  var line = document.querySelector(`#lyrics_sections .lyrics-line[data-s="${s}"][data-p="${p}"][data-l="${l}"]`);
  return !!(line && selected(line));
}

function set_status(text) {
  document.querySelector('#lyrics_status').textContent = text;
}

// 有選取的行時才能複製
function update_checks() {
  var none = !line_elements().some(selected);
  var copy = document.querySelector('#lyrics_copy');
  copy.classList.toggle('disabled', none);
  copy.setAttribute('aria-disabled', none);
}

function set_all(value) {
  for (const line of line_elements())
    set_selected(line, value);
  set_status('');
  update_checks();
}

async function copy_selected() {
  var text = lines_text(shown_sections, is_selected);
  if (!text)
    return;
  var count = line_elements().filter(selected).length;
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
  // 點一行：選取／取消；點段名：整段全選，已經全選時全部取消
  document.querySelector('#lyrics_sections').addEventListener('click', (event)=>{
    var line = event.target.closest('.lyrics-line');
    var head = event.target.closest('.lyrics-name');
    if (line) {
      set_selected(line, !selected(line));
    } else if (head) {
      var lines = line_elements(head.dataset.section);
      var all = lines.every(selected);
      for (const l of lines)
        set_selected(l, !all);
    } else {
      return;
    }
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
