const { test, expect } = require('../app');

test.describe('開啟與關閉譜面', () => {
  test('點「(譜)」開啟彈窗，顯示樂譜、曲號、調性，並更新網址與標題', async ({ app }) => {
    await app.goto();
    await expect(app.popup()).not.toHaveClass(/open/);

    await app.openScore(1);

    expect(await app.hashParams()).toEqual({ song_id: '1' });
    await expect(app.currentSongId()).toHaveText('1');
    await expect(app.currentTone()).toHaveText('C');
    // 還沒移調時顯示 0
    await expect(app.transposeValue()).toHaveText('0');
    await expect(app.page).toHaveTitle('測試歌一 (C)');
    await expect(app.page.locator('#score_paper svg').first()).toBeVisible();
  });

  test('不同歌曲顯示各自的調性（大調、小調）', async ({ app }) => {
    await app.goto();
    await app.openScore(2);
    await expect(app.currentTone()).toHaveText('G');
    // 譜面開著時列表被蓋住，改用網址切換
    await app.goto('#song_id=4');
    await expect(app.currentTone()).toHaveText('Am');
    await expect(app.page).toHaveTitle('小調測試 (Am)');
  });

  test('樂譜上有和弦與歌詞文字', async ({ app }) => {
    await app.goto();
    await app.openScore(1);
    const text = await app.page.locator('#score_paper').textContent();
    expect(text).toContain('C');
    expect(text).toContain('G');
    expect(text).toContain('do');
  });

  test('「關閉」（X icon）收起彈窗，清除網址參數、標題與移調值', async ({ app }) => {
    await app.goto('#song_id=1&transpose=2');
    await expect(app.popup()).toHaveClass(/open/);

    await app.page.getByLabel('關閉', { exact: true }).click();

    await expect(app.popup()).not.toHaveClass(/open/);
    expect(await app.hashParams()).toEqual({});
    await expect(app.page).toHaveTitle('移調小幫手');
    await expect(app.transposeValue()).toHaveText('0');
  });

  test('點彈窗背景的空白處也會關閉', async ({ app }) => {
    await app.goto();
    await app.openScore(1);
    // 直接對背景元素送出 click，確保 event.target 就是背景本身
    await app.page.locator('#score_popup_bg').dispatchEvent('click');
    await expect(app.popup()).not.toHaveClass(/open/);
    expect(await app.hashParams()).toEqual({});
  });

  test('關閉後再開另一首，移調值重置為 0', async ({ app }) => {
    await app.goto('#song_id=1&transpose=3');
    await app.page.getByLabel('關閉', { exact: true }).click();
    await app.openScore(2);
    await expect(app.transposeValue()).toHaveText('0');
    expect(await app.hashParams()).toEqual({ song_id: '2' });
    await expect(app.currentTone()).toHaveText('G');
  });
});

// #60：分頁改成點左右半部換頁後，拿掉譜面左右的上一首／下一首按鈕，換歌用曲號鍵盤（keypad.spec.js）
test('譜面左右沒有上一首／下一首按鈕', async ({ app }) => {
  await app.goto('#song_id=1');
  await expect(app.page.locator('.change-song')).toHaveCount(0);
});

test.describe('工具列（夠寬時）', () => {
  test('「列印」「播放」「編輯」直接在工具列上，不顯示 ⋮', async ({ app }) => {
    await app.goto('#song_id=1');
    const bar = app.page.locator('#score_popup_top_bar');
    await expect(bar).not.toHaveClass(/compact/);
    await expect(bar.locator('.print-button.wide-only')).toBeVisible();
    await expect(bar.locator('.play-button.wide-only')).toBeVisible();
    await expect(app.page.locator('#edit_button')).toBeVisible();
    await expect(app.page.locator('#more_button')).toBeHidden();
  });

  test('「播放」切換播放器區塊的顯示', async ({ app }) => {
    await app.goto('#song_id=1');
    const player = app.page.locator('#player-set');
    await expect(player).toHaveClass(/hide/);
    await app.page.locator('.play-button.wide-only').click();
    await expect(player).not.toHaveClass(/hide/);
    await app.page.locator('.play-button.wide-only').click();
    await expect(player).toHaveClass(/hide/);
  });

  test('「列印」呼叫 window.print', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.page.locator('.print-button.wide-only').click();
    expect(await app.page.evaluate(() => window.__printCalls__)).toBe(1);
  });
});

test.describe('編輯選單', () => {
  const editLabel = (app) => app.page.locator('#edit_button');
  const menu = (app) => app.page.locator('#editor-menu');

  test('點「編輯」展開選單：和弦編輯器、進階編輯器', async ({ app }) => {
    await app.goto('#song_id=2');
    await expect(menu(app)).toHaveClass(/hide/);
    await expect(editLabel(app)).toHaveAttribute('aria-expanded', 'false');
    await editLabel(app).click();
    await expect(menu(app)).not.toHaveClass(/hide/);
    await expect(editLabel(app)).toHaveAttribute('aria-expanded', 'true');
    await expect(menu(app).locator('.menu-item')).toHaveText(['和弦編輯器', '進階編輯器']);
    // 鍵盤也能開關
    await editLabel(app).focus();
    await app.page.keyboard.press('Enter');
    await expect(menu(app)).toHaveClass(/hide/);
    await app.page.keyboard.press(' ');
    await expect(menu(app)).not.toHaveClass(/hide/);
    await expect(menu(app).locator('.menu-item')).toHaveText(['和弦編輯器', '進階編輯器']);
  });

  test('選單展開時點其他地方會收起，不開編輯器', async ({ app }) => {
    await app.goto('#song_id=2');
    await editLabel(app).click();
    await expect(menu(app)).not.toHaveClass(/hide/);
    let opened = false;
    app.page.on('popup', () => { opened = true; });
    // 點譜紙：選單收起，譜面還開著
    await app.page.locator('#score_page').click({ position: { x: 20, y: 400 } });
    await expect(menu(app)).toHaveClass(/hide/);
    await expect(editLabel(app)).toHaveAttribute('aria-expanded', 'false');
    await expect(app.popup()).toHaveClass(/open/);
    expect(opened).toBe(false);
  });

  test('選單沒有遮罩：開著時其他按鈕照樣能按，選單同時收起', async ({ app }) => {
    await app.goto('#song_id=2');
    await editLabel(app).click();
    await expect(menu(app)).not.toHaveClass(/hide/);
    await app.page.locator('label.play-button').click();
    await expect(app.page.locator('#player-set')).not.toHaveClass(/hide/);
    await expect(menu(app)).toHaveClass(/hide/);
  });

  test('按 Esc 收起選單，焦點回到「編輯」', async ({ app }) => {
    await app.goto('#song_id=2');
    await editLabel(app).focus();
    await app.page.keyboard.press('Enter');
    await expect(menu(app)).not.toHaveClass(/hide/);
    await app.page.keyboard.press('Tab');
    await expect(menu(app).getByRole('menuitem', { name: '和弦編輯器' })).toBeFocused();
    await app.page.keyboard.press('Escape');
    await expect(menu(app)).toHaveClass(/hide/);
    await expect(editLabel(app)).toBeFocused();
  });

  test('「進階編輯器」在新分頁開啟 /song_edit/，並帶上目前的曲號', async ({ app }) => {
    await app.goto('#song_id=2');
    await editLabel(app).click();
    const popupPromise = app.page.waitForEvent('popup');
    await menu(app).locator('.menu-item', { hasText: '進階編輯器' }).click();
    const editor = await popupPromise;
    // 選完編輯器後選單自動收起
    await expect(menu(app)).toHaveClass(/hide/);
    const url = new URL(editor.url());
    expect(url.pathname).toBe('/song_edit/');
    expect(url.hash).toBe('#song_id=2');
    await editor.close();
  });

  test('「和弦編輯器」在新分頁開啟 /chord_editor/，並帶上目前的曲號', async ({ app }) => {
    await app.goto('#song_id=4');
    await editLabel(app).click();
    const popupPromise = app.page.waitForEvent('popup');
    await menu(app).locator('.menu-item', { hasText: '和弦編輯器' }).click();
    const editor = await popupPromise;
    // 選完編輯器後選單自動收起
    await expect(menu(app)).toHaveClass(/hide/);
    const url = new URL(editor.url());
    expect(url.pathname).toBe('/chord_editor/');
    expect(url.hash).toBe('#song_id=4');
    await editor.close();
  });
});

test.describe('工具列不夠寬時的 ⋮ 選單', () => {
  const moreButton = (app) => app.page.locator('#more_button');
  const menu = (app) => app.page.locator('#more-menu');

  // 用一定放不下的 200px 測精簡版面（多寬放得下會隨字型而不同）
  test.beforeEach(async ({ app }) => {
    await app.page.setViewportSize({ width: 200, height: 667 });
  });

  test('很窄時：列印、播放、編輯、排版收進 ⋮，「檢視」換成 icon，工具列排成一行不折行', async ({ app }) => {
    await app.goto('#song_id=2');
    const bar = app.page.locator('#score_popup_top_bar');
    await expect(bar).toHaveClass(/compact/);
    await expect(moreButton(app).locator('svg')).toBeVisible();
    await expect(app.page.locator('#edit_button')).toBeHidden();
    await expect(app.page.locator('#view_button svg')).toBeVisible();
    await expect(app.page.locator('#layout_button')).toBeHidden();
    await expect(bar.locator('.print-button.wide-only')).toBeHidden();
    // 每個項目都只有一行高
    const heights = await bar.evaluate((b) => Array.from(b.children)
      .filter((c) => c.offsetParent && getComputedStyle(c).position == 'static')
      .map((c) => c.getBoundingClientRect().height));
    for (const h of heights) expect(h).toBeLessThan(30);

    await expect(menu(app)).toHaveClass(/hide/);
    await moreButton(app).click();
    await expect(menu(app)).not.toHaveClass(/hide/);
    await expect(menu(app).locator('.menu-item')).toHaveText(['列印', '播放', '和弦編輯器', '進階編輯器', '排版…']);
  });

  test('很窄時：編號和調性貼左邊，「檢視」、⋮、關閉貼右邊，兩邊都留邊距', async ({ app }) => {
    await app.page.setViewportSize({ width: 375, height: 667 });
    await app.goto('#song_id=1');
    const bar = await app.page.locator('#score_popup_top_bar').boundingBox();
    const id = await app.page.locator('#current_song_id').boundingBox();
    const view = await app.page.locator('#view_button').boundingBox();
    const close = await app.page.locator('#close_score_button').boundingBox();
    const key = await app.page.locator('#key_group').boundingBox();
    expect(close.x + close.width).toBeLessThan(bar.x + bar.width - 4);
    expect(close.x + close.width).toBeGreaterThan(bar.x + bar.width - 24);
    expect(id.x).toBeGreaterThan(bar.x + 4);
    expect(id.x).toBeLessThan(bar.x + 24);
    // 調性和「檢視」之間空出來
    expect(view.x - (key.x + key.width)).toBeGreaterThan(40);
  });

  test('螢幕寬度小於 450px 時是精簡版面，450px 以上是完整版面', async ({ app }) => {
    const bar = app.page.locator('#score_popup_top_bar');
    await app.page.setViewportSize({ width: 449, height: 667 });
    await app.goto('#song_id=1');
    await expect(bar).toHaveClass(/compact/);
    await app.page.setViewportSize({ width: 450, height: 667 });
    await expect(bar).not.toHaveClass(/compact/);
    await app.page.setViewportSize({ width: 449, height: 667 });
    await expect(bar).toHaveClass(/compact/);
  });

  test('⋮ 可以用鍵盤打開，Tab 到選單項目按 Enter 執行', async ({ app }) => {
    await app.goto('#song_id=1');
    await moreButton(app).focus();
    await app.page.keyboard.press(' ');
    await expect(menu(app)).not.toHaveClass(/hide/);
    await app.page.keyboard.press('Tab');
    await expect(menu(app).getByRole('menuitem', { name: '列印' })).toBeFocused();
    await app.page.keyboard.press('Tab');
    await expect(menu(app).getByRole('menuitem', { name: '播放' })).toBeFocused();
    await app.page.keyboard.press('Enter');
    await expect(app.page.locator('#player-set')).not.toHaveClass(/hide/);
    await expect(menu(app)).toHaveClass(/hide/);
    await expect(moreButton(app)).toBeFocused();
  });

  test('選單沒有遮罩：開著時其他按鈕照樣能按（例如調性），選單同時收起', async ({ app }) => {
    await app.goto('#song_id=1');
    await moreButton(app).click();
    await expect(menu(app)).not.toHaveClass(/hide/);
    await app.page.locator('#transpose_button').click();
    await expect(app.page.locator('#transpose-menu')).not.toHaveClass(/hide/);
    await expect(menu(app)).toHaveClass(/hide/);
    await expect(moreButton(app)).toHaveAttribute('aria-expanded', 'false');

    await moreButton(app).click();
    await expect(menu(app)).not.toHaveClass(/hide/);
    await app.page.locator('#view_button').click();
    await expect(app.page.locator('#view-menu')).not.toHaveClass(/hide/);
    await expect(menu(app)).toHaveClass(/hide/);
    // 檢視選單開著時再點 ⋮：檢視選單收起、⋮ 打開
    await moreButton(app).click();
    await expect(app.page.locator('#view-menu')).toHaveClass(/hide/);
    await expect(menu(app)).not.toHaveClass(/hide/);
    await expect(moreButton(app)).toHaveAttribute('aria-expanded', 'true');
  });

  test('⋮ 選單按 Esc 收起，焦點回到 ⋮', async ({ app }) => {
    await app.goto('#song_id=1');
    await moreButton(app).focus();
    await app.page.keyboard.press('Enter');
    await expect(menu(app)).not.toHaveClass(/hide/);
    await app.page.keyboard.press('Tab');
    await app.page.keyboard.press('Escape');
    await expect(menu(app)).toHaveClass(/hide/);
    await expect(moreButton(app)).toBeFocused();
  });

  test('手機寬度（375px）工具列排成一行，不折行', async ({ app }) => {
    await app.page.setViewportSize({ width: 375, height: 667 });
    await app.goto('#song_id=1&transpose=2');
    const bar = app.page.locator('#score_popup_top_bar');
    const heights = await bar.evaluate((b) => Array.from(b.children)
      .filter((c) => c.offsetParent && getComputedStyle(c).position == 'static')
      .map((c) => c.getBoundingClientRect().height));
    for (const h of heights) expect(h).toBeLessThan(30);
  });

  test('視窗變寬時恢復完整工具列，開著的 ⋮ 選單會收起，之後不會自己冒出來', async ({ app }) => {
    await app.goto('#song_id=1');
    const bar = app.page.locator('#score_popup_top_bar');
    await expect(bar).toHaveClass(/compact/);
    await moreButton(app).click();
    await expect(menu(app)).not.toHaveClass(/hide/);

    await app.page.setViewportSize({ width: 1280, height: 720 });
    await expect(bar).not.toHaveClass(/compact/);
    await expect(moreButton(app)).toBeHidden();
    await expect(menu(app)).toHaveClass(/hide/);

    await app.page.setViewportSize({ width: 200, height: 667 });
    await expect(bar).toHaveClass(/compact/);
    await expect(menu(app)).toHaveClass(/hide/);
  });

  test('「播放」切換播放器區塊的顯示，選完選單收起', async ({ app }) => {
    await app.goto('#song_id=1');
    const player = app.page.locator('#player-set');
    await expect(player).toHaveClass(/hide/);
    await moreButton(app).click();
    await menu(app).getByText('播放', { exact: true }).click();
    await expect(player).not.toHaveClass(/hide/);
    await expect(menu(app)).toHaveClass(/hide/);
    await moreButton(app).click();
    await menu(app).getByText('播放', { exact: true }).click();
    await expect(player).toHaveClass(/hide/);
  });

  test('「列印」呼叫 window.print', async ({ app }) => {
    await app.goto('#song_id=1');
    await moreButton(app).click();
    await menu(app).getByText('列印', { exact: true }).click();
    expect(await app.page.evaluate(() => window.__printCalls__)).toBe(1);
    await expect(menu(app)).toHaveClass(/hide/);
  });

  test('「和弦編輯器」在新分頁開啟，並帶上目前的曲號', async ({ app }) => {
    await app.goto('#song_id=4');
    await moreButton(app).click();
    const popupPromise = app.page.waitForEvent('popup');
    await menu(app).locator('.menu-item', { hasText: '和弦編輯器' }).click();
    const editor = await popupPromise;
    await expect(menu(app)).toHaveClass(/hide/);
    const url = new URL(editor.url());
    expect(url.pathname).toBe('/chord_editor/');
    expect(url.hash).toBe('#song_id=4');
    await editor.close();
  });

  test('「進階編輯器」在新分頁開啟，並帶上目前的曲號', async ({ app }) => {
    await app.goto('#song_id=2');
    await moreButton(app).click();
    const popupPromise = app.page.waitForEvent('popup');
    await menu(app).locator('.menu-item', { hasText: '進階編輯器' }).click();
    const editor = await popupPromise;
    await expect(menu(app)).toHaveClass(/hide/);
    const url = new URL(editor.url());
    expect(url.pathname).toBe('/song_edit/');
    expect(url.hash).toBe('#song_id=2');
    await editor.close();
  });
});
