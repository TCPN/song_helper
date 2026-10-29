import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse_slide_cell, w_line_text, sections_from_abc, song_slide_lyrics, sections_text } from '../../js/slide-lyrics.js';

const section = (name, paragraphs, source = null) => ({ name, source, paragraphs });

test('parse_slide_cell：換行 = 換行，空一行 = 段內分段，[段名] 開新的一段', () => {
  const cell = '[主歌]\n第一句\n第二句\n\n第三句\n[副歌]\n副歌一\n';
  assert.deepEqual(parse_slide_cell(cell), {
    order: null,
    sections: [
      section('主歌', [['第一句', '第二句'], ['第三句']]),
      section('副歌', [['副歌一']]),
    ],
  });
});

test('parse_slide_cell：[段名 = A1] 記下對到譜上的段；段名、來源前後的空白拿掉', () => {
  assert.deepEqual(parse_slide_cell('[ 主歌1 = A1 ]\n一\n[副歌=B1]\n二').sections, [
    section('主歌1', [['一']], 'A1'),
    section('副歌', [['二']], 'B1'),
  ]);
});

test('parse_slide_cell：第一個段名之前的文字算一段沒有名字的段；之前只有空行就不算', () => {
  assert.deepEqual(parse_slide_cell('前言\n[A]\n一').sections, [section(null, [['前言']]), section('A', [['一']])]);
  assert.deepEqual(parse_slide_cell('\n\n[A]\n一').sections, [section('A', [['一']])]);
  // 沒有任何段名：整格一段
  assert.deepEqual(parse_slide_cell('一\n二').sections, [section(null, [['一', '二']])]);
});

test('parse_slide_cell：/ 空一格、// 換行、/// 空一行（前後的空白一起拿掉）', () => {
  assert.deepEqual(parse_slide_cell('一句 / 二句//三句 /// 四句').sections, [
    section(null, [['一句 二句', '三句'], ['四句']]),
  ]);
  // 四條以上也當 ///；可以和真的換行混用
  assert.deepEqual(parse_slide_cell('一////二\n三').sections, [section(null, [['一'], ['二', '三']])]);
});

test('parse_slide_cell：連續空行只算一次分段，行首行尾的空白拿掉', () => {
  assert.deepEqual(parse_slide_cell('  一  \n\n\n\n二\r\n').sections, [section(null, [['一'], ['二']])]);
});

test('parse_slide_cell：「順序:」行讀成段名的陣列（全形冒號也可以），不算歌詞', () => {
  assert.deepEqual(parse_slide_cell('順序: V1 C  V2 C\n[V1]\n一'), {
    order: ['V1', 'C', 'V2', 'C'],
    sections: [section('V1', [['一']])],
  });
  assert.deepEqual(parse_slide_cell('順序：A B').order, ['A', 'B']);
});

test('parse_slide_cell：有段名但沒有字的段保留；空白格是空的', () => {
  assert.deepEqual(parse_slide_cell('[間奏]\n[A]\n一').sections, [section('間奏', []), section('A', [['一']])]);
  assert.deepEqual(parse_slide_cell(''), { order: null, sections: [] });
  assert.deepEqual(parse_slide_cell(null), { order: null, sections: [] });
});

test('w_line_text：中文音節直接相連，英文的字之間隔一個空格', () => {
  assert.equal(w_line_text('奇 異 恩 典 何 等 甘 甜'), '奇異恩典何等甘甜');
  assert.equal(w_line_text('how sweet the sound'), 'how sweet the sound');
  assert.equal(w_line_text('主 Jesus 愛 我'), '主Jesus愛我');
});

test('w_line_text：- 接回同一個字，_ * | 拿掉，~ 是空格，\\- 是連字號', () => {
  assert.equal(w_line_text('A-maz-ing grace'), 'Amazing grace');
  assert.equal(w_line_text('a--b'), 'ab');
  assert.equal(w_line_text('sweet_ _ the * sound'), 'sweet the sound');
  assert.equal(w_line_text('一 二 | 三 四|五'), '一二三四五');
  assert.equal(w_line_text('of~the Lord'), 'of the Lord');
  assert.equal(w_line_text('self\\-less'), 'self-less');
  assert.equal(w_line_text('  '), '');
});

test('sections_from_abc：沒有 P: 時整首一段，第幾行 w: 就是 V 幾，譜上一行 = 歌詞一行', () => {
  const abc = 'X:1\nT:t\nK:C\nCDEF|\nw:一 二 三 四\nw:五 六 七 八\nGABc|\nw:甲 乙 丙 丁\nw:子 丑 寅 卯\n';
  assert.deepEqual(sections_from_abc(abc), [
    section('V1', [['一二三四', '甲乙丙丁']]),
    section('V2', [['五六七八', '子丑寅卯']]),
  ]);
});

test('sections_from_abc：有 P: 時段名是段落名稱＋第幾行 w:；同一段出現兩次接在一起', () => {
  const abc = 'X:1\nP:ABA\nK:C\nP:A\nCDEF|\nw:一 二 三 四\nw:五 六 七 八\nP:B\nGABc|\nw:副 歌 一 句\nP:A\nCDEF|\nw:又 一 句 歌\n';
  assert.deepEqual(sections_from_abc(abc), [
    section('A1', [['一二三四', '又一句歌']]),
    section('A2', [['五六七八']]),
    section('B1', [['副歌一句']]),
  ]);
});

test('sections_from_abc：行首的 [P:B] 從這行換段；行中間的 [P:C] 從下一行譜開始', () => {
  const abc = 'X:1\nK:C\n[P:A]CDEF|\nw:一 二 三 四\n[P:B]GABc|[P:C]cBAG|\nw:甲 乙 丙 丁 戊 己 庚 辛\nC4|\nw:末\n';
  assert.deepEqual(sections_from_abc(abc), [
    section('A1', [['一二三四']]),
    section('B1', [['甲乙丙丁戊己庚辛']]),
    section('C1', [['末']]),
  ]);
});

test('sections_from_abc：第一個 P: 之前的歌詞叫 V1；沒有 w: 的譜行、註解、其他欄位不影響', () => {
  const abc = 'X:1\nK:C\nCDEF|\nw:前 奏 歌 詞\n%註解\n%%vskip 10\nP:A\nV:1\nGABc|\nT:小標題\nw:主 歌 一 句\nc4|]\n';
  assert.deepEqual(sections_from_abc(abc), [
    section('V1', [['前奏歌詞']]),
    section('A1', [['主歌一句']]),
  ]);
});

test('sections_from_abc：W: 放在最後一段「W」，空的 W: 是段內分段', () => {
  const abc = 'X:1\nK:C\nCDEF|\nw:一 二 三 四\nW:第二節第一句\nW:第二節第二句\nW:\nW:第三節\n';
  assert.deepEqual(sections_from_abc(abc), [
    section('V1', [['一二三四']]),
    section('W', [['第二節第一句', '第二節第二句'], ['第三節']]),
  ]);
});

test('sections_from_abc：沒有譜、沒有 K:、沒有歌詞時是空陣列', () => {
  assert.deepEqual(sections_from_abc(null), []);
  assert.deepEqual(sections_from_abc('X:1\nT:t\n'), []);
  assert.deepEqual(sections_from_abc('X:1\nK:C\nCDEF|\n'), []);
});

test('song_slide_lyrics：「投影片」欄有字就用它，空白（或只有空白字元）時從 w: 產生', () => {
  const abc = 'X:1\nK:C\nP:A\nCDEF|\nw:一 二 三 四\n';
  assert.deepEqual(song_slide_lyrics({ abc, slides: '[主歌 = A1]\n一二三四\n順序: 主歌' }), {
    from: 'cell', order: ['主歌'], has_parts: true, sections: [section('主歌', [['一二三四']], 'A1')],
  });
  for (const slides of [null, undefined, '', ' \n '])
    assert.deepEqual(song_slide_lyrics({ abc, slides }), {
      from: 'abc', order: null, has_parts: true, sections: [section('A1', [['一二三四']])],
    });
  assert.equal(song_slide_lyrics({ abc: 'X:1\nK:C\nC|\nw:一\n' }).has_parts, false);
});

test('sections_text：一行一句，段落之間和段與段之間空一行，不放段名', () => {
  assert.equal(sections_text([
    section('A', [['一', '二'], ['三']]),
    section('間奏', []),
    section('B', [['四']]),
  ]), '一\n二\n\n三\n\n四');
  assert.equal(sections_text([]), '');
});
