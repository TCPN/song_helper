// 譜面上記號的位置修正（純函式，不碰 DOM）；量測與修改在 score-layout.js

// 和弦寫成另一個聲部時，兩個聲部各帶一個反覆框（[1、[2），abcjs 會各畫一個；行開頭時兩個框還沒對齊（#64）。
// endings 是同一行裡的反覆框 { voice, label, x1, x2 }（voice 是聲部編號，label 是框裡的字，x1～x2 是框的橫線）。
// 較後面的聲部如果和前面的聲部有同樣字、橫線重疊的框，就是多畫的；傳回這些框在 endings 裡的索引
export function duplicate_endings(endings) {
  return endings.flatMap((e, i)=>(
    endings.some((f)=>(f.voice < e.voice && f.label == e.label && f.x1 < e.x2 && e.x1 < f.x2)) ? [i] : []
  ));
}

// part 標記（[P:Chorus] 等）靠近行尾時，abcjs 從音符的位置往右寫，可能超出譜的右邊界（#69）。
// box 是標記的左右 { left, right }，limit 是譜的左右邊界 { left, right }；
// 傳回要往右移多少（負數是往左），不超出右邊界，但也不移到左邊界外面
export function fit_inside(box, limit) {
  if(box.right <= limit.right)
    return 0;
  return Math.max(limit.right - box.right, limit.left - box.left);
}
