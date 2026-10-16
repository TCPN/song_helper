// 進入點：載入資料、註冊事件。index.html 以 <script type="module"> 載入這支。
import { loadData, renderWithCachedData } from './data.js';
import { exec_hash, parse_hash } from './route.js';
import { filter_song, song_list_onclick } from './list.js';
import { open_score, close_score, set_transpose, value_modify } from './score.js';
import { begin_song_id_edit, song_id_popup_control, song_id_keydown_handler } from './song-id-input.js';
import { open_feedback_popup } from './popups.js';
import { openDom, closeDom, toggleClass, save_scroll, restore_scroll } from './dom.js';
import { open_editor, open_chord_editor } from './editor-links.js';
import { state } from './state.js';

state.originalTitle = document.title;

// 過渡用：index.html 還在用 onclick= 等屬性呼叫這些函式，先掛到 window。
// 改成 addEventListener 後（#9 第 5 步）就刪掉。
Object.assign(window, {
  filter_song,
  open_score,
  close_score,
  set_transpose,
  value_modify,
  begin_song_id_edit,
  song_id_popup_control,
  song_id_keydown_handler,
  openDom,
  closeDom,
  toggleClass,
  parse_hash,
  open_editor,
  open_chord_editor,
});

// Load the Visualization API, then query the spreadsheet.
google.load('visualization', '1.0', {'packages':['corechart']});
google.setOnLoadCallback(loadData);

window.addEventListener('click', function (){ open_feedback_popup(5); });
window.addEventListener('hashchange', exec_hash);
window.addEventListener('beforeprint', ()=>{save_scroll('html')});
window.addEventListener('afterprint', ()=>{restore_scroll('html')});
document.querySelector('#song_list tbody').addEventListener('click', song_list_onclick)

// 放在最後：事件監聽都註冊好之後才用快取渲染（見 #2）
renderWithCachedData();
