import { test } from 'node:test';
import assert from 'node:assert/strict';
import { line_start_bars, lines_to_breaks, breaks_to_lines, toggle_break, normalize_breaks,
  parse_break_store, song_breaks, set_song_breaks } from '../../js/page-breaks.js';

// 仿 abcjs 的 tune.lines：有譜的行有 staff，第一個聲部裡數 bar
const bar = { el_type: 'bar' };
const note = { el_type: 'note' };
const music = (bars) => ({ staff: [{ voices: [[note, ...Array(bars).fill(bar)]] }] });

test('line_start_bars：每行開頭之前有幾個小節線、整首有幾個', () => {
  assert.deepEqual(line_start_bars([music(4), music(4), music(3)]),
    { starts: [0, 4, 8], bars: 11, newpage_lines: [] });
});

test('line_start_bars：只數有譜的行；%%newpage 之後的那一行是預設分頁，第一行之前的不算', () => {
  var lines = [{ newpage: -1 }, music(2), { subtitle: 'x' }, music(2), { newpage: -1 }, { text: 'hi' }, music(1)];
  assert.deepEqual(line_start_bars(lines), { starts: [0, 2, 4], bars: 5, newpage_lines: [2] });
});

test('line_start_bars：沒有資料時是空的', () => {
  assert.deepEqual(line_start_bars(undefined), { starts: [], bars: 0, newpage_lines: [] });
});

test('lines_to_breaks／breaks_to_lines：行和小節位置互相換算', () => {
  var starts = [0, 4, 8, 12];
  assert.deepEqual(lines_to_breaks([3, 1], starts), [4, 12]);
  assert.deepEqual(breaks_to_lines([12, 4], starts, 16), [1, 3]);
});

test('breaks_to_lines：在一行中間的位置從那一行開始；第一行裡面、超出範圍的忽略', () => {
  var starts = [0, 4, 8, 12];
  assert.deepEqual(breaks_to_lines([2, 10, 16, 99, 0], starts, 16), [2]);
  // 同一行有兩個位置只算一次
  assert.deepEqual(breaks_to_lines([9, 10], starts, 16), [2]);
});

test('breaks_to_lines：沒有小節線的行和下一行開頭位置一樣時，對到前面那一行', () => {
  assert.deepEqual(breaks_to_lines([4], [0, 4, 4], 8), [1]);
});

test('toggle_break：沒有就加入，有就取消', () => {
  var starts = [0, 4, 8, 12];
  assert.deepEqual(toggle_break([], starts, 16, 2), [8]);
  assert.deepEqual(toggle_break([8], starts, 16, 1), [4, 8]);
  assert.deepEqual(toggle_break([4, 8], starts, 16, 2), [4]);
  // 原本超出範圍的位置會被清掉
  assert.deepEqual(toggle_break([99], starts, 16, 3), [12]);
});

test('normalize_breaks：只留正整數，不重複、由小到大', () => {
  assert.deepEqual(normalize_breaks([8, 4, 8, 0, -1, 2.5, '3', null]), [4, 8]);
  assert.deepEqual(normalize_breaks('x'), []);
});

test('parse_break_store：壞掉的整包或單首當作沒設定', () => {
  assert.deepEqual(parse_break_store('{"1":[8,4],"2":"x","3":[]}'), { 1: [4, 8], 3: [] });
  assert.deepEqual(parse_break_store('{bad'), {});
  assert.deepEqual(parse_break_store(null), {});
  assert.deepEqual(parse_break_store('[1,2]'), {});
});

test('song_breaks：設定過就用設定的（空的也是），否則用預設', () => {
  assert.deepEqual(song_breaks({ 1: [] }, 1, [4]), []);
  assert.deepEqual(song_breaks({ 1: [8] }, 1, [4]), [8]);
  assert.deepEqual(song_breaks({}, 1, [4]), [4]);
  assert.deepEqual(song_breaks({}, 'toString', []), []);
});

test('set_song_breaks：和預設一樣時刪掉設定，不改原本的 store', () => {
  var store = { 1: [8], 2: [4] };
  assert.deepEqual(set_song_breaks(store, 1, [12], []), { 1: [12], 2: [4] });
  assert.deepEqual(set_song_breaks(store, 1, [], []), { 2: [4] });
  assert.deepEqual(set_song_breaks(store, 1, [], [4]), { 1: [], 2: [4] });
  assert.deepEqual(store, { 1: [8], 2: [4] });
});
