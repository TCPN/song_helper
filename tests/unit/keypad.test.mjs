import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keypad_button_for_key } from '../../js/keypad.js';

test('keypad_button_for_key：數字鍵對應同一個數字', () => {
  for (let d = 0; d <= 9; d++)
    assert.equal(keypad_button_for_key(String(d)), String(d));
});

test('keypad_button_for_key：功能鍵', () => {
  assert.equal(keypad_button_for_key('Enter'), 'ent');
  assert.equal(keypad_button_for_key('Escape'), 'esc');
  assert.equal(keypad_button_for_key('ArrowUp'), 'dec');
  assert.equal(keypad_button_for_key('ArrowLeft'), 'dec');
  assert.equal(keypad_button_for_key('ArrowDown'), 'inc');
  assert.equal(keypad_button_for_key('ArrowRight'), 'inc');
  assert.equal(keypad_button_for_key('c'), 'clr');
  assert.equal(keypad_button_for_key('C'), 'clr');
  assert.equal(keypad_button_for_key('Backspace'), 'del');
  assert.equal(keypad_button_for_key('Delete'), 'del');
});

test('keypad_button_for_key：其他鍵沒有對應', () => {
  assert.equal(keypad_button_for_key('a'), undefined);
  assert.equal(keypad_button_for_key('Tab'), undefined);
});
