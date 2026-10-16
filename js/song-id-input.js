// 譜面上方的歌號：點一下開小鍵盤輸入歌號，也可以用鍵盤操作
import { state } from './state.js';
import { keypad_button_for_key } from './keypad.js';
import { openDom, isOpenDom, closeDom } from './dom.js';
import { open_score } from './score.js';

// 點歌號：開小鍵盤，記下原本的歌號並清空，等待輸入
function begin_song_id_edit(label){
  openDom(label.dataset.open);
  state.originalSongId = state.targetSongId = label.textContent;
  label.textContent = '';
}

function song_id_popup_control(btn){
  var song_id_dom = document.querySelector('#current_song_id');
  var song_id_popup = document.querySelector('#song_id_popup');
  switch(btn) {
    case "ent":
      open_score(song_id_dom.textContent) || restore_edited_song_id();
      closeDom(song_id_popup);
      song_id_dom.blur();
      break;
    case "esc":
      restore_edited_song_id();
      open_score(song_id_dom.textContent);
      closeDom(song_id_popup);
      song_id_dom.blur();
      break;
    case "del": song_id_dom.textContent = song_id_dom.textContent.substr(0, song_id_dom.textContent.length - 1); break;
    case "inc": song_id_dom.textContent = parseInt(state.targetSongId) + 1; open_score(song_id_dom.textContent); break;
    case "dec": song_id_dom.textContent = parseInt(state.targetSongId) - 1; open_score(song_id_dom.textContent); break;
    case "clr": song_id_dom.textContent = ''; break;
    case "0": case "1": case "2": case "3": case "4": case "5": case "6": case "7": case "8": case "9":
      song_id_dom.textContent += btn; break;
  }
  state.targetSongId = song_id_dom.textContent || state.targetSongId;
  if(isOpenDom(song_id_popup))
    song_id_dom.focus();
}

function song_id_keydown_handler(event){
  console.log(event);
  var btn = keypad_button_for_key(event.key);
  btn && song_id_popup_control(btn);
}

function restore_edited_song_id(){
  var song_id_dom = document.querySelector('#current_song_id');
  song_id_dom.textContent = state.originalSongId;
}

// 產生小鍵盤按鈕，註冊歌號與小鍵盤的事件
export function setup_song_id_input() {
  var buttons = [0,1,2,3,4,5,6,7,8,9,'inc','dec','del','clr','esc','ent'];
  var parent = document.querySelector('#song_id_popup .popup-window');
  var div = document.createElement('div');
  div.className = 'button cc';
  buttons.forEach(v=>{
    div.dataset.value = v;
    parent.append(div.cloneNode());
  });

  var label = document.querySelector('#current_song_id');
  label.addEventListener('click', function(){ begin_song_id_edit(this); });
  label.addEventListener('keydown', song_id_keydown_handler);
  // 點按鈕送出按鈕的值；點小鍵盤外的背景（data-value="esc"）等於取消
  document.querySelector('#song_id_popup').addEventListener('click', function(event){
    song_id_popup_control(event.target.dataset.value);
  });
}
