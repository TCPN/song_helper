// 「檢視」選單的「排版…」面板：行間距均等化、行距、譜面寬度、歌詞字級、和弦字級。設定所有歌共用，
// 整包存在 localStorage 的 score_layout（JSON），不放進網址 hash。
// 面板裡每個設定一列：開關用 data-layout-toggle，數值用 −／＋（data-layout-step）加上顯示值（data-layout-value），
// 之後要加設定只要在 layout-settings.js 加欄位、在 index.html 加一列
import { parse_layout, normalize_layout, step_layout, needs_rerender, format_layout_value, DEFAULT_LAYOUT } from './layout-settings.js';
import { fix_score_line_heights } from './score-layout.js';
import { update_content_ratio } from './score-view.js';
import { click_on_enter, place_menu, toggle_menu } from './dom.js';
import { state } from './state.js';

const LAYOUT_KEY = 'score_layout';
const PANEL = '#layout-panel';

var layout = { ...DEFAULT_LAYOUT };
// 重新渲染目前的譜（由 main.js 傳入，避免和 score.js 互相 import）
var rerender = ()=>{};

// 渲染譜面時用的設定
export function current_layout() {
  return layout;
}

function load_layout() {
  try { return parse_layout(localStorage.getItem(LAYOUT_KEY)); } catch(e) { return normalize_layout(null); }
}
function save_layout() {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch(e) {}
}

// 數值設定目前實際用的值：譜面寬度在設定的寬度塞不下時會撐寬（見 score.js），顯示撐寬後的值
function used_value(key) {
  if(key == 'staff_width' && state.staffwidthUsed != null)
    return state.staffwidthUsed;
  return layout[key];
}

// 已經是這首歌最小的譜面寬度時，「−」不能按
function step_disabled(key, steps) {
  return key == 'staff_width' && steps < 0 && state.staffwidthAtMin;
}

// 面板上的開關與數值跟著設定（渲染譜面後 score.js 也會呼叫，更新實際用的譜面寬度）
export function show_layout() {
  var panel = document.querySelector(PANEL);
  for(const item of panel.querySelectorAll('[data-layout-toggle]')){
    var on = layout[item.dataset.layoutToggle];
    item.setAttribute('aria-checked', on);
    item.textContent = on ? '開' : '關';
  }
  for(const output of panel.querySelectorAll('[data-layout-value]'))
    output.value = format_layout_value(output.dataset.layoutValue, used_value(output.dataset.layoutValue));
  for(const button of panel.querySelectorAll('[data-layout-step]'))
    button.setAttribute('aria-disabled', step_disabled(button.dataset.layoutStep, Number(button.dataset.steps)));
}

// 譜面改變行高或重新渲染時，畫面最上面看得到的那一行（第幾行）留在原本的位置
// （不是每個瀏覽器都會自動調整捲動位置；重新渲染後每行都是新的元素，所以用第幾行來找）
function keep_visible_line(update) {
  var win = document.querySelector('#score_popup_window');
  var lines = ()=>Array.from(document.querySelectorAll('#score_paper .abcjs-container'));
  var top = win.getBoundingClientRect().top;
  var index = lines().findIndex((elem)=>(elem.getBoundingClientRect().bottom > top));
  var before = index >= 0 && lines()[index].getBoundingClientRect().top;
  update();
  var line = index >= 0 && lines()[index];
  if(line)
    win.scrollTop += line.getBoundingClientRect().top - before;
}

// 改了設定：存起來、更新面板；譜面開著就套用：
// 譜面寬度、字級會改變 abcjs 的排版，要重新渲染（渲染完會依新設定設行高）；均等化、行距只改 viewBox，不用重新渲染
function set_layout(new_layout) {
  var old_layout = layout;
  layout = normalize_layout(new_layout);
  save_layout();
  show_layout();
  if(document.querySelector('#score_popup_container').classList.contains('open')){
    keep_visible_line(()=>{
      if(needs_rerender(old_layout, layout))
        rerender();
      else {
        fix_score_line_heights('#score_paper', layout);
        update_content_ratio();
      }
    });
  }
}

function is_open() {
  return !document.querySelector(PANEL).classList.contains('hide');
}

// 從「檢視」選單打開面板：選單收起，面板出現在同一個位置，焦點移到面板的第一個控制項
function open_panel() {
  var panel = document.querySelector(PANEL);
  var view_menu = document.querySelector('#view-menu');
  if(!view_menu.classList.contains('hide'))
    toggle_menu('#view_button', view_menu);
  panel.classList.remove('hide');
  place_menu(panel);
  document.querySelector('#view_button').setAttribute('aria-expanded', true);
  panel.querySelector('[tabindex]').focus();
}

// 和其他選單一樣：點面板以外的地方或按 Esc 收起；用鍵盤時焦點還給「檢視」按鈕
function close_panel() {
  var panel = document.querySelector(PANEL);
  panel.classList.add('hide');
  // 點「檢視」按鈕收起面板時，「檢視」選單已經打開了，按鈕維持展開
  if(document.querySelector('#view-menu').classList.contains('hide'))
    document.querySelector('#view_button').setAttribute('aria-expanded', false);
  if(panel.contains(document.activeElement))
    document.querySelector('#view_button').focus();
}

// rerender：用目前的設定重新渲染譜面
export function setup_layout_panel({ rerender: rerender_score } = {}) {
  if(rerender_score)
    rerender = rerender_score;
  layout = load_layout();
  show_layout();

  var panel = document.querySelector(PANEL);
  var open_item = document.querySelector('#view-menu [data-open-layout]');
  open_item.addEventListener('click', open_panel);
  click_on_enter(open_item);
  document.addEventListener('click', (event)=>{
    if(is_open() && !panel.contains(event.target) && !open_item.contains(event.target))
      close_panel();
  });
  panel.addEventListener('keydown', (event)=>{
    if(event.key == 'Escape')
      close_panel();
  });
  window.addEventListener('resize', ()=>{
    if(is_open())
      place_menu(panel);
  });

  for(const item of panel.querySelectorAll('[data-layout-toggle]')){
    item.addEventListener('click', ()=>{
      var key = item.dataset.layoutToggle;
      set_layout({ ...layout, [key]: !layout[key] });
    });
    click_on_enter(item);
  }
  for(const button of panel.querySelectorAll('[data-layout-step]')){
    button.addEventListener('click', ()=>{
      var key = button.dataset.layoutStep;
      var steps = Number(button.dataset.steps);
      if(step_disabled(key, steps))
        return;
      // 從畫面上顯示的值開始調，按了就一定會變
      set_layout(step_layout(layout, key, steps, used_value(key)));
    });
    click_on_enter(button);
  }
  var reset = panel.querySelector('#layout_reset');
  reset.addEventListener('click', ()=>{ set_layout(DEFAULT_LAYOUT); });
  click_on_enter(reset);
}
