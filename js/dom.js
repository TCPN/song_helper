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
