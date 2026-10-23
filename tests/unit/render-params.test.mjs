import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build_render_params, build_midi_params, widened_staffwidth } from '../../js/render-params.js';
import { DEFAULT_LAYOUT } from '../../js/layout-settings.js';

test('build_render_params：移調半音數放在 visualTranspose，預設 0', () => {
  assert.equal(build_render_params({ transpose: 3 }).visualTranspose, 3);
  assert.equal(build_render_params({ transpose: -2 }).visualTranspose, -2);
  assert.equal(build_render_params().visualTranspose, 0);
});

test('build_render_params：預設的排版設定和加入設定前一樣（staffwidth 740 是 abcjs 螢幕上的預設，歌詞不指定字型）', () => {
  const params = build_render_params({ transpose: 0 });
  assert.equal(params.staffwidth, 740);
  assert.deepEqual(build_render_params({ layout: DEFAULT_LAYOUT }), params);
  assert.equal(params.responsive, 'resize');
  assert.equal(params.oneSvgPerLine, true);
  assert.equal(params.add_classes, true);
  assert.deepEqual(params.format, {
    gchordfont: 'Times New Roman 12',
    textfont: 'Times New Roman',
    partsfont: '14px Times New Roman',
  });
  assert.equal('clickListener' in params, false);
});

test('build_render_params：譜面寬度就是 staffwidth', () => {
  assert.equal(build_render_params({ layout: { ...DEFAULT_LAYOUT, staff_width: 1100 } }).staffwidth, 1100);
  assert.equal(build_render_params({ layout: { ...DEFAULT_LAYOUT, staff_width: 300 } }).staffwidth, 300);
});

test('build_render_params：歌詞、和弦字級（字型字串是「字型 大小 粗細」，歌詞維持粗體）', () => {
  const params = build_render_params({ layout: { ...DEFAULT_LAYOUT, lyric_size: 16, chord_size: 14 } });
  assert.equal(params.format.vocalfont, 'Times New Roman 16 bold');
  assert.equal(params.format.gchordfont, 'Times New Roman 14');
  assert.equal(build_render_params({ layout: { ...DEFAULT_LAYOUT, chord_size: 14 } }).format.vocalfont, undefined);
});

test('build_render_params：layout 缺的欄位用預設值', () => {
  assert.equal(build_render_params({ layout: { equalize: false } }).staffwidth, 740);
  assert.equal(build_render_params({ layout: { equalize: false } }).format.gchordfont, 'Times New Roman 12');
});

test('build_render_params：每次傳回新的物件，呼叫端改它不影響下一次', () => {
  const a = build_render_params();
  a.format.textfont = 'x';
  a.clickListener = () => {};
  const b = build_render_params();
  assert.equal(b.format.textfont, 'Times New Roman');
  assert.equal('clickListener' in b, false);
});

test('build_midi_params：只帶移調半音數', () => {
  assert.deepEqual(build_midi_params({ transpose: 5 }), { visualTranspose: 5 });
  assert.deepEqual(build_midi_params(), { visualTranspose: 0 });
});

test('widened_staffwidth：有行超出排版寬度時傳回最寬那行需要的寬度，否則 null', () => {
  assert.equal(widened_staffwidth([770, 770, 755], 740), null);
  assert.equal(widened_staffwidth([622, 600, 330], 300), 592);
  assert.equal(widened_staffwidth([330.4, 330], 300), null);
  assert.equal(widened_staffwidth([340.2, 330], 300), 311);
});
