// 歌曲列表：建立列表、選取、搜尋，點歌名開資訊彈窗
import { state } from './state.js';
import { score_kind } from './abc.js';
import { make_song_matcher } from './search.js';
import { show_song_info } from './popups.js';

export function getSongData(song_id){
  return state.songs.find(x=>(x.id==song_id));
}

export function fixedListWidth() {
  var song_list_table = document.querySelector('#song_list');
  var r = song_list_table.getClientRects()[0];
  song_list_table.style.maxWidth = `${r.width}px`;
}

export function createList(songs){
  var song_list_table = document.querySelector('#song_list');
  const rows = Array.from(song_list_table.tBodies[0].rows);
  for(let row of rows.splice(songs.length)){
    row.remove();
  }
  var song_list_dom = song_list_table.tBodies[0];
  for(let i = 0; i < songs.length; i++ ){
    var item_tpl = (rows[i] && rows[i].item)|| createListItem();
    item_tpl.num.textContent = songs[i].id + '.';
    item_tpl.name.textContent = songs[i].name;
    item_tpl.tone.textContent = songs[i].tone + '調';
    // 重用的列先清掉舊的譜面連結（快取與最新資料的譜可能不同）
    item_tpl.scoreMarkLink.classList.remove('chord_score', 'note_score');
    item_tpl.scoreMarkLink.removeAttribute('title');
    item_tpl.scoreMarkLink.removeAttribute('href');
    var kind = score_kind(songs[i].abc);
    if(kind){
      if(kind == 'chord') {
        item_tpl.scoreMarkLink.classList.add('chord_score');
        item_tpl.scoreMarkLink.title = '五線譜 (含和弦)';
      } else {
        item_tpl.scoreMarkLink.classList.add('note_score');
        item_tpl.scoreMarkLink.title = '五線譜 (僅旋律)';
      }
      item_tpl.scoreMarkLink.href = '#song_id=' + songs[i].id;
    }
    song_list_dom.appendChild(item_tpl.topElem);
    item_tpl.topElem.dataset.target = songs[i].id;
    item_tpl.topElem.song_obj = songs[i];
  }
}

function createListItem(){
  var topElem = document.createElement('tr');
  var num = document.createElement('td');
  var name = document.createElement('td');
  var tone = document.createElement('td');
  var scoreMark = document.createElement('td');
  var scoreMarkLink = document.createElement('a');
  num.classList.add('song_index');
  name.classList.add('song_name');
  tone.classList.add('song_tone');
  scoreMark.classList.add('song_score');
  topElem.appendChild(num);
  topElem.appendChild(name);
  topElem.appendChild(tone);
  topElem.appendChild(scoreMark);
  scoreMark.appendChild(scoreMarkLink);
  const listItem = {
    topElem,
    num,
    name,
    tone,
    scoreMark,
    scoreMarkLink,
  };
  topElem.item = listItem;
  return listItem;
}

export function select_song (id) {
  const songs = document.querySelectorAll('#song_list tr');
  for (const song_dom of songs) {
    song_dom.classList.remove('selected');
  }
  if (typeof id === 'number') {
    const song = document.querySelector(`#song_list tr[data-target="${id}"]`);
    song?.classList.add('selected');
  }
}

function on_click_select_song(event) {
  let target = event.target;
  while (target) {
    if (target.tagName === 'TR') {
      select_song(Number(target.dataset.target));
      return;
    }
    target = target.parentElement;
  }
  select_song(null);
}

// 註：每次更新列表都會再註冊一次（現況，重複註冊不影響結果）
export function setup_song_list_selection() {
  const list_container = document.querySelector('#list_container');
  list_container.addEventListener('click', on_click_select_song);
}

export function filter_song(pattern) {
  var song_list_table = document.querySelector('#song_list');
  var items = Array.from(song_list_table.tBodies[0].children);
  var found_something = false;
  var matches = make_song_matcher(pattern);
  items.forEach(v=>{
    if(!matches(v.textContent))
      v.classList.add('hide');
    else {
      v.classList.remove('hide');
      found_something = true;
    }
  });
  var found_nothing_dom = document.querySelector('#found_nothing');
  if(!found_something){
    found_nothing_dom.classList.remove('hide');
  }
  else
    found_nothing_dom.classList.add('hide');
}

// 列表 tbody 的 click：點到歌曲那一列（不是譜面連結）時開資訊彈窗
export function song_list_onclick(event){
  var found_target = event.target;
  while(this.contains(found_target) && this != found_target){
    if(found_target.dataset.target || found_target.tagName == 'A')
      break;
    found_target = found_target.parentElement;
  }
  var target_song = found_target.dataset.target;
  if(target_song)
    show_song_info(target_song);
}
