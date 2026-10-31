const { test, expect } = require('../app');

test.describe('歌曲列表', () => {
  test('載入完成後隱藏 Loading，並列出所有歌曲', async ({ app }) => {
    await app.goto();
    await expect(app.page.locator('#loading_icon')).toHaveClass(/hide/);
    await expect(app.rows()).toHaveCount(4);
    await expect(app.page.locator('#found_nothing')).toHaveClass(/hide/);
  });

  test('每列依序顯示「編號.」「歌名」「調號調」，譜面欄只有圖示、沒有文字', async ({ app }) => {
    await app.goto();
    await expect(app.rows().nth(0).locator('td')).toHaveText(['1.', '測試歌一', 'C調', '', '']);
    await expect(app.rows().nth(1).locator('td')).toHaveText(['2.', '測試歌二', 'G調', '', '']);
    await expect(app.rows().nth(3).locator('td')).toHaveText(['4.', '小調測試', 'Am調', '', '']);
    await expect(app.rows().nth(0).locator('td')).toHaveClass(['song_index', 'song_name', 'song_tone', 'song_score', 'song_lyrics']);
  });

  test('有譜的歌：連結指向 #song_id=N，並以圖示區分「含和弦」與「僅旋律」', async ({ app }) => {
    await app.goto();
    await expect(app.scoreLink(1)).toHaveAttribute('href', '#song_id=1');
    await expect(app.scoreLink(1)).toHaveClass(/chord_score/);
    await expect(app.scoreLink(1)).toHaveAttribute('title', '五線譜 (含和弦)');

    await expect(app.scoreLink(2)).toHaveAttribute('href', '#song_id=2');
    await expect(app.scoreLink(2)).toHaveClass(/note_score/);
    await expect(app.scoreLink(2)).toHaveAttribute('title', '五線譜 (僅旋律)');

    await expect(app.scoreLink(4)).toHaveClass(/chord_score/);
  });

  test('沒有譜的歌：連結沒有 href、沒有圖示，也沒有提示文字', async ({ app }) => {
    await app.goto();
    await expect(app.scoreLink(3)).not.toHaveAttribute('href', /.*/);
    await expect(app.scoreLink(3)).not.toHaveClass(/chord_score|note_score/);
    await expect(app.scoreLink(3)).not.toHaveAttribute('title', /.*/);
  });

  test('只向試算表查詢一次，且不發出任何外部請求', async ({ app }) => {
    await app.goto();
    expect(app.queryUrls).toHaveLength(1);
    expect(app.queryUrls[0]).toBe('https://docs.google.com/spreadsheets/d/1_8-RZ_a_f47I0IavWYOwg5W07d_M3nQx8VK6wzEvfoM/gviz/tq?tqx=out:json');
    expect(app.blocked).toEqual([]);
  });
});

test.describe('abc 只有標頭、沒有實際樂句的歌', () => {
  // hasSongContent 要求 K: 行之後還有內容才算有譜
  test.use({
    songs: [
      { id: 7, name: '只有標頭', tone: 'C', timesig: '4/4', melody: '', abc: 'X:7\nT:Header only\nK:C' },
    ],
  });

  test('不提供譜面連結', async ({ app }) => {
    await app.goto();
    await expect(app.rows()).toHaveCount(1);
    await expect(app.scoreLink(7)).not.toHaveAttribute('href', /.*/);
  });
});

test.describe('試算表查詢失敗', () => {
  test.use({ queryError: { message: 'boom', detail: 'sheet is gone' } });

  test('跳出錯誤提示，列表維持空白，載入畫面改顯示錯誤訊息', async ({ app }) => {
    await app.goto('', { waitReady: false });
    await expect.poll(() => app.dialogs.length).toBe(1);
    expect(app.dialogs[0]).toBe('Error in query: boom sheet is gone');
    await expect(app.rows()).toHaveCount(0);
    await expect(app.page.locator('#loading_icon')).not.toHaveClass(/hide/);
    await expect(app.page.locator('#loading_icon_center')).toHaveText('無法載入歌曲資料，請稍後重新整理');
  });
});
