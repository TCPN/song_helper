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

  test('快取裡沒有譜、最新資料有譜的歌：等最新資料後直接開啟，不提示', async ({ app }) => {
    const stale = SONGS.map((song) => ({ ...song }));
    stale[0].abc = null;
    await app.seedCache(stale);
    await app.delayQuery(300);
    await app.goto('#song_id=1');
    await expect(app.popup()).toHaveClass(/open/);
    await expect(app.currentSongId()).toHaveText('1');
    expect(app.dialogs).toEqual([]);
  });

  test('快取裡還沒有的歌：等最新資料後直接開啟', async ({ app }) => {
    await app.seedCache(SONGS.slice(0, 1));
    await app.delayQuery(300);
    await app.goto('#song_id=4');
    await expect(app.popup()).toHaveClass(/open/);
    await expect(app.currentSongId()).toHaveText('4');
    expect(app.dialogs).toEqual([]);
  });

  test('已用快取開啟的譜，最新資料的譜不同時改用最新的譜重新渲染', async ({ app }) => {
    const stale = SONGS.map((song) => ({ ...song }));
    stale[1].abc = stale[1].abc.replace('K:G', 'K:D');
    await app.seedCache(stale);
    await app.delayQuery(500);
    await app.goto('#song_id=2');
    await expect(app.currentTone()).toHaveText('D');
    await expect(app.currentTone()).toHaveText('G');
    await expect(app.popup()).toHaveClass(/open/);
  });

  test('最新資料的譜不同而重新渲染時，hash 的提示不會再出現一次', async ({ app }) => {
    const stale = SONGS.map((song) => ({ ...song }));
    stale[1].abc = stale[1].abc.replace('K:G', 'K:D');
    await app.seedCache(stale);
    await app.delayQuery(500);
    await app.goto('#song_id=2&transpose=abc');
    await expect(app.currentTone()).toHaveText('D');
    await expect(app.currentTone()).toHaveText('G');
    await app.page.waitForTimeout(300);
    expect(app.dialogs).toEqual(['Invalid transpose is ignored: abc']);
  });

  test('已用快取開啟的譜，最新資料只有歌名不同時，標題改用最新歌名', async ({ app }) => {
    const stale = SONGS.map((song) => ({ ...song }));
    stale[0].name = '快取中的舊歌名';
    await app.seedCache(stale);
    await app.delayQuery(500);
    await app.goto('#song_id=1');
    await expect(app.page).toHaveTitle('快取中的舊歌名 (C)');
    await expect(app.page).toHaveTitle('測試歌一 (C)');
  });

  test('快取裡有譜、最新資料沒有譜的歌：列表的譜面連結也跟著移除', async ({ app }) => {
    const stale = SONGS.map((song) => ({ ...song }));
    stale[2].abc = stale[1].abc;
    await app.seedCache(stale);
    await app.delayQuery(300);
    await app.goto();
    await expect(app.scoreLink(3)).toHaveAttribute('href', '#song_id=3');
    await expect(app.scoreLink(3)).not.toHaveAttribute('href');
    await expect(app.scoreLink(3)).not.toHaveClass(/note_score|chord_score/);
  });

  test('快取內容損壞（不是合法的 JSON）時，忽略快取並照常載入', async ({ app }) => {
    await app.page.addInitScript(() => localStorage.setItem('song_data', '{oops'));
    await app.goto();
    await expect(app.rows()).toHaveCount(4);
    await expect(app.rows().nth(0).locator('td.song_name')).toHaveText('測試歌一');
  });
});

test.describe('有快取但試算表查詢失敗', () => {
  test.use({ queryError: { message: 'boom', detail: 'offline' } });

  test('仍顯示快取的列表，並提示錯誤', async ({ app }) => {
    await app.seedCache();
    await app.goto('', { waitReady: false });
    await expect(app.rows()).toHaveCount(4);
    await expect.poll(() => app.dialogs).toEqual(['Error in query: boom offline']);
  });
});
