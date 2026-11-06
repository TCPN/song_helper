const { test, expect, SONGS } = require('../app');

// 自編的短歌：id 10 有 P: 段落（從譜上抽出）、id 12 有填「投影片」欄
const EDITOR_SONGS = [
  ...SONGS,
  {
    id: 10, name: '分段的歌', tone: 'C', timesig: '4/4', melody: 'CDEF',
    abc: 'X:10\nT:Parts\nM:4/4\nL:1/4\nK:C\nP:A\nCDEF|GABc|\nw:一 二 三 四 五 六 七 八\nw:甲 乙 丙 丁 戊 己 庚 辛\nP:B\nc4|]\nw:副\n',
  },
  {
    id: 12, name: '有投影片欄的歌', tone: 'C', timesig: '4/4', melody: 'CDEF',
    slides: '[主歌 = A1]\n第一句 / 第二句 // 第三句\n\n第四句\n[副歌]\n副歌一句',
    abc: 'X:12\nT:Cell\nM:4/4\nL:1/4\nK:C\nP:A\nCDEF|]\nw:一 二 三 四\n',
  },
];

test.use({ songs: [EDITOR_SONGS, { option: true }] });

test.describe('歌詞排版編輯', () => {
  const editor = (app) => app.page.locator('#lyrics_editor');
  const area = (app) => app.page.locator('#lyrics_editor_text');
  const names = (app) => app.page.locator('#lyrics_editor_gutter .lyrics-editor-name');
  const warnings = (app) => app.page.locator('#lyrics_editor_warnings li');
  const status = (app) => app.page.locator('#lyrics_editor_status');
  const button = (app, id) => app.page.locator('#lyrics_' + id);
  const view_lines = (app) => app.page.locator('#lyrics_sections .lyrics-line');
  const view_messages = (app) => app.page.locator('#lyrics_messages li');
  const saved = (app) => app.page.evaluate(() => JSON.parse(localStorage.getItem('lyrics_layout') || '{}'));

  async function open_editor(app, song_id) {
    await app.goto(`#song_id=${song_id}&view=lyrics`);
    await button(app, 'edit').click();
    await expect(editor(app)).toBeVisible();
  }

  // 游標放在 text 後面（before 為 true 時放在 text 前面）
  async function caret(app, text, before = false) {
    await area(app).evaluate((t, [text, before]) => {
      const at = t.value.indexOf(text) + (before ? 0 : text.length);
      t.focus();
      t.setSelectionRange(at, at);
    }, [text, before]);
  }

  // 段名的中線和文字區裡那段第一行的中線差多少 px（段名對齊那段的第一行）
  const name_tops = (app) => names(app).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));

  test('鉛筆在按鈕列第三個；打開後整首一個文字區，段名浮在左邊、不能選取；複製的按鈕列和歌詞藏起來', async ({ app }) => {
    await app.goto('#song_id=12&view=lyrics');
    await expect(app.page.locator('#lyrics_view .lyrics-actions > .lyrics-button')).toHaveText(['全選', '去除空格', '', '複製']);
    await expect(app.page.locator('#lyrics_view .lyrics-actions > .lyrics-button').nth(2)).toHaveId('lyrics_edit');
    await button(app, 'edit').click();
    await expect(app.page.locator('#lyrics_view .lyrics-actions')).toBeHidden();
    await expect(app.page.locator('#lyrics_sections')).toBeHidden();
    await expect(app.page.locator('#lyrics_title')).toHaveText('有投影片欄的歌');
    await expect(app.page.locator('#lyrics_editor textarea')).toHaveCount(1);
    await expect(area(app)).toHaveValue('第一句 第二句\n第三句\n\n第四句\n副歌一句');
    await expect(names(app)).toHaveText(['主歌', '副歌']);
    expect(await names(app).first().evaluate((n) => getComputedStyle(n).userSelect)).toBe('none');
    // 段名在文字區左邊，對齊各段的第一行（主歌第 1 行、副歌第 5 行）
    const box = await area(app).boundingBox();
    const name_box = await names(app).nth(1).boundingBox();
    expect(name_box.x + name_box.width).toBeLessThanOrEqual(box.x);
    const line = await area(app).evaluate((t) => parseFloat(getComputedStyle(t).lineHeight));
    const [a, b] = await name_tops(app);
    expect(Math.abs(b - a - 4 * line)).toBeLessThan(2);
    // 段和段之間一條線
    await expect(app.page.locator('#lyrics_editor_marks .lyrics-editor-divider')).toHaveCount(1);
    for (const id of ['undo', 'redo', 'save', 'editor_close'])
      await expect(button(app, id)).toBeVisible();
    for (const id of ['undo', 'redo', 'save'])
      await expect(button(app, id)).toHaveAttribute('aria-disabled', 'true');
    await expect(warnings(app)).toHaveCount(0);
    expect(await app.hashParams()).toEqual({ song_id: '12', view: 'lyrics' });
  });

  test('前面的段加換行時，後面的段名跟著往下移', async ({ app }) => {
    await open_editor(app, 12);
    const line = await area(app).evaluate((t) => parseFloat(getComputedStyle(t).lineHeight));
    const [, before] = await name_tops(app);
    await caret(app, '第一句');
    await app.page.keyboard.press('Enter');
    await expect(area(app)).toHaveValue('第一句\n 第二句\n第三句\n\n第四句\n副歌一句');
    const [, after] = await name_tops(app);
    expect(Math.abs(after - before - line)).toBeLessThan(2);
  });

  test('段落標記不能刪：在段的開頭按 Backspace、選取跨段後刪除都會改回去', async ({ app }) => {
    await open_editor(app, 12);
    await caret(app, '副歌一句', true);
    await app.page.keyboard.press('Backspace');
    await expect(area(app)).toHaveValue('第一句 第二句\n第三句\n\n第四句\n副歌一句');
    await expect(status(app)).toHaveText('段落標記不能刪除');
    await expect(button(app, 'undo')).toHaveAttribute('aria-disabled', 'true');
    // 全選後刪除
    await area(app).focus();
    await app.page.keyboard.press('ControlOrMeta+a');
    await app.page.keyboard.press('Delete');
    await expect(area(app)).toHaveValue('第一句 第二句\n第三句\n\n第四句\n副歌一句');
    // 段內的空行可以刪
    await caret(app, '第四句', true);
    await app.page.keyboard.press('Backspace');
    await expect(area(app)).toHaveValue('第一句 第二句\n第三句\n第四句\n副歌一句');
    await expect(names(app)).toHaveText(['主歌', '副歌']);
  });

  test('只加減空格和換行時沒有警告；改到字時顯示警告，指出哪一段、改了什麼', async ({ app }) => {
    await open_editor(app, 10);
    await expect(names(app)).toHaveText(['A1', 'A2', 'B']);
    await caret(app, '一二三四');
    await app.page.keyboard.press('Enter');
    await app.page.keyboard.press('Space');
    await expect(area(app)).toHaveValue('一二三四\n 五六七八\n甲乙丙丁戊己庚辛\n副');
    await expect(warnings(app)).toHaveCount(0);

    await caret(app, '甲乙');
    await app.page.keyboard.press('Backspace');
    await expect(warnings(app)).toHaveText(['「A2」的文字和原本不一樣：刪掉「乙」（…甲▲丙丁戊…）']);
    await expect(names(app).nth(1)).toHaveClass(/changed/);
    await expect(names(app).nth(0)).not.toHaveClass(/changed/);
    await expect(app.page.locator('#lyrics_editor_marks .lyrics-editor-changed')).toHaveCount(1);
    await app.page.keyboard.type('乙');
    await expect(warnings(app)).toHaveCount(0);
    await app.page.keyboard.type('啊');
    await expect(warnings(app)).toHaveText(['「A2」的文字和原本不一樣：加了「啊」（…甲乙▲丙丁戊…）']);
  });

  test('復原、重做：一步一步回去；換行和空格各是一步，連續打字合成一步；Ctrl+Z／Ctrl+Shift+Z 也可以', async ({ app }) => {
    await open_editor(app, 10);
    await caret(app, '一二三四');
    await app.page.keyboard.press('Enter');
    await caret(app, '甲乙丙丁');
    await app.page.keyboard.press('Space');
    await app.page.keyboard.type('xyz');
    await expect(area(app)).toHaveValue('一二三四\n五六七八\n甲乙丙丁 xyz戊己庚辛\n副');

    await button(app, 'undo').click();
    await expect(area(app)).toHaveValue('一二三四\n五六七八\n甲乙丙丁 戊己庚辛\n副');
    await button(app, 'undo').click();
    await expect(area(app)).toHaveValue('一二三四\n五六七八\n甲乙丙丁戊己庚辛\n副');
    await app.page.keyboard.press('ControlOrMeta+z');
    await expect(area(app)).toHaveValue('一二三四五六七八\n甲乙丙丁戊己庚辛\n副');
    await expect(button(app, 'undo')).toHaveAttribute('aria-disabled', 'true');
    await expect(button(app, 'save')).toHaveAttribute('aria-disabled', 'true');

    await button(app, 'redo').click();
    await expect(area(app)).toHaveValue('一二三四\n五六七八\n甲乙丙丁戊己庚辛\n副');
    await app.page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(area(app)).toHaveValue('一二三四\n五六七八\n甲乙丙丁 戊己庚辛\n副');
    // 復原後段名的位置也回來；之後再改就不能重做
    await caret(app, '副', true);
    await app.page.keyboard.press('Space');
    await expect(button(app, 'redo')).toHaveAttribute('aria-disabled', 'true');
  });

  test('輸入法組字（注音、拼音）：組字中的半成品不記成一步、不出現警告；組字結束才算一步', async ({ app }) => {
    await open_editor(app, 10);
    await caret(app, '甲乙');
    const cdp = await app.page.context().newCDPSession(app.page);
    for (const text of ['ㄒ', 'ㄒㄧ', 'ㄒㄧㄚ'])
      await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
    await expect(area(app)).toHaveValue('一二三四五六七八\n甲乙ㄒㄧㄚ丙丁戊己庚辛\n副');
    await expect(warnings(app)).toHaveCount(0);
    await expect(button(app, 'undo')).toHaveAttribute('aria-disabled', 'true');
    await cdp.send('Input.insertText', { text: '下' });
    await expect(area(app)).toHaveValue('一二三四五六七八\n甲乙下丙丁戊己庚辛\n副');
    await expect(warnings(app)).toHaveText(['「A2」的文字和原本不一樣：加了「下」（…甲乙▲丙丁戊…）']);
    await button(app, 'undo').click();
    await expect(area(app)).toHaveValue('一二三四五六七八\n甲乙丙丁戊己庚辛\n副');
    await expect(button(app, 'undo')).toHaveAttribute('aria-disabled', 'true');
  });

  test('存檔存在 localStorage（「投影片」欄格式），關閉後歌詞檢視用暫存的排版並顯示訊息；再打開從暫存開始', async ({ app }) => {
    await open_editor(app, 10);
    await caret(app, '一二三四');
    await app.page.keyboard.press('Enter');
    await caret(app, '甲乙丙丁');
    await app.page.keyboard.press('Enter');
    await app.page.keyboard.press('Enter');
    await button(app, 'save').click();
    await expect(status(app)).toHaveText('已存檔');
    await expect(button(app, 'save')).toHaveAttribute('aria-disabled', 'true');
    expect(await saved(app)).toEqual({ 10: '[A1]\n一二三四\n五六七八\n\n[A2]\n甲乙丙丁\n\n戊己庚辛\n\n[B]\n副' });
    expect(app.dialogs).toEqual([]);

    await button(app, 'editor_close').click();
    await expect(editor(app)).toBeHidden();
    await expect(app.page.locator('#lyrics_view .lyrics-actions')).toBeVisible();
    await expect(view_lines(app)).toHaveText(['一二三四', '五六七八', '甲乙丙丁', '戊己庚辛', '副']);
    await expect(view_messages(app)).toHaveText(['使用這台裝置暫存的排版（還沒存回試算表）']);

    await app.page.reload();
    await expect(view_lines(app)).toHaveText(['一二三四', '五六七八', '甲乙丙丁', '戊己庚辛', '副']);
    await button(app, 'edit').click();
    await expect(area(app)).toHaveValue('一二三四\n五六七八\n甲乙丙丁\n\n戊己庚辛\n副');
    await expect(names(app)).toHaveText(['A1', 'A2', 'B']);
    await expect(warnings(app)).toHaveCount(0);
  });

  test('改回和原本一樣再存檔：刪掉暫存，歌詞檢視回到原本的來源', async ({ app }) => {
    await open_editor(app, 12);
    await caret(app, '副歌');
    await app.page.keyboard.press('Enter');
    await button(app, 'save').click();
    expect(await saved(app)).toEqual({ 12: '[主歌 = A1]\n第一句 第二句\n第三句\n\n第四句\n\n[副歌]\n副歌\n一句' });
    await app.page.keyboard.press('Backspace');
    await button(app, 'save').click();
    expect(await saved(app)).toEqual({});
    await button(app, 'editor_close').click();
    await expect(view_messages(app)).toHaveCount(0);
  });

  test('改到字時存檔要先確認；暫存的字和原本不一樣時歌詞檢視顯示警告', async ({ app }) => {
    await open_editor(app, 12);
    await caret(app, '副歌一句');
    await app.page.keyboard.type('！');
    await button(app, 'save').click();
    expect(app.dialogs).toEqual(['有些字和原本的歌詞不一樣，仍要存檔嗎？']);
    await button(app, 'editor_close').click();
    await expect(view_messages(app)).toHaveText(['使用這台裝置暫存的排版（還沒存回試算表）', '暫存的排版和目前的歌詞文字不一樣']);
    await button(app, 'edit').click();
    await expect(warnings(app)).toHaveText(['「副歌」的文字和原本不一樣：加了「！」（…歌一句▲）']);
  });

  test('沒存檔就關閉要先確認；關掉後不留修改', async ({ app }) => {
    await open_editor(app, 12);
    await caret(app, '副歌');
    await app.page.keyboard.press('Enter');
    await button(app, 'editor_close').click();
    expect(app.dialogs).toEqual(['還沒存檔，確定要關閉嗎？']);
    await expect(editor(app)).toBeHidden();
    expect(await saved(app)).toEqual({});
    await expect(view_lines(app)).toHaveText(['第一句 第二句', '第三句', '第四句', '副歌一句']);
  });

  test('點段名：游標移到那段的開頭', async ({ app }) => {
    await open_editor(app, 12);
    await names(app).nth(1).click();
    await expect(area(app)).toBeFocused();
    expect(await area(app).evaluate((t) => t.value.slice(t.selectionStart))).toBe('副歌一句');
  });

  test('換歌或回到歌譜檢視時不再編輯', async ({ app }) => {
    await open_editor(app, 12);
    await app.goto('#song_id=10&view=lyrics');
    await expect(editor(app)).toBeHidden();
    await expect(view_lines(app)).toHaveText(['一二三四五六七八', '甲乙丙丁戊己庚辛', '副']);
    await button(app, 'edit').click();
    await app.goto('#song_id=10');
    await expect(editor(app)).toBeHidden();
    await app.goto('#song_id=10&view=lyrics');
    await expect(editor(app)).toBeHidden();
    await expect(app.page.locator('#lyrics_view .lyrics-actions')).toBeVisible();
  });
});
