const { test, expect } = require('../app');

// 網址 hash（#song_id=12&transpose=2）是這個網站對外的「介面」：
// 使用者可能把它存成書籤或分享給別人，所以格式與行為必須保持相容。
test.describe('網址 hash 的格式與行為', () => {
  test('#song_id=N 直接開啟該首', async ({ app }) => {
    await app.goto('#song_id=2');
    await expect(app.popup()).toHaveClass(/open/);
    await expect(app.currentSongId()).toHaveText('2');
    // 沒有 transpose 參數時顯示 0
    await expect(app.transposeValue()).toHaveText('0');
  });

  test('#song_id=N&transpose=M 開啟該首並套用移調', async ({ app }) => {
    await app.goto('#song_id=2&transpose=2');
    await expect(app.transposeValue()).toHaveText('2');
    await expect(app.currentTone()).toHaveText('A');
  });

  test('參數順序不影響結果', async ({ app }) => {
    await app.goto('#transpose=2&song_id=2');
    await expect(app.currentSongId()).toHaveText('2');
    await expect(app.currentTone()).toHaveText('A');
  });

  test('支援負的移調值', async ({ app }) => {
    await app.goto('#song_id=1&transpose=-1');
    await expect(app.transposeValue()).toHaveText('-1');
    await expect(app.currentTone()).toHaveText('B');
  });

  test('沒有 hash 時只顯示列表', async ({ app }) => {
    await app.goto();
    await expect(app.popup()).not.toHaveClass(/open/);
  });

  test('操作時會保留不認識的其他參數', async ({ app }) => {
    await app.goto('#song_id=1&foo=bar');
    await app.stepTranspose(1);
    expect(await app.hashParams()).toEqual({ song_id: '1', foo: 'bar', transpose: '1' });
  });

  test('手動修改網址 hash 會切換歌曲', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.page.evaluate(() => { location.hash = '#song_id=4'; });
    await expect(app.currentSongId()).toHaveText('4');
    await expect(app.currentTone()).toHaveText('Am');
  });

  test('手動清掉 hash 會關閉譜面', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.page.evaluate(() => { location.hash = '#x'; });
    await expect(app.popup()).not.toHaveClass(/open/);
  });

  test('瀏覽器的上一頁／下一頁可在歌曲之間切換', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.page.locator('.change-song.next').click();
    await expect(app.currentSongId()).toHaveText('2');

    await app.page.goBack();
    await expect(app.currentSongId()).toHaveText('1');
    await app.page.goForward();
    await expect(app.currentSongId()).toHaveText('2');
  });
});

test.describe('不合法的 hash', () => {
  test('不存在的 song_id：不開譜面，並從網址移除 song_id', async ({ app }) => {
    await app.goto('#song_id=999');
    await expect(app.popup()).not.toHaveClass(/open/);
    expect(await app.hashParams()).toEqual({});
  });

  test('沒有譜的 song_id：提示後不開譜面', async ({ app }) => {
    await app.goto('#song_id=3');
    await expect.poll(() => app.dialogs).toEqual(['No score for song 3']);
    await expect(app.popup()).not.toHaveClass(/open/);
  });

  test('transpose 不是整數：提示後忽略，仍開啟該首（移調 0）', async ({ app }) => {
    await app.goto('#song_id=1&transpose=abc');
    await expect.poll(() => app.dialogs).toEqual(['Invalid transpose is ignored: abc']);
    await expect(app.popup()).toHaveClass(/open/);
    await expect(app.transposeValue()).toHaveText('0');
    await expect(app.currentTone()).toHaveText('C');
  });

  test('transpose 是小數：同樣視為不合法', async ({ app }) => {
    await app.goto('#song_id=1&transpose=1.5');
    await expect.poll(() => app.dialogs).toEqual(['Invalid transpose is ignored: 1.5']);
    await expect(app.currentTone()).toHaveText('C');
  });
});
