// 各模組共用的狀態（取代原本 script.js 的全域變數）
export const state = {
  // 頁面原本的標題，關閉譜面時還原（由 main.js 啟動時設定；模組頂層不碰 DOM）
  originalTitle: null,
  // 目前的歌曲列表資料（快取或試算表最新資料）
  songs: null,
  // 正在顯示譜面的歌
  displayingSong: null,
  // 網址 hash 只在載入時處理一次（之後交給 hashchange）；見 updateListUI
  initialHashHandled: false,
  // 譜面上方歌號輸入：開始編輯前的歌號，與目前指向的歌號
  originalSongId: undefined,
  targetSongId: undefined,
};
