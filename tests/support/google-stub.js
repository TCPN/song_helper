// 取代 https://www.google.com/jsapi 的假實作，只提供 js/main.js、js/data.js 用到的部分：
//   google.load / google.setOnLoadCallback / new google.visualization.Query(url).send(cb)
// 資料來自測試在頁面載入前注入的 window.__TEST_SONGS__；
// 設定 window.__TEST_QUERY_ERROR__ = { message, detail } 可模擬查詢失敗；
// 設定 window.__TEST_QUERY_DELAY__ = 毫秒數 可讓查詢延遲回應（用來測試「先用快取渲染」）。
(function () {
  // 對應試算表欄位順序：0 編號, 1 歌名, 2 調號, 3 拍號, 4 首句旋律, 5 出處, 6 分類, 7 譜, 8 投影片, 9 ppt, 10 abc
  function songToRow(song) {
    return [song.id, song.name, song.tone, song.timesig, song.melody, null, null, null, null, null, song.abc];
  }

  function makeDataTable(songs) {
    var rows = songs.map(songToRow);
    return {
      getNumberOfRows: function () { return rows.length; },
      getValue: function (row, col) { return rows[row][col]; },
    };
  }

  function whenDomReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function Query(url) {
    this.url = url;
    (window.__TEST_QUERY_URLS__ = window.__TEST_QUERY_URLS__ || []).push(url);
  }

  Query.prototype.send = function (callback) {
    setTimeout(function () {
      var error = window.__TEST_QUERY_ERROR__;
      if (error) {
        callback({
          isError: function () { return true; },
          getMessage: function () { return error.message; },
          getDetailedMessage: function () { return error.detail; },
        });
        return;
      }
      callback({
        isError: function () { return false; },
        getDataTable: function () { return makeDataTable(window.__TEST_SONGS__ || []); },
      });
    }, window.__TEST_QUERY_DELAY__ || 0);
  };

  window.google = {
    load: function () {},
    setOnLoadCallback: function (callback) {
      whenDomReady(function () { setTimeout(callback, 0); });
    },
    visualization: { Query: Query },
  };
})();
