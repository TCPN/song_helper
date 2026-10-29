const { test, expect, SONGS } = require('../app');

// 自編的短歌：id 10 有 P: 段落、id 11 沒有 P:、id 12 有填「投影片」欄、id 13 沒有歌詞
const LYRIC_SONGS = [
  ...SONGS,
  {
    id: 10, name: '分段的歌', tone: 'C', timesig: '4/4', melody: 'CDEF',
    abc: 'X:10\nT:Parts\nM:4/4\nL:1/4\nK:C\nP:A\nCDEF|GABc|\nw:一 二 三 四 五 六 七 八\nw:甲 乙 丙 丁 戊 己 庚 辛\nP:B\nc4|]\nw:副\n',
  },
  {
    id: 11, name: '沒分段的歌', tone: 'C', timesig: '4/4', melody: 'CDEF',
    abc: 'X:11\nT:No parts\nM:4/4\nL:1/4\nK:C\nCDEF|\nw:一 二 三 四\nw:五 六 七 八\nGABc|]\nw:甲 乙 丙 丁\nw:子 丑 寅 卯\n',
  },
  {
    id: 12, name: '有投影片欄的歌', tone: 'C', timesig: '4/4', melody: 'CDEF',
    slides: '[主歌 = A1]\n第一句 / 第二句 // 第三句\n\n第四句\n[副歌]\n副歌一句',
    abc: 'X:12\nT:Cell\nM:4/4\nL:1/4\nK:C\nP:A\nCDEF|]\nw:一 二 三 四\n',
  },
];

test.use({ songs: [LYRIC_SONGS, { option: true }] });

test.describe('投影片歌詞', () => {
  const popup = (app) => app.page.locator('#lyrics-popup-container');
  const names = (app) => app.page.locator('#lyrics_sections .lyrics-name');
  const texts = (app) => app.page.locator('#lyrics_sections .lyrics-text');
  const note = (app) => app.page.locator('#lyrics_note');

  async function open_lyrics(app) {
    await app.page.locator('#edit_button').click();
    await app.page.locator('#editor-menu .lyrics-item').click();
    await expect(popup(app)).toHaveClass(/open/);
  }

  async function clipboard(app) {
    return app.page.evaluate(() => navigator.clipboard.readText());
  }

  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('有 P: 的歌：段名是段落＋第幾行 w:，譜上一行 = 歌詞一行', async ({ app }) => {
    await app.goto('#song_id=10');
    await open_lyrics(app);
    await expect(app.page.locator('#lyrics_title')).toHaveText('投影片歌詞：分段的歌');
    await expect(names(app)).toHaveText(['A1', 'A2', 'B1']);
    await expect(texts(app)).toHaveText(['一二三四五六七八', '甲乙丙丁戊己庚辛', '副']);
    await expect(note(app)).toContainText('自動產生');
    await expect(note(app)).not.toContainText('P:');
    // 「編輯」選單選了項目後收起
    await expect(app.page.locator('#editor-menu')).toHaveClass(/hide/);
  });

  test('沒有 P: 的歌：整首一段 V1、V2…，並提醒沒有段落標記', async ({ app }) => {
    await app.goto('#song_id=11');
    await open_lyrics(app);
    await expect(names(app)).toHaveText(['V1', 'V2']);
    await expect(texts(app).nth(0).locator('p')).toHaveText(['一二三四\n甲乙丙丁']);
    await expect(note(app)).toContainText('譜上沒有 P: 段落標記');
  });

  test('有填「投影片」欄的歌：照格子的段名、換行與分段（也接受 / //）', async ({ app }) => {
    await app.goto('#song_id=12');
    await open_lyrics(app);
    await expect(note(app)).toHaveText('歌詞來自試算表的「投影片」欄。');
    await expect(names(app)).toHaveText(['主歌', '副歌']);
    await expect(texts(app).nth(0).locator('p')).toHaveText(['第一句 第二句\n第三句', '第四句']);
  });

  test('預設全選，複製成純文字：段落與段之間空一行，不含段名', async ({ app }) => {
    await app.goto('#song_id=12');
    await open_lyrics(app);
    await app.page.locator('#lyrics_copy').click();
    await expect(app.page.locator('#lyrics_status')).toHaveText('已複製 2 段');
    expect(await clipboard(app)).toBe('第一句 第二句\n第三句\n\n第四句\n\n副歌一句');
  });

  test('只複製勾選的段；全不選時不能按複製，全選恢復', async ({ app }) => {
    await app.goto('#song_id=10');
    await open_lyrics(app);
    const checks = app.page.locator('#lyrics_sections input[type=checkbox]');
    await checks.nth(1).uncheck();
    await app.page.locator('#lyrics_copy').click();
    await expect(app.page.locator('#lyrics_status')).toHaveText('已複製 2 段');
    expect(await clipboard(app)).toBe('一二三四五六七八\n\n副');

    await app.page.locator('#lyrics_select_none').click();
    await expect(checks.nth(0)).not.toBeChecked();
    await expect(app.page.locator('#lyrics_copy')).toHaveAttribute('aria-disabled', 'true');
    await app.page.locator('#lyrics_select_all').click();
    await expect(checks).toHaveCount(3);
    for (let i = 0; i < 3; i++)
      await expect(checks.nth(i)).toBeChecked();
    await expect(app.page.locator('#lyrics_copy')).toHaveAttribute('aria-disabled', 'false');
  });

  test('沒有歌詞的歌：沒有段，說明沒有歌詞', async ({ app }) => {
    await app.goto('#song_id=2');
    await open_lyrics(app);
    await expect(names(app)).toHaveCount(0);
    await expect(note(app)).toContainText('沒有歌詞');
    await expect(app.page.locator('#lyrics_copy')).toHaveAttribute('aria-disabled', 'true');
  });

  test('Esc、關閉按鈕、點背景都能關閉；關閉譜面時一起關閉', async ({ app }) => {
    await app.goto('#song_id=10');
    await open_lyrics(app);
    await app.page.keyboard.press('Escape');
    await expect(popup(app)).not.toHaveClass(/open/);

    // 焦點不在彈窗裡時 Esc 也能關閉
    await open_lyrics(app);
    await app.page.evaluate(() => document.activeElement.blur());
    await app.page.keyboard.press('Escape');
    await expect(popup(app)).not.toHaveClass(/open/);

    await open_lyrics(app);
    await app.page.locator('#lyrics-popup-window .popup-window-close').click();
    await expect(popup(app)).not.toHaveClass(/open/);

    await open_lyrics(app);
    await app.page.mouse.click(5, app.page.viewportSize().height - 5);
    await expect(popup(app)).not.toHaveClass(/open/);
    await expect(app.popup()).toHaveClass(/open/);

    await open_lyrics(app);
    // 網址換成不存在的歌（例如上一頁回到別的網址）時譜面關閉
    await app.page.evaluate(() => { location.hash = '#song_id=999'; });
    await expect(app.popup()).not.toHaveClass(/open/);
    await expect(popup(app)).not.toHaveClass(/open/);
  });

  test('工具列不夠寬時從「⋮」選單打開', async ({ app }) => {
    await app.page.setViewportSize({ width: 375, height: 700 });
    await app.goto('#song_id=11');
    await app.page.locator('#more_button').click();
    await app.page.locator('#more-menu .lyrics-item').click();
    await expect(popup(app)).toHaveClass(/open/);
    await expect(names(app)).toHaveText(['V1', 'V2']);
    const box = await app.page.locator('#lyrics-popup-window').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(16 - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(375 - 16 + 1);
  });
});
