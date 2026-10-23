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

// 註冊「編輯」選單與「⋮」選單的開關和編輯器項目（列印、播放的事件在 score.js，檢視、排版的選單在 score-view.js、layout-panel.js）；
// 選單沒有遮罩，點選單外面或按 Esc 收起，選了項目後也收起
export function setup_editor_menu() {
  for(const [button, menu] of [['#edit_button', '#editor-menu'], ['#more_button', '#more-menu']]){
    setup_dropdown(button, menu);
    for(const item of document.querySelectorAll(menu + ' .menu-item')){
      item.addEventListener('click', ()=>{ toggle_menu(button, menu); });
      click_on_enter(item);
    }
  }
  // 工具列不夠寬時「⋮」裡的「排版…」：「⋮」收起（上面註冊的），打開按鈕被收起來的那個選單
  for(const item of document.querySelectorAll('#more-menu [data-open-menu]')){
    item.addEventListener('click', (event)=>{
      // 不讓這次點擊傳到 document，不然剛打開的選單會被當成點了外面而收起
      event.stopPropagation();
      var button = document.querySelector(item.dataset.openMenu);
      var menu = document.getElementById(button.getAttribute('aria-controls'));
      toggle_menu(button, menu);
      // 用鍵盤打開時（Enter 觸發的 click 沒有滑鼠位置，detail 是 0），焦點移到選單裡的第一項
      if(event.detail == 0)
        menu.querySelector('[tabindex]').focus();
    });
  }
  for(const item of document.querySelectorAll('.chord-editor-item'))
    item.addEventListener('click', ()=>{ open_chord_editor(parse_hash().song_id); });
  for(const item of document.querySelectorAll('.song-editor-item'))
    item.addEventListener('click', ()=>{ open_editor(parse_hash().song_id); });
}
