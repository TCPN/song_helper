// 「檢視」選單的「排版…」面板：行間距均等化、行距。設定所有歌共用，
// 整包存在 localStorage 的 score_layout（JSON），不放進網址 hash。
// 面板裡每個設定一列：開關用 data-layout-toggle，數值用 −／＋（data-layout-step）加上顯示值（data-layout-value），
// 之後要加設定（例如字級）只要在 layout-settings.js 加欄位、在 index.html 加一列
import { parse_layout, normalize_layout, step_layout, DEFAULT_LAYOUT } from './layout-settings.js';
import { fix_score_line_heights } from './score-layout.js';
import { update_content_ratio } from './score-view.js';
import { click_on_enter, place_menu, toggle_menu } from './dom.js';

const LAYOUT_KEY = 'score_layout';
const PANEL = '#layout-panel';

var layout = { ...DEFAULT_LAYOUT };

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

// 面板上的開關與數值跟著設定
function show_layout() {
  var panel = document.querySelector(PANEL);
  for(const item of panel.querySelectorAll('[data-layout-toggle]')){
    var on = layout[item.dataset.layoutToggle];
    item.setAttribute('aria-checked', on);
    item.textContent = on ? '開' : '關';
  }
  for(const output of panel.querySelectorAll('[data-layout-value]'))
    output.value = layout[output.dataset.layoutValue];
}

// 譜面改變行高時，畫面最上面看得到的那一行留在原本的位置（不是每個瀏覽器都會自動調整捲動位置）
function keep_visible_line(update) {
  var win = document.querySelector('#score_popup_window');
  var top = win.getBoundingClientRect().top;
  var line = Array.from(document.querySelectorAll('#score_paper .abcjs-container'))
    .find((elem)=>(elem.getBoundingClientRect().bottom > top));
  var before = line && line.getBoundingClientRect().top;
  update();
  if(line)
    win.scrollTop += line.getBoundingClientRect().top - before;
}

// 改了設定：存起來、更新面板；譜面開著就重新設定行高（只改 viewBox，不用重新渲染）
function set_layout(new_layout) {
  layout = normalize_layout(new_layout);
  save_layout();
  show_layout();
  if(document.querySelector('#score_popup_container').classList.contains('open')){
    keep_visible_line(()=>{
      fix_score_line_heights('#score_paper', layout);
      update_content_ratio();
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

export function setup_layout_panel() {
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
      set_layout(step_layout(layout, button.dataset.layoutStep, Number(button.dataset.steps)));
    });
    click_on_enter(button);
  }
  var reset = panel.querySelector('#layout_reset');
  reset.addEventListener('click', ()=>{ set_layout(DEFAULT_LAYOUT); });
  click_on_enter(reset);
}
