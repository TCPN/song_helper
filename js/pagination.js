// 分頁的純函式（不碰 DOM）；量測與顯示在 score-pages.js

// 分頁的譜紙是 A4 直式，高是寬的 √2 倍（210 × 297 mm）
export const A4_RATIO = Math.SQRT2;

// 浮點誤差：剛好塞滿一頁的行不要被擠到下一頁
const EPSILON = 1e-6;

// line_heights[i]：第 i 行的高度；page_height：一頁的高度（單位和行高一樣；不分頁時傳 Infinity）
// forced_breaks：要從新的一頁開始的行（第幾行，0 起算）；0、超出範圍或重複的直接忽略
// 從第一行開始一行一行放，放不下就換頁，一行不會切開；比一頁還高的行自己一頁（那一頁超出，不縮小）。
// 傳回每一頁有哪些行（行的索引），沒有行時傳回空陣列
export function paginate(line_heights, page_height, forced_breaks = []) {
  var breaks = new Set(forced_breaks);
  var pages = [];
  var used = 0;
  line_heights.forEach((height, i)=>{
    var page = pages[pages.length - 1];
    if(!page || breaks.has(i) || used + height > page_height + EPSILON){
      pages.push([i]);
      used = height;
    }
    else {
      page.push(i);
      used += height;
    }
  });
  return pages;
}

// 第 line 行在第幾頁（0 起算）；找不到時傳回 0
export function page_of_line(pages, line) {
  var index = pages.findIndex((page)=>page.includes(line));
  return index < 0 ? 0 : index;
}
