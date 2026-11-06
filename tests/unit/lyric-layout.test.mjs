import { test } from 'node:test';
import assert from 'node:assert/strict';
import { section_to_text, text_to_paragraphs, sections_to_cell, strip_whitespace, text_change, describe_change,
  layout_changes, apply_texts, parse_saved_layouts, create_history, history_record, history_undo, history_redo,
  can_undo, can_redo } from '../../js/lyric-layout.js';
import { parse_slide_cell, song_slide_lyrics, lyrics_messages } from '../../js/slide-lyrics.js';

const section = (name, paragraphs, source = null) => ({ name, source, paragraphs });

test('section_to_text／text_to_paragraphs：一行一句，段內分段空一行；行頭行尾的空白與多的空行拿掉', () => {
  assert.equal(section_to_text(section('A', [['一', '二'], ['三']])), '一\n二\n\n三');
  assert.deepEqual(text_to_paragraphs('  一 二 \n三\n\n\n\n四\n'), [['一 二', '三'], ['四']]);
  assert.deepEqual(text_to_paragraphs(''), []);
});

test('sections_to_cell：存成「投影片」欄格式，parse_slide_cell 讀得回來', () => {
  const sections = [section(null, [['前言']]), section('主歌', [['一', '二'], ['三']], 'A1'), section('空段', [])];
  const cell = sections_to_cell(sections);
  assert.equal(cell, '前言\n\n[主歌 = A1]\n一\n二\n\n三\n\n[空段]');
  assert.deepEqual(parse_slide_cell(cell).sections, sections);
});

test('strip_whitespace／text_change：只看去掉空白（含全形空白、換行）後的字', () => {
  assert.equal(strip_whitespace('一 二\n\n三　四'), '一二三四');
  assert.equal(text_change('一二三四', '一 二\n三　四'), null);
  assert.deepEqual(text_change('甲乙丙丁戊', '甲丙丁戊'), { removed: '乙', added: '', before: '甲', after: '丙丁戊' });
  assert.deepEqual(text_change('甲乙丙', '甲乙丙！'), { removed: '', added: '！', before: '甲乙丙', after: '' });
  assert.deepEqual(text_change('一二三四五六', '一二X四五六', 2), { removed: '三', added: 'X', before: '一二', after: '四五' });
});

test('describe_change：刪掉／加了／改成，▲ 標出位置', () => {
  assert.equal(describe_change({ removed: '乙', added: '', before: '甲', after: '丙' }), '刪掉「乙」（…甲▲丙…）');
  assert.equal(describe_change({ removed: '', added: '啊', before: '', after: '一二' }), '加了「啊」（▲一二…）');
  assert.equal(describe_change({ removed: '甜', added: '田', before: '甘', after: '' }), '「甜」改成「田」（…甘▲）');
});

test('layout_changes：只列出有變動的段', () => {
  assert.deepEqual(layout_changes(['一二', '三四'], ['一\n二', '三']).map((c) => c.index), [1]);
  assert.deepEqual(layout_changes(['一二'], ['一 二']), []);
});

test('apply_texts：文字放回段裡，段名與來源照舊', () => {
  assert.deepEqual(apply_texts([section('A', [['一二']], 'A1')], ['一\n\n二']), [section('A', [['一'], ['二']], 'A1')]);
});

test('parse_saved_layouts：壞掉或不是物件時當成沒有；只留字串', () => {
  assert.deepEqual(parse_saved_layouts(null), {});
  assert.deepEqual(parse_saved_layouts('{bad'), {});
  assert.deepEqual(parse_saved_layouts('[1]'), {});
  assert.deepEqual(parse_saved_layouts('{"10":"[A]\\n一","11":3}'), { 10: '[A]\n一' });
});

test('history：一步一步復原、重做；同一個 merge_key 在時間內合成一步；復原後再記錄就不能重做', () => {
  const h = create_history('a', 1000);
  assert.equal(can_undo(h), false);
  history_record(h, 'ab', 'type', 0);
  history_record(h, 'abc', 'type', 500); // 合成一步
  history_record(h, 'abc ', null, 600);
  history_record(h, 'abc d', 'type', 700);
  history_record(h, 'abc de', 'type', 2000); // 太久，新的一步
  assert.deepEqual(h.stack, ['a', 'abc', 'abc ', 'abc d', 'abc de']);
  assert.equal(history_undo(h), 'abc d');
  assert.equal(history_undo(h), 'abc ');
  assert.equal(can_redo(h), true);
  assert.equal(history_redo(h), 'abc d');
  // 復原之後的下一個動作是新的一步（就算 merge_key 一樣）
  history_undo(h);
  history_record(h, 'abc x', 'type', 2100);
  assert.equal(can_redo(h), false);
  assert.deepEqual(h.stack, ['a', 'abc', 'abc ', 'abc x']);
  assert.equal(history_undo(h), 'abc ');
  history_undo(h);
  history_undo(h);
  assert.equal(history_undo(h), null);
});

test('song_slide_lyrics：有本機暫存時用暫存的段，記下原本的段；字不一樣時 local_differs', () => {
  const song = { abc: 'X:1\nK:C\nP:A\nCDEF|\nw:一 二 三 四\n' };
  const same = song_slide_lyrics(song, '[A]\n一二\n\n三四');
  assert.equal(same.from, 'local');
  assert.deepEqual(same.sections, [section('A', [['一二'], ['三四']])]);
  assert.deepEqual(same.source_sections, [section('A', [['一二三四']])]);
  assert.equal(same.local_differs, false);
  assert.deepEqual(lyrics_messages(same).map((m) => m.text), ['使用這台裝置暫存的排版（還沒存回試算表）']);
  const differs = song_slide_lyrics(song, '[A]\n一二三');
  assert.equal(differs.local_differs, true);
  assert.deepEqual(lyrics_messages(differs).map((m) => m.type), ['info', 'warning']);
  // 暫存是空的：照原本的
  assert.equal(song_slide_lyrics(song, '  ').from, 'abc');
});

import { join_sections, split_sections, apply_edit } from '../../js/lyric-layout.js';

test('join_sections／split_sections：段和段之間一個換行，記下每段開頭的位置', () => {
  const joined = join_sections(['一\n二', '', '三']);
  assert.deepEqual(joined, { text: '一\n二\n\n三', boundaries: [0, 4, 5] });
  assert.deepEqual(split_sections(joined.text, joined.boundaries), ['一\n二', '', '三']);
});

test('apply_edit：前面的段改動時，後面的段開頭跟著移動', () => {
  // 'ab' | 'cd'：text 'ab\ncd'，第二段從 3 開始
  assert.deepEqual(apply_edit('ab\ncd', 'a b\ncd', 2, [0, 3]), [0, 4]);
  assert.deepEqual(apply_edit('ab\ncd', 'ab\nc d', 5, [0, 3]), [0, 3]);
  // 在第一段最後按換行（游標在 3）：新的換行屬於第一段
  assert.deepEqual(apply_edit('ab\ncd', 'ab\n\ncd', 3, [0, 3]), [0, 4]);
  // 在第二段開頭按換行（游標在 4）：屬於第二段，開頭不動
  assert.deepEqual(apply_edit('ab\ncd', 'ab\n\ncd', 4, [0, 3]), [0, 3]);
  // 刪掉第二段開頭的字可以
  assert.deepEqual(apply_edit('ab\ncd', 'ab\nd', 3, [0, 3]), [0, 3]);
});

test('apply_edit：刪到段和段之間的換行（段落標記）不允許', () => {
  // 在第二段開頭按 Backspace
  assert.equal(apply_edit('ab\ncd', 'abcd', 2, [0, 3]), null);
  // 選取跨過兩段後打字
  assert.equal(apply_edit('ab\ncd', 'aXd', 2, [0, 3]), null);
  // 全選刪掉
  assert.equal(apply_edit('ab\ncd', '', 0, [0, 3]), null);
  // 段內的換行可以刪
  assert.deepEqual(apply_edit('a\nb\ncd', 'ab\ncd', 1, [0, 4]), [0, 3]);
});
