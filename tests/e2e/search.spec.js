const { test, expect } = require('../app');

test.describe('搜尋', () => {
  test('輸入歌名片段，只留下符合的歌', async ({ app }) => {
    await app.goto();
    await app.page.locator('#song_search').fill('歌二');
    await expect(app.visibleRows()).toHaveCount(1);
    await expect(app.visibleRows().first().locator('td').nth(1)).toHaveText('測試歌二');
  });

  test('搜尋範圍包含編號與調號', async ({ app }) => {
    await app.goto();
    await app.page.locator('#song_search').fill('Am');
    await expect(app.visibleRows()).toHaveCount(1);
    await expect(app.visibleRows().first().locator('td').nth(1)).toHaveText('小調測試');
  });

  test('沒有符合時顯示「沒有符合結果」，清空後恢復全部', async ({ app }) => {
    await app.goto();
    const search = app.page.locator('#song_search');
    await search.fill('不存在的歌');
    await expect(app.visibleRows()).toHaveCount(0);
    await expect(app.page.locator('#found_nothing')).toBeVisible();
    await expect(app.page.locator('#found_nothing')).toHaveText('沒有符合結果');

    await search.fill('');
    await expect(app.visibleRows()).toHaveCount(4);
    await expect(app.page.locator('#found_nothing')).toHaveClass(/hide/);
  });

  test('載入後搜尋框自動取得焦點', async ({ app }) => {
    await app.goto();
    await expect(app.page.locator('#song_search')).toBeFocused();
  });

  test('搜尋後仍可點開譜面', async ({ app }) => {
    await app.goto();
    await app.page.locator('#song_search').fill('歌二');
    await app.openScore(2);
    await expect(app.currentSongId()).toHaveText('2');
  });
});

// 以下是「目前的行為」。它們不一定是刻意的設計，
// 若之後決定改變（例如改成不分大小寫），直接修改這些測試即可。
test.describe('搜尋的現況行為', () => {
  test('搜尋文字會被當成正規表達式', async ({ app }) => {
    await app.goto();
    await app.page.locator('#song_search').fill('歌[一二]');
    await expect(app.visibleRows()).toHaveCount(2);
  });

  test('搜尋區分大小寫', async ({ app }) => {
    await app.goto();
    await app.page.locator('#song_search').fill('am');
    await expect(app.visibleRows()).toHaveCount(0);
  });
});

// #4：輸入不是合法的正規表達式時不丟錯；直接包含輸入文字的歌也算符合。
test.describe('搜尋：含正規表達式特殊字元的歌名', () => {
  // songs 是兩個以上元素的陣列時，要包成 [value, {}]，否則會被當成 Playwright 的 [value, options]
  test.use({
    songs: [[
      { id: 1, name: '歌(一)', tone: 'C', timesig: '4/4', melody: '', abc: null },
      { id: 2, name: '普通的歌', tone: 'G', timesig: '4/4', melody: '', abc: null },
    ], {}],
  });

  for (const text of ['(', '歌(', '歌(一)']) {
    test(`輸入 "${text}"：找到歌名含括號的歌`, async ({ app }) => {
      await app.goto();
      await app.page.locator('#song_search').fill(text);
      await expect(app.visibleRows()).toHaveCount(1);
      await expect(app.visibleRows().first().locator('td.song_name')).toHaveText('歌(一)');
      await expect(app.page.locator('#found_nothing')).toHaveClass(/hide/);
    });
  }

  test('輸入 "[" 或 "*"：沒有符合，不丟錯', async ({ app }) => {
    await app.goto();
    const search = app.page.locator('#song_search');
    for (const text of ['[', '*']) {
      await search.fill(text);
      await expect(app.visibleRows()).toHaveCount(0);
      await expect(app.page.locator('#found_nothing')).toBeVisible();
    }
    await search.fill('');
    await expect(app.visibleRows()).toHaveCount(2);
  });

  test('合法的正規表達式仍照正規表達式比對', async ({ app }) => {
    await app.goto();
    await app.page.locator('#song_search').fill('^1\\.歌');
    await expect(app.visibleRows()).toHaveCount(1);
    await expect(app.visibleRows().first().locator('td.song_name')).toHaveText('歌(一)');
  });
});

// #44：搜尋也比對歌詞（ABC 的 w:／W:，或「投影片」欄）；只有歌詞符合時，歌名下面顯示符合的那一句
test.describe('搜尋：比對歌詞', () => {
  test.use({
    songs: [[
      { id: 1, name: '春之歌', tone: 'C', timesig: '4/4', melody: '',
        abc: 'X:1\nM:4/4\nL:1/4\nK:C\nCDEF|GABc|]\nw:春-天 來_ 了 花 開 了\nGFED|C4|]\nw:小 鳥 在 唱 歌\n' },
      { id: 2, name: '晚安曲', tone: 'G', timesig: '4/4', melody: '',
        abc: 'X:2\nM:4/4\nL:1/4\nK:G\nGABc|]\n', slides: '[A]\n星星 亮了\n晚安 晚安' },
      { id: 3, name: '花園', tone: 'D', timesig: '4/4', melody: '', abc: null },
    ], {}],
  });

  test('只有歌詞符合：找得到，歌名下面顯示那一句', async ({ app }) => {
    await app.goto();
    await app.page.locator('#song_search').fill('天來了');
    await expect(app.visibleRows()).toHaveCount(1);
    const row = app.visibleRows().first();
    await expect(row.locator('td.song_name > span')).toHaveText('春之歌');
    await expect(row.locator('.lyric_match')).toBeVisible();
    await expect(row.locator('.lyric_match')).toHaveText('春天來了花開了');
  });

  test('跨行的句子也找得到，顯示跨到的兩行', async ({ app }) => {
    await app.goto();
    await app.page.locator('#song_search').fill('開了小鳥');
    await expect(app.visibleRows()).toHaveCount(1);
    await expect(app.visibleRows().first().locator('.lyric_match')).toHaveText('春天來了花開了 小鳥在唱歌');
  });

  test('「投影片」欄的歌詞也比對', async ({ app }) => {
    await app.goto();
    await app.page.locator('#song_search').fill('晚安晚安');
    await expect(app.visibleRows()).toHaveCount(1);
    await expect(app.visibleRows().first().locator('.lyric_match')).toHaveText('晚安晚安');
  });

  test('歌名符合時不顯示歌詞；歌名與歌詞都符合的一起列出', async ({ app }) => {
    await app.goto();
    await app.page.locator('#song_search').fill('花');
    await expect(app.visibleRows()).toHaveCount(2);
    const garden = app.page.locator('#song_list tr[data-target="3"]');
    await expect(garden).toBeVisible();
    await expect(garden.locator('.lyric_match')).toBeHidden();
    await expect(app.page.locator('#song_list tr[data-target="1"] .lyric_match')).toHaveText('春天來了花開了');
  });

  test('清空搜尋後，歌詞那一句不再顯示', async ({ app }) => {
    await app.goto();
    const search = app.page.locator('#song_search');
    await search.fill('小鳥');
    await expect(app.page.locator('.lyric_match:visible')).toHaveCount(1);
    await search.fill('');
    await expect(app.visibleRows()).toHaveCount(3);
    await expect(app.page.locator('.lyric_match:visible')).toHaveCount(0);
  });
});
