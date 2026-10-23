// 每行譜的高度計算（純函式，不碰 DOM）；量測在 score-layout.js

// staff_bottoms[i]：第 i 行五線譜底線的 y；needed_heights[i]：第 i 行所有內容的底部 y
// 除了最後一行，每行譜下方的空間取最大值，讓各行高度一致
// 傳回每行要設的高度，null 表示不改（最後一行維持 abcjs 給的高度）
export function equalized_line_heights(staff_bottoms, needed_heights) {
  var height_below_staff = needed_heights.map((h,i)=>(h - staff_bottoms[i]));
  var max_height_below_staff = Math.max(...height_below_staff.slice(0, -1));
  return staff_bottoms.map((b,i)=>(i < staff_bottoms.length - 1 ? b + max_height_below_staff : null));
}
