const { test, expect } = require('../app');

// 一般（不是浮在內容上的）捲軸：headless Chromium 預設隱藏捲軸，這裡打開，量得到捲軸占的寬度。
// launchOptions 會換一個 worker，所以放在自己的檔案
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test.describe('符合寬度時有垂直捲軸', () => {
  const line = (i) => `"C"CDEF|"G"GFED|"C"CDEF|"G"GFED|\nw:l${i} b c d e f g h i j k l m n o p\n`;
  const LONG = { id: 1, name: '長譜測試', tone: 'C', timesig: '4/4', melody: 'CDEF',
    abc: 'X:1\nT:Long\nM:4/4\nL:1/4\nK:C\n' + Array.from({ length: 30 }, (_, i) => line(i)).join('') + 'C4|]\n' };
  test.use({ songs: [[LONG], { option: true }] });

  for (const paper of ['a4', 'content']) {
    test(`譜紙貼齊捲軸以外的寬度，不出現橫向捲軸（${paper == 'a4' ? '分頁' : '不分頁'}）`, async ({ app }) => {
      await app.page.setViewportSize({ width: 1024, height: 600 });
      await app.page.addInitScript((p) => { localStorage.setItem('score_paper_mode', p); }, paper);
      await app.goto('#song_id=1');
      const size = await app.page.locator('#score_popup_window').evaluate((win) => ({
        offset: win.offsetWidth, client: win.clientWidth, scroll: win.scrollWidth,
        scroll_y: win.scrollHeight > win.clientHeight,
        page: document.querySelector('#score_page').getBoundingClientRect().width,
      }));
      expect(size.scroll_y).toBe(true);
      // 捲軸真的占了寬度，這個測試才有意義
      expect(size.client).toBeLessThan(size.offset);
      expect(size.page).toBeCloseTo(size.client, 0);
      expect(size.scroll).toBe(size.client);
    });
  }
});
