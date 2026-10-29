// 「投影片歌詞…」彈窗：列出正在看的歌的各段歌詞（前面標段名），勾選段落後複製成純文字
import { state } from './state.js';
import { song_slide_lyrics, sections_text } from './slide-lyrics.js';
import { openDom, closeDom, isOpenDom, click_on_enter } from './dom.js';

const CONTAINER = '#lyrics-popup-container';

// 目前彈窗裡列出的段（和勾選框的順序相同）
var shown_sections = [];

// 段的上方說明：歌詞從哪裡來；沒有 P: 段落標記的歌提醒一下
function lyrics_note(lyrics) {
  if (lyrics.from == 'cell')
    return '歌詞來自試算表的「投影片」欄。';
  if (!lyrics.sections.length)
    return '這首歌沒有歌詞：試算表的「投影片」欄是空的，譜上也沒有 w: 歌詞。';
  var note = '試算表的「投影片」欄是空的，以下由譜上的歌詞自動產生（譜上一行 = 一行）。';
  if (!lyrics.has_parts)
    note += '譜上沒有 P: 段落標記，整首當一段，分成 V1、V2…；可以在譜上加 P:，或在「投影片」欄寫好分段。';
  return note;
}

function section_element(section, index) {
  var label = document.createElement('label');
  label.className = 'lyrics-section';
  var checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = true;
  checkbox.dataset.index = index;
  var name = document.createElement('span');
  name.className = 'lyrics-name';
  name.textContent = section.name || '（無段名）';
  var text = document.createElement('div');
  text.className = 'lyrics-text';
  // 段落之間空一行；資料來自試算表，一律當成文字（不用 innerHTML）
  for (const paragraph of section.paragraphs) {
    var p = document.createElement('p');
    p.textContent = paragraph.join('\n');
    text.appendChild(p);
  }
  label.append(checkbox, name, text);
  return label;
}

function checkboxes() {
  return [...document.querySelectorAll('#lyrics_sections input[type=checkbox]')];
}

function selected_sections() {
  return checkboxes().filter((c) => c.checked).map((c) => shown_sections[c.dataset.index]);
}

function set_status(text) {
  document.querySelector('#lyrics_status').textContent = text;
}

// 有勾選段落時才能複製
function update_copy_button() {
  var copy = document.querySelector('#lyrics_copy');
  var none = selected_sections().length == 0;
  copy.classList.toggle('disabled', none);
  copy.setAttribute('aria-disabled', none);
}

export function open_lyrics_popup() {
  var song = state.displayingSong;
  if (!song)
    return;
  var lyrics = song_slide_lyrics(song);
  shown_sections = lyrics.sections;
  document.querySelector('#lyrics_title').textContent = '投影片歌詞：' + (song.name || song.id);
  document.querySelector('#lyrics_note').textContent = lyrics_note(lyrics);
  document.querySelector('#lyrics_sections').replaceChildren(...shown_sections.map(section_element));
  set_status('');
  update_copy_button();
  openDom(CONTAINER);
  document.querySelector('#lyrics_copy').focus();
}

export function close_lyrics_popup() {
  closeDom(CONTAINER);
}

async function copy_selected() {
  var sections = selected_sections();
  if (!sections.length)
    return;
  var text = sections_text(sections);
  try {
    await navigator.clipboard.writeText(text);
    set_status('已複製 ' + sections.length + ' 段');
  } catch (e) {
    // 沒有權限或不是 https（學校網頁用 http 開時）時，改用選取文字＋execCommand
    if (copy_with_textarea(text))
      set_status('已複製 ' + sections.length + ' 段');
    else
      set_status('無法複製，請手動選取文字');
  }
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

// 註冊選單項目與彈窗的事件
export function setup_lyrics_popup() {
  for (const item of document.querySelectorAll('.lyrics-item'))
    item.addEventListener('click', open_lyrics_popup);
  var container = document.querySelector(CONTAINER);
  container.querySelector('.popup-bg').addEventListener('click', function(event){
    if (event.target == this)
      close_lyrics_popup();
  });
  container.querySelector('.popup-window-close').addEventListener('click', close_lyrics_popup);
  // 焦點不一定在彈窗裡（例如點了彈窗裡的文字），所以在 document 上聽 Esc；capture 階段先收到，不讓 Esc 再傳到譜面（例如收起其他選單）
  document.addEventListener('keydown', (event)=>{
    if (event.key == 'Escape' && isOpenDom(CONTAINER)) {
      event.stopPropagation();
      close_lyrics_popup();
    }
  }, true);
  document.querySelector('#lyrics_sections').addEventListener('change', ()=>{
    set_status('');
    update_copy_button();
  });
  for (const [id, checked] of [['#lyrics_select_all', true], ['#lyrics_select_none', false]]) {
    var button = document.querySelector(id);
    button.addEventListener('click', ()=>{
      for (const c of checkboxes())
        c.checked = checked;
      set_status('');
      update_copy_button();
    });
    click_on_enter(button);
  }
  var copy = document.querySelector('#lyrics_copy');
  copy.addEventListener('click', copy_selected);
  click_on_enter(copy);
}
