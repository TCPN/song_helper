const { test, expect, SONGS } = require('../app');

// 回訪時先用 localStorage 裡的快取資料渲染列表，再用試算表的最新資料更新。
test.describe('快取（localStorage）', () => {
  test('第一次載入後，把歌曲資料與時間存進 localStorage', async ({ app }) => {
    await app.goto();
    const stored = await app.page.evaluate(() => ({
      data: localStorage.getItem('song_data'),
      timestamp: localStorage.getItem('song_data_timestamp'),
    }));
    const cached = JSON.parse(stored.data);
    expect(cached.map((song) => song.name)).toEqual(SONGS.map((song) => song.name));
    expect(cached[0]).toMatchObject({ id: 1, tone: 'C', timesig: '4/4' });
    expect(Math.abs(Date.now() - Number(stored.timestamp))).toBeLessThan(60_000);
  });

  test('回訪時先顯示快取的列表，不必等試算表回應', async ({ app }) => {
    const stale = SONGS.map((song) => ({ ...song }));
    stale[0].name = '快取中的舊歌名';
    await app.seedCache(stale);
    await app.delayQuery(2000);

    await app.goto();
    // 試算表還沒回應，列表已經顯示快取內容
    await expect(app.rows()).toHaveCount(4);
    await expect(app.rows().nth(0).locator('td.song_name')).toHaveText('快取中的舊歌名');
  });

  test('試算表回應後，列表與快取都更新成最新資料', async ({ app }) => {
    const stale = SONGS.map((song) => ({ ...song }));
    stale[0].name = '快取中的舊歌名';
    await app.seedCache(stale);
    await app.delayQuery(500);

    await app.goto();
    await expect(app.rows().nth(0).locator('td.song_name')).toHaveText('測試歌一');
    const names = await app.page.evaluate(() => JSON.parse(localStorage.getItem('song_data')).map((s) => s.name));
    expect(names[0]).toBe('測試歌一');
  });

  test('最新資料裡已經不存在的歌，會從列表移除', async ({ app }) => {
    const extra = { id: 9, name: '已刪除的歌', tone: 'C', timesig: '4/4', melody: '', abc: null };
    await app.seedCache([...SONGS, extra]);
    await app.delayQuery(500);

    await app.goto();
    await expect(app.rows()).toHaveCount(5);
    await expect(app.rows()).toHaveCount(4);
    await expect(app.page.locator('#song_list tbody')).not.toContainText('已刪除的歌');
  });

  test('回訪時網址帶有效的歌曲，直接開啟譜面', async ({ app }) => {
    await app.seedCache();
    await app.goto('#song_id=2&transpose=2');
    await expect(app.popup()).toHaveClass(/open/);
    await expect(app.currentSongId()).toHaveText('2');
    await expect(app.currentTone()).toHaveText('A');
  });

  test('有快取但試算表查詢失敗：仍顯示快取的列表，並提示錯誤', async ({ app }) => {
    await app.seedCache();
    await app.page.addInitScript(() => {
      window.__TEST_QUERY_ERROR__ = { message: 'boom', detail: 'offline' };
    });
    await app.goto();
    await expect(app.rows()).toHaveCount(4);
    await expect.poll(() => app.dialogs).toEqual(['Error in query: boom offline']);
  });

  test('快取內容損壞（不是合法的 JSON）時，忽略快取並照常載入', async ({ app }) => {
    await app.page.addInitScript(() => localStorage.setItem('song_data', '{oops'));
    await app.goto();
    await expect(app.rows()).toHaveCount(4);
    await expect(app.rows().nth(0).locator('td.song_name')).toHaveText('測試歌一');
  });
});
