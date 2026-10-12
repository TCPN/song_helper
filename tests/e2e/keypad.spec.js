const { test, expect } = require('../app');

const keypad = (app) => app.page.locator('#song_id_popup');
const key = (app, value) => app.page.locator(`#song_id_popup .button[data-value="${value}"]`);

test.describe('曲號鍵盤', () => {
  test.beforeEach(async ({ app }) => {
    await app.goto('#song_id=1');
  });

  test('點曲號：開啟鍵盤，並清空曲號等待輸入', async ({ app }) => {
    await expect(keypad(app)).not.toHaveClass(/open/);
    await app.currentSongId().click();
    await expect(keypad(app)).toHaveClass(/open/);
    await expect(app.currentSongId()).toHaveText('');
  });

  test('鍵盤共有 16 個按鍵', async ({ app }) => {
    await expect(app.page.locator('#song_id_popup .button')).toHaveCount(16);
  });

  test('輸入數字後按 ✓：開啟該首並收起鍵盤', async ({ app }) => {
    await app.currentSongId().click();
    await key(app, '4').click();
    await expect(app.currentSongId()).toHaveText('4');
    await key(app, 'ent').click();

    await expect(keypad(app)).not.toHaveClass(/open/);
    await expect(app.currentSongId()).toHaveText('4');
    expect(await app.hashParams()).toEqual({ song_id: '4' });
    await expect(app.currentTone()).toHaveText('Am');
  });

  test('按 ✗：還原原本的曲號並收起鍵盤', async ({ app }) => {
    await app.currentSongId().click();
    await key(app, '3').click();
    await key(app, 'esc').click();

    await expect(keypad(app)).not.toHaveClass(/open/);
    await expect(app.currentSongId()).toHaveText('1');
    expect(await app.hashParams()).toEqual({ song_id: '1' });
  });

  test('⌫ 刪除最後一位、C 清空', async ({ app }) => {
    await app.currentSongId().click();
    await key(app, '1').click();
    await key(app, '2').click();
    await expect(app.currentSongId()).toHaveText('12');
    await key(app, 'del').click();
    await expect(app.currentSongId()).toHaveText('1');
    await key(app, '2').click();
    await key(app, 'clr').click();
    await expect(app.currentSongId()).toHaveText('');
  });

  test('輸入不存在的曲號後按 ✓：還原原本的曲號，譜面不變', async ({ app }) => {
    await app.currentSongId().click();
    await key(app, '9').click();
    await key(app, '9').click();
    await key(app, 'ent').click();

    await expect(app.currentSongId()).toHaveText('1');
    expect(await app.hashParams()).toEqual({ song_id: '1' });
    await expect(app.popup()).toHaveClass(/open/);
  });

  test('▶ 直接開啟下一個曲號，鍵盤保持開啟', async ({ app }) => {
    await app.currentSongId().click();
    await key(app, 'inc').click();

    await expect(app.currentSongId()).toHaveText('2');
    expect(await app.hashParams()).toEqual({ song_id: '2' });
    await expect(keypad(app)).toHaveClass(/open/);
  });

  test('◀ 直接開啟上一個曲號', async ({ app }) => {
    await app.goto('#song_id=2');
    await app.currentSongId().click();
    await key(app, 'dec').click();

    await expect(app.currentSongId()).toHaveText('1');
    expect(await app.hashParams()).toEqual({ song_id: '1' });
  });
});

test.describe('曲號鍵盤：用實體鍵盤操作', () => {
  test.beforeEach(async ({ app }) => {
    await app.goto('#song_id=1');
    await app.currentSongId().click();
  });

  test('數字鍵 + Enter 開啟該首', async ({ app }) => {
    await app.page.keyboard.press('4');
    await app.page.keyboard.press('Enter');
    await expect(app.currentSongId()).toHaveText('4');
    expect(await app.hashParams()).toEqual({ song_id: '4' });
    await expect(keypad(app)).not.toHaveClass(/open/);
  });

  test('Escape 還原原本的曲號', async ({ app }) => {
    await app.page.keyboard.press('3');
    await app.page.keyboard.press('Escape');
    await expect(app.currentSongId()).toHaveText('1');
    await expect(keypad(app)).not.toHaveClass(/open/);
  });

  test('Backspace 刪除、c 清空', async ({ app }) => {
    await app.page.keyboard.press('1');
    await app.page.keyboard.press('2');
    await app.page.keyboard.press('Backspace');
    await expect(app.currentSongId()).toHaveText('1');
    await app.page.keyboard.press('c');
    await expect(app.currentSongId()).toHaveText('');
  });

  test('方向鍵下／右＝下一首，上／左＝上一首', async ({ app }) => {
    await app.page.keyboard.press('ArrowDown');
    await expect(app.currentSongId()).toHaveText('2');
    await app.page.keyboard.press('ArrowRight');
    // 第 3 首沒有譜：提示後關閉譜面
    await expect.poll(() => app.dialogs).toEqual(['No score for song 3']);
  });
});
