// 譜面上方「歌號」小鍵盤的鍵盤對應

var btn_map = {
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  'Enter': 'ent',
  'Escape': 'esc',
  'ArrowUp': 'dec',
  'ArrowLeft': 'dec',
  'ArrowDown': 'inc',
  'ArrowRight': 'inc',
  'c': 'clr',
  'C': 'clr',
  'Backspace': 'del',
  'Delete': 'del',
};

// KeyboardEvent.key → 小鍵盤按鈕的值（見 song_id_popup_control）；沒有對應時為 undefined
export function keypad_button_for_key(key) {
  return btn_map[key];
}
