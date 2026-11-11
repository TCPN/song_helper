const { test, expect, SONGS } = require('../app');

// 自編的短歌：A 段兩節（從譜上抽出，每節一行），B 段一行很長
const AUTO_SONGS = [
  ...SONGS,
  {
    id: 20, name: '自動排版的歌', tone: 'C', timesig: '4/4', melody: 'CDEF',
    slides: '[A]\n一二三四 五六七八 甲乙丙丁\n子丑寅卯\n\n辰巳午未\n[B]\n春夏秋冬',
    abc: 'X:20\nT:Auto\nM:4/4\nL:1/4\nK:C\nCDEF|]\n',
  },
];

test.use({ songs: [AUTO_SONGS, { option: true }] });

test.describe('自動排版', () => {
  const area = (app) => app.page.locator('#lyrics_editor_text');
  const panel = (app) => app.page.locator('#lyrics_auto_panel');
  const value = (app, key) => panel(app).locator(`[data-auto-value="${key}"]`);
  const step = (app, key, steps) => panel(app).locator(`[data-auto-step="${key}"][data-steps="${steps}"]`);

  async function open_auto(app, options) {
    await app.page.addInitScript((options) => {
      if (options)
        localStorage.setItem('lyrics_auto_layout', JSON.stringify(options));
    }, options);
    await app.goto('#song_id=20&view=lyrics');
    await app.page.locator('#lyrics_edit').click();
    await expect(area(app)).toHaveValue('一二三四 五六七八 甲乙丙丁\n子丑寅卯\n\n辰巳午未\n\n春夏秋冬');
    await app.page.locator('#lyrics_auto_button').click();
    await expect(panel(app)).toBeVisible();
  }

  test('打開面板就依設定重新分行、分頁；改設定馬上重排，存檔後歌詞檢視照新的排版', async ({ app }) => {
    await open_auto(app, { lines: 2, max_lines: 2, width: 8 });
    await expect(value(app, 'lines')).toHaveText('2');
    await expect(value(app, 'max_lines')).toHaveText('2');
    await expect(value(app, 'width')).toHaveText('8');
    await expect(panel(app).locator('[data-auto-space="half"]')).toHaveAttribute('aria-checked', 'true');
    // 第一行寬 14，每行 8 字：斷成三行；4 行、每頁 2 行
    await expect(area(app)).toHaveValue('一二三四\n五六七八\n\n甲乙丙丁\n子丑寅卯\n\n辰巳午未\n\n春夏秋冬');
    await expect(app.page.locator('#lyrics_auto_button')).toHaveAttribute('aria-expanded', 'true');
    // 段名不變
    await expect(app.page.locator('#lyrics_editor_names .lyrics-editor-name')).toHaveText(['A', 'B']);
    // 每行字數加到 9：「一二三四 五六七八」放得下（寬 8.5）
    await step(app, 'width', 1).click();
    await expect(value(app, 'width')).toHaveText('9');
    await expect(area(app)).toHaveValue('一二三四 五六七八\n甲乙丙丁\n\n子丑寅卯\n辰巳午未\n\n春夏秋冬');
    // 全形空格寬 9，還放得下；設定存在 localStorage
    await panel(app).locator('[data-auto-space="full"]').click();
    await expect(panel(app).locator('[data-auto-space="full"]')).toHaveAttribute('aria-checked', 'true');
    await expect(area(app)).toHaveValue('一二三四 五六七八\n甲乙丙丁\n\n子丑寅卯\n辰巳午未\n\n春夏秋冬');
    expect(await app.page.evaluate(() => JSON.parse(localStorage.getItem('lyrics_auto_layout')))).toEqual({ lines: 2, max_lines: 2, width: 9 });
    expect(await app.page.evaluate(() => localStorage.getItem('lyrics_space_mode'))).toBe('full');
    // 隱藏空格：和歌詞檢視的「空格」選單同一個設定，面板上也選得到；寬 8，每行 8 字放得下
    await step(app, 'width', -1).click();
    await panel(app).locator('[data-auto-space="hide"]').click();
    await expect(panel(app).locator('[data-auto-space="hide"]')).toHaveAttribute('aria-checked', 'true');
    await expect(area(app)).toHaveValue('一二三四 五六七八\n甲乙丙丁\n\n子丑寅卯\n辰巳午未\n\n春夏秋冬');
    await panel(app).locator('[data-auto-space="full"]').click();
    await step(app, 'width', 1).click();
    // 字沒變：沒有警告，存檔不用確認
    await expect(app.page.locator('#lyrics_editor_warnings li')).toHaveCount(0);
    await app.page.locator('#lyrics_save').click();
    await app.page.locator('#lyrics_editor_close').click();
    await expect(app.page.locator('#lyrics_sections .lyrics-paragraph')).toHaveCount(3);
    await expect(app.page.locator('#lyrics_sections .lyrics-line').first()).toHaveText('一二三四　五六七八');
  });

  test('整個自動排版（含改設定）是復原的一步；排完可以接著編輯', async ({ app }) => {
    await open_auto(app, { lines: 2, max_lines: 2, width: 8 });
    await step(app, 'width', 1).click();
    await step(app, 'lines', 1).click();
    await step(app, 'lines', 1).click();
    // 每頁行數加到超過最多行數時，最多行數跟著加
    await expect(value(app, 'lines')).toHaveText('4');
    await expect(value(app, 'max_lines')).toHaveText('4');
    await expect(area(app)).toHaveValue('一二三四 五六七八\n甲乙丙丁\n子丑寅卯\n辰巳午未\n\n春夏秋冬');
    // 面板開著也能接著編輯：在「子丑寅卯」前面空一行（換頁）；再按「自動排版」收起設定，排好的留著
    await area(app).click();
    await expect(panel(app)).toBeVisible();
    await area(app).evaluate((t) => { const at = t.value.indexOf('子丑'); t.setSelectionRange(at, at); });
    await app.page.keyboard.press('Enter');
    await expect(area(app)).toHaveValue('一二三四 五六七八\n甲乙丙丁\n\n子丑寅卯\n辰巳午未\n\n春夏秋冬');
    await app.page.locator('#lyrics_auto_button').click();
    await expect(panel(app)).toBeHidden();
    await expect(area(app)).toHaveValue('一二三四 五六七八\n甲乙丙丁\n\n子丑寅卯\n辰巳午未\n\n春夏秋冬');
    await app.page.locator('#lyrics_undo').click();
    await app.page.locator('#lyrics_undo').click();
    await expect(area(app)).toHaveValue('一二三四 五六七八 甲乙丙丁\n子丑寅卯\n\n辰巳午未\n\n春夏秋冬');
    await expect(app.page.locator('#lyrics_undo')).toHaveClass(/disabled/);
  });
});
