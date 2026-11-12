// 把「投影片」欄寫回 Google 試算表：用 Google Identity Services 登入拿 access token，再呼叫 Sheets API。
// 進階編輯器用的 gapi.auth2 已經被 Google 停用，這裡用新的 token client。token 只放在記憶體（重新整理就要重新登入）。
import { OAUTH_CLIENT_ID, SHEETS_SCOPE, ID_COLUMN_INDEX, SLIDES_COLUMN_INDEX, column_range, cell_range,
  batch_get_url, update_url, response_column, find_song_rows, cell_text, api_error_message } from './sheet-api.js';

const GIS_URL = 'https://accounts.google.com/gsi/client';

var gis_loading = null;
var token = null; // { access_token, expires_at }

function gis_ready() {
  return !!(window.google && google.accounts && google.accounts.oauth2);
}

// 先載入 Google 登入的程式：按下按鈕時要馬上開登入視窗（等載入完才開會被當成彈出式廣告擋掉）
export function preload_google_sign_in() {
  if (gis_ready())
    return Promise.resolve();
  if (!gis_loading) {
    gis_loading = new Promise((resolve, reject) => {
      var script = document.createElement('script');
      script.src = GIS_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // 失敗的 <script> 拿掉，下次（例如按按鈕時）再載入一次
        script.remove();
        gis_loading = null;
        reject(new Error('無法載入 Google 登入'));
      };
      document.head.appendChild(script);
    });
    gis_loading.catch(() => {});
  }
  return gis_loading;
}

// 開 Google 登入／授權視窗拿 token。要在按鈕的 click 裡同步呼叫（中間不能先 await）
function request_token() {
  return new Promise((resolve, reject) => {
    var client = google.accounts.oauth2.initTokenClient({
      client_id: OAUTH_CLIENT_ID,
      scope: SHEETS_SCOPE,
      callback: (response) => {
        if (response.error)
          return reject(new Error('Google 登入失敗（' + response.error + '）'));
        if (!google.accounts.oauth2.hasGrantedAllScopes(response, SHEETS_SCOPE))
          return reject(new Error('沒有允許存取試算表'));
        // 提早一分鐘當成過期
        token = { access_token: response.access_token, expires_at: Date.now() + (Number(response.expires_in) - 60) * 1000 };
        resolve(token.access_token);
      },
      error_callback: (error) => {
        reject(new Error(error && error.type == 'popup_closed' ? '已取消登入' :
          error && error.type == 'popup_failed_to_open' ? '無法開啟 Google 登入視窗，請再按一次' : 'Google 登入失敗'));
      },
    });
    client.requestAccessToken();
  });
}

function get_token() {
  if (token && Date.now() < token.expires_at)
    return Promise.resolve(token.access_token);
  if (!gis_ready()) {
    preload_google_sign_in();
    return Promise.reject(new Error('正在載入 Google 登入，請再按一次'));
  }
  return request_token();
}

async function call_api(access_token, url, options = {}) {
  var response;
  try {
    response = await fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: 'Bearer ' + access_token } });
  } catch (e) {
    throw new Error('連不上 Google 試算表');
  }
  var body = await response.json().catch(() => null);
  if (!response.ok) {
    // token 被撤銷或過期：下次重新登入
    if (response.status == 401)
      token = null;
    throw new Error(api_error_message(response.status, body && body.error && body.error.message));
  }
  return body;
}

// 把 text 寫進這首歌的「投影片」欄。expected 是網站載入時這一格的值：
// 試算表上現在的值和它不一樣（別人改過）時，問 confirm_overwrite(現在的值)，傳回 false 就不寫。
// 傳回 { saved: true, row } 或 { saved: false }；失敗時丟出 Error（message 是給使用者看的）。
// 要在按鈕的 click 裡直接呼叫（第一次會開登入視窗）
export async function save_slides_cell(song_id, text, expected, confirm_overwrite) {
  var access_token = await get_token();
  var body = await call_api(access_token, batch_get_url([column_range(ID_COLUMN_INDEX), column_range(SLIDES_COLUMN_INDEX)]));
  var rows = find_song_rows(response_column(body, 0), song_id);
  if (rows.length == 0)
    throw new Error('試算表裡找不到曲號 ' + song_id);
  if (rows.length > 1)
    throw new Error('試算表裡有 ' + rows.length + ' 列都是曲號 ' + song_id);
  var row = rows[0];
  var current = response_column(body, 1)[row - 1];
  if (cell_text(current) != cell_text(expected) && !confirm_overwrite(cell_text(current)))
    return { saved: false };
  var range = cell_range(SLIDES_COLUMN_INDEX, row);
  await call_api(access_token, update_url(range), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, majorDimension: 'ROWS', values: [[text]] }),
  });
  return { saved: true, row };
}
