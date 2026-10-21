// 所有 E2E 測試共用的 fixture。
//
// 做了這些事，讓測試完全不依賴外部網路，也不受本機檔案影響：
//   1. 試算表的 gviz 查詢由測試回應：內容是 songs 選項的歌曲，可模擬查詢錯誤、連不上與延遲
//   2. 其餘非本機的請求一律中止，並記錄在 app.blocked
//   3. songs.json 快照由測試決定（snapshot 選項；預設 404，就算本機有產生過 songs.json 也不會用到）
//   4. 把 window.print 換成計數器
//
// 另外自動收集頁面錯誤（app.errors）與 alert/confirm 訊息（app.dialogs）。
const base = require('@playwright/test');
const { SONGS } = require('./fixtures/songs');

const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

const SHEET_QUERY_PATH = /^\/spreadsheets\/d\/[^/]+\/gviz\/tq$/;

// 對應試算表欄位順序：0 編號, 1 歌名, 2 調號, 3 拍號, 4 首句旋律, 5 出處, 6 分類, 7 譜, 8 投影片, 9 ppt, 10 abc
function songToCells(song) {
  return [song.id, song.name, song.tone, song.timesig, song.melody, null, null, null, null, null, song.abc]
    .map((v) => (v === null || v === undefined ? null : { v }));
}

// 仿照試算表 gviz 查詢（tqx=out:json）的回應；error 為 { message, detail } 時回應查詢錯誤
function gvizResponse(songs, error) {
  const body = error
    ? { version: '0.6', status: 'error', errors: [{ reason: 'invalid_query', message: error.message, detailed_message: error.detail }] }
    : { version: '0.6', status: 'ok', table: { cols: [], rows: songs.map((song) => ({ c: songToCells(song) })) } };
  return '/*O_o*/\ngoogle.visualization.Query.setResponse(' + JSON.stringify(body) + ');';
}

const test = base.test.extend({
  // 測試檔可用 test.use({ songs: [...] }) 或 test.use({ queryError: {...} }) 覆寫
  songs: [SONGS, { option: true }],
  queryError: [null, { option: true }],
  // songs.json 快照的內容（{ updated, songs }）；null 表示沒有部署快照（回 404）
  snapshot: [null, { option: true }],
  // songs.json 延遲幾毫秒才回應（測試快照比試算表晚到的情況）
  snapshotDelay: [0, { option: true }],
  // true 時連不上試算表（請求被中止）
  sheetUnreachable: [false, { option: true }],
  // 預設任何未捕捉的頁面錯誤都會讓測試失敗；已知問題的測試可設為 true 後自行檢查 app.errors
  allowPageErrors: [false, { option: true }],

  app: async ({ page, songs, queryError, snapshot, snapshotDelay, sheetUnreachable, allowPageErrors }, use) => {
    const errors = [];
    const dialogs = [];
    const blocked = [];
    const queryUrls = [];
    let queryDelay = 0;

    page.on('pageerror', (error) => errors.push(error.message));
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      dialog.accept();
    });

    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (LOCAL_HOSTS.includes(url.hostname)) {
        if (url.pathname.endsWith('/songs.json')) {
          if (snapshotDelay) await new Promise((resolve) => setTimeout(resolve, snapshotDelay));
          return snapshot
            ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(snapshot) })
            : route.fulfill({ status: 404, body: 'Not found' });
        }
        return route.continue();
      }
      if (url.hostname === 'docs.google.com' && SHEET_QUERY_PATH.test(url.pathname)) {
        queryUrls.push(url.href);
        if (queryDelay) await new Promise((resolve) => setTimeout(resolve, queryDelay));
        if (sheetUnreachable) return route.abort();
        return route.fulfill({
          contentType: 'application/javascript',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: gvizResponse(songs, queryError),
        });
      }
      blocked.push(url.href);
      return route.abort();
    });

    await page.addInitScript(() => {
      window.__printCalls__ = 0;
      window.print = () => { window.__printCalls__ += 1; };
    });

    const app = {
      page,
      errors,
      dialogs,
      blocked,
      queryUrls,

      // 開啟網站（可帶 hash，例如 '#song_id=1'），並等歌曲列表載入完成
      async goto(hash = '', { waitReady = true } = {}) {
        await page.goto('/' + hash);
        if (waitReady) await app.ready();
      },
      async ready() {
        await base.expect(page.locator('#loading_icon')).toHaveClass(/hide/);
      },

      // 常用 locator
      rows: () => page.locator('#song_list tbody tr'),
      visibleRows: () => page.locator('#song_list tbody tr:not(.hide)'),
      popup: () => page.locator('#score_popup_container'),
      transposeValue: () => page.locator('#transpose'),
      currentTone: () => page.locator('#current_visual_tone'),
      currentSongId: () => page.locator('#current_song_id'),

      // 目前 hash 解析成物件（'#a=1&b' → { a: '1', b: true }）
      async hashParams() {
        return page.evaluate(() => {
          const out = {};
          location.hash.slice(1).split('&').filter(Boolean).forEach((part) => {
            const [key, ...rest] = part.split('=');
            out[key] = rest.length ? rest.join('=') : true;
          });
          return out;
        });
      },
      // 列表中「開啟譜面」的連結（有譜的歌才有 href）
      scoreLink: (songId) => page.locator(`#song_list tbody tr[data-target="${songId}"] td.song_score a`),
      selectedRows: () => page.locator('#song_list tbody tr.selected'),
      infoPopup: () => page.locator('#info-popup-container'),
      feedbackPopup: () => page.locator('#feedback_popup'),

      // 預先在 localStorage 放入快取資料，模擬「回訪」。要在 goto 之前呼叫。
      async seedCache(cachedSongs = SONGS) {
        await page.addInitScript((data) => {
          localStorage.setItem('song_data', JSON.stringify(data));
        }, cachedSongs);
      },
      // 讓試算表查詢延遲 ms 毫秒才回應。要在 goto 之前呼叫。
      async delayQuery(ms) {
        queryDelay = ms;
      },
      // 打開移調選單（點工具列上的移調 icon）；已經打開就不動
      async openTranspose() {
        if (await page.locator('#transpose-menu').evaluate((m) => m.classList.contains('hide')))
          await page.locator('#transpose_button').click();
        await base.expect(page.locator('#transpose-menu')).not.toHaveClass(/hide/);
      },
      // 在移調選單裡按 ＋／− 移調
      async stepTranspose(delta) {
        await app.openTranspose();
        await page.locator(`#transpose-menu .step-button[data-add="${delta > 0 ? '+1' : '-1'}"]`).click();
      },
      async openScore(songId) {
        await app.scoreLink(songId).click();
        await base.expect(app.popup()).toHaveClass(/open/);
      },
    };

    await use(app);

    if (!allowPageErrors) {
      base.expect(errors, '頁面不應出現未捕捉的錯誤').toEqual([]);
    }
  },
});

module.exports = { test, expect: base.expect, SONGS };
