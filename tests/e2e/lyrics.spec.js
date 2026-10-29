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
  // 用一般的文字選取：從第 from 行的第 from_offset 個字到第 to 行的第 to_offset 個字（省略時到行尾）
  async function select_text(app, from, from_offset, to, to_offset) {
    await app.page.evaluate(([from, from_offset, to, to_offset]) => {
      const lines = document.querySelectorAll('#lyrics_sections .lyrics-line');
      const start = lines[from].firstChild;
      const end = lines[to].firstChild;
      const range = document.createRange();
      range.setStart(start, from_offset);
      range.setEnd(end, to_offset == null ? end.length : to_offset);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    }, [from, from_offset, to, to_offset]);
  }
  const selection = (app) => app.page.evaluate(() => getSelection().toString());

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

  test('有 P: 的歌：段名是段落＋第幾行 w:，每一行一個 .lyrics-line；訊息只有來源', async ({ app }) => {
    await app.goto('#song_id=10&mode=lyrics');
    await expect(names(app)).toHaveText(['A1', 'A2', 'B1']);
    await expect(lines(app)).toHaveText(['一二三四五六七八', '甲乙丙丁戊己庚辛', '副']);
    await expect(messages(app)).toHaveText(['從歌譜中自動抽出']);
    // 訊息小字、不粗體
    const style = await messages(app).first().evaluate((li) => getComputedStyle(li));
    expect(Number(style.fontWeight)).toBeLessThan(600);
  });

  test('沒有 P: 的歌：整首一段 Verse1、Verse2…，另一則警告訊息', async ({ app }) => {
    await app.goto('#song_id=11&mode=lyrics');
    await expect(names(app)).toHaveText(['Verse1', 'Verse2']);
    await expect(lines(app)).toHaveText(['一二三四', '甲乙丙丁', '五六七八', '子丑寅卯']);
    await expect(messages(app)).toHaveText(['從歌譜中自動抽出', '歌譜缺少段落標記（P:）']);
    // 自動抽出是 info（i icon），缺少段落標記是 warning（三角形 icon）
    await expect(messages(app).nth(0)).toHaveClass(/info/);
    await expect(messages(app).nth(1)).toHaveClass(/warning/);
    await expect(messages(app).locator('svg.lyrics-message-icon')).toHaveCount(2);
    // 訊息不能選取
    expect(await messages(app).first().evaluate((li) => getComputedStyle(li).userSelect)).toBe('none');
  });

  test('有填「投影片」欄的歌：照格子的段名、換行與分段，不寫來源訊息', async ({ app }) => {
    await app.goto('#song_id=12&mode=lyrics');
    await expect(messages(app)).toHaveCount(0);
    await expect(names(app)).toHaveText(['主歌', '副歌']);
    await expect(app.page.locator('#lyrics_sections .lyrics-section').first().locator('.lyrics-paragraph'))
      .toHaveText(['第一句 第二句第三句', '第四句']);
    await expect(lines(app)).toHaveText(['第一句 第二句', '第三句', '第四句', '副歌一句']);
  });

  test('「投影片」欄沒有段名：警告投影片欄缺少段落標記，沒有段名的段叫 Verse', async ({ app }) => {
    await app.goto('#song_id=13&mode=lyrics');
    await expect(messages(app)).toHaveText(['歌譜缺少段落標記（P:）', '投影片欄缺少段落標記（[段名]）']);
    await expect(names(app)).toHaveText(['Verse']);
  });

  test('用一般的文字選取：按「複製」整理成純文字，換段落或換段空一行，不含段名', async ({ app }) => {
    await app.goto('#song_id=12&mode=lyrics');
    // 沒有選取時不能複製
    await expect(app.page.locator('#lyrics_copy')).toHaveAttribute('aria-disabled', 'true');
    // 從「第二句」選到「副歌一」（跨過段內分段和段名）
    await select_text(app, 0, 4, 3, 3);
    await expect(app.page.locator('#lyrics_copy')).toHaveAttribute('aria-disabled', 'false');
    await app.page.locator('#lyrics_copy').click();
    await expect(app.page.locator('#lyrics_status')).toHaveText('已複製 4 行');
    expect(await clipboard(app)).toBe('第二句\n第三句\n\n第四句\n\n副歌一');
    // 按按鈕不會取消選取
    expect(await selection(app)).not.toBe('');
  });

  test('剪貼簿 API 不能用時（例如 http），「複製」改用 execCommand，一樣整理成純文字，選取留著', async ({ app }) => {
    await app.goto('#song_id=11&mode=lyrics');
    await app.page.evaluate(() => {
      navigator.clipboard.writeText = () => Promise.reject(new Error('not allowed'));
    });
    await select_text(app, 1, 0, 2);
    await app.page.locator('#lyrics_copy').click();
    await expect(app.page.locator('#lyrics_status')).toHaveText('已複製 2 行');
    expect(await clipboard(app)).toBe('甲乙丙丁\n\n五六七八');
    // 選取還在（selection.toString() 會不會含段名依瀏覽器版本而異，所以看選到哪幾行）
    expect(await app.page.evaluate(() => {
      const lines = document.querySelectorAll('#lyrics_sections .lyrics-line');
      return [...lines].map((l) => getSelection().containsNode(l, true));
    })).toEqual([false, true, true, false]);
    await expect(app.page.locator('#lyrics_copy')).toHaveAttribute('aria-disabled', 'false');
  });

  test('用鍵盤複製（Ctrl+C）也整理成同樣的純文字', async ({ app }) => {
    await app.goto('#song_id=11&mode=lyrics');
    await select_text(app, 1, 0, 2);
    await app.page.keyboard.press('ControlOrMeta+c');
    expect(await clipboard(app)).toBe('甲乙丙丁\n\n五六七八');
    await expect(app.page.locator('#lyrics_status')).toHaveText('已複製 2 行');
  });

  test('沒有勾選框；段名不能被選取。點段名選取整段，已經選取整段時取消；全選（沒有全不選）', async ({ app }) => {
    await app.goto('#song_id=11&mode=lyrics');
    await expect(app.page.locator('#lyrics_view input')).toHaveCount(0);
    expect(await names(app).first().evaluate((n) => getComputedStyle(n).userSelect)).toBe('none');
    await names(app).nth(1).click();
    expect(await selection(app)).toMatch(/^五六七八\s+子丑寅卯$/);
    await names(app).nth(1).click();
    expect(await selection(app)).toBe('');
    // 只選了一部分時點段名：選取整段
    await select_text(app, 0, 1, 0, 2);
    await names(app).nth(0).click();
    expect(await selection(app)).toMatch(/^一二三四\s+甲乙丙丁$/);

    await app.page.locator('#lyrics_select_all').click();
    await app.page.locator('#lyrics_copy').click();
    await expect(app.page.locator('#lyrics_status')).toHaveText('已複製 4 行');
    expect(await clipboard(app)).toBe('一二三四\n甲乙丙丁\n\n五六七八\n子丑寅卯');

    await expect(app.page.locator('#lyrics_select_none')).toHaveCount(0);
    await names(app).nth(1).click();
    await names(app).nth(1).click();
    expect(await selection(app)).toBe('');
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
    const box = await names(app).first().evaluate((n) => ({ radius: getComputedStyle(n).borderTopLeftRadius, width: getComputedStyle(n).borderTopWidth, cursor: getComputedStyle(n).cursor }));
    expect(box).toEqual({ radius: '4px', width: '1px', cursor: 'auto' });
    // 段名的左邊緣對齊歌詞的字
    const name_left = (await names(app).first().boundingBox()).x;
    const text_left = await lines(app).first().evaluate((l) => {
      const r = document.createRange();
      r.selectNodeContents(l);
      return r.getBoundingClientRect().left;
    });
    expect(name_left).toBeCloseTo(text_left, 0);
    const border = await app.page.locator('#lyrics_sections .lyrics-section').first()
      .evaluate((s) => getComputedStyle(s).borderBottomWidth);
    expect(border).toBe('0px');
    // 主歌：第一句 第二句／第三句 ‖ 第四句（段內分段）
    const tops = await lines(app).evaluateAll((ls) => ls.map((l) => l.getBoundingClientRect().top));
    expect(tops[2] - tops[1]).toBeCloseTo(tops[1] - tops[0], 0);
    // 訊息的左邊緣也和歌詞的字對齊
    await app.goto('#song_id=13&mode=lyrics');
    await expect(app.page.locator('#lyrics_messages li')).toHaveCount(2);
    const message_left = await app.page.locator('#lyrics_messages li').first().evaluate((li) => li.getBoundingClientRect().left);
    const line_text_left = await lines(app).first().evaluate((l) => {
      const r = document.createRange();
      r.selectNodeContents(l);
      return r.getBoundingClientRect().left;
    });
    expect(message_left).toBeCloseTo(line_text_left, 0);
  });

  test('歌名在歌詞前面、訊息在歌詞後面；段和段之間空 0.5em，最後一段後面不空；歌詞的空白寬一點', async ({ app }) => {
    await app.goto('#song_id=11&mode=lyrics');
    await expect(app.page.locator('#lyrics_title')).toHaveText('沒分段的歌');
    const order = await view(app).evaluate((v) => [...v.children].map((c) => c.id || c.className));
    expect(order.indexOf('lyrics_title')).toBeLessThan(order.indexOf('lyrics_sections'));
    expect(order.indexOf('lyrics_sections')).toBeLessThan(order.indexOf('lyrics_messages'));
    await expect(messages(app)).toHaveCount(2);
    const margins = await app.page.locator('#lyrics_sections .lyrics-section').evaluateAll((ss) => ss.map((s) => {
      const st = getComputedStyle(s);
      return parseFloat(st.marginBottom) / parseFloat(st.fontSize);
    }));
    expect(margins).toEqual([0.5, 0]);
    expect(await lines(app).first().evaluate((l) => parseFloat(getComputedStyle(l).wordSpacing) / parseFloat(getComputedStyle(l).fontSize))).toBeCloseTo(0.5);
    // 換歌時歌名跟著換
    await app.goto('#song_id=12&mode=lyrics');
    await expect(app.page.locator('#lyrics_title')).toHaveText('有投影片欄的歌');
  });

  test('列印時只印歌名和歌詞：不印全選／複製等按鈕和訊息', async ({ app }) => {
    await app.goto('#song_id=11&mode=lyrics');
    await app.page.emulateMedia({ media: 'print' });
    await expect(app.page.locator('#lyrics_title')).toBeVisible();
    await expect(lines(app).first()).toBeVisible();
    await expect(app.page.locator('.lyrics-actions')).toBeHidden();
    await expect(app.page.locator('#lyrics_messages')).toBeHidden();
    await app.page.emulateMedia({ media: 'screen' });
    await expect(app.page.locator('.lyrics-actions')).toBeVisible();
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
    await expect(names(app)).toHaveText(['Verse1', 'Verse2']);
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
    await expect(names(app)).toHaveText(['Verse1', 'Verse2']);
    const box = await view(app).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(16 - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(375 - 16 + 1);
    await app.page.locator('#more_button').click();
    await expect(app.page.locator('#more-menu .view-mode-button')).toHaveText('檢視歌譜');
  });
});
