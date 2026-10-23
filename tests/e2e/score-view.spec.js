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
    await expect(app.page.locator('#view-menu [data-fit]')).toHaveText(['整頁可見', '符合高度', '符合寬度']);

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

  test('工具列的選單預設左邊對齊按鈕；右邊放不下時改成右邊對齊', async ({ app }) => {
    await app.goto('#song_id=1');
    await open_view_menu(app);
    let group = await app.page.locator('#view_group').boundingBox();
    let menu = await app.page.locator('#view-menu').boundingBox();
    expect(menu.x).toBeCloseTo(group.x, 0);

    // 窄螢幕上「⋮」在工具列最右邊，選單往右展開會超出畫面
    await app.page.setViewportSize({ width: 280, height: 600 });
    await app.page.locator('#more_button').click();
    await expect(app.page.locator('#more-menu')).toHaveClass(/align-right/);
    group = await app.page.locator('#more_group').boundingBox();
    menu = await app.page.locator('#more-menu').boundingBox();
    expect(menu.x + menu.width).toBeCloseTo(group.x + group.width, 0);
    expect(menu.x).toBeGreaterThanOrEqual(0);
    // 選單寬度依項目文字，不會被擠成按鈕的寬度
    expect(await app.page.locator('#more-menu').evaluate((m) => m.scrollWidth <= m.clientWidth)).toBe(true);
    expect(menu.width).toBeGreaterThan(group.width);
  });

  test('手機寬度（375px）：「編輯」選單右邊放不下，改成右邊對齊按鈕，寬度不被擠窄', async ({ app }) => {
    await app.page.setViewportSize({ width: 375, height: 667 });
    await app.goto('#song_id=1');
    await app.page.locator('#edit_button').click();
    const menu_locator = app.page.locator('#editor-menu');
    await expect(menu_locator).toHaveClass(/align-right/);
    const group = await app.page.locator('#edit_group').boundingBox();
    const menu = await menu_locator.boundingBox();
    expect(menu.x + menu.width).toBeCloseTo(group.x + group.width, 0);
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.width).toBeGreaterThan(group.width);
    expect(await menu_locator.evaluate((m) => m.scrollWidth <= m.clientWidth)).toBe(true);
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

// 「檢視」選單：譜紙（A4／不分頁）
test.describe('譜紙：A4／不分頁', () => {
  const line = (i) => `"C"CDEF|"G"GFED|"C"CDEF|"G"GFED|\nw:l${i} b c d e f g h i j k l m n o p\n`;
  const LONG = { id: 1, name: '長譜測試', tone: 'C', timesig: '4/4', melody: 'CDEF',
    abc: 'X:1\nT:Long\nM:4/4\nL:1/4\nK:C\n' + Array.from({ length: 30 }, (_, i) => line(i)).join('') + 'C4|]\n' };
  const SHORT = { id: 2, name: '短譜測試', tone: 'C', timesig: '4/4', melody: 'CDEF',
    abc: 'X:2\nT:Short\nM:4/4\nL:1/4\nK:C\n"C"CDEF|"G"GFED|\n"C"CDEF|"G"G4|]\n' };
  // 陣列要寫成 [值, 選項]，不然 Playwright 會把第二首歌當成 fixture 的選項
  test.use({ songs: [[LONG, SHORT], { option: true }] });

  const sizes = (app) => app.page.evaluate(() => {
    const page = document.querySelector('#score_page').getBoundingClientRect();
    const paper = document.querySelector('#score_paper').getBoundingClientRect();
    const win = document.querySelector('#score_popup_window');
    return { width: page.width, height: page.height, paper_height: paper.height,
      win_width: win.clientWidth, win_height: win.clientHeight,
      scroll_x: win.scrollWidth > win.clientWidth, scroll_y: win.scrollHeight > win.clientHeight };
  });
  const item = (app, attr, value) => app.page.locator(`#view-menu [data-${attr}="${value}"]`);

  async function choose(app, attr, value) {
    if (await app.page.locator('#view-menu').getAttribute('class').then((c) => c.includes('hide')))
      await app.page.locator('#view_button').click();
    await item(app, attr, value).click();
    await expect(item(app, attr, value)).toHaveAttribute('aria-checked', 'true');
  }

  test('選單在顯示方式下面隔一條線，預設是 A4', async ({ app }) => {
    await app.goto('#song_id=2');
    await app.page.locator('#view_button').click();
    await expect(app.page.locator('#view-menu .menu-separator').first()).toBeVisible();
    await expect(app.page.locator('#view-menu [data-paper]')).toHaveText(['A4', '不分頁']);
    await expect(item(app, 'paper', 'a4')).toHaveClass(/selected/);
    await expect(item(app, 'paper', 'content')).toHaveAttribute('aria-checked', 'false');
  });

  test('不分頁：短的譜，譜紙高度就是譜的高度，切回 A4 又是 3:4', async ({ app }) => {
    await app.goto('#song_id=2');
    await choose(app, 'paper', 'content');
    let size = await sizes(app);
    expect(size.height).toBeCloseTo(size.paper_height, 0);
    expect(size.height).toBeLessThan(size.width / 2);

    await choose(app, 'paper', 'a4');
    size = await sizes(app);
    expect(size.height).toBeCloseTo(size.width * 4 / 3, 0);
  });

  test('不分頁＋整頁可見：長的譜整首都在畫面裡，不用捲動', async ({ app }) => {
    await app.goto('#song_id=1');
    await choose(app, 'fit', 'page');
    // A4 時長譜超出畫面
    expect((await sizes(app)).scroll_y).toBe(true);

    await choose(app, 'paper', 'content');
    const size = await sizes(app);
    expect(size.height).toBeCloseTo(size.win_height, 0);
    expect(size.width).toBeLessThan(size.win_width);
    expect(size.height).toBeCloseTo(size.paper_height, 0);
    expect(size.scroll_x).toBe(false);
    expect(size.scroll_y).toBe(false);
  });

  test('不分頁＋整頁可見：短的譜寬度占滿，高度依內容', async ({ app }) => {
    await app.goto('#song_id=2');
    await choose(app, 'fit', 'page');
    await choose(app, 'paper', 'content');
    const size = await sizes(app);
    expect(size.width).toBeCloseTo(size.win_width * 0.9, 0);
    expect(size.height).toBeLessThan(size.win_height);
  });

  test('不分頁＋符合高度：譜紙高度等於畫面高度，短的譜會比畫面寬', async ({ app }) => {
    await app.goto('#song_id=2');
    await choose(app, 'fit', 'height');
    await choose(app, 'paper', 'content');
    const size = await sizes(app);
    expect(size.height).toBeCloseTo(size.win_height, 0);
    expect(size.width).toBeGreaterThan(size.win_width);
    expect(size.scroll_x).toBe(true);
    expect(size.scroll_y).toBe(false);
  });

  test('不分頁時換歌、改視窗大小，譜紙都跟著新的譜', async ({ app }) => {
    await app.goto('#song_id=2');
    await choose(app, 'fit', 'page');
    await choose(app, 'paper', 'content');
    await app.page.keyboard.press('Escape');

    await app.page.locator('.change-song.prev').click();
    await expect(app.page.locator('#current_song_id')).toHaveText('1');
    let size = await sizes(app);
    expect(size.height).toBeCloseTo(size.win_height, 0);

    await app.page.setViewportSize({ width: 900, height: 500 });
    size = await sizes(app);
    expect(size.height).toBeCloseTo(size.win_height, 0);
    expect(size.scroll_y).toBe(false);
  });

  test('設定記在瀏覽器，重新載入沿用，網址 hash 不變', async ({ app }) => {
    await app.goto('#song_id=2');
    await choose(app, 'paper', 'content');
    expect(await app.hashParams()).toEqual({ song_id: '2' });
    expect(await app.page.evaluate(() => localStorage.getItem('score_paper_mode'))).toBe('content');

    await app.page.reload();
    await app.ready();
    const size = await sizes(app);
    expect(size.height).toBeCloseTo(size.paper_height, 0);
    await app.page.locator('#view_button').click();
    await expect(item(app, 'paper', 'content')).toHaveClass(/selected/);
  });

  test('localStorage 裡的值不對時用 A4', async ({ app }) => {
    await app.page.addInitScript(() => {
      localStorage.setItem('score_paper_mode', 'bogus');
    });
    await app.goto('#song_id=2');
    await app.page.locator('#view_button').click();
    await expect(item(app, 'paper', 'a4')).toHaveClass(/selected/);
  });

  // 列印不管螢幕上的顯示方式，譜紙就是整張紙寬；每行譜是一個 svg，塞不進這一頁時整行換到下一頁
  for (const paper of ['a4', 'content']) {
    test(`列印（${paper}）：長的譜印成好幾頁，每行譜不從中間切開`, async ({ app }) => {
      await app.page.addInitScript((paper) => {
        localStorage.setItem('score_paper_mode', paper);
        localStorage.setItem('score_fit_mode', 'page');
      }, paper);
      await app.goto('#song_id=1');
      await app.page.emulateMedia({ media: 'print' });
      const lines = await app.page.locator('#score_paper .abcjs-container')
        .evaluateAll((list) => list.map((c) => getComputedStyle(c).breakInside));
      expect(lines.length).toBeGreaterThan(20);
      expect(new Set(lines)).toEqual(new Set(['avoid']));

      // 數 PDF 裡的頁面物件
      const pdf = (await app.page.pdf({ format: 'A4' })).toString('latin1');
      expect(pdf.match(/\/Type \/Page\b/g).length).toBeGreaterThan(1);
    });
  }
});
