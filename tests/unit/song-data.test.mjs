import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSongArray } from '../../js/song-data.js';

// 模擬 google.visualization.DataTable，只實作 getSongArray 用到的方法
function fakeDataTable(rows) {
  return {
    getNumberOfRows: () => rows.length,
    getValue: (r, c) => rows[r][c],
  };
}

test('getSongArray：取出編號、歌名、調號、拍號、首句旋律、投影片、abc 欄位', (t) => {
  t.mock.method(console, 'log', () => {});
  const row = [5, '歌名', 'G', '3/4', 'GAB', '出處', '分類', '譜', '投影片', 'ppt', 'X:1\nK:G\nG|'];
  assert.deepEqual(getSongArray(fakeDataTable([row])), [{
    id: 5, name: '歌名', tone: 'G', timesig: '3/4', melody: 'GAB', slides: '投影片', abc: 'X:1\nK:G\nG|',
  }]);
});

test('getSongArray：保持試算表的順序；沒有資料時為空陣列', (t) => {
  t.mock.method(console, 'log', () => {});
  const rows = [2, 1, 3].map((id) => [id, `歌${id}`, 'C', '4/4', '', '', '', '', '', '', null]);
  assert.deepEqual(getSongArray(fakeDataTable(rows)).map((s) => s.id), [2, 1, 3]);
  assert.deepEqual(getSongArray(fakeDataTable([])), []);
});
