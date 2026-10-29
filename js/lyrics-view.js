// 歌詞檢視：一首歌的另一種檢視方式（網址 mode=lyrics）。列出各段歌詞（前面標段名），
// 用一般的文字選取選歌詞，複製時整理成純文字（不含段名，換段落或換段時空一行）；工具列的「檢視歌詞」／「檢視歌譜」切換
import { state } from './state.js';
import { song_slide_lyrics, lyrics_messages, lines_text, UNNAMED } from './slide-lyrics.js';
import { update_hash } from './route.js';
import { click_on_enter } from './dom.js';

const CONTAINER = '#score_popup_container';

// 目前列出的段（每一行的 data-s／data-p／data-l 是在這裡的位置）
var shown_sections = [];
// 列出的是哪首歌的哪份歌詞；資料沒變時不重畫，選取的文字留著
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
  var key = JSON.stringify([song.id, song.name, song.slides, song.abc]);
  if (key == shown_key)
    return;
  shown_key = key;
  var lyrics = song_slide_lyrics(song);
  shown_sections = lyrics.sections;
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
}

// 訊息前面的 icon：warning 是黃色三角形裡的驚嘆號，info 是淺灰圓形裡的藍色 i
const ICON_PATHS = {
  warning: [['path', { d: 'M8 1.5 15 14.5H1Z', fill: '#f2c200', stroke: '#c99a00', 'stroke-width': 1, 'stroke-linejoin': 'round' }],
    ['path', { d: 'M8 6v4', stroke: '#000', 'stroke-width': 1.6, 'stroke-linecap': 'round' }],
    ['circle', { cx: 8, cy: 12.3, r: 0.9, fill: '#000' }]],
  info: [['circle', { cx: 8, cy: 8, r: 7, fill: '#e3e3e3' }],
    ['circle', { cx: 8, cy: 4.6, r: 1, fill: '#2a6fc9' }],
    ['path', { d: 'M8 7v5', stroke: '#2a6fc9', 'stroke-width': 1.8, 'stroke-linecap': 'round' }]],
};

function message_icon(type) {
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', 'lyrics-message-icon');
  svg.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of ICON_PATHS[type]) {
    var shape = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs))
      shape.setAttribute(k, v);
    svg.appendChild(shape);
  }
  return svg;
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

// 註冊工具列的切換按鈕與歌詞檢視的事件
export function setup_lyrics_view() {
  for (const button of document.querySelectorAll('.view-mode-button')) {
    // 網址改了之後由 route.js 的 exec_hash 切換
    button.addEventListener('click', ()=>{ update_hash('mode', is_lyrics_mode() ? undefined : 'lyrics'); });
    click_on_enter(button);
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
  var buttons = [['#lyrics_select_all', ()=>{ var lines = line_elements(); select_lines(lines[0], lines[lines.length - 1]); }],
    ['#lyrics_copy', copy_selected]];
  for (const [id, action] of buttons) {
    var button = document.querySelector(id);
    // 按按鈕時不要把選取的文字取消掉
    button.addEventListener('mousedown', (event)=>{ event.preventDefault(); });
    button.addEventListener('click', action);
    click_on_enter(button);
  }
}
