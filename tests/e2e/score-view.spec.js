const { test, expect } = require('../app');

// 「檢視」選單：顯示方式（整頁可見／符合高度／符合寬度）
test.describe('譜面的顯示方式', () => {
  const page_box = (app) => app.page.locator('#score_page').boundingBox();
  const window_size = (app) => app.page.locator('#score_popup_window')
    .evaluate((w) => ({ width: w.clientWidth, height: w.clientHeight }));
  const fit_item = (app, mode) => app.page.locator(`#view-menu [data-fit="${mode}"]`);

  async function open_view_menu(app) {
    await app.page.locator('#view_button').click();
    await expect(app.page.locator('#view-menu')).not.toHaveClass(/hide/);
  }

  test('預設是符合寬度，譜紙寬度是畫面的九成', async ({ app }) => {
    await app.goto('#song_id=1');
    await open_view_menu(app);
    await expect(fit_item(app, 'width')).toHaveClass(/selected/);
    await expect(fit_item(app, 'width')).toHaveAttribute('aria-checked', 'true');
    await expect(fit_item(app, 'page')).not.toHaveClass(/selected/);
    await expect(app.page.locator('#view-menu .menu-item')).toHaveText(['整頁可見', '符合高度', '符合寬度']);

    const box = await page_box(app);
    const win = await window_size(app);
    expect(box.width).toBeCloseTo(win.width * 0.9, 0);
    expect(box.height).toBeCloseTo(box.width * 4 / 3, 0);
  });

  test('整頁可見：整張譜紙都在畫面裡', async ({ app }) => {
    await app.goto('#song_id=1');
    await open_view_menu(app);
    await fit_item(app, 'page').click();
    await expect(fit_item(app, 'page')).toHaveClass(/selected/);
    await expect(fit_item(app, 'width')).not.toHaveClass(/selected/);

    const box = await page_box(app);
    const win = await window_size(app);
    expect(box.height).toBeCloseTo(win.height, 0);
    expect(box.width).toBeLessThanOrEqual(win.width);
  });

  test('符合高度：譜紙高度等於畫面高度', async ({ app }) => {
    await app.page.setViewportSize({ width: 375, height: 667 });
    await app.goto('#song_id=1');
    await open_view_menu(app);
    await fit_item(app, 'height').click();

    const box = await page_box(app);
    const win = await window_size(app);
    expect(box.height).toBeCloseTo(win.height, 0);
    // 直式手機畫面上會比畫面寬，可以左右捲動
    expect(box.width).toBeGreaterThan(win.width);
  });

  test('譜紙比畫面寬時可以左右捲動，而且從左邊開始都看得到', async ({ app }) => {
    await app.page.setViewportSize({ width: 375, height: 667 });
    await app.goto('#song_id=1');
    await open_view_menu(app);
    await fit_item(app, 'height').click();

    const scroll_x = await app.page.locator('#score_popup_window').evaluate((w) => w.scrollWidth > w.clientWidth);
    expect(scroll_x).toBe(true);
    const box = await page_box(app);
    const win = await app.page.locator('#score_popup_window').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(win.x);
    expect(box.y).toBeGreaterThanOrEqual(win.y);
  });

  test('選單裡的點擊不會收起選單，點選單外面才收起', async ({ app }) => {
    await app.goto('#song_id=1');
    await open_view_menu(app);
    await expect(app.page.locator('#view_button')).toHaveAttribute('aria-expanded', 'true');
    await fit_item(app, 'height').click();
    await fit_item(app, 'page').click();
    await expect(app.page.locator('#view-menu')).not.toHaveClass(/hide/);

    // 點譜紙：選單收起，譜面還開著
    await app.page.locator('#score_page').click({ position: { x: 20, y: 400 } });
    await expect(app.page.locator('#view-menu')).toHaveClass(/hide/);
    await expect(app.page.locator('#view_button')).toHaveAttribute('aria-expanded', 'false');
    await expect(app.popup()).toHaveClass(/open/);
  });

  test('選單沒有遮罩：開著時其他按鈕照樣能按，選單同時收起', async ({ app }) => {
    await app.goto('#song_id=1');
    await open_view_menu(app);
    await app.page.locator('label.play-button').click();
    await expect(app.page.locator('#player-set')).not.toHaveClass(/hide/);
    await expect(app.page.locator('#view-menu')).toHaveClass(/hide/);
  });

  test('可以只用鍵盤操作：Enter 打開、Tab 到項目按 Enter 選、Esc 收起', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.page.locator('#view_button').focus();
    await app.page.keyboard.press('Enter');
    await expect(app.page.locator('#view-menu')).not.toHaveClass(/hide/);
    await app.page.keyboard.press('Tab');
    await expect(fit_item(app, 'page')).toBeFocused();
    await app.page.keyboard.press('Enter');
    await expect(fit_item(app, 'page')).toHaveAttribute('aria-checked', 'true');
    await app.page.keyboard.press('Tab');
    await app.page.keyboard.press(' ');
    await expect(fit_item(app, 'height')).toHaveAttribute('aria-checked', 'true');
    await app.page.keyboard.press('Escape');
    await expect(app.page.locator('#view-menu')).toHaveClass(/hide/);
    await expect(app.page.locator('#view_button')).toBeFocused();
  });

  test('工具列不夠寬時「檢視」仍留在工具列上', async ({ app }) => {
    await app.page.setViewportSize({ width: 280, height: 600 });
    await app.goto('#song_id=1');
    await expect(app.page.locator('#score_popup_top_bar')).toHaveClass(/compact/);
    await expect(app.page.locator('#view_button')).toBeVisible();
    await open_view_menu(app);
    // 選單不超出畫面
    const box = await app.page.locator('#view-menu').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(280);
  });

  test('設定記在瀏覽器，重新載入或換歌都沿用，網址 hash 不變', async ({ app }) => {
    await app.goto('#song_id=1');
    await open_view_menu(app);
    await fit_item(app, 'page').click();
    expect(await app.hashParams()).toEqual({ song_id: '1' });

    await app.page.reload();
    await app.ready();
    await open_view_menu(app);
    await expect(fit_item(app, 'page')).toHaveClass(/selected/);

    await app.goto('#song_id=2');
    const box = await page_box(app);
    const win = await window_size(app);
    expect(box.height).toBeCloseTo(win.height, 0);
  });

  test('localStorage 裡的值不對時用預設值', async ({ app }) => {
    await app.page.addInitScript(() => {
      localStorage.setItem('score_fit_mode', 'bogus');
    });
    await app.goto('#song_id=1');
    await open_view_menu(app);
    await expect(fit_item(app, 'width')).toHaveClass(/selected/);
  });

  test('點譜紙旁邊的暗色背景會關閉譜面，點譜紙不會', async ({ app }) => {
    await app.goto('#song_id=1');
    await open_view_menu(app);
    await fit_item(app, 'page').click();
    await app.page.keyboard.press('Escape');
    await expect(app.page.locator('#view-menu')).toHaveClass(/hide/);

    await app.page.locator('#score_page').click({ position: { x: 20, y: 400 } });
    await expect(app.popup()).toHaveClass(/open/);

    const box = await page_box(app);
    // 譜紙左邊的空白處（避開上一首的箭頭）
    await app.page.mouse.click(box.x - 20, box.y + 50);
    await expect(app.popup()).not.toHaveClass(/open/);
    expect(await app.hashParams()).toEqual({});
  });

  test('點在捲動層的捲軸上不會關閉譜面', async ({ app }) => {
    await app.goto('#song_id=1');
    // Playwright 的 headless Chromium 隱藏捲軸（不占空間），這裡把 clientWidth 改小，模擬右邊有 20px 的捲軸
    const click_at = (dx) => app.page.locator('#score_popup_window').evaluate((w, dx) => {
      Object.defineProperty(w, 'clientWidth', { configurable: true, value: w.offsetWidth - 20 });
      const rect = w.getBoundingClientRect();
      w.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.right - dx, clientY: rect.top + 100 }));
    }, dx);

    await click_at(10);   // 捲軸上
    await expect(app.popup()).toHaveClass(/open/);
    await click_at(30);   // 捲軸左邊的暗色背景
    await expect(app.popup()).not.toHaveClass(/open/);
  });
});

test.describe('長譜', () => {
  const line = '"C"CDEF|"G"GFED|"C"CDEF|"G"GFED|\n';
  test.use({ songs: [{ id: 1, name: '長譜測試', tone: 'C', timesig: '4/4', melody: 'CDEF',
    abc: 'X:1\nT:Long\nM:4/4\nL:1/4\nK:C\n' + line.repeat(30) + 'C4|]\n' }] });

  test('譜比 3:4 的譜紙長時，譜紙往下延伸，捲到底看得到最後一行', async ({ app }) => {
    await app.page.setViewportSize({ width: 375, height: 667 });
    await app.goto('#song_id=1');
    const size = await app.page.evaluate(() => {
      const page = document.querySelector('#score_page');
      const paper = document.querySelector('#score_paper');
      return { page_w: page.offsetWidth, page_h: page.offsetHeight, paper_h: paper.offsetHeight };
    });
    expect(size.page_h).toBeGreaterThan(size.page_w * 4 / 3);
    expect(size.page_h).toBeGreaterThanOrEqual(size.paper_h);

    const win = app.page.locator('#score_popup_window');
    await win.evaluate((w) => { w.scrollTop = w.scrollHeight; });
    const last = await app.page.locator('#score_paper svg').last().boundingBox();
    const view = await win.boundingBox();
    expect(last.y + last.height).toBeLessThanOrEqual(view.y + view.height + 1);
  });
});
