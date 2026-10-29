const { test, expect, SONGS } = require('../app');

// 自編的短歌：id 10 有 P: 段落、id 11 沒有 P:、id 12 有填「投影片」欄、id 13 的「投影片」欄沒有段名
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
  {
    id: 13, name: '投影片欄沒分段', tone: 'C', timesig: '4/4', melody: 'CDEF',
    slides: '一句\n兩句',
    abc: 'X:13\nT:Cell no headers\nM:4/4\nL:1/4\nK:C\nCDEF|]\nw:一 二 三 四\n',
  },
];

test.use({ songs: [LYRIC_SONGS, { option: true }] });

test.describe('歌詞檢視', () => {
  const view = (app) => app.page.locator('#lyrics_view');
  const names = (app) => app.page.locator('#lyrics_sections .lyrics-name');
  const lines = (app) => app.page.locator('#lyrics_sections .lyrics-line');
  const messages = (app) => app.page.locator('#lyrics_messages li');
  const toggle = (app) => app.page.locator('#score_popup_top_bar > .view-mode-button');
  const line_at = (app, i) => lines(app).nth(i);

  async function clipboard(app) {
    return app.page.evaluate(() => navigator.clipboard.readText());
  }

  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('工具列「檢視歌詞」切換到歌詞檢視，網址加上 mode=lyrics，按鈕變成「檢視歌譜」', async ({ app }) => {
    await app.goto('#song_id=10');
    await expect(toggle(app)).toHaveText('檢視歌詞');
    await expect(view(app)).toBeHidden();
    await toggle(app).click();
    await expect(view(app)).toBeVisible();
    await expect(app.page.locator('#score_page')).toBeHidden();
    await expect(toggle(app)).toHaveText('檢視歌譜');
    expect(await app.hashParams()).toEqual({ song_id: '10', mode: 'lyrics' });

    await toggle(app).click();
    await expect(view(app)).toBeHidden();
    await expect(app.page.locator('#score_page')).toBeVisible();
    await expect(toggle(app)).toHaveText('檢視歌詞');
    expect(await app.hashParams()).toEqual({ song_id: '10' });
  });

  test('網址 mode=lyrics 直接打開歌詞檢視；其他值是歌譜', async ({ app }) => {
    await app.goto('#song_id=10&mode=lyrics');
    await expect(view(app)).toBeVisible();
    await expect(names(app)).toHaveText(['A1', 'A2', 'B1']);
    await app.goto('#song_id=10&mode=xyz');
    await expect(view(app)).toBeHidden();
    await expect(app.page.locator('#score_page')).toBeVisible();
  });

  test('有 P: 的歌：段名是段落＋第幾行 w:，每一行一個選取單位；訊息只有來源', async ({ app }) => {
    await app.goto('#song_id=10&mode=lyrics');
    await expect(names(app)).toHaveText(['A1', 'A2', 'B1']);
    await expect(lines(app)).toHaveText(['一二三四五六七八', '甲乙丙丁戊己庚辛', '副']);
    await expect(messages(app)).toHaveText(['從歌譜中自動抽出']);
    // 訊息小字、不粗體
    const style = await messages(app).first().evaluate((li) => getComputedStyle(li));
    expect(Number(style.fontWeight)).toBeLessThan(600);
  });

  test('沒有 P: 的歌：整首一段 V1、V2…，另一則 ⚠ 訊息', async ({ app }) => {
    await app.goto('#song_id=11&mode=lyrics');
    await expect(names(app)).toHaveText(['V1', 'V2']);
    await expect(lines(app)).toHaveText(['一二三四', '甲乙丙丁', '五六七八', '子丑寅卯']);
    await expect(messages(app)).toHaveText(['從歌譜中自動抽出', '⚠ 歌譜缺少段落標記（P:）']);
  });

  test('有填「投影片」欄的歌：照格子的段名、換行與分段，不寫來源訊息', async ({ app }) => {
    await app.goto('#song_id=12&mode=lyrics');
    await expect(messages(app)).toHaveCount(0);
    await expect(names(app)).toHaveText(['主歌', '副歌']);
    await expect(app.page.locator('#lyrics_sections .lyrics-section').first().locator('.lyrics-paragraph'))
      .toHaveText(['第一句 第二句第三句', '第四句']);
    await expect(lines(app)).toHaveText(['第一句 第二句', '第三句', '第四句', '副歌一句']);
  });

  test('「投影片」欄沒有段名：⚠ 投影片欄缺少段落標記', async ({ app }) => {
    await app.goto('#song_id=13&mode=lyrics');
    await expect(messages(app)).toHaveText(['⚠ 歌譜缺少段落標記（P:）', '⚠ 投影片欄缺少段落標記（[段名]）']);
    await expect(names(app)).toHaveText(['無段名']);
  });

  test('選取的行複製成純文字：同一段落換行，換段落或換段空一行，不含段名', async ({ app }) => {
    await app.goto('#song_id=12&mode=lyrics');
    // 預設都沒勾，不能複製
    await expect(app.page.locator('#lyrics_copy')).toHaveAttribute('aria-disabled', 'true');
    await line_at(app, 0).click();
    await line_at(app, 2).click();
    await line_at(app, 3).click();
    // 再點一次取消
    await line_at(app, 3).click();
    await expect(line_at(app, 3)).not.toHaveClass(/selected/);
    await line_at(app, 3).click();
    await expect(lines(app).nth(0)).toHaveClass(/selected/);
    await app.page.locator('#lyrics_copy').click();
    await expect(app.page.locator('#lyrics_status')).toHaveText('已複製 3 行');
    expect(await clipboard(app)).toBe('第一句 第二句\n\n第四句\n\n副歌一句');
  });

  test('沒有勾選框，點一行選取；點段名整段全選，已經全選時全部取消；全選、全不選', async ({ app }) => {
    await app.goto('#song_id=11&mode=lyrics');
    const head = (i) => names(app).nth(i);
    await expect(app.page.locator('#lyrics_view input')).toHaveCount(0);
    await head(0).click();
    await expect(line_at(app, 0)).toHaveAttribute('aria-checked', 'true');
    await expect(line_at(app, 1)).toHaveAttribute('aria-checked', 'true');
    await expect(line_at(app, 2)).toHaveAttribute('aria-checked', 'false');
    // 部分勾選時點段名：補成全選
    await line_at(app, 1).click();
    await expect(line_at(app, 1)).toHaveAttribute('aria-checked', 'false');
    await head(0).click();
    await expect(line_at(app, 1)).toHaveAttribute('aria-checked', 'true');
    // 已經全選：全部取消
    await head(0).click();
    await expect(line_at(app, 0)).toHaveAttribute('aria-checked', 'false');
    await expect(line_at(app, 1)).toHaveAttribute('aria-checked', 'false');

    await app.page.locator('#lyrics_select_all').click();
    for (let i = 0; i < 4; i++)
      await expect(line_at(app, i)).toHaveAttribute('aria-checked', 'true');
    await app.page.locator('#lyrics_copy').click();
    await expect(app.page.locator('#lyrics_status')).toHaveText('已複製 4 行');
    expect(await clipboard(app)).toBe('一二三四\n甲乙丙丁\n\n五六七八\n子丑寅卯');

    await app.page.locator('#lyrics_select_none').click();
    await expect(line_at(app, 0)).toHaveAttribute('aria-checked', 'false');
    await expect(app.page.locator('#lyrics_copy')).toHaveAttribute('aria-disabled', 'true');
  });

  test('段名小字、淡色、不粗體，有 4px 圓角的邊框；段與段之間沒有分隔線；每一行一樣高（段內分段也不多空）', async ({ app }) => {
    await app.goto('#song_id=12&mode=lyrics');
    const style = await names(app).first().evaluate((n) => {
      const s = getComputedStyle(n);
      return { weight: Number(s.fontWeight), size: parseFloat(s.fontSize), body: parseFloat(getComputedStyle(n.closest('#lyrics_view')).fontSize) };
    });
    expect(style.weight).toBeLessThan(600);
    expect(style.size).toBeLessThan(style.body);
    const box = await names(app).first().evaluate((n) => ({ radius: getComputedStyle(n).borderTopLeftRadius, width: getComputedStyle(n).borderTopWidth }));
    expect(box).toEqual({ radius: '4px', width: '1px' });
    const border = await app.page.locator('#lyrics_sections .lyrics-section').first()
      .evaluate((s) => getComputedStyle(s).borderBottomWidth);
    expect(border).toBe('0px');
    // 主歌：第一句 第二句／第三句 ‖ 第四句（段內分段）
    const tops = await lines(app).evaluateAll((ls) => ls.map((l) => l.getBoundingClientRect().top));
    expect(tops[2] - tops[1]).toBeCloseTo(tops[1] - tops[0], 0);
  });

  test('沒有歌詞的歌：沒有段，訊息說沒有歌詞', async ({ app }) => {
    await app.goto('#song_id=2&mode=lyrics');
    await expect(names(app)).toHaveCount(0);
    await expect(messages(app)).toHaveText(['這首歌沒有歌詞']);
  });

  test('歌詞檢視時換歌，留在歌詞檢視並列出新的歌', async ({ app }) => {
    await app.goto('#song_id=10&mode=lyrics');
    await app.switchSong(11);
    await expect(app.currentSongId()).toHaveText('11');
    await expect(view(app)).toBeVisible();
    await expect(names(app)).toHaveText(['V1', 'V2']);
  });

  test('關閉譜面時網址的 mode 也拿掉，下一首打開是歌譜', async ({ app }) => {
    await app.goto('#song_id=10&mode=lyrics');
    await app.page.locator('#close_score_button').click();
    await expect(app.popup()).not.toHaveClass(/open/);
    expect(await app.hashParams()).toEqual({});
    await app.openScore(11);
    await expect(view(app)).toBeHidden();
    await expect(app.page.locator('#score_page')).toBeVisible();
  });

  test('歌詞檢視時方向鍵不換頁', async ({ app }) => {
    await app.goto('#song_id=10&mode=lyrics');
    await app.page.keyboard.press('ArrowRight');
    await expect(view(app)).toBeVisible();
    await expect(app.page.locator('#page_nav')).toBeHidden();
  });

  test('工具列不夠寬時從「⋮」選單切換，歌詞檢視不超出畫面', async ({ app }) => {
    await app.page.setViewportSize({ width: 375, height: 700 });
    await app.goto('#song_id=11');
    await app.page.locator('#more_button').click();
    await expect(app.page.locator('#more-menu .view-mode-button')).toHaveText('檢視歌詞');
    await app.page.locator('#more-menu .view-mode-button').click();
    await expect(view(app)).toBeVisible();
    await expect(names(app)).toHaveText(['V1', 'V2']);
    const box = await view(app).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(16 - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(375 - 16 + 1);
    await app.page.locator('#more_button').click();
    await expect(app.page.locator('#more-menu .view-mode-button')).toHaveText('檢視歌譜');
  });
});
