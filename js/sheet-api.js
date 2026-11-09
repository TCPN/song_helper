// 把資料寫回 Google 試算表用的純函式：Sheets API 的網址、找歌在第幾列、錯誤訊息（不碰 DOM、不連網）。
// 登入與實際送出在 js/sheet-save.js
import { SPREADSHEET_KEY } from './song-data.js';

// 和進階編輯器（tcpn_web_server 的 /song_edit/）同一個 OAuth 用戶端；能用的網站來源在 Google Cloud Console 設定
export const OAUTH_CLIENT_ID = '179202720764-76nabehfbpstjm8h9husjiel2maavk1a.apps.googleusercontent.com';
// 讀寫試算表的權限（實際能不能寫，由登入的帳號對試算表有沒有編輯權決定）
export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

// 欄位（和 js/song-data.js 的 getSongArray 一樣從 0 數）：0 編號、8 投影片
export const ID_COLUMN_INDEX = 0;
export const SLIDES_COLUMN_INDEX = 8;

const VALUES_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_KEY}/values`;

// 第幾欄（從 0 數）→ 欄名：0 → A、8 → I、26 → AA
export function column_letter(index) {
  var name = '';
  for (var n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}

// 整欄的範圍，例如 'A:A'（沒寫工作表名稱就是第一個工作表，和 gviz 查詢一樣）
export function column_range(index) {
  var c = column_letter(index);
  return `${c}:${c}`;
}

// 一格的範圍，例如 'I12'（row 從 1 數，和試算表上的列號一樣）
export function cell_range(index, row) {
  return column_letter(index) + row;
}

// 一次讀幾個範圍；每個範圍傳回一欄（majorDimension=COLUMNS），數字照原本的值（不套格式）
export function batch_get_url(ranges) {
  return VALUES_URL + ':batchGet?' + ranges.map((r) => 'ranges=' + encodeURIComponent(r)).join('&') +
    '&majorDimension=COLUMNS&valueRenderOption=UNFORMATTED_VALUE';
}

// 寫一個範圍：RAW 表示照字面存（開頭是 = 或 + 的字不會變成公式）
export function update_url(range) {
  return `${VALUES_URL}/${encodeURIComponent(range)}?valueInputOption=RAW`;
}

// batchGet 回應裡第 i 個範圍的那一欄（整欄都空時 API 不給 values）
export function response_column(body, i) {
  var range = body && body.valueRanges && body.valueRanges[i];
  return (range && range.values && range.values[0]) || [];
}

// 編號那一欄裡是這個曲號的列號（從 1 數；可能有好幾列，或一列都沒有）
export function find_song_rows(id_column, song_id) {
  var target = String(song_id).trim();
  var rows = [];
  id_column.forEach((value, i) => {
    if (value !== null && value !== undefined && String(value).trim() === target)
      rows.push(i + 1);
  });
  return rows;
}

// 格子的值 → 比較用的文字：空的當成 ''，換行統一成 \n，去掉前後空白
export function cell_text(value) {
  if (value === null || value === undefined)
    return '';
  return String(value).replace(/\r\n?/g, '\n').trim();
}

// Sheets API 回應錯誤時給使用者看的訊息
export function api_error_message(status, message) {
  if (status == 403)
    return '這個 Google 帳號沒有試算表的編輯權限';
  if (status == 401)
    return 'Google 登入已失效，請再試一次';
  if (status == 404)
    return '找不到試算表';
  return '試算表回應錯誤（' + status + (message ? '：' + message : '') + '）';
}
