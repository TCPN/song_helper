const { test, expect } = require('../app');

// 分頁顯示：譜紙是「分頁」時一次顯示一頁，點畫面下半部換下一頁、上半部回上一頁；「不分頁」時上下捲動
test.describe('分頁顯示', () => {
  // 每行歌詞第一個字是行號（l0、l1…），可以看出畫面上是哪幾行
  const line = (i) => `"C"CDEF|"G"GFED|"C"CDEF|"G"GFED|\nw:l${i} b c d e f g h i j k l m n o p\n`;
  const LONG = { id: 1, name: '長譜測試', tone: 'C', timesig: '4/4', melody: 'CDEF',
    abc: 'X:1\nT:Long\nM:4/4\nL:1/4\nK:C\n' + Array.from({ length: 30 }, (_, i) => line(i)).join('') + 'C4|]\n' };
  const SHORT = { id: 2, name: '短譜測試', tone: 'C', timesig: '4/4', melody: 'CDEF',
    abc: 'X:2\nT:Short\nM:4/4\nL:1/4\nK:C\n"C"CDEF|"G"GFED|\n"C"CDEF|"G"G4|]\n' };
  test.use({ songs: [[LONG, SHORT], { option: true }] });

  const indicator = (app) => app.page.locator('#page_indicator');
  const lines = (app) => app.page.locator('#score_paper .abcjs-container');
  // 畫面上看得到的行（第幾行）
  const visible_lines = (app) => lines(app).evaluateAll((list) =>
    list.map((l, i) => (l.getClientRects().length ? i : null)).filter((i) => i != null));
  const page_count = async (app) => Number((await indicator(app).textContent()).split(' / ')[1]);

  // 點畫面（捲動層）的上半部或下半部，點在譜紙上
  async function tap(app, half) {
    const win = await app.page.locator('#score_popup_window').boundingBox();
    const page = await app.page.locator('#score_page').boundingBox();
    const y = half == 'lower' ? win.y + win.height * 0.75 : win.y + win.height * 0.25;
    await app.page.mouse.click(page.x + page.width / 2, y);
  }

  test('分頁時一次顯示一頁，下面有頁碼；每行都在某一頁，一行不會切開', async ({ app }) => {
    await app.goto('#song_id=1');
    await expect(indicator(app)).toBeVisible();
    await expect(indicator(app)).toHaveText(/^1 \/ \d+$/);
    const pages = await page_count(app);
    expect(pages).toBeGreaterThan(1);

    const total = await lines(app).count();
    const seen = [];
    for (let n = 1; n <= pages; n++) {
      await expect(indicator(app)).toHaveText(`${n} / ${pages}`);
      const shown = await visible_lines(app);
      expect(shown.length).toBeGreaterThan(0);
      // 這頁的行接在上一頁後面
      expect(shown[0]).toBe(seen.length);
      seen.push(...shown);
      // 這頁的行都放得進 A4 比例的譜紙裡，譜紙不會被撐長
      const size = await app.page.evaluate(() => {
        const page = document.querySelector('#score_page').getBoundingClientRect();
        const paper = document.querySelector('#score_paper').getBoundingClientRect();
        return { width: page.width, height: page.height, paper: paper.height };
      });
      expect(size.height).toBeCloseTo(size.width * Math.SQRT2, 0);
      expect(size.paper).toBeLessThanOrEqual(size.height + 0.5);
      if (n < pages) await tap(app, 'lower');
    }
    expect(seen).toEqual(Array.from({ length: total }, (_, i) => i));
  });

  test('點下半部換下一頁、點上半部回上一頁，第一頁和最後一頁再點不動', async ({ app }) => {
    await app.goto('#song_id=1');
    const pages = await page_count(app);
    await tap(app, 'upper');
    await expect(indicator(app)).toHaveText(`1 / ${pages}`);
    await tap(app, 'lower');
    await expect(indicator(app)).toHaveText(`2 / ${pages}`);
    await tap(app, 'upper');
    await expect(indicator(app)).toHaveText(`1 / ${pages}`);
    for (let n = 1; n < pages; n++) await tap(app, 'lower');
    await expect(indicator(app)).toHaveText(`${pages} / ${pages}`);
    await tap(app, 'lower');
    await expect(indicator(app)).toHaveText(`${pages} / ${pages}`);
    await expect(app.popup()).toHaveClass(/open/);
  });

  test('鍵盤換頁：→／PageDown 下一頁，←／PageUp 上一頁；焦點在工具列上時不換頁', async ({ app }) => {
    await app.goto('#song_id=1');
    const pages = await page_count(app);
    // 焦點留在譜面後面的搜尋框（autofocus）也能換頁
    await app.page.keyboard.press('ArrowRight');
    await expect(indicator(app)).toHaveText(`2 / ${pages}`);
    await app.page.keyboard.press('PageDown');
    await expect(indicator(app)).toHaveText(`3 / ${pages}`);
    await app.page.keyboard.press('ArrowLeft');
    await expect(indicator(app)).toHaveText(`2 / ${pages}`);
    await app.page.keyboard.press('PageUp');
    await expect(indicator(app)).toHaveText(`1 / ${pages}`);
    await app.page.keyboard.press('PageUp');
    await expect(indicator(app)).toHaveText(`1 / ${pages}`);

    await app.page.locator('#view_button').focus();
    await app.page.keyboard.press('ArrowRight');
    await expect(indicator(app)).toHaveText(`1 / ${pages}`);
  });

  test('換頁後捲回這頁的最上面', async ({ app }) => {
    await app.page.setViewportSize({ width: 375, height: 667 });
    await app.goto('#song_id=1');
    const win = app.page.locator('#score_popup_window');
    // 符合寬度時一頁比畫面高，可以往下捲
    await win.evaluate((w) => { w.scrollTop = 100; });
    await tap(app, 'lower');
    await expect(indicator(app)).toHaveText(/^2 \//);
    expect(await win.evaluate((w) => w.scrollTop)).toBe(0);
  });

  test('選單開著時點譜紙只收起選單，不換頁', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.page.locator('#view_button').click();
    await expect(app.page.locator('#view-menu')).not.toHaveClass(/hide/);
    await tap(app, 'lower');
    await expect(app.page.locator('#view-menu')).toHaveClass(/hide/);
    await expect(indicator(app)).toHaveText(/^1 \//);
  });

  test('點譜紙旁邊的暗色背景照樣關閉譜面；重新打開從第一頁開始', async ({ app }) => {
    await app.goto('#song_id=1');
    await tap(app, 'lower');
    await expect(indicator(app)).toHaveText(/^2 \//);
    const page = await app.page.locator('#score_page').boundingBox();
    await app.page.mouse.click(page.x - 20, page.y + 50);
    await expect(app.popup()).not.toHaveClass(/open/);
    await app.goto('#song_id=1');
    await expect(indicator(app)).toHaveText(/^1 \//);
  });

  test('整頁可見、符合高度以一頁為準', async ({ app }) => {
    await app.page.addInitScript(() => { localStorage.setItem('score_fit_mode', 'page'); });
    await app.goto('#song_id=1');
    const size = await app.page.evaluate(() => {
      const page = document.querySelector('#score_page').getBoundingClientRect();
      const win = document.querySelector('#score_popup_window');
      return { height: page.height, win_height: win.clientHeight, scroll_y: win.scrollHeight > win.clientHeight };
    });
    expect(size.height).toBeCloseTo(size.win_height, 0);
    expect(size.scroll_y).toBe(false);
    await expect(indicator(app)).toHaveText(/^1 \//);
  });

  test('只有一頁的歌不顯示頁碼，點譜紙不會怎樣', async ({ app }) => {
    await app.goto('#song_id=2');
    await expect(indicator(app)).toBeHidden();
    await tap(app, 'lower');
    await expect(app.popup()).toHaveClass(/open/);
    expect((await visible_lines(app)).length).toBe(await lines(app).count());
  });

  test('換歌時回到第一頁，移調時留在同一頁', async ({ app }) => {
    await app.goto('#song_id=1');
    await tap(app, 'lower');
    await expect(indicator(app)).toHaveText(/^2 \//);
    const shown = await visible_lines(app);

    await app.page.locator('#transpose_button').click();
    await app.page.locator('.step-button[data-add="+1"]').click();
    await expect(app.page.locator('#current_visual_tone')).toHaveText('D♭');
    await expect(indicator(app)).toHaveText(/^2 \//);
    expect(await visible_lines(app)).toEqual(shown);

    await app.goto('#song_id=2');
    await app.goto('#song_id=1');
    await expect(indicator(app)).toHaveText(/^1 \//);
  });

  test('改排版時重新分頁，留在原本這頁第一行所在的那一頁', async ({ app }) => {
    await app.goto('#song_id=1');
    const before = await page_count(app);
    await tap(app, 'lower');
    await tap(app, 'lower');
    await expect(indicator(app)).toHaveText(/^3 \//);
    const first = (await visible_lines(app))[0];

    // 加大行距：每行變高，頁數變多
    await app.page.locator('#layout_button').click();
    const plus = app.page.locator('#layout-panel [data-layout-step="line_gap"][data-steps="1"]');
    for (let i = 0; i < 8; i++) await plus.click();
    await app.page.keyboard.press('Escape');

    expect(await page_count(app)).toBeGreaterThan(before);
    expect(await visible_lines(app)).toContain(first);
  });

  test('不分頁時整首都顯示、沒有頁碼，上下捲動', async ({ app }) => {
    await app.page.addInitScript(() => { localStorage.setItem('score_paper_mode', 'content'); });
    await app.goto('#song_id=1');
    await expect(indicator(app)).toBeHidden();
    expect((await visible_lines(app)).length).toBe(await lines(app).count());
    const scroll_y = await app.page.locator('#score_popup_window').evaluate((w) => w.scrollHeight > w.clientHeight);
    expect(scroll_y).toBe(true);
    // 點譜紙不換頁
    await tap(app, 'lower');
    expect((await visible_lines(app)).length).toBe(await lines(app).count());
  });

  test('切換分頁／不分頁時重新分頁', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.page.locator('#view_button').click();
    await app.page.locator('#view-menu [data-paper="content"]').click();
    await expect(indicator(app)).toBeHidden();
    expect((await visible_lines(app)).length).toBe(await lines(app).count());
    await app.page.locator('#view-menu [data-paper="a4"]').click();
    await expect(indicator(app)).toHaveText(/^1 \//);
    expect((await visible_lines(app)).length).toBeLessThan(await lines(app).count());
  });

  test('列印時每一頁都印出來，在螢幕上的分頁位置換頁', async ({ app }) => {
    await app.goto('#song_id=1');
    await tap(app, 'lower');
    const pages = await page_count(app);
    await app.page.emulateMedia({ media: 'print' });
    // 列印時每行都印出來，頁碼不印
    expect((await visible_lines(app)).length).toBe(await lines(app).count());
    await expect(indicator(app)).toBeHidden();
    const breaks = await lines(app).evaluateAll((list) => list.map((l) => getComputedStyle(l).breakAfter));
    expect(breaks.filter((b) => b == 'page').length).toBe(pages - 1);
    expect(breaks[breaks.length - 1]).not.toBe('page');

    // 紙張大小用 style.css 的 @page（A4），邊界一樣寬時每頁都放得下
    for (const margin of ['0mm', '10mm', '20mm']) {
      const pdf = (await app.page.pdf({ preferCSSPageSize: true, margin: { top: margin, bottom: margin, left: margin, right: margin } })).toString('latin1');
      expect(pdf.match(/\/Type \/Page\b/g).length).toBe(pages);
    }
  });
});
