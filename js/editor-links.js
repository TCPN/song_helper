// 「編輯」選單：在新分頁開編輯器（放在學校網頁時編輯器在 App Engine 上）
import { parse_hash } from './route.js';
import { toggle_menu, click_on_enter } from './dom.js';

function open_editor(song_id) {
  var editor_url = (location.hostname == 'www.csie.ntu.edu.tw' ? '//tcpn-web.appspot.com/song_edit/' : '/song_edit/');
  var url = editor_url + (song_id ? '#song_id=' + song_id : '');
  window.open(url);
}

function open_chord_editor(song_id) {
  var editor_url = (location.hostname == 'www.csie.ntu.edu.tw' ? '//tcpn-web.appspot.com/chord_editor/' : '/chord_editor/');
  var url = editor_url + (song_id ? '#song_id=' + song_id : '');
  window.open(url);
}

// 註冊「編輯」選單與「⋮」選單的開關和編輯器項目（列印、播放的事件在 score.js）；
// 選單項目在按鈕裡面，點選後事件冒泡上去會把選單收起
export function setup_editor_menu() {
  document.querySelector('#edit_button').addEventListener('click', ()=>{ toggle_menu('#edit_button', '#editor-menu'); });
  document.querySelector('#more_button').addEventListener('click', ()=>{ toggle_menu('#more_button', '#more-menu'); });
  click_on_enter('#edit_button');
  click_on_enter('#more_button');
  for(const item of document.querySelectorAll('#editor-menu .menu-item, #more-menu .menu-item'))
    click_on_enter(item);
  for(const item of document.querySelectorAll('.chord-editor-item'))
    item.addEventListener('click', ()=>{ open_chord_editor(parse_hash().song_id); });
  for(const item of document.querySelectorAll('.song-editor-item'))
    item.addEventListener('click', ()=>{ open_editor(parse_hash().song_id); });
}
