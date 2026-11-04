// 歌曲列表：建立列表、選取、搜尋，點歌名開資訊彈窗
import { state } from './state.js';
import { score_kind } from './abc.js';
import { make_song_finder, match_song, song_lyric_search_index, sort_by_rank, unmoved, parse_search_scope, DEFAULT_SEARCH_SCOPE } from './search.js';
import { setup_dropdown } from './dom.js';
import { show_song_info } from './popups.js';
import { has_slide_lyrics } from './slide-lyrics.js';

export function getSongData(song_id){
  return state.songs.find(x=>(x.id==song_id));
}

export function fixedListWidth() {
  var song_list_table = document.querySelector('#song_list');
  var r = song_list_table.getClientRects()[0];
  song_list_table.style.maxWidth = `${r.width}px`;
  update_lyric_match_width();
}

// 歌名下面那句歌詞可以用到的寬度：從歌名那一欄的內容左邊到表格右邊（右邊的調性、按鈕只佔第一行，
// 第二行是空的）。存在表格的 --lyric-match-width，CSS 用它截斷那句歌詞
function update_lyric_match_width() {
  var table = document.querySelector('#song_list');
  var cell = table.querySelector('tbody td.song_name');
  if (!table.getClientRects().length || !cell)
    return;
  var left = cell.getBoundingClientRect().left + parseFloat(getComputedStyle(cell).paddingLeft);
  var width = table.getBoundingClientRect().right - left;
  if (width > 0)
    table.style.setProperty('--lyric-match-width', `${Math.floor(width)}px`);
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
    item_tpl.nameText.textContent = songs[i].name;
    item_tpl.lyricText.textContent = '';
    item_tpl.lyricMatch.classList.add('hide');
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
    // 譜右邊的歌詞按鈕：直接開歌詞檢視；沒有歌詞時不顯示
    var lyrics = has_slide_lyrics(songs[i]);
    item_tpl.lyricsLink.classList.toggle('hide', !lyrics);
    if(lyrics)
      item_tpl.lyricsLink.href = '#song_id=' + songs[i].id + '&view=lyrics';
    else
      item_tpl.lyricsLink.removeAttribute('href');
    song_list_dom.appendChild(item_tpl.topElem);
    item_tpl.topElem.dataset.target = songs[i].id;
    item_tpl.topElem.song_obj = songs[i];
    item_tpl.order = i;
  }
  warm_lyric_indexes(songs);
  // 換了資料（例如快取 → 最新資料）時，照搜尋框現在的字重新篩選
  var search = document.querySelector('#song_search');
  if(search && search.value)
    filter_song(search.value);
}

function createListItem(){
  var topElem = document.createElement('tr');
  var num = document.createElement('td');
  var name = document.createElement('td');
  var nameText = document.createElement('span');
  // 只有歌詞符合搜尋時，歌名下面用小字顯示符合的那一句
  var lyricMatch = document.createElement('div');
  lyricMatch.className = 'lyric_match hide';
  var lyricText = document.createElement('span');
  lyricMatch.appendChild(lyricText);
  name.appendChild(nameText);
  name.appendChild(lyricMatch);
  var tone = document.createElement('td');
  var scoreMark = document.createElement('td');
  var scoreMarkLink = document.createElement('a');
  var lyricsMark = document.createElement('td');
  var lyricsLink = document.createElement('a');
  lyricsLink.className = 'lyrics_link';
  lyricsLink.title = '歌詞';
  lyricsLink.setAttribute('aria-label', '歌詞');
  num.classList.add('song_index');
  name.classList.add('song_name');
  tone.classList.add('song_tone');
  scoreMark.classList.add('song_score');
  lyricsMark.classList.add('song_lyrics');
  topElem.appendChild(num);
  topElem.appendChild(name);
  topElem.appendChild(tone);
  topElem.appendChild(scoreMark);
  topElem.appendChild(lyricsMark);
  scoreMark.appendChild(scoreMarkLink);
  lyricsMark.appendChild(lyricsLink);
  const listItem = {
    topElem,
    num,
    name,
    nameText,
    lyricMatch,
    lyricText,
    tone,
    scoreMark,
    scoreMarkLink,
    lyricsLink,
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

// 搜尋用的歌詞（算一次要幾毫秒，數百首加起來會卡）：列表建好後趁閒置時一點一點先算好；
// 還沒算到就搜尋時，比對到那首歌才當場算。以「投影片」欄＋ABC 為鍵，快取換成最新資料時沒變的歌不用重算
var lyric_indexes = new Map();
var lyric_index_by_song = new WeakMap(); // 每次按鍵都要查，先用 song 物件找，免得每次接一次長字串
var warm_generation = 0;
function lyric_key(song) {
  return (song.slides == null ? '' : String(song.slides)) + '\u0000' + (song.abc || '');
}
function lyric_index_of(song) {
  var index = lyric_index_by_song.get(song);
  if (index)
    return index;
  var key = lyric_key(song);
  index = lyric_indexes.get(key);
  if (!index) {
    try {
      index = song_lyric_search_index(song);
    } catch (e) {
      // 格式異常的 ABC／投影片欄：當成沒有歌詞，不要讓整個搜尋（或閒置時的預先計算）停在這首
      console.error('song ' + song.id + ': 無法抽出搜尋用的歌詞', e);
      index = song_lyric_search_index({});
    }
    lyric_indexes.set(key, index);
  }
  lyric_index_by_song.set(song, index);
  return index;
}

var schedule_idle = typeof requestIdleCallback == 'function'
  ? (fn) => requestIdleCallback(fn, { timeout: 2000 })
  : (fn) => setTimeout(() => fn(null), 50);

var warm_songs = [];
function warm_lyric_indexes(songs) {
  warm_songs = songs;
  // 沒有要搜尋歌詞時不用先算；打開「搜尋歌詞」時再開始
  if (!search_scope.lyrics) {
    warm_generation++;
    return;
  }
  // 只留這份資料用得到的，換資料後舊的歌詞不會一直留在記憶體
  var keep = new Map();
  for (const song of songs) {
    var key = lyric_key(song);
    if (lyric_indexes.has(key))
      keep.set(key, lyric_indexes.get(key));
  }
  lyric_indexes = keep;
  var generation = ++warm_generation;
  var next = 0;
  function work(deadline) {
    if (generation != warm_generation)
      return;
    // 每次最多做約 8 毫秒，閒置時間再長也不一次做完，免得這時打字要等
    var until = performance.now() + 8;
    while (next < songs.length) {
      lyric_index_of(songs[next++]);
      if (performance.now() > until || (deadline && deadline.timeRemaining() < 1))
        break;
    }
    if (next < songs.length)
      schedule_idle(work);
  }
  schedule_idle(work);
}

// 篩選並排序：符合的列依符合程度（search.js 的 RANK_*）排在前面，同一級照原本的順序
function filter_song(pattern) {
  var tbody = document.querySelector('#song_list').tBodies[0];
  var items = Array.from(tbody.children);
  var found_something = false;
  var find = make_song_finder(pattern);
  var entries = items.map((v, k) => {
    var song = v.song_obj;
    var item = v.item;
    // 空的搜尋框：全部列出（只搜尋歌詞時，沒有歌詞的歌也要列出）
    var result = !song ? null : !pattern ? { rank: 0, lyric: null }
      : match_song(find, song, () => lyric_index_of(song), search_scope);
    v.classList.toggle('hide', !result);
    if (result)
      found_something = true;
    if (item) {
      var lyric = (result && result.lyric) || '';
      if (item.lyricText.textContent !== lyric)
        item.lyricText.textContent = lyric;
      item.lyricMatch.classList.toggle('hide', !lyric);
    }
    return { row: v, rank: result ? result.rank : null, order: item ? item.order : k };
  });
  // 依序排好（藏起來的列照原本順序放在後面），只搬必要的列：每次按鍵都整個重排 600 列會多花很多時間重新排版
  var desired = sort_by_rank(entries).map((e) => e.row);
  if (desired.some((row, k) => row !== items[k])) {
    var keep = unmoved(items, desired);
    for (var k = desired.length - 1; k >= 0; k--)
      if (!keep.has(desired[k]))
        tbody.insertBefore(desired[k], desired[k + 1] || null);
  }
  var found_nothing_dom = document.querySelector('#found_nothing');
  if(!found_something){
    found_nothing_dom.classList.remove('hide');
  }
  else
    found_nothing_dom.classList.add('hide');
}

// 列表 tbody 的 click：點到歌曲那一列（不是譜面連結）時開資訊彈窗
function song_list_onclick(event){
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

// 搜尋範圍（搜尋標題／搜尋歌詞）：所有歌共用，存在 localStorage
const SEARCH_SCOPE_KEY = 'search_scope';
var search_scope = { ...DEFAULT_SEARCH_SCOPE };

function load_search_scope() {
  try { return parse_search_scope(localStorage.getItem(SEARCH_SCOPE_KEY)); } catch(e) { return { ...DEFAULT_SEARCH_SCOPE }; }
}

function show_search_scope() {
  for (const box of document.querySelectorAll('#search_options [data-search-scope]')) {
    var key = box.dataset.searchScope;
    box.checked = search_scope[key];
    // 只剩一個勾選時不能取消（至少要搜尋一樣）
    box.disabled = search_scope[key] && !Object.keys(search_scope).some((k) => k != key && search_scope[k]);
  }
  var changed = Object.keys(DEFAULT_SEARCH_SCOPE).some((k) => search_scope[k] !== DEFAULT_SEARCH_SCOPE[k]);
  document.querySelector('#search_options_button').classList.toggle('changed', changed);
}

function setup_search_scope() {
  search_scope = load_search_scope();
  show_search_scope();
  setup_dropdown('#search_options_button', '#search_options');
  document.querySelector('#search_options').addEventListener('change', (event) => {
    var key = event.target.dataset.searchScope;
    if (!key)
      return;
    search_scope = parse_search_scope(JSON.stringify({ ...search_scope, [key]: event.target.checked }));
    try { localStorage.setItem(SEARCH_SCOPE_KEY, JSON.stringify(search_scope)); } catch(e) {}
    show_search_scope();
    if (key == 'lyrics' && search_scope.lyrics)
      warm_lyric_indexes(warm_songs);
    filter_song(document.querySelector('#song_search').value);
  });
}

// 註冊搜尋框與列表的事件
export function setup_list() {
  // 視窗變窄時表格可能跟著變窄
  window.addEventListener('resize', update_lyric_match_width);
  setup_search_scope();
  document.querySelector('#song_search').addEventListener('input', function(){ filter_song(this.value); });
  document.querySelector('#song_list tbody').addEventListener('click', song_list_onclick);
}
