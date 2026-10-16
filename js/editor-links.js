// 「編輯」選單：在新分頁開編輯器（放在學校網頁時編輯器在 App Engine 上）
import { parse_hash } from './route.js';
import { toggleClass } from './dom.js';

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

// 註冊「編輯」選單的事件；選單項目在「編輯」裡面，點選後事件冒泡上去會把選單收起
export function setup_editor_menu() {
  document.querySelector('#edit_button').addEventListener('click', ()=>{ toggleClass('#editor-menu', 'hide'); });
  document.querySelector('#chord_editor_item').addEventListener('click', ()=>{ open_chord_editor(parse_hash().song_id); });
  document.querySelector('#song_editor_item').addEventListener('click', ()=>{ open_editor(parse_hash().song_id); });
}
