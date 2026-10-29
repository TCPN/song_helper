import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse_slide_cell, w_line_text, w_slots, music_line_marks, sections_from_abc, song_slide_lyrics, lyrics_messages, lines_text, has_slide_lyrics } from '../../js/slide-lyrics.js';

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

test('sections_from_abc：沒有 P: 時整首一段，第幾行 w: 就是 Verse 幾（只有一節時叫 Verse），譜上一行 = 歌詞一行', () => {
  const abc = 'X:1\nT:t\nK:C\nCDEF|\nw:一 二 三 四\nw:五 六 七 八\nGABc|\nw:甲 乙 丙 丁\nw:子 丑 寅 卯\n';
  assert.deepEqual(sections_from_abc(abc), [
    section('Verse1', [['一二三四', '甲乙丙丁']]),
    section('Verse2', [['五六七八', '子丑寅卯']]),
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

test('sections_from_abc：行首的 [P:B] 從這行換段；行中間的 [P:C] 之後的字都是 C 段', () => {
  const abc = 'X:1\nK:C\n[P:A]CDEF|\nw:一 二 三 四\n[P:B]GABc|[P:C]cBAG|\nw:甲 乙 丙 丁 戊 己 庚 辛\nw:子 丑 寅 卯 辰 巳 午 未\nC4|\nw:末\n';
  assert.deepEqual(sections_from_abc(abc), [
    section('A1', [['一二三四']]),
    section('B1', [['甲乙丙丁']]),
    section('B2', [['子丑寅卯']]),
    section('C1', [['戊己庚辛', '末']]),
    section('C2', [['辰巳午未']]),
  ]);
});

test('sections_from_abc：行中間的 [P:] 依音符數切開歌詞（休止符、裝飾音、和弦記號不算音符，和音算一個）', () => {
  const abc = 'X:1\nK:C\nP:A\n"C"C z {g}D [CE]E |[P:B] !fermata!F G|\nw:一 二 三 四 五\n';
  assert.deepEqual(sections_from_abc(abc), [
    section('A1', [['一二三四']]),
    section('B1', [['五']]),
  ]);
});

test('sections_from_abc：歌詞比 [P:] 之前的音符少時，後面那段沒有字', () => {
  const abc = 'X:1\nK:C\nCDEF|[P:B]GABc|\nw:一 二\n';
  assert.deepEqual(sections_from_abc(abc), [section('Verse', [['一二']])]);
});

test('music_line_marks：段落標記與小節線的位置是之前的音符數', () => {
  assert.deepEqual(music_line_marks('[P:A]CD EF|:GA [P:B]B2c2:|[1 d4|]'), {
    marks: [{ name: 'A', at: 0 }, { name: 'B', at: 6 }],
    bars: [4, 8, 9],
  });
  // % 之後是註解；"..." 裡的字母不算
  assert.deepEqual(music_line_marks('"Am"A B|% c d'), { marks: [], bars: [2] });
});

test('w_slots：每個音符一個音節；| 跳到下一小節', () => {
  assert.deepEqual(w_slots('a-b c'), [{ text: 'a', hyphen: true }, { text: 'b', hyphen: false }, { text: 'c', hyphen: false }]);
  // 第一小節有 3 個音，歌詞只寫了 1 個：| 補兩個空的
  assert.deepEqual(w_slots('一|二', [3, 5]).map((s) => s.text), ['一', '', '', '二']);
  // 剛好在小節線上的 | 不多補
  assert.deepEqual(w_slots('一 二 三|四', [3]).map((s) => s.text), ['一', '二', '三', '四']);
});

test('sections_from_abc：w: 用 | 對小節時，行中間的 [P:] 也對得到', () => {
  const abc = 'X:1\nK:C\nCDE|[P:B]FGA|\nw:一|二 三 四\n';
  assert.deepEqual(sections_from_abc(abc), [section('Verse', [['一']]), section('B1', [['二三四']])]);
});

test('sections_from_abc：第一個 P: 之前的歌詞叫 Verse；沒有 w: 的譜行、註解、其他欄位不影響', () => {
  const abc = 'X:1\nK:C\nCDEF|\nw:前 奏 歌 詞\n%註解\n%%vskip 10\nP:A\nV:1\nGABc|\nT:小標題\nw:主 歌 一 句\nc4|]\n';
  assert.deepEqual(sections_from_abc(abc), [
    section('Verse', [['前奏歌詞']]),
    section('A1', [['主歌一句']]),
  ]);
});

test('sections_from_abc：W: 放在最後一段「W」，空的 W: 是段內分段', () => {
  const abc = 'X:1\nK:C\nCDEF|\nw:一 二 三 四\nW:第二節第一句\nW:第二節第二句\nW:\nW:第三節\n';
  assert.deepEqual(sections_from_abc(abc), [
    section('Verse', [['一二三四']]),
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
    from: 'cell', order: ['主歌'], sections: [section('主歌', [['一二三四']], 'A1')],
    score_has_lyrics: true, score_has_parts: true, cell_has_headers: true,
  });
  for (const slides of [null, undefined, '', ' \n '])
    assert.deepEqual(song_slide_lyrics({ abc, slides }), {
      from: 'abc', order: null, sections: [section('A1', [['一二三四']])],
      score_has_lyrics: true, score_has_parts: true, cell_has_headers: null,
    });
  assert.equal(song_slide_lyrics({ abc: 'X:1\nK:C\nC|\nw:一\n' }).score_has_parts, false);
  assert.equal(song_slide_lyrics({ abc, slides: '一\n二' }).cell_has_headers, false);
});

test('lyrics_messages：自動抽出才寫來源（info）；缺少段落標記各一則（warning）', () => {
  const lyrics = (o) => song_slide_lyrics(o);
  const parts = 'X:1\nK:C\nP:A\nC|\nw:一\n';
  const no_parts = 'X:1\nK:C\nC|\nw:一\n';
  const info = (text) => ({ type: 'info', text });
  const warning = (text) => ({ type: 'warning', text });
  assert.deepEqual(lyrics_messages(lyrics({ abc: parts })), [info('從歌譜中自動抽出')]);
  assert.deepEqual(lyrics_messages(lyrics({ abc: no_parts })), [info('從歌譜中自動抽出'), warning('歌譜缺少段落標記（P:）')]);
  assert.deepEqual(lyrics_messages(lyrics({ abc: parts, slides: '[A]\n一' })), []);
  assert.deepEqual(lyrics_messages(lyrics({ abc: no_parts, slides: '一' })), [warning('歌譜缺少段落標記（P:）'), warning('投影片欄缺少段落標記（[段名]）')]);
  // 沒有歌詞：譜上沒有 w: 就不提醒段落標記
  assert.deepEqual(lyrics_messages(lyrics({ abc: 'X:1\nK:C\nC|\n' })), [info('這首歌沒有歌詞')]);
});

test('lines_text：只放勾選的行；同一段落換行，換段落或換段時空一行，不放段名', () => {
  const sections = [section('A', [['一', '二', '三'], ['四']]), section('間奏', []), section('B', [['五']])];
  assert.equal(lines_text(sections), '一\n二\n三\n\n四\n\n五');
  const picked = new Set(['0.0.0', '0.0.2', '2.0.0']);
  assert.equal(lines_text(sections, (s, p, l) => picked.has(`${s}.${p}.${l}`)), '一\n三\n\n五');
  assert.equal(lines_text(sections, () => false), '');
  // 傳回字串時用它代替整行（只選到一部分）
  assert.equal(lines_text(sections, (s, p, l) => (s == 0 && p == 0 && l == 2 ? '三' : s == 0 && p == 1 ? '四' : false)), '三\n\n四');
});

test('has_slide_lyrics：有譜，而且「投影片」欄有字或譜上有 w:／W: 才算有歌詞', () => {
  const abc = 'X:1\nK:C\nCDEF|\n';
  assert.equal(has_slide_lyrics({ abc }), false);
  assert.equal(has_slide_lyrics({ abc: abc + 'w:一 二 三 四\n' }), true);
  assert.equal(has_slide_lyrics({ abc: abc + 'W:譜後歌詞\n' }), true);
  assert.equal(has_slide_lyrics({ abc, slides: '一句' }), true);
  assert.equal(has_slide_lyrics({ abc, slides: '  \n' }), false);
  assert.equal(has_slide_lyrics({ abc: '', slides: '一句' }), false);
  assert.equal(has_slide_lyrics(null), false);
});
