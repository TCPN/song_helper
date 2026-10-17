// 進入點：載入資料、註冊事件。index.html 以 <script type="module"> 載入這支。
import { state } from './state.js';
import { loadData, renderWithCachedData, markNewestUnavailable } from './data.js';
import { exec_hash } from './route.js';
import { setup_list } from './list.js';
import { setup_score_controls } from './score.js';
import { setup_song_id_input } from './song-id-input.js';
import { setup_popups } from './popups.js';
import { setup_editor_menu } from './editor-links.js';
import { save_scroll, restore_scroll } from './dom.js';

state.originalTitle = document.title;

// Load the Visualization API, then query the spreadsheet.
// Google 的舊載入器（jsapi）載入失敗時，網站仍用快取或 songs.json 快照顯示
var googleAvailable = !!(window.google && google.load);
if (googleAvailable) {
  google.load('visualization', '1.0', {'packages':['corechart']});
  google.setOnLoadCallback(loadData);
}

setup_list();
setup_score_controls();
setup_song_id_input();
setup_editor_menu();
setup_popups();
window.addEventListener('hashchange', exec_hash);
window.addEventListener('beforeprint', ()=>{save_scroll('html')});
window.addEventListener('afterprint', ()=>{restore_scroll('html')});

// 放在最後：事件監聽都註冊好之後才用快取渲染（見 #2）
renderWithCachedData();
if (!googleAvailable)
  markNewestUnavailable();
