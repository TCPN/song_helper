// abcjs 渲染參數（純函式，不碰 DOM）
// 參數只由移調與版面設定決定，與是哪一首歌無關；版面設定之後會放在 options 裡，所有歌共用

// ABCJS.renderAbc 的參數；clickListener 等函式由呼叫端加上
export function build_render_params({ transpose = 0 } = {}) {
  return {
    // TODO: decide the staffwidth dynamically
    //staffwidth: 800,
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
    format: {
      gchordfont: 'Times New Roman',
      textfont: 'Times New Roman',
      partsfont: '14px Times New Roman',
      // vocalfont: 'PMingLiU',
      // titlefont: '"Microsoft JhengHei" 24px',
    },
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
