const { test, expect } = require('../app');

// 手動分頁：從「排版」面板的「設定分頁…」進入，點兩行之間加入或取消分頁；每首歌存在 localStorage，%%newpage 是預設
test.describe('手動分頁', () => {
  // 每行四個小節；歌詞第一個字是行號（l0、l1…）
  const line = (i) => `"C"CDEF|"G"GFED|"C"CDEF|"G"GFED|\nw:l${i} b c d e f g h i j k l m n o p\n`;
  const lines_abc = (n) => Array.from({ length: n }, (_, i) => line(i)).join('');
  const LONG = { id: 1, name: '長譜測試', tone: 'C', timesig: '4/4', melody: 'CDEF',
    abc: 'X:1\nT:Long\nM:4/4\nL:1/4\nK:C\n' + lines_abc(30) + 'C4|]\n' };
  const SHORT = { id: 2, name: '短譜測試', tone: 'C', timesig: '4/4', melody: 'CDEF',
    abc: 'X:2\nT:Short\nM:4/4\nL:1/4\nK:C\n' + lines_abc(4) };
  // 第 2 行之前有 %%newpage
  const NEWPAGE = { id: 3, name: '有預設分頁', tone: 'C', timesig: '4/4', melody: 'CDEF',
    abc: 'X:3\nT:Newpage\nM:4/4\nL:1/4\nK:C\n' + lines_abc(2) + '%%newpage\n' + lines_abc(2) };
  test.use({ songs: [[LONG, SHORT, NEWPAGE], { option: true }] });

  const indicator = (app) => app.page.locator('#page_indicator');
  const lines = (app) => app.page.locator('#score_paper .abcjs-container');
  const bar = (app) => app.page.locator('#page_break_bar');
  const visible_lines = (app) => lines(app).evaluateAll((list) =>
    list.map((l, i) => (l.getClientRects().length ? i : null)).filter((i) => i != null));
  // 從新的一頁開始的行
  const page_starts = (app) => lines(app).evaluateAll((list) =>
    list.map((l, i) => (l.classList.contains('page-start') ? i : null)).filter((i) => i != null));
  const manual_breaks = (app) => lines(app).evaluateAll((list) =>
    list.map((l, i) => (l.classList.contains('manual-break') ? i : null)).filter((i) => i != null));
  const stored = (app) => app.page.evaluate(() => JSON.parse(localStorage.getItem('score_page_breaks')));

  async function enter_mode(app) {
    await app.page.locator('#layout_button').click();
    await app.page.locator('#page_break_mode').click();
    await expect(app.popup()).toHaveClass(/setting-breaks/);
    await expect(bar(app)).toBeVisible();
  }

  // 點第 i 行和上一行之間（第 i 行的上緣附近）
  async function tap_between(app, i) {
    const target = lines(app).nth(i);
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    await app.page.mouse.click(box.x + box.width / 2, box.y + Math.min(8, box.height / 6));
  }

  test('進入設定分頁時整首都顯示、頁碼收起；完成後回到一次一頁', async ({ app }) => {
    await app.goto('#song_id=1');
    await expect(indicator(app)).toBeVisible();
    await enter_mode(app);
    await expect(app.page.locator('#layout-panel')).toHaveClass(/hide/);
    await expect(indicator(app)).toBeHidden();
    expect((await visible_lines(app)).length).toBe(await lines(app).count());
    await app.page.locator('#page_break_done').click();
    await expect(app.popup()).not.toHaveClass(/setting-breaks/);
    await expect(bar(app)).toBeHidden();
    await expect(indicator(app)).toHaveText(/^1 \//);
    expect((await visible_lines(app)).length).toBeLessThan(await lines(app).count());
  });

  test('點兩行之間加入分頁，那一行從新的一頁開始；存成下一行開頭的小節位置，重新整理後還在', async ({ app }) => {
    await app.goto('#song_id=1');
    await enter_mode(app);
    await tap_between(app, 2);
    expect(await manual_breaks(app)).toEqual([2]);
    expect(await page_starts(app)).toContain(2);
    // 第 2 行前面有兩行、每行四個小節線
    expect(await stored(app)).toEqual({ 1: [8] });
    await app.page.keyboard.press('Escape');
    await expect(app.popup()).not.toHaveClass(/setting-breaks/);

    // 第一頁只有第 0、1 行
    await expect(indicator(app)).toHaveText(/^1 \//);
    expect(await visible_lines(app)).toEqual([0, 1]);

    await app.page.reload();
    await app.ready();
    await expect(indicator(app)).toHaveText(/^1 \//);
    expect(await visible_lines(app)).toEqual([0, 1]);
  });

  test('再點一次取消分頁；點在一行的中間不會改', async ({ app }) => {
    await app.goto('#song_id=1');
    await enter_mode(app);
    await tap_between(app, 3);
    expect(await manual_breaks(app)).toEqual([3]);
    const box = await lines(app).nth(5).boundingBox();
    await app.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    expect(await manual_breaks(app)).toEqual([3]);
    await tap_between(app, 3);
    expect(await manual_breaks(app)).toEqual([]);
    // 和預設（沒有 %%newpage）一樣時不留設定
    expect(await stored(app)).toEqual({});
  });

  test('設定時標出自動換頁和手動分頁的位置', async ({ app }) => {
    await app.goto('#song_id=1');
    await enter_mode(app);
    const auto = await page_starts(app);
    expect(auto.length).toBeGreaterThan(0);
    const label = (i) => lines(app).nth(i).evaluate((l) => getComputedStyle(l, '::before').content);
    expect(await label(auto[0])).toBe('"自動換頁"');
    await tap_between(app, 1);
    expect(await label(1)).toBe('"分頁"');
  });

  test('不分頁時只依手動分頁切開，每段之間有間隔，整首上下捲動', async ({ app }) => {
    await app.page.addInitScript(() => {
      localStorage.setItem('score_paper_mode', 'content');
      localStorage.setItem('score_page_breaks', JSON.stringify({ 1: [12] }));
    });
    await app.goto('#song_id=1');
    await expect(indicator(app)).toBeHidden();
    expect((await visible_lines(app)).length).toBe(await lines(app).count());
    expect(await page_starts(app)).toEqual([3]);
    const gap = await lines(app).nth(3).evaluate((l) => parseFloat(getComputedStyle(l, '::before').height));
    expect(gap).toBeGreaterThan(0);
    const no_gap = await lines(app).nth(4).evaluate((l) => getComputedStyle(l, '::before').content);
    expect(no_gap).toBe('none');
  });

  test('分頁時手動分頁會強制換頁，頁碼看得出來', async ({ app }) => {
    await app.page.addInitScript(() => {
      localStorage.setItem('score_page_breaks', JSON.stringify({ 2: [8] }));
    });
    await app.goto('#song_id=2');
    // 四行的短譜本來一頁放得下
    await expect(indicator(app)).toHaveText('1 / 2');
    expect(await visible_lines(app)).toEqual([0, 1]);
  });

  test('超出範圍或不在行首的分頁位置：超出的忽略，在一行中間的從那一行開始', async ({ app }) => {
    await app.page.addInitScript(() => {
      localStorage.setItem('score_page_breaks', JSON.stringify({ 2: [2, 10, 999, 0, -4, 'x'] }));
    });
    await app.goto('#song_id=2');
    // 2 在第 0 行裡面（忽略），10 在第 2 行裡面（第 2 行開始新的一頁）
    expect(await manual_breaks(app)).toEqual([2]);
    await expect(indicator(app)).toHaveText('1 / 2');
    expect(app.errors).toEqual([]);
  });

  test('localStorage 的內容壞掉時當作沒設定', async ({ app }) => {
    await app.page.addInitScript(() => { localStorage.setItem('score_page_breaks', '{bad'); });
    await app.goto('#song_id=2');
    await expect(indicator(app)).toBeHidden();
    expect(await manual_breaks(app)).toEqual([]);
  });

  test('ABC 的 %%newpage 是預設分頁；改了之後可以還原預設', async ({ app }) => {
    await app.goto('#song_id=3');
    expect(await manual_breaks(app)).toEqual([2]);
    await expect(indicator(app)).toHaveText('1 / 2');

    await enter_mode(app);
    const restore = app.page.locator('#page_break_default');
    await expect(restore).toHaveAttribute('aria-disabled', 'true');
    // 取消預設的分頁、加上另一個
    await tap_between(app, 2);
    await tap_between(app, 1);
    expect(await manual_breaks(app)).toEqual([1]);
    expect(await stored(app)).toEqual({ 3: [4] });
    await expect(restore).toHaveAttribute('aria-disabled', 'false');

    await restore.click();
    expect(await manual_breaks(app)).toEqual([2]);
    expect(await stored(app)).toEqual({});
    await expect(restore).toHaveAttribute('aria-disabled', 'true');
  });

  test('取消所有預設分頁也會記住', async ({ app }) => {
    await app.goto('#song_id=3');
    await enter_mode(app);
    await tap_between(app, 2);
    expect(await stored(app)).toEqual({ 3: [] });
    await app.page.locator('#page_break_done').click();
    await expect(indicator(app)).toBeHidden();
  });

  test('每首歌各自設定', async ({ app }) => {
    await app.goto('#song_id=2');
    await enter_mode(app);
    await tap_between(app, 1);
    await app.page.locator('#page_break_done').click();
    await app.goto('#song_id=1');
    expect(await manual_breaks(app)).toEqual([]);
    expect(await stored(app)).toEqual({ 2: [4] });
  });

  test('換歌、關閉譜面時離開設定分頁', async ({ app }) => {
    await app.goto('#song_id=1');
    await enter_mode(app);
    await app.goto('#song_id=2');
    await expect(app.popup()).not.toHaveClass(/setting-breaks/);
    await expect(bar(app)).toBeHidden();

    await enter_mode(app);
    await app.page.locator('#close_score_button').click();
    await app.goto('#song_id=2');
    await expect(app.popup()).not.toHaveClass(/setting-breaks/);
    await expect(bar(app)).toBeHidden();
  });

  test('設定分頁時移調、改排版，分頁設定不變、還在設定中', async ({ app }) => {
    await app.goto('#song_id=1');
    await enter_mode(app);
    await tap_between(app, 2);
    await app.page.locator('#transpose_button').click();
    await app.page.locator('.step-button[data-add="+1"]').click();
    await expect(app.page.locator('#current_visual_tone')).toHaveText('D♭');
    await expect(app.popup()).toHaveClass(/setting-breaks/);
    expect(await manual_breaks(app)).toEqual([2]);
  });

  test('列印時在手動分頁的位置換頁', async ({ app }) => {
    await app.page.addInitScript(() => {
      localStorage.setItem('score_paper_mode', 'content');
      localStorage.setItem('score_page_breaks', JSON.stringify({ 2: [8] }));
    });
    await app.goto('#song_id=2');
    await app.page.emulateMedia({ media: 'print' });
    const breaks = await lines(app).evaluateAll((list) => list.map((l) => getComputedStyle(l).breakAfter));
    expect(breaks).toEqual(['auto', 'page', 'auto', 'auto']);
    const gap = await lines(app).nth(2).evaluate((l) => getComputedStyle(l, '::before').content);
    expect(gap).toBe('none');
  });
});
