import { test } from 'node:test';
import assert from 'node:assert/strict';
import { column_letter, column_range, cell_range, batch_get_url, update_url, response_column, find_song_rows,
  cell_text, api_error_message, SLIDES_COLUMN_INDEX, ID_COLUMN_INDEX } from '../../js/sheet-api.js';
import { SPREADSHEET_KEY } from '../../js/song-data.js';

test('column_letter：從 0 數的欄位 → 欄名', () => {
  assert.deepEqual([0, 8, 10, 25, 26, 27, 51, 52, 701, 702].map(column_letter),
    ['A', 'I', 'K', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA']);
});

test('「投影片」欄是 I 欄、編號是 A 欄；範圍的寫法', () => {
  assert.equal(column_range(ID_COLUMN_INDEX), 'A:A');
  assert.equal(column_range(SLIDES_COLUMN_INDEX), 'I:I');
  assert.equal(cell_range(SLIDES_COLUMN_INDEX, 12), 'I12');
});

test('batch_get_url／update_url：試算表的 Sheets API 網址；寫入用 RAW（不當成公式）', () => {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_KEY}/values`;
  assert.equal(batch_get_url(['A:A', 'I:I']),
    base + ':batchGet?ranges=A%3AA&ranges=I%3AI&majorDimension=COLUMNS&valueRenderOption=UNFORMATTED_VALUE');
  assert.equal(update_url('I12'), base + '/I12?valueInputOption=RAW');
});

test('response_column：batchGet 回應的第幾欄；整欄都空（沒有 values）時是空陣列', () => {
  const body = { valueRanges: [{ range: 'A1:A3', values: [['編號', 1, 2]] }, { range: 'I1:I1000' }] };
  assert.deepEqual(response_column(body, 0), ['編號', 1, 2]);
  assert.deepEqual(response_column(body, 1), []);
  assert.deepEqual(response_column(body, 2), []);
  assert.deepEqual(response_column(null, 0), []);
});

test('find_song_rows：找編號那一欄裡的曲號，傳回試算表的列號（從 1 數）；數字和文字都比得到', () => {
  const column = ['編號', 1, 2, '', 12, ' 30 ', 12];
  assert.deepEqual(find_song_rows(column, 2), [3]);
  assert.deepEqual(find_song_rows(column, 30), [6]);
  assert.deepEqual(find_song_rows(column, 12), [5, 7]);
  assert.deepEqual(find_song_rows(column, 99), []);
  assert.deepEqual(find_song_rows([], 1), []);
});

test('cell_text：比較用的文字（空的當成空字串、換行統一、去掉前後空白）', () => {
  assert.equal(cell_text(null), '');
  assert.equal(cell_text(undefined), '');
  assert.equal(cell_text('  [A]\r\n一\r二\n'), '[A]\n一\n二');
  assert.equal(cell_text(5), '5');
});

test('api_error_message：常見的錯誤給看得懂的訊息', () => {
  assert.equal(api_error_message(403), '這個 Google 帳號沒有試算表的編輯權限');
  assert.equal(api_error_message(401), 'Google 登入已失效，請再試一次');
  assert.equal(api_error_message(500, 'boom'), '試算表回應錯誤（500：boom）');
  assert.equal(api_error_message(500), '試算表回應錯誤（500）');
});
