// 過渡用：script.js 還是一般的 script（HTML 也還在用 onclick=），
// 先把模組裡的函式掛到 window 給它用。script.js 拆成模組後（#9 第 4 步）就刪掉這個檔案。
// index.html 裡這支要放在 script.js 前面：兩者都是延後執行，會依文件順序執行。
import { parse_params, params_to_str } from './hash.js';
import { score_kind, tempo_text, key_display_name } from './abc.js';
import { getSongArray } from './song-data.js';
import { search_pattern_to_regexp, make_song_matcher } from './search.js';
import { keypad_button_for_key } from './keypad.js';

Object.assign(window, {
  parse_params,
  params_to_str,
  score_kind,
  tempo_text,
  key_display_name,
  getSongArray,
  search_pattern_to_regexp,
  make_song_matcher,
  keypad_button_for_key,
});
