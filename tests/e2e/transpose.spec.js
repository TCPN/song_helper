const { test, expect } = require('../app');

// 調性顯示使用 abcjs 的結果：升降記號固定用 ♭（C 升一個半音顯示 D♭，不是 C♯）。
test.describe('移調', () => {
  test('▴ 升一個半音：輸入框、網址、調性與標題一起更新', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.stepTranspose(1);

    await expect(app.transposeInput()).toHaveValue('1');
    expect(await app.hashParams()).toEqual({ song_id: '1', transpose: '1' });
    await expect(app.currentTone()).toHaveText('D♭');
    await expect(app.page).toHaveTitle('測試歌一 (D♭)');
  });

  test('▾ 降一個半音', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.stepTranspose(-1);

    await expect(app.transposeInput()).toHaveValue('-1');
    expect(await app.hashParams()).toEqual({ song_id: '1', transpose: '-1' });
    await expect(app.currentTone()).toHaveText('B');
  });

  test('連續點擊會累加', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.stepTranspose(1);
    await app.stepTranspose(1);
    await expect(app.transposeInput()).toHaveValue('2');
    await expect(app.currentTone()).toHaveText('D');
  });

  test('移回 0 時，網址不保留 transpose 參數', async ({ app }) => {
    await app.goto('#song_id=1&transpose=1');
    await app.stepTranspose(-1);
    // 現況：網址移除 transpose 後重新套用，輸入框會變成空白（視同 0）
    await expect(app.transposeInput()).toHaveValue('');
    expect(await app.hashParams()).toEqual({ song_id: '1' });
    await expect(app.currentTone()).toHaveText('C');
  });

  test('直接在輸入框輸入數字也會移調', async ({ app }) => {
    await app.goto('#song_id=2');
    await app.transposeInput().fill('2');
    await app.transposeInput().press('Tab');

    expect(await app.hashParams()).toEqual({ song_id: '2', transpose: '2' });
    await expect(app.currentTone()).toHaveText('A');
  });

  test('小調也會正確移調（Am 升兩個半音為 Bm）', async ({ app }) => {
    await app.goto('#song_id=4&transpose=2');
    await expect(app.currentTone()).toHaveText('Bm');
  });

  test('移調 ±12 回到原調', async ({ app }) => {
    await app.goto('#song_id=1&transpose=12');
    await expect(app.currentTone()).toHaveText('C');
    await app.goto('#song_id=1&transpose=-12');
    await expect(app.currentTone()).toHaveText('C');
  });

  test('移調後樂譜會重新渲染', async ({ app }) => {
    await app.goto('#song_id=1');
    const before = await app.page.locator('#score_paper').innerHTML();
    await app.stepTranspose(1);
    await expect(app.currentTone()).toHaveText('D♭');
    const after = await app.page.locator('#score_paper').innerHTML();
    expect(after).not.toBe(before);
  });

  // 現況：移調值存在網址裡，所以用上一首／下一首換歌時會沿用。
  test('換歌時沿用目前的移調值（現況）', async ({ app }) => {
    await app.goto('#song_id=1&transpose=2');
    await app.page.locator('.change-song.next').click();
    await expect(app.currentSongId()).toHaveText('2');
    await expect(app.transposeInput()).toHaveValue('2');
    await expect(app.currentTone()).toHaveText('A');
    expect(await app.hashParams()).toEqual({ song_id: '2', transpose: '2' });
  });
});
