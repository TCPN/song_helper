import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equalized_line_heights } from '../../js/line-heights.js';

test('equalized_line_heights：除了最後一行，五線譜下方都留最大的空間', () => {
  // 下方需要的空間：10、30、5（最後一行不算）
  const bottoms = [50, 60, 55];
  const needed = [60, 90, 100];
  assert.deepEqual(equalized_line_heights(bottoms, needed), [80, 90, null]);
});

test('equalized_line_heights：最後一行下方空間再大也不影響其他行', () => {
  assert.deepEqual(equalized_line_heights([40, 40], [50, 200]), [50, null]);
});

test('equalized_line_heights：只有一行時不改；沒有譜時傳回空陣列', () => {
  assert.deepEqual(equalized_line_heights([40], [70]), [null]);
  assert.deepEqual(equalized_line_heights([], []), []);
});
