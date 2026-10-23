// abcjs 渲染參數（純函式，不碰 DOM）
// 參數只由移調與「排版」的設定決定，與是哪一首歌無關；排版設定所有歌共用
import { DEFAULT_LAYOUT } from './layout-settings.js';

// ABCJS.renderAbc 的參數；clickListener 等函式由呼叫端加上。
// layout 只用到譜面寬度（staffwidth）與歌詞、和弦字級，均等化與行距在渲染後由 score-layout.js 處理
export function build_render_params({ transpose = 0, layout = DEFAULT_LAYOUT } = {}) {
  var { staff_width = DEFAULT_LAYOUT.staff_width, lyric_size = DEFAULT_LAYOUT.lyric_size,
    chord_size = DEFAULT_LAYOUT.chord_size } = layout;
  var format = {
    gchordfont: `Times New Roman ${chord_size}`,
    textfont: 'Times New Roman',
    partsfont: '14px Times New Roman',
    // titlefont: '"Microsoft JhengHei" 24px',
  };
  // 歌詞預設維持 abcjs 原本的字型（"Times New Roman" 13 粗體），有調整才指定；字型字串是「字型 大小 粗細」
  if(lyric_size != DEFAULT_LAYOUT.lyric_size)
    format.vocalfont = `Times New Roman ${lyric_size} bold`;
  return {
    // 排版寬度越寬，縮放到同樣寬度的 svg 上就越小、越密；換行位置仍依 ABC 原本的換行
    staffwidth: staff_width,
    responsive: 'resize',
    //wrap: {
      //minSpacing: 1.8,
      //maxSpacing: 3,
      //preferredMeasuresPerLine: 4,
    //},
    oneSvgPerLine: true,
    add_classes: true,
    // generate_midi: true,
    // midi_id: 'player_control',
    format,
    visualTranspose: transpose,
  };
}

// abcjs 每行 svg 的 viewBox 寬度是排版寬度加上左右邊界（abcjs 5.8.0 是 15 + 15；升級 abcjs 時要重新確認）
export const ABCJS_PADDING = 30;

// 排版寬度太窄時，abcjs 會把塞不下的那一行撐寬，而每行是各自縮放到譜紙寬度的 svg，撐寬的行看起來就比較小。
// line_widths 是渲染後每行 svg 的 viewBox 寬度；有行超出 staffwidth 時傳回最寬那行需要的排版寬度（用它重新渲染，
// 每行就一樣大，這也是這首歌最小的譜面寬度），都沒超出時傳回 null
export function widened_staffwidth(line_widths, staffwidth) {
  var needed = Math.ceil(Math.max(...line_widths) - ABCJS_PADDING);
  // 差不到 1 的誤差不算超出
  return needed > staffwidth + 1 ? needed : null;
}

// ABCJS.renderMidi 的參數
export function build_midi_params({ transpose = 0 } = {}) {
  return {
    visualTranspose: transpose,
    //midiTranspose: transpose,
  };
}
