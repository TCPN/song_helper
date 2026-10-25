import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duplicate_endings, fit_inside } from '../../js/score-marks.js';

test('duplicate_endings：後面的聲部有同樣字、重疊的框時是多畫的', () => {
  const endings = [
    { voice: 0, label: '1', x1: 60, x2: 270 },
    { voice: 0, label: '2', x1: 272, x2: 480 },
    { voice: 1, label: '1', x1: 21, x2: 268 },
    { voice: 1, label: '2', x1: 272, x2: 480 },
  ];
  assert.deepEqual(duplicate_endings(endings), [2, 3]);
});

test('duplicate_endings：只有一個聲部有框、字不同或沒重疊時都保留', () => {
  assert.deepEqual(duplicate_endings([{ voice: 1, label: '1', x1: 20, x2: 200 }]), []);
  assert.deepEqual(duplicate_endings([
    { voice: 0, label: '1', x1: 60, x2: 270 },
    { voice: 1, label: '2', x1: 100, x2: 300 },
    { voice: 1, label: '1', x1: 300, x2: 400 },
  ]), []);
});

test('duplicate_endings：跨行接續的框（沒有字）也去重', () => {
  assert.deepEqual(duplicate_endings([
    { voice: 1, label: '', x1: 20, x2: 200 },
    { voice: 0, label: '', x1: 40, x2: 200 },
  ]), [0]);
});

test('fit_inside：沒超出右邊界時不移', () => {
  assert.equal(fit_inside({ left: 600, right: 700 }, { left: 15, right: 755 }), 0);
  assert.equal(fit_inside({ left: 655, right: 755 }, { left: 15, right: 755 }), 0);
});

test('fit_inside：超出右邊界時往左移到剛好對齊', () => {
  assert.equal(fit_inside({ left: 700, right: 790 }, { left: 15, right: 755 }), -35);
});

test('fit_inside：比譜還寬時對齊左邊界', () => {
  assert.equal(fit_inside({ left: 100, right: 900 }, { left: 15, right: 755 }), -85);
});
