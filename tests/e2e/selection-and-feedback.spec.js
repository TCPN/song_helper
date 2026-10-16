const { test, expect } = require('../app');

test.describe('列表的選取（高亮）', () => {
  test('開啟譜面時，該首的那一列會被選取（同時只有一列）', async ({ app }) => {
    await app.goto();
    await expect(app.selectedRows()).toHaveCount(0);

    await app.openScore(2);
    await expect(app.selectedRows()).toHaveCount(1);
    await expect(app.selectedRows().first()).toHaveAttribute('data-target', '2');
  });

  test('上一首／下一首切換時，選取跟著移動', async ({ app }) => {
    await app.goto('#song_id=1');
    await expect(app.selectedRows().first()).toHaveAttribute('data-target', '1');

    await app.page.locator('.change-song.next').click();
    await expect(app.selectedRows()).toHaveCount(1);
    await expect(app.selectedRows().first()).toHaveAttribute('data-target', '2');
  });

  test('用網址直接開譜面也會選取對應的列', async ({ app }) => {
    await app.goto('#song_id=4');
    await expect(app.selectedRows().first()).toHaveAttribute('data-target', '4');
  });

  test('點列表中的一列會選取該列', async ({ app }) => {
    await app.goto();
    await app.rows().nth(1).locator('td.song_name').click();
    await expect(app.selectedRows()).toHaveCount(1);
    await expect(app.selectedRows().first()).toHaveAttribute('data-target', '2');
  });
});

// 點擊頁面任何地方，都會顯示約 5 秒的「找不到想找的歌嗎？」意見回饋提示。
test.describe('意見回饋提示', () => {
  const clickBlankArea = (app) => app.page.locator('body').click({ position: { x: 5, y: 5 } });

  test('一開始不顯示', async ({ app }) => {
    await app.goto();
    await expect(app.feedbackPopup()).not.toHaveClass(/open/);
  });

  test('點擊頁面後顯示，內容有指向 Google 表單的連結', async ({ app }) => {
    await app.goto();
    await clickBlankArea(app);
    await expect(app.feedbackPopup()).toHaveClass(/open/);
    await expect(app.feedbackPopup()).toContainText('找不到想找的歌嗎？');
    await expect(app.feedbackPopup().locator('a')).toHaveAttribute('href', /^https:\/\/docs\.google\.com\/forms\//);
  });

  test('約 5 秒後自動消失', async ({ app }) => {
    await app.page.clock.install();
    await app.goto();
    await clickBlankArea(app);
    await expect(app.feedbackPopup()).toHaveClass(/open/);

    await app.page.clock.fastForward(4500);
    await expect(app.feedbackPopup()).toHaveClass(/open/);
    await app.page.clock.fastForward(1000);
    await expect(app.feedbackPopup()).not.toHaveClass(/open/);
  });

  test('點提示本身會立刻關閉，不會又被重新打開', async ({ app }) => {
    await app.goto();
    await clickBlankArea(app);
    await expect(app.feedbackPopup()).toHaveClass(/open/);

    await app.page.locator('#feedback_popup_content').click({ position: { x: 5, y: 5 } });
    await expect(app.feedbackPopup()).not.toHaveClass(/open/);
  });

  test('在開譜面之後點擊也會顯示', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.page.locator('#score_popup_top_bar').click({ position: { x: 2, y: 2 } });
    await expect(app.feedbackPopup()).toHaveClass(/open/);
  });
});
