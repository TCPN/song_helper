// 試算表資料 → 歌曲物件

// 歌曲資料的 Google 試算表（網站即時查詢與 scripts/update-songs.mjs 產生快照都用它）
export const SPREADSHEET_KEY = '1_8-RZ_a_f47I0IavWYOwg5W07d_M3nQx8VK6wzEvfoM';
// 試算表的 gviz 查詢，回應交給 parse_gviz_response
export const SHEET_QUERY_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_KEY}/gviz/tq?tqx=out:json`;

// data 只要有 getNumberOfRows／getValue（parse_gviz_response 的回傳值）
export function getSongArray(data) {
  /*
  0  編號
  1  歌名/曲名
  2  調號
  3  拍號
  4  首句旋律
  5  出處/譜源
  6  分類
  7  譜
  8  投影片
  9  ppt
  10 abc
  */
  var songArray = [];
  console.log('number of songs', data.getNumberOfRows());
  for (var i = 0; i < data.getNumberOfRows(); i++) {
    var song = {
      "id": data.getValue(i, 0),
      "name": data.getValue(i, 1),
      "tone": data.getValue(i, 2),
      "timesig": data.getValue(i, 3),
      "melody": data.getValue(i, 4),
      "abc": data.getValue(i, 10),
    }
    songArray.push(song);
  }
  return songArray;
}

// 試算表 gviz 查詢（tqx=out:json）的回應文字 → 和 DataTable 相同介面的物件，可直接交給 getSongArray
// 回應長這樣：/*O_o*/\ngoogle.visualization.Query.setResponse({...});
export function parse_gviz_response(text) {
  var m = text.match(/setResponse\(([\s\S]*)\)\s*;?\s*$/);
  if (!m)
    throw new Error('無法解析試算表回應');
  var response = JSON.parse(m[1]);
  // 錯誤訊息只放 gviz 給的說明（例如「boom sheet is gone」），前綴由呼叫端決定
  if (response.status === 'error')
    throw new Error((response.errors || []).map((e) => [e.message, e.detailed_message].filter(Boolean).join(' ') || e.reason).join('; '));
  var rows = response.table.rows;
  return {
    getNumberOfRows: () => rows.length,
    getValue: (r, c) => {
      var cell = rows[r].c[c];
      return cell == null || cell.v === undefined ? null : cell.v;
    },
  };
}
