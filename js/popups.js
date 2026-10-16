// 歌曲資訊彈窗與意見回饋提示
import { state } from './state.js';
import { tempo_text } from './abc.js';
import { getDom, openDom, closeDom } from './dom.js';

export function show_song_info(song_id){
  var elem = getDom('#info-popup-container');
  var content_elem = elem.querySelector('.popup-window-content');
  var song = state.songs.find(s=>s.id == song_id);
  if(!song)
    return;
  var score_cell;
  if(song.abc){
    score_cell = document.createElement('a');
    score_cell.href = '#song_id=' + song.id;
    score_cell.textContent = '開啟';
    score_cell.addEventListener('click', function(){ closeDom('#info-popup-container'); });
  }else{
    score_cell = '無';
  }
  // 資料來自試算表，一律當成文字放進表格（不用 innerHTML），避免 HTML 被解析
  var table = document.createElement('table');
  [
    ['編號:', song.id],
    ['歌名:', song.name],
    ['調性:', song.tone],
    ['拍號:', song.timesig],
    ['速度:', tempo_text(song.abc)],
    ['歌譜:', score_cell],
  ].forEach(function([label, value]){
    var tr = table.insertRow();
    tr.insertCell().textContent = label;
    var td = tr.insertCell();
    if(value instanceof Node)
      td.appendChild(value);
    else
      td.textContent = value;
  });
  content_elem.replaceChildren(table);
  openDom(elem);
}

// 「找不到想找的歌嗎？」提示：顯示 timeout 秒；期間再點會重新計時
export function open_feedback_popup(timeout=5) {
  openDom('#feedback_popup');
  var elem = document.querySelector('#feedback_popup');
  elem.dataset.timeoutCount = (parseInt(elem.dataset.timeoutCount) || 0) + 1;
  setTimeout(function () {
    elem.dataset.timeoutCount = (parseInt(elem.dataset.timeoutCount) - 1) || 0;
    if(!(parseInt(elem.dataset.timeoutCount)) > 0) {
      closeDom('#feedback_popup');
    }
  }, timeout * 1000);
}

// 註冊資訊彈窗與意見回饋提示的事件
export function setup_popups() {
  document.querySelector('#info-popup-container .popup-bg').addEventListener('click', function(event){
    if(event.target == this)
      closeDom('#info-popup-container');
  });
  document.querySelector('#info-popup-window .popup-window-close').addEventListener('click', ()=>{ closeDom('#info-popup-container'); });
  document.querySelector('#feedback_popup_content').addEventListener('click', function(event){
    closeDom(this.parentElement);
    event.stopPropagation();
  });
  window.addEventListener('click', function (){ open_feedback_popup(5); });
}
