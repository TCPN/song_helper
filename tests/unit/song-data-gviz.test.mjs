import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse_gviz_response, getSongArray } from '../../js/song-data.js';

// 仿照試算表 gviz 查詢（tqx=out:json）回應的格式
function gviz(rows, status = 'ok') {
  const body = { version: '0.6', status, table: { cols: [], rows: rows.map((cells) => ({ c: cells })) } };
  if (status === 'error') body.errors = [{ reason: 'access_denied' }];
  return '/*O_o*/\ngoogle.visualization.Query.setResponse(' + JSON.stringify(body) + ');';
}

test('parse_gviz_response：可以交給 getSongArray 轉成歌曲物件', (t) => {
  t.mock.method(console, 'log', () => {});
  const row = [{ v: 5 }, { v: '歌名' }, { v: 'G' }, { v: '3/4' }, { v: 'GAB' }, null, null, null, null, null, { v: 'X:1\nK:G\nG|' }];
  assert.deepEqual(getSongArray(parse_gviz_response(gviz([row]))), [{
    id: 5, name: '歌名', tone: 'G', timesig: '3/4', melody: 'GAB', abc: 'X:1\nK:G\nG|',
  }]);
});

test('parse_gviz_response：空白格（null 或沒有 v）為 null', () => {
  const data = parse_gviz_response(gviz([[{ v: 1 }, null, {}, { v: null }]]));
  assert.equal(data.getNumberOfRows(), 1);
  assert.equal(data.getValue(0, 0), 1);
  assert.equal(data.getValue(0, 1), null);
  assert.equal(data.getValue(0, 2), null);
  assert.equal(data.getValue(0, 3), null);
});

test('parse_gviz_response：查詢錯誤或格式不對時丟出錯誤', () => {
  assert.throws(() => parse_gviz_response(gviz([], 'error')), /^Error: access_denied$/);
  assert.throws(() => parse_gviz_response('<html>login</html>'), /無法解析/);
});

test('parse_gviz_response：查詢錯誤的訊息是 gviz 的說明文字', () => {
  const body = { status: 'error', errors: [{ reason: 'invalid_query', message: 'boom', detailed_message: 'sheet is gone' }] };
  const text = '/*O_o*/\ngoogle.visualization.Query.setResponse(' + JSON.stringify(body) + ');';
  assert.throws(() => parse_gviz_response(text), { message: 'boom sheet is gone' });
});

test('parse_gviz_response：查詢錯誤沒有說明時用預設訊息', () => {
  const text = '/*O_o*/\ngoogle.visualization.Query.setResponse(' + JSON.stringify({ status: 'error', errors: [] }) + ');';
  assert.throws(() => parse_gviz_response(text), { message: '試算表回報錯誤' });
});
