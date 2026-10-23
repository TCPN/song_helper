const { test, expect } = require('../app');

// 工具列「排版」選單的面板：行間距均等化（#42）、行距（#41）、譜面寬度（#38）、歌詞字級（#39）、和弦字級（#40）
test.describe('排版設定', () => {
  // 每行的音符都一樣（五線譜底線的位置相同），只有第 2 行有三段歌詞，比其他行需要更多空間
  const bar = 'CDEF|GFED|CDEF|GFED|\n';
  const SONG = { id: 1, name: '排版測試', tone: 'C', timesig: '4/4', melody: 'CDEF',
    abc: 'X:1\nT:Layout\nM:4/4\nL:1/4\nK:C\n' + bar + bar + 'w:a b c d e f g h i j k l m n o p\n'
      + 'w:a b c d e f g h i j k l m n o p\nw:a b c d e f g h i j k l m n o p\n' + bar + 'C4|]\n' };
  const LONG = { id: 2, name: '長譜測試', tone: 'C', timesig: '4/4', melody: 'CDEF',
    abc: 'X:2\nT:Long\nM:4/4\nL:1/4\nK:C\n' + bar.repeat(30) + 'C4|]\n' };
  // 自編的多段歌詞長歌：有和弦、每行四小節、三段歌詞
  const verse = 'w:la la la la la la la la la la la la la la la la\nw:lo lo lo lo lo lo lo lo lo lo lo lo lo lo lo lo\nw:li li li li li li li li li li li li li li li li\n';
  const VERSES = { id: 3, name: '多段歌詞測試', tone: 'G', timesig: '4/4', melody: 'GABc',
    abc: 'X:3\nT:Verses\nM:4/4\nL:1/4\nK:G\n' + ('"G"GABc|"C"cBAG|"D7"ABcd|"G"G4|\n' + verse).repeat(12) };
  // 每行長短不一：第 1 行音符很多，第 2 行有長音，最後一行只有兩小節
  const UNEVEN = { id: 4, name: '長短不一測試', tone: 'C', timesig: '4/4', melody: 'CEEE',
    abc: 'X:4\nT:Uneven\nM:4/4\nL:1/8\nK:C\n' + '"C"zEEE E2DC|zEEE EEDC|"F"zEEE E2DC|zEEE EEDC|\nw:a b c d e f g h i j k l m n o p q r s t u v w x y z\n'
      + '"Am"zDDE DCC2|"G"zDDE DCC2|"F"C8|z8|\n' + '"C"E2E2 G2G2|c8|]\n' };
  test.use({ songs: [[SONG, LONG, VERSES, UNEVEN], { option: true }] });

  const panel = (app) => app.page.locator('#layout-panel');
  const toggle = (app) => app.page.locator('#layout-panel [data-layout-toggle="equalize"]');
  const gap_value = (app) => app.page.locator('#layout-panel [data-layout-value="line_gap"]');
  const gap_button = (app, steps) => app.page.locator(`#layout-panel [data-layout-step="line_gap"][data-steps="${steps}"]`);
  // 每行 svg 的 viewBox 高度
  const value = (app, key) => app.page.locator(`#layout-panel [data-layout-value="${key}"]`);
  const step = (app, key, steps) => app.page.locator(`#layout-panel [data-layout-step="${key}"][data-steps="${steps}"]`);
  // 每行 svg 的 viewBox 寬度（abcjs 的 staffwidth 加上左右邊界）與畫面上的高度
  const widths = (app) => app.page.locator('#score_paper .abcjs-container svg')
    .evaluateAll((svgs) => svgs.map((svg) => svg.viewBox.baseVal.width));
  const screen_heights = (app) => app.page.locator('#score_paper .abcjs-container svg')
    .evaluateAll((svgs) => svgs.map((svg) => svg.getBoundingClientRect().height));
  const font_size = (app, selector) => app.page.locator(`#score_paper ${selector}`).first()
    .evaluate((elem) => Number(elem.getAttribute('font-size')));
  const heights = (app) => app.page.locator('#score_paper .abcjs-container svg')
    .evaluateAll((svgs) => svgs.map((svg) => svg.viewBox.baseVal.height));

  const expect_heights = (actual, expected) => {
    expect(actual.length).toBe(expected.length);
    actual.forEach((h, i) => expect(h).toBeCloseTo(expected[i], 1));
  };

  // 工具列不夠寬時「排版」收在 ⋮ 選單裡，從 ⋮ 打開
  async function open_panel(app) {
    if (await app.page.locator('#layout_button').isVisible()) {
      await app.page.locator('#layout_button').click();
    } else {
      await app.page.locator('#more_button').click();
      await app.page.locator('#more-menu [data-open-menu="#layout_button"]').click();
    }
    await expect(panel(app)).not.toHaveClass(/hide/);
  }

  test('工具列「檢視」右邊有「排版」選單，點了出現面板，預設均等化、行距 0', async ({ app }) => {
    await app.goto('#song_id=1');
    // 「排版」不在「檢視」選單裡，是工具列上和「檢視」同級的按鈕，排在「檢視」右邊
    await app.page.locator('#view_button').click();
    await expect(app.page.locator('#view-menu .menu-item')).not.toContainText(['排版']);
    await app.page.locator('#view_button').click();
    const view = await app.page.locator('#view_button').boundingBox();
    const button = await app.page.locator('#layout_button').boundingBox();
    expect(button.x).toBeGreaterThan(view.x + view.width);
    expect(Math.abs(button.y - view.y)).toBeLessThan(2);
    await expect(app.page.locator('#layout_button')).toHaveText('排版');
    await expect(app.page.locator('#layout_button')).toHaveAttribute('aria-expanded', 'false');
    await app.page.locator('#layout_button').click();
    await expect(panel(app)).not.toHaveClass(/hide/);
    await expect(app.page.locator('#layout_button')).toHaveAttribute('aria-expanded', 'true');
    // 面板在按鈕正下方、左邊對齊按鈕
    const box = await panel(app).boundingBox();
    expect(box.y).toBeGreaterThan(button.y + button.height);
    expect(Math.abs(box.x - button.x)).toBeLessThan(2);
    await expect(app.page.locator('#layout-panel .layout-label')).toHaveText(['行間距均等化', '行距', '譜面寬度', '歌詞字級', '和弦字級']);
    await expect(toggle(app)).toHaveAttribute('aria-checked', 'true');
    await expect(toggle(app)).toHaveText('開');
    await expect(gap_value(app)).toHaveText('0');
    await expect(value(app, 'staff_width')).toHaveText('740');
    await expect(value(app, 'lyric_size')).toHaveText('13');
    await expect(value(app, 'chord_size')).toHaveText('12');
  });

  // 第 1 行上面有標題，比較高；第 2 行有三段歌詞，第 3 行沒有歌詞
  test('均等化（預設）：除了最後一行，五線譜下方的空間都一樣；關掉後每行只占自己需要的高度', async ({ app }) => {
    await app.goto('#song_id=1');
    const before = await heights(app);
    expect(before.length).toBe(4);
    expect(before[2]).toBeCloseTo(before[1], 1);

    await open_panel(app);
    await toggle(app).click();
    await expect(toggle(app)).toHaveAttribute('aria-checked', 'false');
    await expect(toggle(app)).toHaveText('關');
    const after = await heights(app);
    expect(after[1]).toBeCloseTo(before[1], 1);
    expect(after[0]).toBeLessThan(before[0] - 10);
    expect(after[2]).toBeLessThan(before[2] - 10);
    expect(after[3]).toBeCloseTo(before[3], 1);
    // 面板還開著，可以繼續調
    await expect(panel(app)).not.toHaveClass(/hide/);

    await toggle(app).click();
    expect_heights(await heights(app), before);
  });

  test('行距：每按一下＋，最後一行以外的每行都加高，最小是 0', async ({ app }) => {
    await app.goto('#song_id=1');
    const before = await heights(app);
    await open_panel(app);
    await gap_button(app, 1).click();
    await gap_button(app, 1).click();
    await expect(gap_value(app)).toHaveText('10');
    const after = await heights(app);
    for (let i = 0; i < 3; i++) expect(after[i]).toBeCloseTo(before[i] + 10, 1);
    expect(after[3]).toBeCloseTo(before[3], 1);

    for (let i = 0; i < 2; i++) await gap_button(app, -1).click();
    await expect(gap_value(app)).toHaveText('0');
    await expect(gap_button(app, -1)).toHaveAttribute('aria-disabled', 'true');
    expect_heights(await heights(app), before);
  });

  test('重設回到預設值', async ({ app }) => {
    await app.goto('#song_id=1');
    const before = await heights(app);
    await open_panel(app);
    await toggle(app).click();
    await gap_button(app, 1).click();
    await step(app, 'staff_width', 1).click();
    await step(app, 'lyric_size', 1).click();
    await step(app, 'chord_size', -1).click();
    await app.page.locator('#layout_reset').click();
    await expect(toggle(app)).toHaveAttribute('aria-checked', 'true');
    await expect(gap_value(app)).toHaveText('0');
    await expect(value(app, 'staff_width')).toHaveText('740');
    await expect(value(app, 'lyric_size')).toHaveText('13');
    await expect(value(app, 'chord_size')).toHaveText('12');
    expect_heights(await heights(app), before);
    expect((await widths(app))[0]).toBeCloseTo(770, 0);
    expect(JSON.parse(await app.page.evaluate(() => localStorage.getItem('score_layout'))))
      .toEqual({ equalize: true, line_gap: 0, staff_width: 740, lyric_size: 13, chord_size: 12 });
  });

  test('設定所有歌共用，記在瀏覽器，重新載入或換歌都沿用，網址 hash 不變', async ({ app }) => {
    await app.goto('#song_id=1');
    await open_panel(app);
    await toggle(app).click();
    await gap_button(app, 1).click();
    const set = await heights(app);
    expect(await app.hashParams()).toEqual({ song_id: '1' });
    expect(JSON.parse(await app.page.evaluate(() => localStorage.getItem('score_layout'))))
      .toEqual({ equalize: false, line_gap: 5, staff_width: 740, lyric_size: 13, chord_size: 12 });

    await app.page.reload();
    await app.ready();
    expect_heights(await heights(app), set);
    await open_panel(app);
    await expect(toggle(app)).toHaveAttribute('aria-checked', 'false');
    await expect(gap_value(app)).toHaveText('5');

    // 移調、換歌（重新渲染）也用同樣的設定：沒有歌詞的第 3 行比第 2 行矮
    await app.page.keyboard.press('Escape');
    await app.goto('#song_id=1&transpose=2');
    const transposed = await heights(app);
    expect(transposed[2]).toBeLessThan(transposed[1] - 10);
  });

  test('localStorage 裡的值不對時用預設值', async ({ app }) => {
    await app.page.addInitScript(() => {
      localStorage.setItem('score_layout', '{"equalize":"no","line_gap":-50,"staff_width":3000,"lyric_size":"big"}');
    });
    await app.goto('#song_id=1');
    await open_panel(app);
    await expect(toggle(app)).toHaveAttribute('aria-checked', 'true');
    await expect(gap_value(app)).toHaveText('0');
    await expect(value(app, 'staff_width')).toHaveText('1500');
    await expect(value(app, 'lyric_size')).toHaveText('13');
  });

  test('和其他選單一樣：點面板外面收起，點面板裡面不收起', async ({ app }) => {
    await app.goto('#song_id=1');
    await open_panel(app);
    await app.page.locator('#layout-panel .layout-label').first().click();
    await expect(panel(app)).not.toHaveClass(/hide/);
    await app.page.locator('#score_page').click({ position: { x: 20, y: 400 } });
    await expect(panel(app)).toHaveClass(/hide/);
    await expect(app.page.locator('#layout_button')).toHaveAttribute('aria-expanded', 'false');
    await expect(app.popup()).toHaveClass(/open/);
  });

  test('再點一次「排版」收起面板', async ({ app }) => {
    await app.goto('#song_id=1');
    await open_panel(app);
    await app.page.locator('#layout_button').click();
    await expect(panel(app)).toHaveClass(/hide/);
    await expect(app.page.locator('#layout_button')).toHaveAttribute('aria-expanded', 'false');
  });

  test('面板開著時點「檢視」：面板收起、「檢視」選單打開', async ({ app }) => {
    await app.goto('#song_id=1');
    await open_panel(app);
    await app.page.locator('#view_button').click();
    await expect(panel(app)).toHaveClass(/hide/);
    await expect(app.page.locator('#layout_button')).toHaveAttribute('aria-expanded', 'false');
    await expect(app.page.locator('#view-menu')).not.toHaveClass(/hide/);
    await expect(app.page.locator('#view_button')).toHaveAttribute('aria-expanded', 'true');
  });

  test('可以只用鍵盤操作：Enter 打開、Tab 進面板、Esc 收起後焦點回到「排版」', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.page.locator('#layout_button').focus();
    await app.page.keyboard.press('Enter');
    await expect(panel(app)).not.toHaveClass(/hide/);
    await app.page.keyboard.press('Tab');
    await expect(toggle(app)).toBeFocused();
    await app.page.keyboard.press(' ');
    await expect(toggle(app)).toHaveAttribute('aria-checked', 'false');
    await app.page.keyboard.press('Tab');
    await app.page.keyboard.press('Tab');
    await expect(gap_button(app, 1)).toBeFocused();
    await app.page.keyboard.press('Enter');
    await expect(gap_value(app)).toHaveText('5');
    await app.page.keyboard.press('Escape');
    await expect(panel(app)).toHaveClass(/hide/);
    await expect(app.page.locator('#layout_button')).toBeFocused();
  });

  test('關閉譜面時面板收起，下一首打開時是收起的', async ({ app }) => {
    await app.goto('#song_id=1');
    await open_panel(app);
    await app.page.locator('#close_score_button').click();
    await app.goto('#song_id=2');
    await expect(panel(app)).toHaveClass(/hide/);
  });

  test('改設定時，畫面最上面的那一行留在原本的位置', async ({ app }) => {
    await app.goto('#song_id=2');
    const win = app.page.locator('#score_popup_window');
    await win.evaluate((w) => { w.scrollTop = 600; });
    // 畫面最上面看得到的那一行
    const top_line = () => app.page.evaluate(() => {
      const top = document.querySelector('#score_popup_window').getBoundingClientRect().top;
      const lines = Array.from(document.querySelectorAll('#score_paper .abcjs-container'));
      const i = lines.findIndex((l) => l.getBoundingClientRect().bottom > top);
      return { i, y: lines[i].getBoundingClientRect().top };
    });
    const before = await top_line();
    expect(before.i).toBeGreaterThan(3);
    await open_panel(app);
    await gap_button(app, 1).click();
    await expect(gap_value(app)).toHaveText('5');
    const after = await top_line();
    expect(after.i).toBe(before.i);
    expect(after.y).toBeCloseTo(before.y, 0);
  });

  test('譜面寬度：每按一下＋多 40，排版寬度變寬、每行在畫面上變矮，換行位置不變', async ({ app }) => {
    await app.goto('#song_id=3');
    const lines = (await widths(app)).length;
    expect((await widths(app))[0]).toBeCloseTo(770, 0);
    const before = await screen_heights(app);
    await open_panel(app);
    await step(app, 'staff_width', 1).click();
    await step(app, 'staff_width', 1).click();
    await expect(value(app, 'staff_width')).toHaveText('820');
    // staffwidth 820 加上左右邊界 30
    await expect.poll(async () => (await widths(app))[0]).toBeCloseTo(850, 0);
    const after = await screen_heights(app);
    expect(after.length).toBe(lines);
    for (let i = 0; i < lines; i++) expect(after[i]).toBeLessThan(before[i]);
    // 面板還開著，可以繼續調
    await expect(panel(app)).not.toHaveClass(/hide/);

    for (let i = 0; i < 2; i++) await step(app, 'staff_width', -1).click();
    await expect(value(app, 'staff_width')).toHaveText('740');
    expect_heights(await screen_heights(app), before);
  });

  test('歌詞字級、和弦字級：每按一下大一級，預設是 abcjs 原本的大小', async ({ app }) => {
    await app.goto('#song_id=3');
    // abcjs 的字級是 pt，svg 上是 px（× 4/3）
    expect(await font_size(app, '.abcjs-lyric')).toBeCloseTo(13 * 4 / 3, 1);
    expect(await font_size(app, '.abcjs-chord')).toBeCloseTo(12 * 4 / 3, 1);
    const lyric_weight = await app.page.locator('#score_paper .abcjs-lyric').first().getAttribute('font-weight');
    await open_panel(app);
    await step(app, 'lyric_size', 1).click();
    await step(app, 'lyric_size', 1).click();
    await expect(value(app, 'lyric_size')).toHaveText('15');
    await expect.poll(() => font_size(app, '.abcjs-lyric')).toBeCloseTo(15 * 4 / 3, 1);
    expect(await app.page.locator('#score_paper .abcjs-lyric').first().getAttribute('font-weight')).toBe(lyric_weight);
    expect(await font_size(app, '.abcjs-chord')).toBeCloseTo(12 * 4 / 3, 1);

    await step(app, 'chord_size', -1).click();
    await expect(value(app, 'chord_size')).toHaveText('11');
    await expect.poll(() => font_size(app, '.abcjs-chord')).toBeCloseTo(11 * 4 / 3, 1);
    expect(await font_size(app, '.abcjs-lyric')).toBeCloseTo(15 * 4 / 3, 1);
  });

  test('重新渲染後仍套用均等化與行距，和用同樣設定重新載入的結果一樣', async ({ app }) => {
    await app.goto('#song_id=1');
    await open_panel(app);
    await toggle(app).click();
    await gap_button(app, 1).click();
    await step(app, 'staff_width', 1).click();
    await step(app, 'lyric_size', 1).click();
    await expect(value(app, 'lyric_size')).toHaveText('14');
    const set = await heights(app);
    // 沒有歌詞的第 3 行比第 2 行矮（不均等化）
    expect(set[2]).toBeLessThan(set[1] - 10);
    await app.page.reload();
    await app.ready();
    expect_heights(await heights(app), set);
  });

  test('重新渲染時保留移調，網址 hash 不變', async ({ app }) => {
    await app.goto('#song_id=3&transpose=2');
    const key = await app.page.locator('#current_visual_tone').textContent();
    await open_panel(app);
    await step(app, 'staff_width', 1).click();
    await expect(value(app, 'staff_width')).toHaveText('780');
    await expect(app.page.locator('#current_visual_tone')).toHaveText(key);
    expect(await app.hashParams()).toEqual({ song_id: '3', transpose: '2' });
  });

  // 每行最右邊的小節線位置與 viewBox 寬度
  const line_fill = (app) => app.page.locator('#score_paper .abcjs-container svg').evaluateAll((svgs) => svgs.map((svg) => {
    const bars = Array.from(svg.querySelectorAll('.abcjs-bar')).map((b) => b.getBBox().x + b.getBBox().width);
    return { width: svg.viewBox.baseVal.width, right: Math.max(...bars) };
  }));

  test('每行都拉滿（短的行和最後一行也是）', async ({ app }) => {
    await app.goto('#song_id=4');
    await open_panel(app);
    for (const steps of [0, 8]) {
      for (let i = 0; i < steps; i++) await step(app, 'staff_width', 1).click();
      await expect(value(app, 'staff_width')).toHaveText(steps ? '1060' : '740');
      for (const line of await line_fill(app)) expect(line.right).toBeGreaterThan(line.width - 20);
    }
  });

  test('譜面寬度太窄、有行塞不下時，用這首歌最小的寬度：每行一樣大，面板顯示實際的寬度，「−」不能再按', async ({ app }) => {
    await app.goto('#song_id=4');
    await open_panel(app);
    const minus = step(app, 'staff_width', -1);
    await expect(minus).toHaveAttribute('aria-disabled', 'false');
    // 一直往下調，到這首歌最小的寬度就停住（第 1 行音符很多，塞不進 740 的一半）
    for (let i = 0; i < 12 && (await minus.getAttribute('aria-disabled')) != 'true'; i++) await minus.click();
    await expect(minus).toHaveAttribute('aria-disabled', 'true');
    const min = Number(await value(app, 'staff_width').textContent());
    expect(min).toBeGreaterThan(400);
    expect(min).toBeLessThan(740);
    const lines = await line_fill(app);
    // 面板顯示的就是實際用的寬度（viewBox 寬度是它加上左右邊界）
    expect(lines[0].width).toBeCloseTo(min + 30, -1);
    for (const line of lines) {
      expect(line.width).toBeCloseTo(lines[0].width, 0);
      // 撐寬的那行比其他行寬一點點（不到 1%），其他行右邊留一點空
      expect(line.right).toBeGreaterThan(line.width * 0.95);
    }
    // 不能按時按了也不變（aria-disabled 的按鈕 Playwright 不會點，直接送 click 事件）；＋ 從顯示的值往上對齊到下一格
    await minus.dispatchEvent('click');
    await expect(value(app, 'staff_width')).toHaveText(String(min));
    await step(app, 'staff_width', 1).click();
    const next = 300 + Math.floor((min - 300) / 40 + 1) * 40;
    await expect(value(app, 'staff_width')).toHaveText(String(next));
    await expect(minus).toHaveAttribute('aria-disabled', 'false');
  });

  test('改譜面寬度或字級只重畫譜面：不重建播放器、不捲動後面的歌單', async ({ app }) => {
    await app.goto('#song_id=3');
    await app.page.evaluate(() => {
      document.querySelector('#player-control').firstElementChild.dataset.marker = 'kept';
      window.scrollTo(0, 0);
      window.__scrolled = 0;
      window.addEventListener('scroll', () => { window.__scrolled++; });
    });
    await open_panel(app);
    await step(app, 'staff_width', 1).click();
    await step(app, 'lyric_size', 1).click();
    await expect(value(app, 'lyric_size')).toHaveText('14');
    await expect(app.page.locator('#player-control [data-marker="kept"]')).toHaveCount(1);
    expect(await app.page.evaluate(() => window.__scrolled)).toBe(0);
  });

  test('改譜面寬度或字級（重新渲染）時，畫面最上面的那一行留在原本的位置', async ({ app }) => {
    await app.goto('#song_id=3');
    const win = app.page.locator('#score_popup_window');
    await win.evaluate((w) => { w.scrollTop = 800; });
    const top_line = () => app.page.evaluate(() => {
      const top = document.querySelector('#score_popup_window').getBoundingClientRect().top;
      const lines = Array.from(document.querySelectorAll('#score_paper .abcjs-container'));
      const i = lines.findIndex((l) => l.getBoundingClientRect().bottom > top);
      return { i, y: lines[i].getBoundingClientRect().top };
    });
    let before = await top_line();
    expect(before.i).toBeGreaterThan(2);
    await open_panel(app);
    // 捲動位置是整數，每次可能差不到 1px
    for (const [key, steps, text] of [['staff_width', 1, '780'], ['lyric_size', 1, '14'], ['chord_size', 1, '13']]) {
      await step(app, key, steps).click();
      await expect(value(app, key)).toHaveText(text);
      const after = await top_line();
      expect(after.i).toBe(before.i);
      expect(Math.abs(after.y - before.y)).toBeLessThan(1);
      before = after;
    }
  });

  test('到了範圍的上下限，「−」／「＋」不能按', async ({ app }) => {
    await app.goto('#song_id=1');
    await open_panel(app);
    // 行距預設 0 是下限
    await expect(gap_button(app, -1)).toHaveAttribute('aria-disabled', 'true');
    await expect(gap_button(app, 1)).toHaveAttribute('aria-disabled', 'false');
    const plus = step(app, 'staff_width', 1);
    for (let i = 0; i < 25 && (await plus.getAttribute('aria-disabled')) != 'true'; i++) await plus.click();
    await expect(value(app, 'staff_width')).toHaveText('1500');
    await expect(plus).toHaveAttribute('aria-disabled', 'true');
    await expect(step(app, 'staff_width', -1)).toHaveAttribute('aria-disabled', 'false');
    // 不能按時按了也不變（aria-disabled 的按鈕 Playwright 不會點，直接送 click 事件）
    await plus.dispatchEvent('click');
    await expect(value(app, 'staff_width')).toHaveText('1500');
  });

  test('工具列不夠寬時「排版」收進 ⋮，從 ⋮ 打開的面板不超出畫面，可以用鍵盤操作', async ({ app }) => {
    await app.page.setViewportSize({ width: 280, height: 600 });
    await app.goto('#song_id=1');
    await expect(app.page.locator('#score_popup_top_bar')).toHaveClass(/compact/);
    await expect(app.page.locator('#layout_button')).toBeHidden();
    await app.page.locator('#more_button').focus();
    await app.page.keyboard.press('Enter');
    await app.page.locator('#more-menu [data-open-menu="#layout_button"]').focus();
    await app.page.keyboard.press('Enter');
    await expect(app.page.locator('#more-menu')).toHaveClass(/hide/);
    await expect(panel(app)).not.toHaveClass(/hide/);
    await expect(toggle(app)).toBeFocused();
    const box = await panel(app).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(280);
    await app.page.keyboard.press('Escape');
    await expect(panel(app)).toHaveClass(/hide/);
    await expect(app.page.locator('#more_button')).toBeFocused();
  });

  test('手機寬度（375px）：面板不超出畫面，控制項都在同一列', async ({ app }) => {
    await app.page.setViewportSize({ width: 375, height: 667 });
    await app.goto('#song_id=1');
    await open_panel(app);
    const box = await panel(app).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    const rows = await app.page.locator('#layout-panel .layout-row')
      .evaluateAll((list) => list.map((r) => r.getBoundingClientRect().height));
    for (const h of rows) expect(h).toBeLessThan(40);
  });
});
