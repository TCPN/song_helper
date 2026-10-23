// 「排版…」的設定（純函式，不碰 DOM）：所有歌共用，整包存成 localStorage 的一個 JSON，不放進網址 hash

// 預設值就是加入這些設定前的排版
export const DEFAULT_LAYOUT = {
  // 行間距均等化（#42）
  equalize: true,
  // 行距：行與行之間再加的空間，svg 座標單位（#41）
  line_gap: 0,
  // 譜面寬度：abcjs 的排版寬度（staffwidth），預設 740 是 abcjs 螢幕上的預設；越寬每行在畫面上越小、越密（#38）
  staff_width: 740,
  // 歌詞、和弦的字級：abcjs 的 vocalfont／gchordfont 大小，預設是 abcjs 原本的大小（#39、#40）
  lyric_size: 13,
  chord_size: 12,
};

// 用 −／＋ 調整的數值設定：每按一下加減多少、範圍
export const LAYOUT_STEPS = {
  line_gap: { step: 5, min: 0, max: 60 },
  staff_width: { step: 40, min: 300, max: 1500 },
  lyric_size: { step: 1, min: 8, max: 24 },
  chord_size: { step: 1, min: 8, max: 24 },
};

// 這些設定會改變 abcjs 的排版，要重新渲染譜面；其他設定（均等化、行距）只改行高
export const RERENDER_KEYS = ['staff_width', 'lyric_size', 'chord_size'];

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

// 數值設定往上（steps > 0）或往下調幾格，傳回新的設定。
// from 是要從哪個值開始調（預設是設定裡的值；例如譜面寬度實際用的值可能比設定的大）；
// 不在格子上的值先往調整的方向對齊格子，例如寬度從 598 往上一格是 620
export function step_layout(layout, key, steps, from) {
  var range = LAYOUT_STEPS[key];
  var current = normalize_layout(layout);
  if(!range)
    return current;
  var base = (typeof from == 'number' && Number.isFinite(from)) ? from : current[key];
  var index = (base - range.min) / range.step;
  var target = steps > 0 ? Math.floor(index) + steps : Math.ceil(index) + steps;
  return normalize_layout({ ...current, [key]: range.min + target * range.step });
}

// 從 old_layout 改成 new_layout 時要不要重新渲染譜面
export function needs_rerender(old_layout, new_layout) {
  var a = normalize_layout(old_layout);
  var b = normalize_layout(new_layout);
  return RERENDER_KEYS.some((key)=>(a[key] != b[key]));
}

// 面板上顯示的值（有 unit 的設定加上單位）
export function format_layout_value(key, value) {
  var unit = (LAYOUT_STEPS[key] && LAYOUT_STEPS[key].unit) || '';
  return value + unit;
}
