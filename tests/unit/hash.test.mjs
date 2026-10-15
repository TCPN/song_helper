import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse_params, params_to_str } from '../../js/hash.js';

test('parse_params：key=value 以 & 分隔', () => {
  assert.deepEqual(parse_params('song_id=12&transpose=-2'), { song_id: '12', transpose: '-2' });
});

test('parse_params：空字串與多餘的 & 會被忽略', () => {
  assert.deepEqual(parse_params(''), {});
  assert.deepEqual(parse_params('&song_id=1&&'), { song_id: '1' });
});

test('parse_params：沒有 = 的參數值為 true', () => {
  assert.deepEqual(parse_params('debug&song_id=3'), { debug: true, song_id: '3' });
});

test('parse_params：值裡的 = 會保留', () => {
  assert.deepEqual(parse_params('q=a=b=c'), { q: 'a=b=c' });
});

test('parse_params：值不做 URL 解碼（現況）', () => {
  assert.deepEqual(parse_params('name=%E6%AD%8C'), { name: '%E6%AD%8C' });
});

test('parse_params：重複的 key 以後面的為準', () => {
  assert.deepEqual(parse_params('song_id=1&song_id=2'), { song_id: '2' });
});

test('params_to_str：依加入順序組合，true 只寫 key', () => {
  assert.equal(params_to_str({ song_id: 12, debug: true, transpose: -2 }), 'song_id=12&debug&transpose=-2');
  assert.equal(params_to_str({}), '');
});

test('params_to_str 與 parse_params 可以來回轉換', () => {
  const s = 'song_id=7&transpose=3&debug';
  assert.equal(params_to_str(parse_params(s)), s);
});
