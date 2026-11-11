import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AUTO_LAYOUT, normalize_auto_layout, parse_auto_layout, step_auto_layout, auto_layout_at_limit,
  text_width, wrap_line, page_sizes, auto_layout_text } from '../../js/auto-layout.js';

test('normalize／parse：不認識的欄位丟掉、超出範圍拉回、最多行數不少於每頁行數；壞掉的 JSON 用預設', () => {
  assert.deepEqual(normalize_auto_layout(null), DEFAULT_AUTO_LAYOUT);
  assert.deepEqual(normalize_auto_layout({ lines: 99, max_lines: 2, width: 1, x: 1 }), { lines: 12, max_lines: 12, width: 4 });
  assert.deepEqual(normalize_auto_layout({ lines: '3', width: 10.4 }), { ...DEFAULT_AUTO_LAYOUT, width: 10 });
  assert.deepEqual(parse_auto_layout('{'), DEFAULT_AUTO_LAYOUT);
  assert.deepEqual(parse_auto_layout('{"lines":2,"max_lines":3,"width":12}'), { lines: 2, max_lines: 3, width: 12 });
});

test('step：每頁行數加到超過最多行數時最多行數跟著加；最多行數減到少於每頁行數時每頁行數跟著減', () => {
  assert.deepEqual(step_auto_layout({ lines: 4, max_lines: 4, width: 16 }, 'lines', 1), { lines: 5, max_lines: 5, width: 16 });
  assert.deepEqual(step_auto_layout({ lines: 4, max_lines: 4, width: 16 }, 'max_lines', -1), { lines: 3, max_lines: 3, width: 16 });
  assert.deepEqual(step_auto_layout({ lines: 1, max_lines: 1, width: 4 }, 'width', -1), { lines: 1, max_lines: 1, width: 4 });
  assert.equal(auto_layout_at_limit({ width: 4 }, 'width', -1), true);
  assert.equal(auto_layout_at_limit({ width: 4 }, 'width', 1), false);
});

test('text_width：中文、全形 1，英數、半形空格 0.5；空格照顯示方式', () => {
  assert.equal(text_width('奇異恩典'), 4);
  assert.equal(text_width('Amazing grace'), 6.5);
  assert.equal(text_width('奇異 恩典', 'half'), 4.5);
  assert.equal(text_width('奇異 恩典', 'full'), 5);
  assert.equal(text_width('奇異 恩典', 'hide'), 4);
  assert.equal(text_width('Amazing grace', 'full'), 6.5);
});

test('wrap_line：放得下不動；太長在空格斷成最少行、各行盡量一樣長', () => {
  assert.deepEqual(wrap_line('奇異恩典 何等甘甜', 10), ['奇異恩典 何等甘甜']);
  assert.deepEqual(wrap_line('奇異恩典 何等甘甜', 8), ['奇異恩典', '何等甘甜']);
  // 全形空格時寬 9，8 放不下
  assert.deepEqual(wrap_line('一二三四 五六七八', 8.5, 'half'), ['一二三四 五六七八']);
  assert.deepEqual(wrap_line('一二三四 五六七八', 8.5, 'full'), ['一二三四', '五六七八']);
  // 6 6 2：平均成 6 / 6 2 而不是 6 6 / 2
  assert.deepEqual(wrap_line('一二三四五六 一二三四五六 七八', 14), ['一二三四五六', '一二三四五六 七八']);
  // 四個片語平均成兩兩一行
  assert.deepEqual(wrap_line('甲乙丙 丁戊己 庚辛壬 癸子丑', 12), ['甲乙丙 丁戊己', '庚辛壬 癸子丑']);
  // 多的空白、全形空白當一個空格
  assert.deepEqual(wrap_line('  一二　 三四 ', 10), ['一二 三四']);
  assert.deepEqual(wrap_line('   ', 10), []);
});

test('wrap_line：片語本身太長時從字中間斷（中文一字一字，英文單字不拆）', () => {
  assert.deepEqual(wrap_line('一二三四五六七八九十', 6), ['一二三四五', '六七八九十']);
  assert.deepEqual(wrap_line('Amazing grace how sweet the sound', 8), ['Amazing grace', 'how sweet the', 'sound']);
  for (const line of wrap_line('Amazing grace how sweet the sound', 8))
    assert.ok(text_width(line) <= 8, line);
  // 一個英文單字比寬度還長：自己一行，不拆
  assert.deepEqual(wrap_line('Hallelujahhallelujah 哈利路亞', 6), ['Hallelujahhallelujah', '哈利路亞']);
});

test('page_sizes：每頁 lines 到 max_lines 行，平均、前面的頁多一行', () => {
  assert.deepEqual(page_sizes(0, 4, 6), []);
  assert.deepEqual(page_sizes(3, 4, 6), [3]);
  assert.deepEqual(page_sizes(5, 4, 6), [5]);
  assert.deepEqual(page_sizes(6, 4, 6), [6]);
  assert.deepEqual(page_sizes(7, 4, 6), [4, 3]);
  assert.deepEqual(page_sizes(9, 4, 6), [5, 4]);
  assert.deepEqual(page_sizes(12, 4, 6), [4, 4, 4]);
  assert.deepEqual(page_sizes(5, 4, 4), [3, 2]);
  assert.deepEqual(page_sizes(8, 2, 2), [2, 2, 2, 2]);
});

test('auto_layout_text：原本的分頁不管，重新分行分頁；換頁不切在同一行斷出來的幾行中間', () => {
  // 5 行、每頁 2 行：照算是 2 + 2 + 1，第二個換頁會切在「子丑寅卯／辰巳午未」中間，往前挪成 2 + 1 + 2
  assert.equal(auto_layout_text('一二三四 五六七八\n\n甲乙丙丁\n子丑寅卯 辰巳午未', { lines: 2, max_lines: 2, width: 4 }),
    '一二三四\n五六七八\n\n甲乙丙丁\n\n子丑寅卯\n辰巳午未');
  // 4 行、每頁 2～3 行：2 + 2 會切在「二三／四五」中間，挪成 1 + 3
  assert.equal(auto_layout_text('一\n二三 四五\n六', { lines: 2, max_lines: 3, width: 2 }), '一\n\n二三\n四五\n六');
  // 挪了會超過最多行數時不挪
  assert.equal(auto_layout_text('一\n二三 四五\n六', { lines: 2, max_lines: 2, width: 2 }), '一\n二三\n\n四五\n六');
  assert.equal(auto_layout_text('', DEFAULT_AUTO_LAYOUT), '');
  assert.equal(auto_layout_text('一\n\n二', DEFAULT_AUTO_LAYOUT), '一\n二');
});
