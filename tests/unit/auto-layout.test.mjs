import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_AUTO_LAYOUT, normalize_auto_layout, parse_auto_layout, step_auto_layout, auto_layout_at_limit,
  text_width, page_sizes, auto_layout_text, align_hints, hints_for } from '../../js/auto-layout.js';
import { sections_from_abc } from '../../js/slide-lyrics.js';

// 每行一段文字（沒有譜）
const wrap = (line, width, space = 'half') => auto_layout_text(line, { lines: 12, max_lines: 12, width }, space).split('\n').filter(Boolean);

test('normalize／parse：不認識的欄位丟掉、超出範圍拉回、最多行數不少於每頁行數；壞掉的 JSON 用預設', () => {
  assert.deepEqual(DEFAULT_AUTO_LAYOUT, { lines: 2, max_lines: 3, width: 13 });
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

test('分行（沒有譜）：放得下不動；太長在空格（片語）斷，各行盡量一樣長', () => {
  assert.deepEqual(wrap('奇異恩典 何等甘甜', 10), ['奇異恩典 何等甘甜']);
  assert.deepEqual(wrap('奇異恩典 何等甘甜', 8), ['奇異恩典', '何等甘甜']);
  // 寬度照空格的顯示方式算：隱藏時寬 8 放得下，半形時 8.5 放不下
  assert.deepEqual(wrap('一二三四 五六七八', 8, 'hide'), ['一二三四 五六七八']);
  assert.deepEqual(wrap('一二三四 五六七八', 8, 'half'), ['一二三四', '五六七八']);
  // 四個片語兩兩一行，不會切在片語中間
  assert.deepEqual(wrap('甲乙丙 丁戊己 庚辛壬 癸子丑', 12), ['甲乙丙 丁戊己', '庚辛壬 癸子丑']);
  // 三個片語放不進兩行時分三行，而不是切在片語中間湊成兩行
  assert.deepEqual(wrap('清晨的光照進窗前 微風輕輕吹過田園 我抬頭望向天邊', 13), ['清晨的光照進窗前', '微風輕輕吹過田園', '我抬頭望向天邊']);
  // 多的空白、全形空白當一個空格
  assert.deepEqual(wrap('  一二　 三四 ', 10), ['一二 三四']);
  assert.deepEqual(wrap('   ', 10), []);
});

test('分行（沒有譜）：原本的換行當成人排好的，保留；標點後面優先斷；全形標點不放行首', () => {
  assert.deepEqual(wrap('奇異恩典\n何等甘甜', 13), ['奇異恩典', '何等甘甜']);
  assert.deepEqual(wrap('今天天氣很好，我們一起出去走走吧', 10), ['今天天氣很好，', '我們一起出去走走吧']);
  for (const line of wrap('一二三四五六七八九，十', 9))
    assert.ok(!/^[，。]/.test(line), line);
});

test('分行（沒有譜）：片語本身太長時從字中間斷，但不切在詞的中間（斷詞）；英文單字不拆', () => {
  // 「清晨」「微風」「田園」都是詞，不會被切開
  for (const line of wrap('清晨的光照進窗前微風輕輕吹過田園', 6))
    assert.ok(!/^(晨|風|園)/.test(line), line);
  assert.deepEqual(wrap('Amazing grace how sweet the sound', 8), ['Amazing grace', 'how sweet', 'the sound']);
  for (const line of wrap('Amazing grace how sweet the sound', 8))
    assert.ok(text_width(line) <= 8, line);
  // 一個英文單字比寬度還長：自己一行，不拆
  assert.deepEqual(wrap('Hallelujahhallelujah 哈利路亞', 6), ['Hallelujahhallelujah', '哈利路亞']);
});

test('分行（有譜）：譜行接起來，在休止符、長音等斷句分數高的地方換行，不管譜上的換行', () => {
  // 第一行譜在「了」之後有休止符；「唱」和下一行的「歌」是同一句，被譜的換行切開
  const abc = 'X:1\nT:t\nM:4/4\nL:1/4\nK:C\nCDEF|G2 z2|ABcd|\nw:春 天 花 開 了 小 鳥 在 唱\ne4|cdef|g4|]\nw:歌 綠 草 青 青\n';
  const sections = sections_from_abc(abc, { hints: true });
  const text = sections[0].paragraphs.flat().join('\n');
  assert.equal(text, '春天花開了 小鳥在唱\n歌綠草青青');
  const hints = align_hints(text, hints_for(sections, sections[0].name));
  const options = { lines: 12, max_lines: 12, width: 6 };
  assert.equal(auto_layout_text(text, options, 'half', hints), '春天花開了\n小鳥在唱歌\n綠草青青');
  // 沒有譜時，原本的換行保留
  assert.equal(auto_layout_text(text, options), '春天花開了\n小鳥在唱\n歌綠草青青');
});

test('align_hints／hints_for：譜的分數對到文字（字有改過也對得到大部分）', () => {
  const source = [...'一二三四'].map((c, i) => ({ c, s: i }));
  assert.deepEqual(align_hints('一二 三四', source), [0, 1, 2, 3]);
  assert.deepEqual(align_hints('一甲三四', source), [0, undefined, 2, 3]);
  assert.equal(align_hints('一二', null), null);
  const sections = [{ name: 'A1', hints: [{ c: '甲', s: 1 }] }, { name: 'B', hints: [{ c: '乙', s: 2 }] }, { name: 'W', hints: null }];
  assert.deepEqual(hints_for(sections, 'B'), [{ c: '乙', s: 2 }]);
  // [主歌 = A1] 用 A1 對
  assert.deepEqual(hints_for(sections, '主歌', 'A1'), [{ c: '甲', s: 1 }]);
  // 對不到段名時用整首
  assert.deepEqual(hints_for(sections, '其他'), [{ c: '甲', s: 1 }, { c: '乙', s: 2 }]);
  assert.equal(hints_for(null, 'A'), null);
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

test('auto_layout_text：分頁；換頁挑斷句分數高的地方', () => {
  // 沒有譜：原本的換行、分頁是強的斷點，5 行每頁 2 行時換頁挪到原本分頁的地方
  assert.equal(auto_layout_text('一二三四 五六七八\n\n甲乙丙丁\n子丑寅卯 辰巳午未', { lines: 2, max_lines: 2, width: 4 }),
    '一二三四\n五六七八\n\n甲乙丙丁\n\n子丑寅卯\n辰巳午未');
  // 4 行、每頁 2～3 行：2 + 2 會切在「二三 四五」這個片語空格（比原本的換行弱），挪成 1 + 3
  assert.equal(auto_layout_text('一\n二三 四五\n六', { lines: 2, max_lines: 3, width: 2 }), '一\n\n二三\n四五\n六');
  // 挪了會超過最多行數時不挪
  assert.equal(auto_layout_text('一\n二三 四五\n六', { lines: 2, max_lines: 2, width: 2 }), '一\n二三\n\n四五\n六');
  assert.equal(auto_layout_text('', DEFAULT_AUTO_LAYOUT), '');
  assert.equal(auto_layout_text('一\n\n二', DEFAULT_AUTO_LAYOUT), '一\n二');
});
