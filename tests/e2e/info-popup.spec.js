const { test, expect } = require('../app');

// 點列表中的一列（不是譜面連結），會跳出該首歌的資訊彈窗。
test.describe('資訊彈窗', () => {
  const infoRows = (app) => app.page.locator('#info-popup-window table tr');
  const clickName = (app, index) => app.rows().nth(index).locator('td.song_name').click();

  test('顯示編號、歌名、調性、拍號、速度與開啟譜面的連結', async ({ app }) => {
    await app.goto();
    await clickName(app, 0);

    await expect(app.infoPopup()).toHaveClass(/open/);
    await expect(infoRows(app).nth(0).locator('td')).toHaveText(['編號:', '1']);
    await expect(infoRows(app).nth(1).locator('td')).toHaveText(['歌名:', '測試歌一']);
    await expect(infoRows(app).nth(2).locator('td')).toHaveText(['調性:', 'C']);
    await expect(infoRows(app).nth(3).locator('td')).toHaveText(['拍號:', '4/4']);
    // ABC 的 Q:1/4=80 會顯示成「音符符號=80」
    await expect(infoRows(app).nth(4).locator('td').nth(1)).toHaveText(/=80$/);
    await expect(infoRows(app).nth(5).locator('td')).toHaveText(['歌譜:', '開啟']);
    await expect(infoRows(app).nth(5).locator('a')).toHaveAttribute('href', '#song_id=1');
  });

  test('沒有 Q: 速度標記的歌，速度欄是空白', async ({ app }) => {
    await app.goto();
    await clickName(app, 1);
    await expect(infoRows(app).nth(1).locator('td')).toHaveText(['歌名:', '測試歌二']);
    await expect(infoRows(app).nth(4).locator('td')).toHaveText(['速度:', '']);
  });

  test('沒有譜的歌：歌譜欄顯示「無」，沒有開啟連結', async ({ app }) => {
    await app.goto();
    await clickName(app, 2);
    await expect(infoRows(app).nth(1).locator('td')).toHaveText(['歌名:', '無譜的歌']);
    await expect(infoRows(app).nth(5).locator('td')).toHaveText(['歌譜:', '無']);
    await expect(infoRows(app).nth(5).locator('a')).toHaveCount(0);
  });

  // 現況：沒有譜的歌，譜面欄中央仍有一個空的 <a>（沒有 href）。點到它既不會開資訊彈窗，
  // 也不會開譜面或跳提示，只會選取該列。
  test('點沒有譜的歌的譜面欄（空連結）：什麼都不會開，只選取該列（現況）', async ({ app }) => {
    await app.goto();
    await app.rows().nth(2).locator('td.song_score').click();
    await expect(app.infoPopup()).not.toHaveClass(/open/);
    await expect(app.popup()).not.toHaveClass(/open/);
    await expect(app.selectedRows()).toHaveCount(1);
    expect(app.dialogs).toEqual([]);
  });

  test('點「開啟」：關閉資訊彈窗並開啟譜面', async ({ app }) => {
    await app.goto();
    await clickName(app, 0);
    await infoRows(app).nth(5).locator('a').click();

    await expect(app.infoPopup()).not.toHaveClass(/open/);
    await expect(app.popup()).toHaveClass(/open/);
    await expect(app.currentSongId()).toHaveText('1');
  });

  test('右上角的 ✕ 可以關閉', async ({ app }) => {
    await app.goto();
    await clickName(app, 0);
    await app.page.locator('#info-popup-window .popup-window-close').click();
    await expect(app.infoPopup()).not.toHaveClass(/open/);
  });

  test('點彈窗外的背景可以關閉，點彈窗本身不會', async ({ app }) => {
    await app.goto();
    await clickName(app, 0);

    await app.page.locator('#info-popup-window').click({ position: { x: 5, y: 40 } });
    await expect(app.infoPopup()).toHaveClass(/open/);

    // 直接對背景元素送出 click，確保 event.target 就是背景本身
    await app.page.locator('#info-popup-container .popup-bg').dispatchEvent('click');
    await expect(app.infoPopup()).not.toHaveClass(/open/);
  });

  test('點列表中的譜面連結：直接開譜面，不開資訊彈窗', async ({ app }) => {
    await app.goto();
    await app.scoreLink(1).click();
    await expect(app.popup()).toHaveClass(/open/);
    await expect(app.infoPopup()).not.toHaveClass(/open/);
  });
});
