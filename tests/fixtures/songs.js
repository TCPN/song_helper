// 自編的短 ABC 測試曲，不是真實歌曲，所以放在公開 repo 也沒有版權問題。
// 欄位對應 script.js 的 getSongArray：編號、歌名、調號、拍號、首句旋律、abc。
// - id 1：有和弦、有歌詞、有速度標記（Q:）
// - id 2：只有旋律（沒有和弦符號），列表會顯示「僅旋律」的圖示
// - id 3：刻意沒有譜（abc 為 null），用來測試「有歌名但沒有譜」的情況
const SONGS = [
  {
    id: 1,
    name: '測試歌一',
    tone: 'C',
    timesig: '4/4',
    melody: 'CDEF',
    abc: 'X:1\nT:Test Song One\nM:4/4\nL:1/4\nQ:1/4=80\nK:C\n"C"CDEF|"G"GFED|"C"C4|]\nw:do re mi fa sol fa mi re do\n',
  },
  {
    id: 2,
    name: '測試歌二',
    tone: 'G',
    timesig: '3/4',
    melody: 'GAB',
    abc: 'X:2\nT:Test Song Two\nM:3/4\nL:1/4\nK:G\nGAB|AGF|G3|]\n',
  },
  {
    id: 3,
    name: '無譜的歌',
    tone: 'D',
    timesig: '4/4',
    melody: 'DEF#G',
    abc: null,
  },
  {
    id: 4,
    name: '小調測試',
    tone: 'Am',
    timesig: '4/4',
    melody: 'ABcd',
    abc: 'X:4\nT:Test Song Four\nM:4/4\nL:1/4\nK:Am\n"Am"ABcd|"E"edcB|"Am"A4|]\n',
  },
];

module.exports = { SONGS };
