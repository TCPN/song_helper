const { test, expect } = require('../app');

// 已知問題：這裡的測試寫的是「應有的行為」，目前會失敗，所以標成 test.fail()。
// 修好之後 Playwright 會回報「預期失敗但通過了」，這時把 test.fail() 那行刪掉即可。
// 這些測試都不會讓整體變紅；它們是待辦清單，也是修好後的回歸測試。
test.describe('已知問題：搜尋', () => {
  test.use({ allowPageErrors: true });

  test('搜尋框輸入 "(" 這類正規表達式特殊字元，不應該拋出錯誤', async ({ app }) => {
    test.fail(true, 'filter_song 直接把輸入當成正規表達式，"(" 會丟出 SyntaxError');
    await app.goto();
    await app.page.locator('#song_search').fill('(');
    expect(app.errors).toEqual([]);
  });
});

// 根本原因：script.js 載入到第 16 行就呼叫 renderWithCachedData()，
// 這時檔案後面的 `var scroll_tmp = {}` 等初始化、以及檔尾的事件監聽都還沒執行。
// 回訪（有快取）時，如果網址指向「沒有譜／不存在」的歌，close_score() 會用到 scroll_tmp
// 而丟出 TypeError，整支 script 在這裡中止，後面的事件監聽（hashchange、意見回饋、資訊彈窗）都沒註冊。
const CACHE_PATH_CAUSE = 'renderWithCachedData() 在 script.js 載入途中就執行，scroll_tmp 等尚未初始化，丟出 TypeError 並中止後面的初始化';

test.describe('已知問題：回訪（有快取）且網址指向無法開啟的歌', () => {
  test.use({ allowPageErrors: true });

  test('指向沒有譜的歌：不應丟出錯誤', async ({ app }) => {
    test.fail(true, CACHE_PATH_CAUSE);
    await app.seedCache();
    await app.goto('#song_id=3');
    await app.page.waitForTimeout(500);
    expect(app.errors).toEqual([]);
  });

  test('指向不存在的歌：不應丟出錯誤', async ({ app }) => {
    test.fail(true, CACHE_PATH_CAUSE);
    await app.seedCache();
    await app.goto('#song_id=999');
    await app.page.waitForTimeout(500);
    expect(app.errors).toEqual([]);
  });

  test('指向沒有譜的歌之後，改網址或點連結仍然能開啟譜面', async ({ app }) => {
    test.fail(true, CACHE_PATH_CAUSE + '（hashchange 的監聽沒註冊）');
    await app.seedCache();
    await app.goto('#song_id=3');
    await app.page.evaluate(() => { location.hash = '#song_id=1'; });
    await expect(app.popup()).toHaveClass(/open/);
  });

  test('無效 hash 的提示只應該出現一次（不是快取、最新資料各一次）', async ({ app }) => {
    test.fail(true, 'updateListUI 對快取與最新資料各呼叫一次 exec_hash，所以提示重複');
    await app.seedCache();
    await app.goto('#song_id=3');
    await app.page.waitForTimeout(500);
    expect(app.dialogs).toEqual(['No score for song 3']);
  });
});

// 以 ABCJS.renderAbc 的呼叫次數當作「渲染次數」。
const countRenders = async (app) => {
  await app.page.addInitScript(() => {
    let abcjs;
    window.__renders = 0;
    Object.defineProperty(window, 'ABCJS', {
      configurable: true,
      get: () => abcjs,
      set: (value) => {
        abcjs = value;
        if (value && value.renderAbc) {
          const original = value.renderAbc;
          value.renderAbc = function () { window.__renders += 1; return original.apply(this, arguments); };
        }
      },
    });
  });
};

test.describe('譜面渲染次數', () => {
  // 這個測試守住下面「已知問題」所用的計數方式；它壞掉代表計數失效，不是行為改變。
  test('無快取、有效 hash：只渲染一次（也確認計數方式有效）', async ({ app }) => {
    await countRenders(app);
    await app.goto('#song_id=1');
    await expect(app.popup()).toHaveClass(/open/);
    await app.page.waitForTimeout(300);
    expect(await app.page.evaluate(() => window.__renders)).toBe(1);
  });

  test('有快取、有效 hash：只應渲染一次（目前快取與最新資料各渲染一次）', async ({ app }) => {
    test.fail(true, 'updateListUI 對快取與最新資料各呼叫一次 exec_hash，譜面被重複渲染（浪費，且可能閃爍）');
    await countRenders(app);
    await app.seedCache();
    await app.goto('#song_id=1');
    await expect(app.popup()).toHaveClass(/open/);
    await app.page.waitForTimeout(300);
    expect(await app.page.evaluate(() => window.__renders)).toBe(1);
  });
});

test.describe('已知問題：資訊彈窗', () => {
  test.describe('速度單位不在對照表', () => {
    test.use({
      songs: [{ id: 1, name: '怪速度', tone: 'C', timesig: '4/4', melody: '', abc: 'X:1\nT:t\nM:4/4\nL:1/4\nQ:1/3=80\nK:C\nCDEF|]\n' }],
    });

    test('不應顯示 "undefined"', async ({ app }) => {
      test.fail(true, 'unicode_note 只有幾種單位，查不到時直接串成 "undefined=80"');
      await app.goto();
      await app.rows().nth(0).locator('td.song_name').click();
      await expect(app.infoPopup()).toHaveClass(/open/);
      await expect(app.page.locator('#info-popup-window table')).not.toContainText('undefined');
    });
  });

  test.describe('歌名含 HTML 字元', () => {
    test.use({
      songs: [{ id: 1, name: '<b>粗體</b>歌名', tone: 'C', timesig: '4/4', melody: '', abc: null }],
    });

    test('應原樣顯示成文字，不應被當成標籤', async ({ app }) => {
      test.fail(true, 'show_song_info 用 innerHTML 直接插入歌名，HTML 會被解析（試算表若有 <、& 等字元會出錯，也有 XSS 風險）');
      await app.goto();
      await app.rows().nth(0).locator('td.song_name').click();
      await expect(app.infoPopup()).toHaveClass(/open/);
      await expect(app.page.locator('#info-popup-window table')).toContainText('<b>粗體</b>歌名');
    });
  });
});
