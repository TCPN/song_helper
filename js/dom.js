// DOM 小工具：彈窗開關、class 切換、捲動位置

export function getDom(target) {
  if(typeof target == 'string')
    target = document.querySelector(target);
  return target;
}

export function openDom(target){
  target = getDom(target);
  target.classList.add('open');
}

export function isOpenDom(target){
  target = getDom(target);
  return target.classList.contains('open');
}

export function closeDom(target){
  target = getDom(target);
  target.classList.remove('open');
}

export function toggleClass(element, class_name) {
  if(typeof element == 'string')
    element = document.querySelector(element);
  if(element.classList.contains(class_name))
    element.classList.remove(class_name);
  else
    element.classList.add(class_name);
}

var scroll_tmp = {};
export function save_scroll(selector){
  var dom = document.querySelector(selector);
  scroll_tmp[selector] = dom.scrollTop;
}

export function restore_scroll(selector){
  var dom = document.querySelector(selector);
  dom.scrollTop = scroll_tmp[selector];
}

// 讓不是 <button> 的按鈕（要搭配 tabindex="0"）可以用 Enter／空白鍵觸發 click；
// 只處理按鈕自己有焦點的時候，裡面的輸入框照常打字
export function click_on_enter(target) {
  target = getDom(target);
  target.addEventListener('keydown', (event)=>{
    if(event.target == target && (event.key == 'Enter' || event.key == ' ')){
      event.preventDefault();
      target.click();
    }
  });
}

// 下拉選單預設左邊對齊按鈕；右邊超出畫面時才改成右邊對齊（加 align-right class）；
// 這樣左邊還是超出畫面（很窄的螢幕上較寬的選單）就往右移到貼齊畫面左邊
export function place_menu(menu) {
  menu = getDom(menu);
  menu.classList.remove('align-right');
  menu.style.right = '';
  if(menu.getBoundingClientRect().right > document.documentElement.clientWidth){
    menu.classList.add('align-right');
    var left = menu.getBoundingClientRect().left;
    if(left < 0)
      menu.style.right = left + 'px';
  }
}

// 開關按鈕的下拉選單（選單用 hide class 收起），並更新按鈕的 aria-expanded
export function toggle_menu(button, menu) {
  button = getDom(button);
  menu = getDom(menu);
  toggleClass(menu, 'hide');
  var expanded = !menu.classList.contains('hide');
  if(expanded)
    place_menu(menu);
  button.setAttribute('aria-expanded', expanded);
  // 用鍵盤選了項目後選單收起，焦點還給按鈕，不要掉在隱藏的項目上
  if(!expanded && menu.contains(document.activeElement))
    visible_button(button).focus();
}

// 按鈕被收起來時（工具列不夠寬，「檢視」「排版」改從「⋮」打開），改用 data-compact-button 指定的按鈕
function visible_button(button) {
  if(button.offsetParent == null && button.dataset.compactButton)
    return document.querySelector(button.dataset.compactButton);
  return button;
}

// 不用遮罩的下拉選單（選單不放在按鈕裡面）：點按鈕開關；開著時其他按鈕照樣能按，
// 點按鈕和選單以外的地方或按 Esc 就收起
export function setup_dropdown(button, menu) {
  button = getDom(button);
  menu = getDom(menu);
  button.addEventListener('click', ()=>{ toggle_menu(button, menu); });
  click_on_enter(button);
  document.addEventListener('click', (event)=>{
    if(!menu.classList.contains('hide') && !button.contains(event.target) && !menu.contains(event.target))
      toggle_menu(button, menu);
  });
  // 開著時視窗大小改變（轉向等），重新決定對齊哪一邊
  window.addEventListener('resize', ()=>{
    if(!menu.classList.contains('hide'))
      place_menu(menu);
  });
  for(const target of [button, menu])
    target.addEventListener('keydown', (event)=>{
      if(event.key == 'Escape' && !menu.classList.contains('hide'))
        toggle_menu(button, menu);
    });
}
