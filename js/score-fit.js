// 譜面顯示方式的純函式（不碰 DOM）

// 整頁可見、符合高度、符合寬度
export const FIT_MODES = ['page', 'height', 'width'];
// 沒設定過時用符合寬度（加入這個功能前的顯示方式）
export const DEFAULT_FIT_MODE = 'width';

// 不認識的值（例如 localStorage 裡沒有或被改壞）用預設值
export function normalize_fit_mode(mode) {
  return FIT_MODES.includes(mode) ? mode : DEFAULT_FIT_MODE;
}
