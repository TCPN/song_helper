// 譜面顯示方式的純函式（不碰 DOM）

// 整頁可見、符合高度、符合寬度
export const FIT_MODES = ['page', 'height', 'width'];
// 沒設定過時用符合寬度（加入這個功能前的顯示方式）
export const DEFAULT_FIT_MODE = 'width';

// 不認識的值（例如 localStorage 裡沒有或被改壞）用預設值
export function normalize_fit_mode(mode) {
  return FIT_MODES.includes(mode) ? mode : DEFAULT_FIT_MODE;
}

// 譜紙：分頁（值是 a4，選單上顯示「分頁」；A4 直式比例，一次顯示一頁，見 score-pages.js）、不分頁（高度依譜的內容）
export const PAPER_MODES = ['a4', 'content'];
// 沒設定過時用 A4（加入這個功能前的譜紙）
export const DEFAULT_PAPER_MODE = 'a4';

export function normalize_paper_mode(mode) {
  return PAPER_MODES.includes(mode) ? mode : DEFAULT_PAPER_MODE;
}
