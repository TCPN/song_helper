const { test, expect, SONGS } = require('../app');

// 部署時產生的 songs.json 快照：第一次來（沒有 localStorage 快取）時先用它顯示列表，
// 之後一樣用試算表的最新資料更新；Google 載入器無法使用時，網站靠它也能用。
function snapshotOf(songs, rename) {
  const copy = songs.map((song) => ({ ...song }));
  if (rename) copy[0].name = rename;
  return { updated: '2026-10-01T00:00:00.000Z', songs: copy };
}

test.describe('songs.json 快照', () => {
  test.describe('有快照', () => {
    test.use({ snapshot: snapshotOf(SONGS, '快照中的舊歌名') });

    test('第一次來時先顯示快照，不必等試算表回應', async ({ app }) => {
      await app.delayQuery(2000);
      await app.goto();
      await expect(app.rows()).toHaveCount(SONGS.length);
      await expect(app.rows().nth(0).locator('td.song_name')).toHaveText('快照中的舊歌名');
    });

    test('試算表回應後，列表與 localStorage 更新成最新資料', async ({ app }) => {
      await app.delayQuery(500);
      await app.goto();
      await expect(app.rows().nth(0).locator('td.song_name')).toHaveText('測試歌一');
      const names = await app.page.evaluate(() => JSON.parse(localStorage.getItem('song_data')).map((s) => s.name));
      expect(names[0]).toBe('測試歌一');
    });

    test('有 localStorage 快取時不用快照', async ({ app }) => {
      await app.seedCache(snapshotOf(SONGS, '快取中的歌名').songs);
      await app.delayQuery(2000);
      await app.goto();
      await expect(app.rows().nth(0).locator('td.song_name')).toHaveText('快取中的歌名');
    });

    test('快照裡有譜的歌，網址指定時直接開啟', async ({ app }) => {
      await app.delayQuery(2000);
      await app.goto('#song_id=2');
      await expect(app.popup()).toHaveClass(/open/);
      await expect(app.currentSongId()).toHaveText('2');
    });
  });

  test.describe('試算表查詢失敗', () => {
    test.use({
      snapshot: snapshotOf(SONGS),
      queryError: { message: 'boom', detail: 'detail' },
    });

    test('用快照顯示列表，網址指定的沒有譜的歌也會提示', async ({ app }) => {
      await app.goto('#song_id=3');
      await expect(app.rows()).toHaveCount(SONGS.length);
      await expect.poll(() => app.dialogs).toContain('No score for song 3');
      await expect(app.popup()).not.toHaveClass(/open/);
    });
  });

  test.describe('Google 載入器無法使用', () => {
    test.use({ googleUnavailable: true });

    test.describe('有快照', () => {
      test.use({ snapshot: snapshotOf(SONGS) });

      test('仍用快照顯示列表並開啟網址指定的歌', async ({ app }) => {
        await app.goto('#song_id=1');
        await expect(app.rows()).toHaveCount(SONGS.length);
        await expect(app.popup()).toHaveClass(/open/);
        await expect(app.currentTone()).toHaveText('C');
      });

      test('搜尋、移調等操作照常運作', async ({ app }) => {
        await app.goto();
        await app.page.locator('#song_search').fill('測試歌二');
        await expect(app.visibleRows()).toHaveCount(1);
        await app.page.locator('#song_search').fill('');
        await app.openScore(1);
        await app.stepTranspose(+1);
        expect((await app.hashParams()).transpose).toBe('1');
      });
    });

    test('有 localStorage 快取時用快取顯示', async ({ app }) => {
      await app.seedCache();
      await app.goto();
      await expect(app.rows()).toHaveCount(SONGS.length);
    });
  });
});
