import { test } from 'node:test';
import assert from 'node:assert/strict';
import { line_heights } from '../../js/line-heights.js';

test('line_heights：預設均等化，除了最後一行，五線譜下方都留最大的空間', () => {
  // 下方需要的空間：10、30、5（最後一行不算）
  const bottoms = [50, 60, 55];
  const needed = [60, 90, 100];
  assert.deepEqual(line_heights(bottoms, needed), [80, 90, null]);
  assert.deepEqual(line_heights(bottoms, needed, { equalize: true, line_gap: 0 }), [80, 90, null]);
});

test('line_heights：最後一行下方空間再大也不影響其他行', () => {
  assert.deepEqual(line_heights([40, 40], [50, 200]), [50, null]);
});

test('line_heights：只有一行時不改；沒有譜時傳回空陣列', () => {
  assert.deepEqual(line_heights([40], [70]), [null]);
  assert.deepEqual(line_heights([], []), []);
  assert.deepEqual(line_heights([40], [70], { equalize: false, line_gap: 20 }), [null]);
});

test('line_heights：不均等化時每行只占自己需要的高度', () => {
  assert.deepEqual(line_heights([50, 60, 55], [60, 90, 100], { equalize: false }), [60, 90, null]);
});

test('line_heights：行距加在每行下面，最後一行不加', () => {
  assert.deepEqual(line_heights([50, 60, 55], [60, 90, 100], { line_gap: 10 }), [90, 100, null]);
  assert.deepEqual(line_heights([50, 60, 55], [60, 90, 100], { equalize: false, line_gap: 10 }), [70, 100, null]);
});
