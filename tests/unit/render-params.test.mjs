import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build_render_params, build_midi_params } from '../../js/render-params.js';

test('build_render_params：移調半音數放在 visualTranspose，預設 0', () => {
  assert.equal(build_render_params({ transpose: 3 }).visualTranspose, 3);
  assert.equal(build_render_params({ transpose: -2 }).visualTranspose, -2);
  assert.equal(build_render_params().visualTranspose, 0);
});

test('build_render_params：固定的版面與字型設定（現況）', () => {
  const params = build_render_params({ transpose: 0 });
  assert.equal(params.responsive, 'resize');
  assert.equal(params.oneSvgPerLine, true);
  assert.equal(params.add_classes, true);
  assert.deepEqual(params.format, {
    gchordfont: 'Times New Roman',
    textfont: 'Times New Roman',
    partsfont: '14px Times New Roman',
  });
  assert.equal('clickListener' in params, false);
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
