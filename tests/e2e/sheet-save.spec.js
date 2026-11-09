const { test, expect, SONGS } = require('../app');

// 「存回試算表」：Google 登入（Google Identity Services）與 Sheets API 都由測試假裝，不連外
const SLIDES = '[主歌 = A1]\n第一句 / 第二句\n[副歌]\n副歌一句';
const SAVE_SONGS = [
  ...SONGS,
  {
    id: 12, name: '有投影片欄的歌', tone: 'C', timesig: '4/4', melody: 'CDEF', slides: SLIDES,
    abc: 'X:12\nT:Cell\nM:4/4\nL:1/4\nK:C\nP:A\nCDEF|]\nw:一 二 三 四\n',
  },
];
const LOCAL = '[主歌 = A1]\n第一句\n第二句\n\n[副歌]\n副歌一句';

test.use({ songs: [SAVE_SONGS, { option: true }] });

// 假的 Google 登入程式：要 token 時記一次，馬上給 token（scope 由 grant 決定）
function fake_gis(grant) {
  return `window.__token_requests__ = 0;
    window.google = { accounts: { oauth2: {
      initTokenClient(config) {
        return { requestAccessToken() {
          window.__token_requests__++;
          setTimeout(() => config.callback({ access_token: 'fake-token', expires_in: 3600, scope: ${JSON.stringify(grant)} }), 0);
        } };
      },
      hasGrantedAllScopes(response, scope) { return response.scope.split(' ').includes(scope); },
    } } };`;
}

// 假的試算表：第 1 列是標題，之後依序是 SAVE_SONGS；sheet_slides 可以改某一首在試算表上的值（模擬別人改過）
async function fake_google(app, { sheet_slides = {}, put_status = 200, grant = 'https://www.googleapis.com/auth/spreadsheets', before_put = null } = {}) {
  const calls = [];
  await app.page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: fake_gis(grant) }));
  await app.page.route('https://sheets.googleapis.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push({ method: request.method(), path: decodeURIComponent(url.pathname), search: url.search,
      auth: request.headers()['authorization'], body: request.postDataJSON && request.method() == 'PUT' ? request.postDataJSON() : null });
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (request.method() == 'OPTIONS')
      return route.fulfill({ status: 204, headers: { ...headers, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, PUT' } });
    if (request.method() == 'GET') {
      const ids = ['編號', ...SAVE_SONGS.map((s) => s.id)];
      const slides = ['投影片', ...SAVE_SONGS.map((s) => (s.id in sheet_slides ? sheet_slides[s.id] : s.slides ?? ''))];
      return route.fulfill({ headers, contentType: 'application/json',
        body: JSON.stringify({ valueRanges: [{ range: 'A1:A99', values: [ids] }, { range: 'I1:I99', values: [slides] }] }) });
    }
    if (before_put)
      await before_put();
    if (put_status != 200)
      return route.fulfill({ status: put_status, headers, contentType: 'application/json',
        body: JSON.stringify({ error: { code: put_status, message: 'denied' } }) });
    return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify({ updatedCells: 1 }) });
  });
  return calls;
}

test.describe('存回試算表', () => {
  const upload = (app) => app.page.locator('#lyrics_upload');
  const status = (app) => app.page.locator('#lyrics_status');
  const view_lines = (app) => app.page.locator('#lyrics_sections .lyrics-line');
  const view_messages = (app) => app.page.locator('#lyrics_messages li');
  const saved = (app) => app.page.evaluate(() => JSON.parse(localStorage.getItem('lyrics_layout') || '{}'));
  const seed_local = (app, layouts) => app.page.addInitScript((data) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('lyrics_layout', JSON.stringify(data));
      sessionStorage.setItem('seeded', '1');
    }
  }, layouts);
  const row_of_12 = SAVE_SONGS.findIndex((s) => s.id == 12) + 2;

  test('沒有暫存的排版時不顯示按鈕，也不載入 Google 登入', async ({ app }) => {
    await app.goto('#song_id=12&view=lyrics');
    await expect(view_lines(app)).toHaveText(['第一句 第二句', '副歌一句']);
    await expect(upload(app)).toBeHidden();
    expect(app.blocked.filter((u) => u.includes('accounts.google.com'))).toEqual([]);
  });

  test('有暫存的排版時按「存回試算表」：登入後寫進那首歌那一列的 I 欄，刪掉暫存，歌詞檢視改用試算表的內容', async ({ app }) => {
    const calls = await fake_google(app);
    await seed_local(app, { 12: LOCAL, 1: '[A]\n別首' });
    await app.goto('#song_id=12&view=lyrics');
    await expect(view_messages(app)).toHaveText(['使用這台裝置暫存的排版（還沒存回試算表）']);
    await expect(upload(app)).toBeVisible();
    await upload(app).click();
    await expect(status(app)).toHaveText('已存回');

    expect(await app.page.evaluate(() => window.__token_requests__)).toBe(1);
    const sheet = calls.filter((c) => c.method != 'OPTIONS');
    expect(sheet.map((c) => c.method)).toEqual(['GET', 'PUT']);
    expect(sheet[0].search).toContain('ranges=A%3AA&ranges=I%3AI');
    expect(sheet[1].path).toMatch(new RegExp(`/values/I${row_of_12}$`));
    expect(sheet[1].search).toBe('?valueInputOption=RAW');
    expect(sheet[1].auth).toBe('Bearer fake-token');
    expect(sheet[1].body.values).toEqual([[LOCAL]]);

    // 暫存只刪這首；畫面用新的「投影片」欄（不再是暫存），按鈕收起；快取也更新
    expect(await saved(app)).toEqual({ 1: '[A]\n別首' });
    await expect(view_messages(app)).toHaveCount(0);
    await expect(view_lines(app)).toHaveText(['第一句', '第二句', '副歌一句']);
    await expect(upload(app)).toBeHidden();
    const cached = await app.page.evaluate(() => JSON.parse(localStorage.getItem('song_data')).find((s) => s.id == 12).slides);
    expect(cached).toBe(LOCAL);
    expect(app.dialogs).toEqual([]);
  });

  test('試算表上的值在網站載入後被別人改過：先確認才覆蓋', async ({ app }) => {
    const calls = await fake_google(app, { sheet_slides: { 12: '[主歌]\n別人改的' } });
    await seed_local(app, { 12: LOCAL });
    await app.goto('#song_id=12&view=lyrics');
    await upload(app).click();
    await expect(status(app)).toHaveText('已存回');
    expect(app.dialogs).toHaveLength(1);
    expect(app.dialogs[0]).toContain('被改過了');
    expect(app.dialogs[0]).toContain('[主歌]\n別人改的');
    expect(calls.filter((c) => c.method == 'PUT')).toHaveLength(1);
  });

  test('沒有編輯權限（403）：跳出訊息，暫存留著', async ({ app }) => {
    await fake_google(app, { put_status: 403 });
    await seed_local(app, { 12: LOCAL });
    await app.goto('#song_id=12&view=lyrics');
    await upload(app).click();
    await expect.poll(() => app.dialogs).toEqual(['無法存回試算表：這個 Google 帳號沒有試算表的編輯權限']);
    await expect(status(app)).toHaveText('');
    expect(await saved(app)).toEqual({ 12: LOCAL });
    await expect(upload(app)).toBeVisible();
    await expect(upload(app)).toHaveAttribute('aria-disabled', 'false');
  });

  test('登入時沒有允許存取試算表：不寫入', async ({ app }) => {
    const calls = await fake_google(app, { grant: 'email' });
    await seed_local(app, { 12: LOCAL });
    await app.goto('#song_id=12&view=lyrics');
    await upload(app).click();
    await expect.poll(() => app.dialogs).toEqual(['無法存回試算表：沒有允許存取試算表']);
    expect(calls).toEqual([]);
  });

  test('寫入期間又存了新的排版：新的暫存留著，不會被刪掉', async ({ app }) => {
    const NEWER = '[主歌 = A1]\n第一句 第二句\n\n[副歌]\n副歌一句';
    await fake_google(app, { before_put: () => app.page.evaluate((t) =>
      localStorage.setItem('lyrics_layout', JSON.stringify({ 12: t })), NEWER) });
    await seed_local(app, { 12: LOCAL });
    await app.goto('#song_id=12&view=lyrics');
    await upload(app).click();
    await expect(status(app)).toHaveText('已存回');
    expect(await saved(app)).toEqual({ 12: NEWER });
    await expect(upload(app)).toBeVisible();
  });

  test('第二次存不用再登入（token 留在記憶體）', async ({ app }) => {
    const calls = await fake_google(app);
    await seed_local(app, { 12: LOCAL });
    await app.goto('#song_id=12&view=lyrics');
    await upload(app).click();
    await expect(status(app)).toHaveText('已存回');
    // 再暫存一次別的排版（不重新整理）
    await app.page.evaluate(() => localStorage.setItem('lyrics_layout', JSON.stringify({ 12: '[主歌 = A1]\n第一句 第二句\n[副歌]\n副歌一句' })));
    await app.page.locator('#lyrics_edit').click();
    await app.page.locator('#lyrics_editor_close').click();
    await expect(upload(app)).toBeVisible();
    await upload(app).click();
    await expect(status(app)).toHaveText('已存回');
    expect(await app.page.evaluate(() => window.__token_requests__)).toBe(1);
    expect(calls.filter((c) => c.method == 'PUT')).toHaveLength(2);
  });
});
