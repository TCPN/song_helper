// 歌曲資訊彈窗
import { state } from './state.js';
import { tempo_text } from './abc.js';
import { getDom, openDom, closeDom } from './dom.js';
import { has_slide_lyrics } from './slide-lyrics.js';

export function show_song_info(song_id){
  var elem = getDom('#info-popup-container');
  var content_elem = elem.querySelector('.popup-window-content');
  var song = state.songs.find(s=>s.id == song_id);
  if(!song)
    return;
  // 「開啟」連結：關閉資訊彈窗，開譜面（歌詞是歌詞檢視）
  function open_link(hash){
    var link = document.createElement('a');
    link.href = hash;
    link.textContent = '開啟';
    link.addEventListener('click', function(){ closeDom('#info-popup-container'); });
    return link;
  }
  var score_cell = song.abc ? open_link('#song_id=' + song.id) : '無';
  var lyrics_cell = has_slide_lyrics(song) ? open_link('#song_id=' + song.id + '&mode=lyrics') : '無';
  // 資料來自試算表，一律當成文字放進表格（不用 innerHTML），避免 HTML 被解析
  var table = document.createElement('table');
  [
    ['編號:', song.id],
    ['歌名:', song.name],
    ['調性:', song.tone],
    ['拍號:', song.timesig],
    ['速度:', tempo_text(song.abc)],
    ['歌譜:', score_cell],
    ['歌詞:', lyrics_cell],
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

// 註冊資訊彈窗的事件
export function setup_popups() {
  document.querySelector('#info-popup-container .popup-bg').addEventListener('click', function(event){
    if(event.target == this)
      closeDom('#info-popup-container');
  });
  document.querySelector('#info-popup-window .popup-window-close').addEventListener('click', ()=>{ closeDom('#info-popup-container'); });
}
