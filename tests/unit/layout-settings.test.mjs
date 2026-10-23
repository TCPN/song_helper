import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LAYOUT, LAYOUT_STEPS, RERENDER_KEYS, normalize_layout, parse_layout, step_layout, needs_rerender, format_layout_value } from '../../js/layout-settings.js';

test('DEFAULT_LAYOUT：預設是加入設定前的排版（均等化、不加行距、密度 100%、abcjs 原本的字級）', () => {
  assert.deepEqual(DEFAULT_LAYOUT, { equalize: true, line_gap: 0, density: 100, lyric_size: 13, chord_size: 12 });
});

test('LAYOUT_STEPS：預設值都在範圍內，而且是從最小值開始的整格', () => {
  for (const [key, { step, min, max }] of Object.entries(LAYOUT_STEPS)) {
    assert.ok(min <= DEFAULT_LAYOUT[key] && DEFAULT_LAYOUT[key] <= max, key);
    assert.equal((DEFAULT_LAYOUT[key] - min) % step, 0, key);
  }
});

test('normalize_layout：認得的值照用，不認得的欄位丟掉', () => {
  assert.deepEqual(normalize_layout({ equalize: false, line_gap: 20, other: 1 }), { ...DEFAULT_LAYOUT, equalize: false, line_gap: 20 });
  assert.deepEqual(normalize_layout({ density: 120, lyric_size: 15, chord_size: 10 }),
    { ...DEFAULT_LAYOUT, density: 120, lyric_size: 15, chord_size: 10 });
});

test('normalize_layout：沒有或型別不對的值用預設', () => {
  for (const bad of [null, undefined, 'x', 3, [], {}])
    assert.deepEqual(normalize_layout(bad), DEFAULT_LAYOUT);
  assert.deepEqual(normalize_layout({ equalize: 'false', line_gap: '20', density: '120', lyric_size: null }), DEFAULT_LAYOUT);
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
  assert.deepEqual(parse_layout('{"density":150}'), { ...DEFAULT_LAYOUT, density: 150 });
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

test('step_layout：密度每格 10%，字級每格 1', () => {
  assert.equal(step_layout(DEFAULT_LAYOUT, 'density', 1).density, 110);
  assert.equal(step_layout(DEFAULT_LAYOUT, 'density', -2).density, 80);
  assert.equal(step_layout(DEFAULT_LAYOUT, 'lyric_size', 1).lyric_size, 14);
  assert.equal(step_layout(DEFAULT_LAYOUT, 'chord_size', -1).chord_size, 11);
});

test('needs_rerender：密度、字級改了要重新渲染，均等化、行距不用', () => {
  assert.deepEqual(RERENDER_KEYS, ['density', 'lyric_size', 'chord_size']);
  assert.equal(needs_rerender(DEFAULT_LAYOUT, DEFAULT_LAYOUT), false);
  assert.equal(needs_rerender(DEFAULT_LAYOUT, { ...DEFAULT_LAYOUT, equalize: false, line_gap: 20 }), false);
  for (const key of RERENDER_KEYS)
    assert.equal(needs_rerender(DEFAULT_LAYOUT, step_layout(DEFAULT_LAYOUT, key, 1)), true, key);
  // 舊的設定沒有新欄位時視同預設值
  assert.equal(needs_rerender({ equalize: true, line_gap: 0 }, DEFAULT_LAYOUT), false);
});

test('format_layout_value：密度加上 %，其他直接顯示數字', () => {
  assert.equal(format_layout_value('density', 120), '120%');
  assert.equal(format_layout_value('lyric_size', 13), '13');
  assert.equal(format_layout_value('line_gap', 0), '0');
});
