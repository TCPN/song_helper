// 歌曲資料載入：先用 localStorage 快取（第一次來則用部署時產生的 songs.json 快照）渲染，
// 再用 Google 試算表的最新資料更新
import { state } from './state.js';
import { getSongArray, SPREADSHEET_KEY } from './song-data.js';
import { getCachedData, setCachedData } from './cache.js';
import { createList, setup_song_list_selection, fixedListWidth } from './list.js';
import { exec_hash, hash_song_openable } from './route.js';
import { render_score, close_score } from './score.js';

// Google Visualization API 載入後的 callback：查詢試算表
export function loadData() {
  /*var URL = 'https://docs.google.com/spreadsheet/tq?key=0AvTQcvEt3SwvdEdaOUpVVHRSMkVXUXlHX1hZbFBzWkE';*//* file deleted! */
  var URL = 'https://docs.google.com/spreadsheet/tq?key=' + SPREADSHEET_KEY;
  var query = new google.visualization.Query(URL);
  query.send(function handleQueryResponse(response) {
    if (response.isError()) {
      alert('Error in query: ' + response.getMessage() + ' ' + response.getDetailedMessage());
      state.newestUnavailable = true;
      // 拿不到最新資料：若有快取，就用快取處理還沒處理的 hash
      if (state.songs && !state.initialHashHandled)
        exec_hash();
      showNoDataIfNeeded();
      return;
    }
    var data = response.getDataTable();
    state.songs = getSongArray(data);
    updateListUI(state.songs, true);
    console.log('rendered with newest data');
    setCachedData(state.songs);
    console.log('cached data updated');
  });
}

export function renderWithCachedData() {
  state.songs = getCachedData();
  if (state.songs) {
    updateListUI(state.songs);
    console.log('rendered with cached data');
  } else {
    renderWithSnapshot();
  }
}

// 快照讀取完成（或不需要讀）時 resolve
var snapshotSettled = Promise.resolve();

// 沒有 localStorage 快取（第一次來）時，讀部署時產生的 songs.json；沒有這個檔案就略過
function renderWithSnapshot() {
  snapshotSettled = fetch('songs.json')
    .then((response) => (response.ok ? response.json() : null))
    .then((snapshot) => {
      // 試算表的最新資料已經先到了，就不用快照
      if (!snapshot || state.songs || !Array.isArray(snapshot.songs) || snapshot.songs.length === 0)
        return;
      state.songs = snapshot.songs;
      // 拿不到最新資料時，快照就是能用的最新資料，網址指定的歌也要在這時處理
      updateListUI(state.songs, state.newestUnavailable);
      console.log('rendered with snapshot updated at', snapshot.updated);
    })
    .catch((err) => console.log('no snapshot', err));
}

// Google 載入器無法使用時呼叫：只能用快取或快照
export function markNewestUnavailable() {
  state.newestUnavailable = true;
  if (state.songs && !state.initialHashHandled)
    exec_hash();
  showNoDataIfNeeded();
}

// 最新資料、快取、快照都拿不到時，把 Loading... 換成錯誤訊息，不要讓它一直轉
function showNoDataIfNeeded() {
  snapshotSettled.then(() => {
    if (!state.songs)
      document.querySelector('#loading_icon_center').textContent = '無法載入歌曲資料，請稍後重新整理';
  });
}

// isNewest: songData 是試算表的最新資料（false 表示是 localStorage 的快取）
function updateListUI(songData, isNewest) {
  createList(songData);
  setup_song_list_selection();
  fixedListWidth();
  document.querySelector('#loading_icon').classList.add('hide');
  if (!state.initialHashHandled) {
    // 快取裡就能開的歌直接開；開不了（沒有譜／不存在）的等最新資料再判斷，
    // 避免快取過舊時誤報，也避免提示出現兩次
    if (isNewest || hash_song_openable(songData))
      exec_hash();
  } else if (isNewest && state.displayingSong) {
    // 已用快取開了譜面：最新資料裡這首歌的譜有變（或不見了）才重新處理，否則不重複渲染
    // 不重新執行 exec_hash，以免 hash 相關的提示（例如無效的 transpose）再出現一次
    var newest = songData.find((s)=>(s.id === state.displayingSong.id));
    if (!newest || !newest.abc) {
      // 沒有譜的歌提示一次；歌被刪除時與 exec_hash 對不存在的 song_id 一致，安靜關閉
      if (newest)
        alert('No score for song ' + newest.id);
      close_score();
    } else if (newest.abc !== state.displayingSong.abc) {
      state.displayingSong = newest;
      render_score(); // 沿用目前輸入框裡的移調值；標題也會用最新的歌名
    } else {
      state.displayingSong = newest;
      document.title = `${newest.name} (${document.querySelector('#current_visual_tone').textContent})`;
    }
  }
}
