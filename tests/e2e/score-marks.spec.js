const { test, expect } = require('../app');

// 渲染後修正的記號：跨行的連結線（#63）、和弦聲部多畫的反覆框（#64）、靠行尾的段落記號（#69）
const TIE = {
  id: 1, name: '跨行連結線', tone: 'C', timesig: '4/4', melody: '',
  abc: 'X:1\nT:Tie\nM:4/4\nL:1/4\nK:C\nC D E F-|\nF G (A B|\nc) d e f|]\n',
};
// 和弦是另一個聲部（%%score 合在同一個譜表），兩個聲部都有 [1、[2
const ENDINGS = {
  id: 2, name: '反覆框', tone: 'C', timesig: '4/4', melody: '',
  abc: 'X:2\nT:Endings\nM:4/4\nL:1/4\n%%score (1 2)\nK:C\nV:1\n|: C D E F-|F G A B-|\nV:2\n|: "C"x4|"G"x4|\n'
    + 'V:1\n[1 B B c d :|[2 d c B A|]\nV:2\n[1 "A"x4 :|[2 "D"x4|]\n',
};
const PART = {
  id: 3, name: '段落記號', tone: 'C', timesig: '4/4', melody: '',
  abc: 'X:3\nT:Part\nM:4/4\nL:1/8\nK:C\nCDEF GABc|cBAG FED[P:Chorus Refrain]C|\nC8|]\n',
};

// 第 line 行 svg 裡符合 selector 的元素的 bbox
const boxes = (app, line, selector) => app.page.locator('#score_paper svg').nth(line).evaluate((svg, selector) =>
  Array.from(svg.querySelectorAll(selector)).map((e) => {
    const b = e.getBBox();
    return { x: b.x, y: b.y, width: b.width, height: b.height, text: e.textContent };
  }), selector);

test.describe('譜面記號', () => {
  test.use({ songs: [[TIE, ENDINGS, PART], { option: true }] });

  test('跨行的連結線、圓滑線在下一行開頭也畫出接續的一段（#63）', async ({ app }) => {
    await app.goto('#song_id=1');
    // 第 2 行：開頭接續的連結線、行尾往下一行的圓滑線；第 3 行：開頭接續的圓滑線
    const line2 = await boxes(app, 1, '.abcjs-slur');
    const line3 = await boxes(app, 2, '.abcjs-slur');
    const first_note = (await boxes(app, 1, '.abcjs-note'))[0];
    expect(line2).toHaveLength(2);
    expect(line2[0].x).toBeLessThan(first_note.x);
    expect(line3).toHaveLength(1);
  });

  test('和弦聲部的反覆框不重複畫（#64）', async ({ app }) => {
    await app.goto('#song_id=2');
    const texts = (await boxes(app, 1, '.abcjs-ending')).filter((b) => b.text).map((b) => b.text);
    expect(texts).toEqual(['1', '2']);
  });

  test('靠近行尾的段落記號不超出譜的右邊界（#69）', async ({ app }) => {
    await app.goto('#song_id=3');
    const [staff] = await boxes(app, 0, '.abcjs-top-line');
    const [part] = await boxes(app, 0, '.abcjs-part');
    const [frame] = await boxes(app, 0, '.abcjs-part + rect');
    expect(part.text).toBe('Chorus Refrain');
    expect(frame.x + frame.width).toBeLessThanOrEqual(staff.x + staff.width + 0.5);
    expect(frame.x).toBeLessThanOrEqual(part.x);
  });
});
