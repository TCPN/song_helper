// 譜面上方工具列：不夠寬時把列印、播放、編輯收進「⋮」選單（加上 compact class，CSS 切換顯示）
const TOP_BAR = '#score_popup_top_bar';

// 先用完整的版面量一次：顯示中的項目從最左到最右的寬度超過工具列，就切成精簡版面。
// 只量排在工具列裡的項目，展開的選單（position: absolute）不算
export function update_toolbar_layout() {
  var bar = document.querySelector(TOP_BAR);
  var was_compact = bar.classList.contains('compact');
  bar.classList.remove('compact');
  var items = Array.from(bar.children).filter((item)=>(
    item.offsetParent != null && getComputedStyle(item).position == 'static'));
  if(items.length == 0)
    return;
  var first = items[0].getBoundingClientRect();
  var last = items[items.length - 1].getBoundingClientRect();
  if(last.right - first.left > bar.clientWidth)
    bar.classList.add('compact');
  // 換版面時收起「編輯」和「⋮」選單，不然按鈕被藏起來、選單卻還開著，切回來時會自己冒出來
  if(bar.classList.contains('compact') != was_compact){
    for(const menu of document.querySelectorAll('#editor-menu, #more-menu'))
      menu.classList.add('hide');
    for(const button of document.querySelectorAll('#edit_button, #more_button'))
      button.setAttribute('aria-expanded', false);
  }
}

// 工具列大小改變（轉向、調整視窗、譜面打開）時重新判斷
export function setup_toolbar_layout() {
  new ResizeObserver(update_toolbar_layout).observe(document.querySelector(TOP_BAR));
}
