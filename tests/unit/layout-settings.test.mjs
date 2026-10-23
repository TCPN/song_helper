import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LAYOUT, LAYOUT_STEPS, normalize_layout, parse_layout, step_layout } from '../../js/layout-settings.js';

test('DEFAULT_LAYOUT：預設是加入設定前的排版（均等化、不加行距）', () => {
  assert.deepEqual(DEFAULT_LAYOUT, { equalize: true, line_gap: 0 });
});

test('normalize_layout：認得的值照用，不認得的欄位丟掉', () => {
  assert.deepEqual(normalize_layout({ equalize: false, line_gap: 20, other: 1 }), { equalize: false, line_gap: 20 });
});

test('normalize_layout：沒有或型別不對的值用預設', () => {
  for (const bad of [null, undefined, 'x', 3, [], {}])
    assert.deepEqual(normalize_layout(bad), DEFAULT_LAYOUT);
  assert.deepEqual(normalize_layout({ equalize: 'false', line_gap: '20' }), DEFAULT_LAYOUT);
  assert.deepEqual(normalize_layout({ line_gap: NaN }), DEFAULT_LAYOUT);
  assert.deepEqual(normalize_layout({ line_gap: Infinity }), DEFAULT_LAYOUT);
});

test('normalize_layout：超出範圍的行距拉回範圍內', () => {
  const { min, max } = LAYOUT_STEPS.line_gap;
  assert.equal(normalize_layout({ line_gap: -10 }).line_gap, min);
  assert.equal(normalize_layout({ line_gap: max + 100 }).line_gap, max);
});

test('parse_layout：localStorage 的字串轉成設定，讀不懂時用預設', () => {
  assert.deepEqual(parse_layout('{"equalize":false,"line_gap":10}'), { equalize: false, line_gap: 10 });
  for (const bad of [null, '', 'bogus', '{', 'null', '[1]'])
    assert.deepEqual(parse_layout(bad), DEFAULT_LAYOUT);
});

test('step_layout：行距每格加減 step，不超出範圍，不改原本的物件', () => {
  const { step, max } = LAYOUT_STEPS.line_gap;
  const layout = { equalize: false, line_gap: 0 };
  assert.deepEqual(step_layout(layout, 'line_gap', 1), { equalize: false, line_gap: step });
  assert.deepEqual(layout, { equalize: false, line_gap: 0 });
  assert.equal(step_layout(layout, 'line_gap', -1).line_gap, 0);
  assert.equal(step_layout({ line_gap: max }, 'line_gap', 1).line_gap, max);
  assert.deepEqual(step_layout(layout, 'unknown', 1), layout);
});
