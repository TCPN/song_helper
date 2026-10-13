const { test, expect } = require('../app');

test.describe('開啟與關閉譜面', () => {
  test('點「(譜)」開啟彈窗，顯示樂譜、曲號、調性，並更新網址與標題', async ({ app }) => {
    await app.goto();
    await expect(app.popup()).not.toHaveClass(/open/);

    await app.openScore(1);

    expect(await app.hashParams()).toEqual({ song_id: '1' });
    await expect(app.currentSongId()).toHaveText('1');
    await expect(app.currentTone()).toHaveText('C');
    // 現況：還沒移調時輸入框是空白（視同 0）
    await expect(app.transposeInput()).toHaveValue('');
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

  test('「關閉」收起彈窗，清除網址參數、標題與移調值', async ({ app }) => {
    await app.goto('#song_id=1&transpose=2');
    await expect(app.popup()).toHaveClass(/open/);

    await app.page.getByText('關閉', { exact: true }).click();

    await expect(app.popup()).not.toHaveClass(/open/);
    expect(await app.hashParams()).toEqual({});
    await expect(app.page).toHaveTitle('移調小幫手');
    await expect(app.transposeInput()).toHaveValue('');
  });

  test('點彈窗背景的空白處也會關閉', async ({ app }) => {
    await app.goto();
    await app.openScore(1);
    // 直接對背景元素送出 click，確保 event.target 就是背景本身
    await app.page.locator('#score_popup_bg').dispatchEvent('click');
    await expect(app.popup()).not.toHaveClass(/open/);
    expect(await app.hashParams()).toEqual({});
  });

  test('關閉後再開另一首，移調值重置（視同 0）', async ({ app }) => {
    await app.goto('#song_id=1&transpose=3');
    await app.page.getByText('關閉', { exact: true }).click();
    await app.openScore(2);
    await expect(app.transposeInput()).toHaveValue('');
    expect(await app.hashParams()).toEqual({ song_id: '2' });
    await expect(app.currentTone()).toHaveText('G');
  });
});

test.describe('上一首／下一首', () => {
  test('下一首、上一首依編號切換，並更新網址', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.page.locator('.change-song.next').click();
    await expect(app.currentSongId()).toHaveText('2');
    expect(await app.hashParams()).toEqual({ song_id: '2' });

    await app.page.locator('.change-song.prev').click();
    await expect(app.currentSongId()).toHaveText('1');
    expect(await app.hashParams()).toEqual({ song_id: '1' });
  });

  test('第一首按上一首、最後一首按下一首：維持原本的歌', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.page.locator('.change-song.prev').click();
    await expect(app.currentSongId()).toHaveText('1');
    await expect(app.popup()).toHaveClass(/open/);

    await app.goto('#song_id=4');
    await app.page.locator('.change-song.next').click();
    await expect(app.currentSongId()).toHaveText('4');
    await expect(app.popup()).toHaveClass(/open/);
  });

  // 現況：下一首剛好是「沒有譜的歌」時，不會跳過，而是提示後關閉譜面。
  // 若之後想改成自動跳到下一首有譜的歌，修改這個測試即可。
  test('下一首是沒有譜的歌：跳出提示並關閉譜面（現況）', async ({ app }) => {
    await app.goto('#song_id=2');
    await app.page.locator('.change-song.next').click();
    await expect.poll(() => app.dialogs).toEqual(['No score for song 3']);
    await expect(app.popup()).not.toHaveClass(/open/);
    expect(await app.hashParams()).toEqual({});
  });
});

test.describe('工具列', () => {
  test('「播放」切換播放器區塊的顯示', async ({ app }) => {
    await app.goto('#song_id=1');
    const player = app.page.locator('#player-set');
    await expect(player).toHaveClass(/hide/);
    await app.page.getByText('播放', { exact: true }).click();
    await expect(player).not.toHaveClass(/hide/);
    await app.page.getByText('播放', { exact: true }).click();
    await expect(player).toHaveClass(/hide/);
  });

  test('「列印」呼叫 window.print', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.page.getByText('列印', { exact: true }).click();
    expect(await app.page.evaluate(() => window.__printCalls__)).toBe(1);
  });
});

test.describe('編輯選單', () => {
  const editLabel = (app) => app.page.locator('label:has(> #editor-menu)');
  const menu = (app) => app.page.locator('#editor-menu');

  test('點「編輯」展開選單：和弦編輯器、進階編輯器', async ({ app }) => {
    await app.goto('#song_id=2');
    await expect(menu(app)).toHaveClass(/hide/);
    await editLabel(app).click();
    await expect(menu(app)).not.toHaveClass(/hide/);
    await expect(menu(app).locator('.menu-item')).toHaveText(['和弦編輯器', '進階編輯器']);
  });

  test('選單展開時點其他地方會收起，不開編輯器', async ({ app }) => {
    await app.goto('#song_id=2');
    await editLabel(app).click();
    await expect(menu(app)).not.toHaveClass(/hide/);
    let opened = false;
    app.page.on('popup', () => { opened = true; });
    await app.page.mouse.click(10, 300);
    await expect(menu(app)).toHaveClass(/hide/);
    expect(opened).toBe(false);
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
