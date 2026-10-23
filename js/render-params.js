// abcjs 渲染參數（純函式，不碰 DOM）
// 參數只由移調與「排版…」的設定決定，與是哪一首歌無關；排版設定所有歌共用
import { DEFAULT_LAYOUT } from './layout-settings.js';

// abcjs 沒有指定 staffwidth 時，螢幕上用的排版寬度
export const DEFAULT_STAFFWIDTH = 740;

// ABCJS.renderAbc 的參數；clickListener 等函式由呼叫端加上。
// layout 只用到密度（staffwidth）與歌詞、和弦字級，均等化與行距在渲染後由 score-layout.js 處理
export function build_render_params({ transpose = 0, layout = DEFAULT_LAYOUT } = {}) {
  var { density = DEFAULT_LAYOUT.density, lyric_size = DEFAULT_LAYOUT.lyric_size,
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
    staffwidth: Math.round(DEFAULT_STAFFWIDTH * density / 100),
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

// ABCJS.renderMidi 的參數
export function build_midi_params({ transpose = 0 } = {}) {
  return {
    visualTranspose: transpose,
    //midiTranspose: transpose,
  };
}
