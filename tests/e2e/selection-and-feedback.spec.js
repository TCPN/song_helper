const { test, expect } = require('../app');

test.describe('列表的選取（高亮）', () => {
  test('開啟譜面時，該首的那一列會被選取（同時只有一列）', async ({ app }) => {
    await app.goto();
    await expect(app.selectedRows()).toHaveCount(0);

    await app.openScore(2);
    await expect(app.selectedRows()).toHaveCount(1);
    await expect(app.selectedRows().first()).toHaveAttribute('data-target', '2');
  });

  test('譜面開著時換歌，選取跟著移動', async ({ app }) => {
    await app.goto('#song_id=1');
    await expect(app.selectedRows().first()).toHaveAttribute('data-target', '1');

    await app.switchSong(2);
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

// 列表尾端有一行「沒有找到想要的歌？快來許願」，「快來許願」連到 Google 表單（#59，取代原本的浮動意見回饋提示）。
test.describe('列表尾端的許願連結', () => {
  test('顯示在列表最後，連結指向 Google 表單', async ({ app }) => {
    await app.goto();
    await expect(app.wishRow()).toBeVisible();
    await expect(app.wishRow()).toHaveText('沒有找到想要的歌？快來許願');
    const link = app.wishRow().locator('a');
    await expect(link).toHaveText('快來許願');
    await expect(link).toHaveAttribute('href', /^https:\/\/docs\.google\.com\/forms\//);

    // 在最後一首歌的下面
    const lastRow = await app.rows().last().boundingBox();
    const wish = await app.wishRow().boundingBox();
    expect(wish.y).toBeGreaterThanOrEqual(lastRow.y + lastRow.height - 1);
  });

  test('灰色斜體小字，沒有底色', async ({ app }) => {
    await app.goto();
    const style = await app.wishRow().locator('td').evaluate((td) => {
      const cs = getComputedStyle(td);
      const row = getComputedStyle(td.parentElement);
      // 和歌名那一格比（編號那格本來就是小字）
      const bodyCell = getComputedStyle(document.querySelector('#song_list tbody td.song_name'));
      return {
        fontStyle: cs.fontStyle,
        color: cs.color,
        fontSize: parseFloat(cs.fontSize),
        bodyFontSize: parseFloat(bodyCell.fontSize),
        rowBackground: row.backgroundColor,
      };
    });
    expect(style.fontStyle).toBe('italic');
    expect(style.color).toBe('rgb(136, 136, 136)');
    expect(style.fontSize).toBeLessThan(style.bodyFontSize);
    expect(style.rowBackground).toBe('rgba(0, 0, 0, 0)');
  });

  test('搜尋時仍然顯示', async ({ app }) => {
    await app.goto();
    await app.page.locator('#song_search').fill('zzzz找不到的字');
    await expect(app.wishRow()).toBeVisible();
  });

  test('點擊頁面不再跳出浮動的意見回饋提示', async ({ app }) => {
    await app.goto();
    await app.page.locator('body').click({ position: { x: 5, y: 5 } });
    await expect(app.page.locator('#feedback_popup')).toHaveCount(0);
  });
});
