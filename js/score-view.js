// 「檢視」選單：譜面的顯示方式（整頁可見／符合高度／符合寬度）與譜紙（A4／不分頁）。
// 只改 CSS（#score_popup_container 的 class），不用重新渲染譜面；
// 選擇記在 localStorage，下次開譜沿用（不放進網址 hash）。
import { normalize_fit_mode, FIT_MODES, normalize_paper_mode, PAPER_MODES } from './score-fit.js';
import { click_on_enter, setup_dropdown } from './dom.js';

const FIT_MODE_KEY = 'score_fit_mode';
const PAPER_MODE_KEY = 'score_paper_mode';

var view = { fit_mode: null, paper_mode: null };

// 無痕模式等情況 localStorage 可能無法使用，讀不到就用預設值、存不了就算了
function load_setting(key) {
  try { return localStorage.getItem(key); } catch(e) { return null; }
}
function save_setting(key, value) {
  try { localStorage.setItem(key, value); } catch(e) {}
}

// 選單裡 data-<name> 等於 value 的項目打勾
function check_menu_items(name, value) {
  for(const item of document.querySelectorAll(`#view-menu [data-${name}]`)){
    item.classList.toggle('selected', item.dataset[name] == value);
    item.setAttribute('aria-checked', item.dataset[name] == value);
  }
}

function apply_view() {
  var container = document.querySelector('#score_popup_container');
  for(const mode of FIT_MODES)
    container.classList.toggle('fit-' + mode, mode == view.fit_mode);
  for(const mode of PAPER_MODES)
    container.classList.toggle('paper-' + mode, mode == view.paper_mode);
  check_menu_items('fit', view.fit_mode);
  check_menu_items('paper', view.paper_mode);
  update_content_ratio();
}

// 不分頁時，「整頁可見／符合高度」要知道譜紙的高寬比。
// abcjs 用 responsive: 'resize'，譜的高寬比不隨寬度改變，所以每次渲染完（或切到不分頁時）量一次就好。
export function update_content_ratio() {
  var container = document.querySelector('#score_popup_container');
  if(!container.classList.contains('paper-content') || !container.classList.contains('open'))
    return;
  var page = document.querySelector('#score_page');
  var box = page.getBoundingClientRect();
  if(box.width > 0)
    page.style.setProperty('--content-ratio', box.height / box.width);
}

function set_fit_mode(mode) {
  view.fit_mode = normalize_fit_mode(mode);
  save_setting(FIT_MODE_KEY, view.fit_mode);
  apply_view();
}

function set_paper_mode(mode) {
  view.paper_mode = normalize_paper_mode(mode);
  save_setting(PAPER_MODE_KEY, view.paper_mode);
  apply_view();
}

// 註冊「檢視」選單的事件；選單沒有遮罩，點選單外面或按 Esc 才收起
export function setup_score_view() {
  view.fit_mode = normalize_fit_mode(load_setting(FIT_MODE_KEY));
  view.paper_mode = normalize_paper_mode(load_setting(PAPER_MODE_KEY));
  apply_view();

  setup_dropdown('#view_button', '#view-menu');
  for(const item of document.querySelectorAll('#view-menu [data-fit]')){
    item.addEventListener('click', ()=>{ set_fit_mode(item.dataset.fit); });
    click_on_enter(item);
  }
  for(const item of document.querySelectorAll('#view-menu [data-paper]')){
    item.addEventListener('click', ()=>{ set_paper_mode(item.dataset.paper); });
    click_on_enter(item);
  }
}
