const { test, expect } = require('../app');

// 調性顯示使用 abcjs 的結果：升降記號固定用 ♭（C 升一個半音顯示 D♭，不是 C♯）。
test.describe('移調', () => {
  test('＋ 升一個半音：半音數、網址、調性與標題一起更新', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.stepTranspose(1);

    await expect(app.transposeValue()).toHaveText('1');
    expect(await app.hashParams()).toEqual({ song_id: '1', transpose: '1' });
    await expect(app.currentTone()).toHaveText('D♭');
    await expect(app.page).toHaveTitle('測試歌一 (D♭)');
  });

  test('− 降一個半音', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.stepTranspose(-1);

    await expect(app.transposeValue()).toHaveText('-1');
    expect(await app.hashParams()).toEqual({ song_id: '1', transpose: '-1' });
    await expect(app.currentTone()).toHaveText('B');
  });

  test('連續點擊會累加', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.stepTranspose(1);
    await app.stepTranspose(1);
    await expect(app.transposeValue()).toHaveText('2');
    await expect(app.currentTone()).toHaveText('D');
  });

  test('移回 0 時，網址不保留 transpose 參數', async ({ app }) => {
    await app.goto('#song_id=1&transpose=1');
    await app.stepTranspose(-1);
    await expect(app.transposeValue()).toHaveText('0');
    expect(await app.hashParams()).toEqual({ song_id: '1' });
    await expect(app.currentTone()).toHaveText('C');
  });

  test('小調也會正確移調（Am 升兩個半音為 Bm）', async ({ app }) => {
    await app.goto('#song_id=4&transpose=2');
    await expect(app.currentTone()).toHaveText('Bm');
  });

  test('移調 ±12 回到原調', async ({ app }) => {
    await app.goto('#song_id=1&transpose=12');
    await expect(app.currentTone()).toHaveText('C');
    await app.goto('#song_id=1&transpose=-12');
    await expect(app.currentTone()).toHaveText('C');
  });

  test('移調後樂譜會重新渲染', async ({ app }) => {
    await app.goto('#song_id=1');
    const before = await app.page.locator('#score_paper').innerHTML();
    await app.stepTranspose(1);
    await expect(app.currentTone()).toHaveText('D♭');
    const after = await app.page.locator('#score_paper').innerHTML();
    expect(after).not.toBe(before);
  });

  // 現況：移調值存在網址裡，所以用上一首／下一首換歌時會沿用。
  test('換歌時沿用目前的移調值（現況）', async ({ app }) => {
    await app.goto('#song_id=1&transpose=2');
    await app.page.locator('.change-song.next').click();
    await expect(app.currentSongId()).toHaveText('2');
    await expect(app.transposeValue()).toHaveText('2');
    await expect(app.currentTone()).toHaveText('A');
    expect(await app.hashParams()).toEqual({ song_id: '2', transpose: '2' });
  });

  test('移調選單平常收起，點 icon 才出現；連續按 ＋／− 選單不會收起，點外面才收起', async ({ app }) => {
    await app.goto('#song_id=1');
    const menu = app.page.locator('#transpose-menu');
    await expect(menu).toHaveClass(/hide/);
    await expect(app.page.locator('#transpose_button')).toHaveAttribute('aria-label', '移調');

    await expect(app.page.locator('#transpose_button')).toHaveAttribute('aria-expanded', 'false');
    await app.page.locator('#transpose_button').click();
    await expect(menu).not.toHaveClass(/hide/);
    await expect(app.page.locator('#transpose_button')).toHaveAttribute('aria-expanded', 'true');
    await menu.locator('.step-button[data-add="+1"]').click();
    await menu.locator('.step-button[data-add="+1"]').click();
    await expect(menu).not.toHaveClass(/hide/);
    await expect(app.transposeValue()).toHaveText('2');
    // 點到選單的內距也不會收起
    await menu.click({ position: { x: 2, y: 2 } });
    await expect(menu).not.toHaveClass(/hide/);

    await app.page.mouse.click(10, 300);
    await expect(menu).toHaveClass(/hide/);
    await expect(app.page.locator('#transpose_button')).toHaveAttribute('aria-expanded', 'false');
    await expect(app.popup()).toHaveClass(/open/);
  });

  test('調性按鈕右上角顯示目前的半音數，0 時不顯示', async ({ app }) => {
    const badge = app.page.locator('#transpose_badge');
    await app.goto('#song_id=1&transpose=2');
    await expect(badge).toHaveText('+2');
    await app.goto('#song_id=1&transpose=-3');
    await expect(badge).toHaveText('-3');
    await app.goto('#song_id=1');
    await expect(badge).toHaveText('');
  });

  test('可以只用鍵盤移調：Enter 打開選單，Tab 到 ＋ 再按 Enter', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.page.locator('#transpose_button').focus();
    await app.page.keyboard.press('Enter');
    await expect(app.page.locator('#transpose-menu')).not.toHaveClass(/hide/);
    await app.page.locator('#transpose-menu .step-button[data-add="+1"]').focus();
    await app.page.keyboard.press('Enter');
    await expect(app.transposeValue()).toHaveText('1');
    expect(await app.hashParams()).toEqual({ song_id: '1', transpose: '1' });
    await expect(app.page.locator('#transpose-menu')).not.toHaveClass(/hide/);
  });

  test('移調選單開著時，其他按鈕照樣能按（例如播放），選單同時收起', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.openTranspose();
    await app.page.locator('label.play-button').click();
    await expect(app.page.locator('#player-set')).not.toHaveClass(/hide/);
    await expect(app.page.locator('#transpose-menu')).toHaveClass(/hide/);
  });

  test('移調選單可以按 Esc 收起，焦點留在調性按鈕', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.page.locator('#transpose_button').focus();
    await app.page.keyboard.press('Enter');
    await expect(app.page.locator('#transpose-menu')).not.toHaveClass(/hide/);
    await app.page.locator('#transpose-menu .step-button[data-add="+1"]').focus();
    await app.page.keyboard.press('Escape');
    await expect(app.page.locator('#transpose-menu')).toHaveClass(/hide/);
    await expect(app.page.locator('#transpose_button')).toBeFocused();
  });

  test('移調選單開著時關閉譜面，下一首打開時選單是收起的', async ({ app }) => {
    await app.goto('#song_id=1');
    await app.openTranspose();
    await expect(app.page.locator('#transpose_button')).toHaveAttribute('aria-expanded', 'true');
    // 選單沒有遮罩，開著時也能直接按 ✕
    await app.page.getByLabel('關閉').click();
    await expect(app.popup()).not.toHaveClass(/open/);
    await app.openScore('2');
    await expect(app.page.locator('#transpose-menu')).toHaveClass(/hide/);
    await expect(app.page.locator('#transpose_button')).toHaveAttribute('aria-expanded', 'false');
  });

  test('「調性:」和調號在同一條基線上，中間隔一個空白，移調數字在調號右上角', async ({ app }) => {
    await app.goto('#song_id=1&transpose=1');
    await expect(app.currentTone()).toHaveText('D♭');
    await expect(app.page.locator('#transpose_button')).toHaveText(/調性: D♭/);
    const box = await app.page.evaluate(() => {
      const r = (sel) => document.querySelector(sel).getBoundingClientRect();
      // 用一個不佔位置的零寬元素量文字基線
      const baseline = (sel) => {
        const probe = document.createElement('span');
        probe.style.cssText = 'display:inline-block;width:0;height:0;';
        document.querySelector(sel).appendChild(probe);
        const y = probe.getBoundingClientRect().bottom;
        probe.remove();
        return y;
      };
      return { label: baseline('.key-label'), tone: baseline('#current_visual_tone'),
        tone_box: r('#current_visual_tone'), badge: r('#transpose_badge') };
    });
    expect(Math.abs(box.label - box.tone)).toBeLessThan(1);
    // 移調數字在調號的右上角：右邊超出調號一點，上緣比調號高
    expect(box.badge.right).toBeGreaterThan(box.tone_box.right);
    expect(box.badge.right - box.tone_box.right).toBeLessThan(12);
    expect(box.badge.top).toBeLessThan(box.tone_box.top);
  });

  test('調性有 ♭ 時，調性按鈕和工具列的高度不變', async ({ app }) => {
    const heights = () => app.page.evaluate(() =>
      ['#transpose_button', '#score_popup_top_bar']
        .map((sel) => Math.round(document.querySelector(sel).getBoundingClientRect().height * 10) / 10));
    await app.goto('#song_id=1');
    await expect(app.currentTone()).toHaveText('C');
    const base = await heights();
    for (const [hash, tone] of [['#song_id=1&transpose=1', 'D♭'], ['#song_id=4&transpose=1', 'B♭m'], ['#song_id=1&transpose=2', 'D']]) {
      await app.goto(hash);
      await expect(app.currentTone()).toHaveText(tone);
      expect(await heights(), hash).toEqual(base);
    }
  });
});
