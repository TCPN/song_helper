import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FIT_MODE, normalize_fit_mode, DEFAULT_PAPER_MODE, normalize_paper_mode } from '../../js/score-fit.js';

test('normalize_fit_mode：認得的值照用，其他用預設（符合寬度）', () => {
  assert.equal(DEFAULT_FIT_MODE, 'width');
  for (const mode of ['page', 'height', 'width'])
    assert.equal(normalize_fit_mode(mode), mode);
  for (const bad of [null, undefined, '', 'Page', 'fit'])
    assert.equal(normalize_fit_mode(bad), 'width');
});

test('normalize_paper_mode：認得的值照用，其他用預設（A4）', () => {
  assert.equal(DEFAULT_PAPER_MODE, 'a4');
  for (const mode of ['a4', 'content'])
    assert.equal(normalize_paper_mode(mode), mode);
  for (const bad of [null, undefined, '', 'A4', 'width'])
    assert.equal(normalize_paper_mode(bad), 'a4');
});
