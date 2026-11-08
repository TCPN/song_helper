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
  const names = (app) => app.page.locator('#lyrics_editor_names .lyrics-editor-name');
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

  test('點鉛筆後歌名、段名和歌詞的位置和檢視時一樣（段裡沒有換投影片時）', async ({ app }) => {
    await app.goto('#song_id=10&view=lyrics');
    // 檢視時：歌名、段名的位置，和每段第一行字的左上角（.lyrics-line 左邊有 padding）
    const measure_view = () => app.page.evaluate(() => ({
      title: document.querySelector('#lyrics_title').getBoundingClientRect().top,
      names: [...document.querySelectorAll('#lyrics_sections .lyrics-name')].map((n) => { const r = n.getBoundingClientRect(); return [r.left, r.top]; }),
      lines: [...document.querySelectorAll('#lyrics_sections .lyrics-line')].map((l) => {
        const r = l.getBoundingClientRect();
        return [r.left + parseFloat(getComputedStyle(l).paddingLeft), r.top];
      }),
    }));
    const view_pos = await measure_view();
    await button(app, 'edit').click();
    await expect(area(app)).toHaveValue('一二三四五六七八\n\n甲乙丙丁戊己庚辛\n\n副');
    const edit_pos = await app.page.evaluate(() => {
      const t = document.querySelector('#lyrics_editor_text');
      const s = getComputedStyle(t);
      const r = t.getBoundingClientRect();
      const left = r.left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft);
      const top = r.top + parseFloat(s.borderTopWidth) + parseFloat(s.paddingTop);
      const line = parseFloat(s.lineHeight);
      return {
        title: document.querySelector('#lyrics_title').getBoundingClientRect().top,
        names: [...document.querySelectorAll('#lyrics_editor_names .lyrics-editor-name')].map((n) => { const b = n.getBoundingClientRect(); return [b.left, b.top]; }),
        // 文字區的第 1、3、5 行（第 2、4 行是段和段之間的空行）
        lines: [0, 2, 4].map((k) => [left, top + k * line]),
      };
    });
    const close = (a, b) => expect(Math.abs(a - b)).toBeLessThan(1);
    close(edit_pos.title, view_pos.title);
    expect(edit_pos.names.length).toBe(view_pos.names.length);
    view_pos.names.forEach(([x, y], i) => { close(edit_pos.names[i][0], x); close(edit_pos.names[i][1], y); });
    view_pos.lines.forEach(([x, y], i) => { close(edit_pos.lines[i][0], x); close(edit_pos.lines[i][1], y); });
    // 改到字出現警告時，歌詞也不移動
    await caret(app, '三');
    await app.page.keyboard.type('啊');
    await expect(warnings(app)).toHaveCount(1);
    const names_after = await name_tops(app);
    view_pos.names.forEach(([, y], i) => close(names_after[i], y));
  });

  test('鉛筆在按鈕列第三個；打開後整首一個文字區，段名浮在上面、不能選取；複製的按鈕列和歌詞藏起來', async ({ app }) => {
    await app.goto('#song_id=12&view=lyrics');
    await expect(app.page.locator('#lyrics_view .lyrics-actions > *').nth(0)).toHaveId('lyrics_select_all');
    await expect(app.page.locator('#lyrics_view .lyrics-actions > *').nth(1)).toHaveId('lyrics_space_group');
    await expect(app.page.locator('#lyrics_view .lyrics-actions > *').nth(2)).toHaveId('lyrics_edit');
    await button(app, 'edit').click();
    await expect(app.page.locator('#lyrics_view .lyrics-actions')).toBeHidden();
    await expect(app.page.locator('#lyrics_sections')).toBeHidden();
    await expect(app.page.locator('#lyrics_title')).toHaveText('有投影片欄的歌');
    await expect(app.page.locator('#lyrics_editor textarea')).toHaveCount(1);
    await expect(area(app)).toHaveValue('第一句 第二句\n第三句\n\n第四句\n\n副歌一句');
    await expect(names(app)).toHaveText(['主歌', '副歌']);
    expect(await names(app).first().evaluate((n) => getComputedStyle(n).userSelect)).toBe('none');
    // 段名在各段第一行的上面（主歌第 1 行、副歌第 6 行：段和段之間空一行，副歌的段名在那個空行裡）
    const line = await area(app).evaluate((t) => parseFloat(getComputedStyle(t).lineHeight));
    const [a, b] = await name_tops(app);
    expect(Math.abs(b - a - 5 * line)).toBeLessThan(2);
    // 段和段之間一條線，在中間那個空行裡，從段名框的中間穿過（段名是白底）
    const divider = app.page.locator('#lyrics_editor_marks .lyrics-editor-divider');
    await expect(divider).toHaveCount(1);
    const divider_y = (await divider.boundingBox()).y;
    const box = await area(app).boundingBox();
    const padding_top = await area(app).evaluate((t) => parseFloat(getComputedStyle(t).paddingTop) + parseFloat(getComputedStyle(t).borderTopWidth));
    const blank_line_top = box.y + padding_top + 4 * line;
    expect(divider_y).toBeGreaterThan(blank_line_top);
    expect(divider_y).toBeLessThan(blank_line_top + line);
    const name_box = await names(app).nth(1).boundingBox();
    expect(Math.abs(divider_y - (name_box.y + name_box.height / 2))).toBeLessThan(1.5);
    expect(await names(app).nth(1).evaluate((n) => getComputedStyle(n).backgroundColor)).toBe('rgb(255, 255, 255)');
    await expect(app.page.locator('#lyrics_editor .lyrics-editor-hint')).toHaveCount(0);
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
    await expect(area(app)).toHaveValue('第一句\n 第二句\n第三句\n\n第四句\n\n副歌一句');
    const [, after] = await name_tops(app);
    expect(Math.abs(after - before - line)).toBeLessThan(2);
  });

  test('段落標記不能刪：在段的開頭按 Backspace、選取跨段後刪除都會改回去', async ({ app }) => {
    await open_editor(app, 12);
    await caret(app, '副歌一句', true);
    await app.page.keyboard.press('Backspace');
    await expect(area(app)).toHaveValue('第一句 第二句\n第三句\n\n第四句\n\n副歌一句');
    await expect(status(app)).toHaveText('段落之間的空行不能修改');
    await expect(button(app, 'undo')).toHaveAttribute('aria-disabled', 'true');
    // 全選後刪除
    await area(app).focus();
    await app.page.keyboard.press('ControlOrMeta+a');
    await app.page.keyboard.press('Delete');
    await expect(area(app)).toHaveValue('第一句 第二句\n第三句\n\n第四句\n\n副歌一句');
    // 段內的空行可以刪
    await caret(app, '第四句', true);
    await app.page.keyboard.press('Backspace');
    await expect(area(app)).toHaveValue('第一句 第二句\n第三句\n第四句\n\n副歌一句');
    await expect(names(app)).toHaveText(['主歌', '副歌']);
  });

  test('只加減空格和換行時沒有警告；改到字時顯示警告，指出哪一段、改了什麼', async ({ app }) => {
    await open_editor(app, 10);
    await expect(names(app)).toHaveText(['A1', 'A2', 'B']);
    await caret(app, '一二三四');
    await app.page.keyboard.press('Enter');
    await app.page.keyboard.press('Space');
    await expect(area(app)).toHaveValue('一二三四\n 五六七八\n\n甲乙丙丁戊己庚辛\n\n副');
    await expect(warnings(app)).toHaveCount(0);

    await caret(app, '甲乙');
    await app.page.keyboard.press('Backspace');
    await expect(warnings(app)).toHaveText(['文字變更：A2 甲乙丙丁戊己…']);
    // word diff：刪掉的字是 <del>（紅底刪除線），加上的字是 <ins>（綠底）
    await expect(warnings(app).locator('del')).toHaveText('乙');
    await expect(warnings(app).locator('ins')).toHaveCount(0);
    expect(await warnings(app).locator('del').evaluate((d) => getComputedStyle(d).textDecorationLine)).toBe('line-through');
    await expect(names(app).nth(1)).toHaveClass(/changed/);
    await expect(names(app).nth(0)).not.toHaveClass(/changed/);
    await expect(app.page.locator('#lyrics_editor_marks .lyrics-editor-changed')).toHaveCount(1);
    await app.page.keyboard.type('乙');
    await expect(warnings(app)).toHaveCount(0);
    await app.page.keyboard.type('啊');
    await expect(warnings(app)).toHaveText(['文字變更：A2 甲乙啊丙丁戊己…']);
    await expect(warnings(app).locator('ins')).toHaveText('啊');
  });

  test('復原、重做：一步一步回去；換行和空格各是一步，連續打字合成一步；Ctrl+Z／Ctrl+Shift+Z 也可以', async ({ app }) => {
    await open_editor(app, 10);
    await caret(app, '一二三四');
    await app.page.keyboard.press('Enter');
    await caret(app, '甲乙丙丁');
    await app.page.keyboard.press('Space');
    await app.page.keyboard.type('xyz');
    await expect(area(app)).toHaveValue('一二三四\n五六七八\n\n甲乙丙丁 xyz戊己庚辛\n\n副');

    await button(app, 'undo').click();
    await expect(area(app)).toHaveValue('一二三四\n五六七八\n\n甲乙丙丁 戊己庚辛\n\n副');
    await button(app, 'undo').click();
    await expect(area(app)).toHaveValue('一二三四\n五六七八\n\n甲乙丙丁戊己庚辛\n\n副');
    await app.page.keyboard.press('ControlOrMeta+z');
    await expect(area(app)).toHaveValue('一二三四五六七八\n\n甲乙丙丁戊己庚辛\n\n副');
    await expect(button(app, 'undo')).toHaveAttribute('aria-disabled', 'true');
    await expect(button(app, 'save')).toHaveAttribute('aria-disabled', 'true');

    await button(app, 'redo').click();
    await expect(area(app)).toHaveValue('一二三四\n五六七八\n\n甲乙丙丁戊己庚辛\n\n副');
    await app.page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(area(app)).toHaveValue('一二三四\n五六七八\n\n甲乙丙丁 戊己庚辛\n\n副');
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
    await expect(area(app)).toHaveValue('一二三四五六七八\n\n甲乙ㄒㄧㄚ丙丁戊己庚辛\n\n副');
    await expect(warnings(app)).toHaveCount(0);
    await expect(button(app, 'undo')).toHaveAttribute('aria-disabled', 'true');
    await cdp.send('Input.insertText', { text: '下' });
    await expect(area(app)).toHaveValue('一二三四五六七八\n\n甲乙下丙丁戊己庚辛\n\n副');
    await expect(warnings(app)).toHaveText(['文字變更：A2 甲乙下丙丁戊己…']);
    await button(app, 'undo').click();
    await expect(area(app)).toHaveValue('一二三四五六七八\n\n甲乙丙丁戊己庚辛\n\n副');
    await expect(button(app, 'undo')).toHaveAttribute('aria-disabled', 'true');
  });

  test('在段落之間的空行上用輸入法打字：組字中不打斷，組字結束後改回去', async ({ app }) => {
    await open_editor(app, 12);
    await caret(app, '第四句\n');
    const cdp = await app.page.context().newCDPSession(app.page);
    for (const text of ['ㄒ', 'ㄒㄧ'])
      await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
    // 組字中沒有被改回去
    await expect(area(app)).toHaveValue('第一句 第二句\n第三句\n\n第四句\nㄒㄧ\n副歌一句');
    await cdp.send('Input.insertText', { text: '下' });
    await expect(area(app)).toHaveValue('第一句 第二句\n第三句\n\n第四句\n\n副歌一句');
    await expect(status(app)).toHaveText('段落之間的空行不能修改');
    await expect(button(app, 'undo')).toHaveAttribute('aria-disabled', 'true');
    // 之後照常編輯
    await caret(app, '副歌');
    await app.page.keyboard.press('Enter');
    await expect(area(app)).toHaveValue('第一句 第二句\n第三句\n\n第四句\n\n副歌\n一句');
    await expect(names(app)).toHaveText(['主歌', '副歌']);
  });

  test('全形空白一律換成半形：打字時馬上換，游標不動；存檔也是半形', async ({ app }) => {
    await open_editor(app, 12);
    await caret(app, '副歌');
    await app.page.keyboard.insertText('\u3000');
    await expect(area(app)).toHaveValue('第一句 第二句\n第三句\n\n第四句\n\n副歌 一句');
    expect(await area(app).evaluate((t) => t.value.slice(t.selectionStart))).toBe('一句');
    // 貼上多個全形空白
    await caret(app, '第三');
    await app.page.keyboard.insertText('\u3000\u3000');
    await expect(area(app)).toHaveValue('第一句 第二句\n第三  句\n\n第四句\n\n副歌 一句');
    await expect(warnings(app)).toHaveCount(0);
    await button(app, 'save').click();
    expect(await saved(app)).toEqual({ 12: '[主歌 = A1]\n第一句 第二句\n第三  句\n\n第四句\n\n[副歌]\n副歌 一句' });
  });

  test('原本的歌詞有全形空白：打開編輯時就換成半形', async ({ app }) => {
    await app.page.addInitScript(() => {
      localStorage.setItem('lyrics_layout', JSON.stringify({ 12: '[主歌 = A1]\n第一句\u3000第二句\n[副歌]\n副歌一句' }));
    });
    await open_editor(app, 12);
    await expect(area(app)).toHaveValue('第一句 第二句\n\n副歌一句');
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
    await expect(area(app)).toHaveValue('一二三四\n五六七八\n\n甲乙丙丁\n\n戊己庚辛\n\n副');
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

  test('改到字時存檔按鈕換成橘色、存檔要先確認；暫存的字和原本不一樣時歌詞檢視顯示警告', async ({ app }) => {
    await open_editor(app, 12);
    const save_color = () => button(app, 'save').evaluate((b) => getComputedStyle(b).backgroundColor);
    // 只改空格、換行時是平常的深藍色
    await caret(app, '副歌');
    await app.page.keyboard.press('Enter');
    await expect(button(app, 'save')).not.toHaveClass(/warning/);
    expect(await save_color()).toBe('rgb(51, 85, 119)');
    await app.page.keyboard.press('Backspace');
    await caret(app, '副歌一句');
    await app.page.keyboard.type('！');
    await expect(button(app, 'save')).toHaveClass(/warning/);
    expect(await save_color()).toBe('rgb(217, 122, 0)');
    await button(app, 'save').click();
    expect(app.dialogs).toEqual(['已修改文字內容，確認要儲存此變更嗎？']);
    await button(app, 'editor_close').click();
    await expect(view_messages(app)).toHaveText(['使用這台裝置暫存的排版（還沒存回試算表）', '暫存的排版和目前的歌詞文字不一樣']);
    await button(app, 'edit').click();
    await expect(warnings(app)).toHaveText(['文字變更：副歌 副歌一句！']);
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
