// 所有 E2E 測試共用的 fixture。
//
// 做了這些事，讓測試完全不依賴外部網路，也不受本機檔案影響：
//   1. 把 https://www.google.com/jsapi 換成 tests/support/google-stub.js（googleUnavailable 時讓它載入失敗）
//   2. 其餘非本機的請求一律中止，並記錄在 app.blocked
//   3. songs.json 快照由測試決定（snapshot 選項；預設 404，就算本機有產生過 songs.json 也不會用到）
//   4. 在頁面載入前注入測試歌曲，並把 window.print 換成計數器
//
// 另外自動收集頁面錯誤（app.errors）與 alert/confirm 訊息（app.dialogs）。
const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');
const { SONGS } = require('./fixtures/songs');

const GOOGLE_STUB = fs.readFileSync(path.join(__dirname, 'support', 'google-stub.js'), 'utf8');
const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

const test = base.test.extend({
  // 測試檔可用 test.use({ songs: [...] }) 或 test.use({ queryError: {...} }) 覆寫
  songs: [SONGS, { option: true }],
  queryError: [null, { option: true }],
  // songs.json 快照的內容（{ updated, songs }）；null 表示沒有部署快照（回 404）
  snapshot: [null, { option: true }],
  // songs.json 延遲幾毫秒才回應（測試快照比試算表晚到的情況）
  snapshotDelay: [0, { option: true }],
  // true 時 Google 的載入器（jsapi）載入失敗
  googleUnavailable: [false, { option: true }],
  // 預設任何未捕捉的頁面錯誤都會讓測試失敗；已知問題的測試可設為 true 後自行檢查 app.errors
  allowPageErrors: [false, { option: true }],

  app: async ({ page, songs, queryError, snapshot, snapshotDelay, googleUnavailable, allowPageErrors }, use) => {
    const errors = [];
    const dialogs = [];
    const blocked = [];

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
      if (url.href === 'https://www.google.com/jsapi') {
        if (googleUnavailable) return route.abort();
        return route.fulfill({ contentType: 'text/javascript', body: GOOGLE_STUB });
      }
      blocked.push(url.href);
      return route.abort();
    });

    await page.addInitScript(({ songs, queryError }) => {
      window.__TEST_SONGS__ = songs;
      window.__TEST_QUERY_ERROR__ = queryError;
      window.__printCalls__ = 0;
      window.print = () => { window.__printCalls__ += 1; };
    }, { songs, queryError });

    const app = {
      page,
      errors,
      dialogs,
      blocked,

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
      transposeInput: () => page.locator('#transpose'),
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
      // 讓假的試算表查詢延遲 ms 毫秒才回應。要在 goto 之前呼叫。
      async delayQuery(ms) {
        await page.addInitScript((delay) => { window.__TEST_QUERY_DELAY__ = delay; }, ms);
      },
      // 按 ▴／▾ 移調。這兩個按鈕平常是隱藏的，輸入框取得焦點（或滑鼠移上去）時才會出現。
      async stepTranspose(delta) {
        await app.transposeInput().focus();
        await page.locator(`.popup-button[data-add="${delta > 0 ? '+1' : '-1'}"]`).click();
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
