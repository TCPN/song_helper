// 「編輯」選單：在新分頁開編輯器（放在學校網頁時編輯器在 App Engine 上）
import { parse_hash } from './route.js';
import { setup_dropdown, toggle_menu, click_on_enter } from './dom.js';

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
// 選單沒有遮罩，點選單外面或按 Esc 收起，選了項目後也收起
export function setup_editor_menu() {
  for(const [button, menu] of [['#edit_button', '#editor-menu'], ['#more_button', '#more-menu']]){
    setup_dropdown(button, menu);
    for(const item of document.querySelectorAll(menu + ' .menu-item')){
      item.addEventListener('click', ()=>{ toggle_menu(button, menu); });
      click_on_enter(item);
    }
  }
  for(const item of document.querySelectorAll('.chord-editor-item'))
    item.addEventListener('click', ()=>{ open_chord_editor(parse_hash().song_id); });
  for(const item of document.querySelectorAll('.song-editor-item'))
    item.addEventListener('click', ()=>{ open_editor(parse_hash().song_id); });
}
