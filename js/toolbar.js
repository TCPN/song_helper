// 譜面上方工具列：螢幕寬度小於 520px（或放不下）時把列印、播放、檢視歌詞、編輯、排版收進「⋮」選單、「檢視」換成 icon（加上 compact class，CSS 切換顯示）
const TOP_BAR = '#score_popup_top_bar';

// 螢幕寬度小於這個值就用精簡版面
export const COMPACT_MAX_WIDTH = 520;

// 螢幕寬度小於 COMPACT_MAX_WIDTH 就切成精簡版面。
// 以防萬一（例如很長的調名、字比較大）再用完整的版面量一次：顯示中的項目從最左到最右的寬度超過工具列，也切成精簡版面。
// 只量排在工具列裡的項目，展開的選單（position: absolute）不算
export function update_toolbar_layout() {
  var bar = document.querySelector(TOP_BAR);
  var was_compact = bar.classList.contains('compact');
  bar.classList.remove('compact');
  if(document.documentElement.clientWidth < COMPACT_MAX_WIDTH)
    bar.classList.add('compact');
  else {
    var items = Array.from(bar.children).filter((item)=>(
      item.offsetParent != null && getComputedStyle(item).position == 'static'));
    if(items.length == 0)
      return;
    var first = items[0].getBoundingClientRect();
    var last = items[items.length - 1].getBoundingClientRect();
    if(last.right - first.left > bar.clientWidth)
      bar.classList.add('compact');
  }
  // 換版面時收起會被收進「⋮」的選單和「⋮」選單，不然按鈕被藏起來、選單卻還開著，切回來時會自己冒出來
  if(bar.classList.contains('compact') != was_compact){
    for(const menu of document.querySelectorAll('#editor-menu, #more-menu, #view-menu, #layout-panel'))
      menu.classList.add('hide');
    for(const button of document.querySelectorAll('#edit_button, #more_button, #view_button, #layout_button'))
      button.setAttribute('aria-expanded', false);
  }
}

// 工具列大小改變（轉向、調整視窗、譜面打開）時重新判斷
export function setup_toolbar_layout() {
  new ResizeObserver(update_toolbar_layout).observe(document.querySelector(TOP_BAR));
}
