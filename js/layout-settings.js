// 「排版…」的設定（純函式，不碰 DOM）：所有歌共用，整包存成 localStorage 的一個 JSON，不放進網址 hash

// 預設值就是加入這些設定前的排版
export const DEFAULT_LAYOUT = {
  // 行間距均等化（#42）
  equalize: true,
  // 行距：行與行之間再加的空間，svg 座標單位（#41）
  line_gap: 0,
};

// 用 −／＋ 調整的數值設定：每按一下加減多少、範圍
export const LAYOUT_STEPS = {
  line_gap: { step: 5, min: 0, max: 60 },
};

function clamp(value, { min, max }) {
  return Math.min(max, Math.max(min, value));
}

// 不認識的欄位丟掉；沒有、型別不對或超出範圍的值用預設值或拉回範圍內
export function normalize_layout(layout) {
  var source = (layout && typeof layout == 'object') ? layout : {};
  var result = { ...DEFAULT_LAYOUT };
  if(typeof source.equalize == 'boolean')
    result.equalize = source.equalize;
  for(const [key, range] of Object.entries(LAYOUT_STEPS)){
    if(typeof source[key] == 'number' && Number.isFinite(source[key]))
      result[key] = clamp(source[key], range);
  }
  return result;
}

// localStorage 裡的字串（可能沒有或被改壞）轉成設定
export function parse_layout(text) {
  try {
    return normalize_layout(JSON.parse(text));
  } catch(e) {
    return normalize_layout(null);
  }
}

// 數值設定往上（steps > 0）或往下調幾格，傳回新的設定
export function step_layout(layout, key, steps) {
  var range = LAYOUT_STEPS[key];
  var current = normalize_layout(layout);
  if(!range)
    return current;
  return normalize_layout({ ...current, [key]: current[key] + steps * range.step });
}
