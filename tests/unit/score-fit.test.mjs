import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FIT_MODE, normalize_fit_mode } from '../../js/score-fit.js';

test('normalize_fit_mode：認得的值照用，其他用預設（符合寬度）', () => {
  assert.equal(DEFAULT_FIT_MODE, 'width');
  for (const mode of ['page', 'height', 'width'])
    assert.equal(normalize_fit_mode(mode), mode);
  for (const bad of [null, undefined, '', 'Page', 'fit'])
    assert.equal(normalize_fit_mode(bad), 'width');
});
