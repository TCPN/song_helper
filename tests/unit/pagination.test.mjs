import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paginate, page_of_line, A4_RATIO } from '../../js/pagination.js';

test('A4_RATIO：A4 直式的高寬比是 √2', () => {
  assert.ok(Math.abs(A4_RATIO - 297 / 210) < 0.001);
});

test('paginate：放得下就放在同一頁，放不下的行換到下一頁', () => {
  assert.deepEqual(paginate([30, 30, 30, 30], 100), [[0, 1, 2], [3]]);
  assert.deepEqual(paginate([50, 60, 40, 40, 10], 100), [[0], [1, 2], [3, 4]]);
});

test('paginate：剛好塞滿一頁不換頁（容許浮點誤差）', () => {
  assert.deepEqual(paginate([50, 50, 1], 100), [[0, 1], [2]]);
  assert.deepEqual(paginate([0.1, 0.2, 0.7], 1), [[0, 1, 2]]);
});

test('paginate：比一頁還高的行自己一頁，不切開', () => {
  assert.deepEqual(paginate([30, 150, 30], 100), [[0], [1], [2]]);
  assert.deepEqual(paginate([150], 100), [[0]]);
  assert.deepEqual(paginate([150, 150], 100), [[0], [1]]);
});

test('paginate：不分頁（頁高 Infinity）時全部在同一頁', () => {
  assert.deepEqual(paginate([300, 300, 300], Infinity), [[0, 1, 2]]);
});

test('paginate：強制分頁的行從新的一頁開始，之後照常自動分頁', () => {
  assert.deepEqual(paginate([10, 10, 10, 10], 100, [2]), [[0, 1], [2, 3]]);
  assert.deepEqual(paginate([40, 40, 40, 40, 40], 100, [1]), [[0], [1, 2], [3, 4]]);
  assert.deepEqual(paginate([10, 10, 10], Infinity, [1, 2]), [[0], [1], [2]]);
});

test('paginate：強制分頁是 0、超出範圍或重複時忽略', () => {
  assert.deepEqual(paginate([10, 10, 10], 100, [0, 5, -1, 2, 2]), [[0, 1], [2]]);
});

test('paginate：沒有行時傳回空陣列', () => {
  assert.deepEqual(paginate([], 100), []);
  assert.deepEqual(paginate([], 100, [1]), []);
});

test('page_of_line：第幾行在第幾頁，找不到時是第一頁', () => {
  const pages = [[0, 1], [2], [3, 4]];
  assert.equal(page_of_line(pages, 0), 0);
  assert.equal(page_of_line(pages, 2), 1);
  assert.equal(page_of_line(pages, 4), 2);
  assert.equal(page_of_line(pages, 9), 0);
  assert.equal(page_of_line([], 0), 0);
});
