import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LAYOUT, LAYOUT_STEPS, RERENDER_KEYS, normalize_layout, parse_layout, step_layout, needs_rerender, format_layout_value } from '../../js/layout-settings.js';

test('DEFAULT_LAYOUT：預設是加入設定前的排版（均等化、不加行距、譜面寬度 740、abcjs 原本的字級）', () => {
  assert.deepEqual(DEFAULT_LAYOUT, { equalize: true, line_gap: 0, staff_width: 740, lyric_size: 13, chord_size: 12 });
});

test('LAYOUT_STEPS：預設值都在範圍內，而且是從最小值開始的整格', () => {
  for (const [key, { step, min, max }] of Object.entries(LAYOUT_STEPS)) {
    assert.ok(min <= DEFAULT_LAYOUT[key] && DEFAULT_LAYOUT[key] <= max, key);
    assert.equal((DEFAULT_LAYOUT[key] - min) % step, 0, key);
  }
});

test('normalize_layout：認得的值照用，不認得的欄位丟掉', () => {
  assert.deepEqual(normalize_layout({ equalize: false, line_gap: 20, other: 1 }), { ...DEFAULT_LAYOUT, equalize: false, line_gap: 20 });
  assert.deepEqual(normalize_layout({ staff_width: 900, lyric_size: 15, chord_size: 10 }),
    { ...DEFAULT_LAYOUT, staff_width: 900, lyric_size: 15, chord_size: 10 });
});

test('normalize_layout：沒有或型別不對的值用預設', () => {
  for (const bad of [null, undefined, 'x', 3, [], {}])
    assert.deepEqual(normalize_layout(bad), DEFAULT_LAYOUT);
  assert.deepEqual(normalize_layout({ equalize: 'false', line_gap: '20', staff_width: '900', lyric_size: null, density: 120 }), DEFAULT_LAYOUT);
  assert.deepEqual(normalize_layout({ line_gap: NaN }), DEFAULT_LAYOUT);
  assert.deepEqual(normalize_layout({ line_gap: Infinity }), DEFAULT_LAYOUT);
});

test('normalize_layout：超出範圍的數值拉回範圍內', () => {
  for (const [key, { min, max }] of Object.entries(LAYOUT_STEPS)) {
    assert.equal(normalize_layout({ [key]: min - 100 })[key], min, key);
    assert.equal(normalize_layout({ [key]: max + 100 })[key], max, key);
  }
});

test('parse_layout：localStorage 的字串轉成設定，讀不懂時用預設', () => {
  assert.deepEqual(parse_layout('{"equalize":false,"line_gap":10}'), { ...DEFAULT_LAYOUT, equalize: false, line_gap: 10 });
  assert.deepEqual(parse_layout('{"staff_width":1100}'), { ...DEFAULT_LAYOUT, staff_width: 1100 });
  for (const bad of [null, '', 'bogus', '{', 'null', '[1]'])
    assert.deepEqual(parse_layout(bad), DEFAULT_LAYOUT);
});

test('step_layout：行距每格加減 step，不超出範圍，不改原本的物件', () => {
  const { step, max } = LAYOUT_STEPS.line_gap;
  const layout = { ...DEFAULT_LAYOUT, equalize: false, line_gap: 0 };
  assert.deepEqual(step_layout(layout, 'line_gap', 1), { ...layout, line_gap: step });
  assert.deepEqual(layout, { ...DEFAULT_LAYOUT, equalize: false, line_gap: 0 });
  assert.equal(step_layout(layout, 'line_gap', -1).line_gap, 0);
  assert.equal(step_layout({ line_gap: max }, 'line_gap', 1).line_gap, max);
  assert.deepEqual(step_layout(layout, 'unknown', 1), layout);
});

test('step_layout：譜面寬度每格 40，字級每格 1', () => {
  assert.equal(step_layout(DEFAULT_LAYOUT, 'staff_width', 1).staff_width, 780);
  assert.equal(step_layout(DEFAULT_LAYOUT, 'staff_width', -2).staff_width, 660);
  assert.equal(step_layout(DEFAULT_LAYOUT, 'lyric_size', 1).lyric_size, 14);
  assert.equal(step_layout(DEFAULT_LAYOUT, 'chord_size', -1).chord_size, 11);
});

test('step_layout：可以指定從哪個值開始調，不在格子上時先往調整的方向對齊格子', () => {
  // 設定是 500，但這首歌實際用 598
  const layout = { ...DEFAULT_LAYOUT, staff_width: 500 };
  assert.equal(step_layout(layout, 'staff_width', 1, 598).staff_width, 620);
  assert.equal(step_layout(layout, 'staff_width', 2, 598).staff_width, 660);
  assert.equal(step_layout(layout, 'staff_width', -1, 598).staff_width, 580);
  assert.equal(step_layout(layout, 'staff_width', 1, 620).staff_width, 660);
  assert.equal(step_layout(layout, 'staff_width', 1).staff_width, 540);
  assert.equal(step_layout(layout, 'staff_width', 1, NaN).staff_width, 540);
  assert.equal(step_layout(layout, 'staff_width', 1, 1490).staff_width, 1500);
});

test('needs_rerender：譜面寬度、字級改了要重新渲染，均等化、行距不用', () => {
  assert.deepEqual(RERENDER_KEYS, ['staff_width', 'lyric_size', 'chord_size']);
  assert.equal(needs_rerender(DEFAULT_LAYOUT, DEFAULT_LAYOUT), false);
  assert.equal(needs_rerender(DEFAULT_LAYOUT, { ...DEFAULT_LAYOUT, equalize: false, line_gap: 20 }), false);
  for (const key of RERENDER_KEYS)
    assert.equal(needs_rerender(DEFAULT_LAYOUT, step_layout(DEFAULT_LAYOUT, key, 1)), true, key);
  // 舊的設定沒有新欄位時視同預設值
  assert.equal(needs_rerender({ equalize: true, line_gap: 0 }, DEFAULT_LAYOUT), false);
});

test('format_layout_value：直接顯示數字', () => {
  assert.equal(format_layout_value('staff_width', 740), '740');
  assert.equal(format_layout_value('lyric_size', 13), '13');
  assert.equal(format_layout_value('line_gap', 0), '0');
});
