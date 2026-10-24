// 分頁顯示：譜紙是「分頁」時一次顯示一頁，點畫面下半部換下一頁、上半部回上一頁（鍵盤用 ←／→、PageUp／PageDown）；「不分頁」時整首上下捲動。
// 每行譜（.abcjs-container）都還在 #score_paper 裡，不在目前這頁的加上 off-page class 藏起來（列印時全部印出），
// 每頁最後一行加上 page-end class，列印時從那裡換頁；第二頁以後每頁第一行加上 page-start
// （手動分頁的再加 manual-break），不分頁時在那裡畫出兩張紙之間的間隔。
//
// 手動分頁（page-breaks.js）：從「排版」面板的「設定分頁」進入設定模式（#score_popup_container 加上 setting-breaks），
// 這時整首都顯示，點兩行之間加入或取消分頁。每首歌的分頁位置存在 localStorage 的 score_page_breaks，
// 沒設定過的歌用 ABC 裡的 %%newpage 當預設。
import { paginate, page_of_line, A4_RATIO } from './pagination.js';
import { breaks_to_lines, toggle_break, parse_break_store, song_breaks, set_song_breaks } from './page-breaks.js';
import { state } from './state.js';
import { click_on_enter } from './dom.js';

const BREAKS_KEY = 'score_page_breaks';

var pages = { list: [], current: 0, song: null };
// 目前這首歌每行開頭的小節線數與 %%newpage 的預設分頁（score.js 渲染後用 set_score_lines 設定）
var score_lines = { starts: [], bars: 0, default_breaks: [] };

function line_containers() {
  return Array.from(document.querySelectorAll('#score_paper .abcjs-container'));
}

function container() {
  return document.querySelector('#score_popup_container');
}

function is_paged() {
  return container().classList.contains('paper-a4');
}

function is_setting_breaks() {
  return container().classList.contains('setting-breaks');
}

function current_song() {
  return state.displayingSong && state.displayingSong.id;
}

// 第一次用到時從 localStorage 讀進來，之後以記憶體裡的為準：無痕模式等情況 localStorage 讀不到時當作沒設定，
// 存不了（例如只擋寫入、額度滿了）就算了，這次開著的時候還是有效
var break_store = null;
function load_store() {
  if(!break_store){
    try { break_store = parse_break_store(localStorage.getItem(BREAKS_KEY)); } catch(e) { break_store = {}; }
  }
  return break_store;
}
function save_store(store) {
  break_store = store;
  try { localStorage.setItem(BREAKS_KEY, JSON.stringify(store)); } catch(e) {}
}

// 渲染完、分頁之前呼叫：lines 是 page-breaks.js 的 line_start_bars 算出來的。
// 行數和畫面上的不一樣（不該發生）時不套用手動分頁
export function set_score_lines({ starts, bars, newpage_lines }) {
  score_lines = { starts, bars, default_breaks: newpage_lines.map((i)=>starts[i]) };
}

function current_breaks() {
  return song_breaks(load_store(), current_song(), score_lines.default_breaks);
}

// 要從新的一頁開始的行
function forced_break_lines(count) {
  if(score_lines.starts.length != count)
    return [];
  return breaks_to_lines(current_breaks(), score_lines.starts, score_lines.bars);
}

// 每行的高度（以譜紙寬度為 1）；每行譜都是 block（style.css），高度和寬度成正比，
// 所以改視窗大小、顯示方式時不用重新分頁
function measure_lines(lines) {
  var width = document.querySelector('#score_page').getBoundingClientRect().width;
  return lines.map((line)=>line.getBoundingClientRect().height / width);
}

// 重新分頁：渲染完、改了行高、切換譜紙、改了手動分頁時呼叫。
// 同一首歌留在目前這頁第一行所在的那一頁，換歌（或重新打開）時回到第一頁、離開設定分頁
export function paginate_score() {
  if(!container().classList.contains('open'))
    return;
  var lines = line_containers();
  var song = current_song();
  if(pages.song != song)
    container().classList.remove('setting-breaks');
  var anchor = (pages.song == song && pages.list[pages.current]) ? pages.list[pages.current][0] : 0;
  for(const line of lines)
    line.classList.remove('off-page', 'page-end', 'page-start', 'manual-break');
  var heights = measure_lines(lines);
  var forced = forced_break_lines(lines.length);
  pages.list = paginate(heights, is_paged() ? A4_RATIO : Infinity, forced);
  pages.song = song;
  pages.current = page_of_line(pages.list, anchor);
  pages.list.forEach((page, i)=>{
    lines[page[page.length - 1]].classList.add('page-end');
    if(i > 0)
      lines[page[0]].classList.add('page-start');
  });
  for(const line of forced)
    lines[line].classList.add('manual-break');
  show_page(pages.current);
  show_break_bar();
}

// 只顯示第 n 頁（不分頁或設定分頁時全部顯示），更新頁碼
function show_page(n) {
  pages.current = n;
  var lines = line_containers();
  var one_page = is_paged() && !is_setting_breaks();
  if(one_page)
    pages.list.forEach((page, i)=>{
      for(const line of page)
        lines[line].classList.toggle('off-page', i != n);
    });
  var indicator = document.querySelector('#page_indicator');
  var show_indicator = one_page && pages.list.length > 1;
  indicator.classList.toggle('hide', !show_indicator);
  indicator.textContent = show_indicator ? `${n + 1} / ${pages.list.length}` : '';
}

// 換到前後一頁，捲回這頁的最上面；已經是第一頁／最後一頁時不動
function turn_page(step) {
  var n = pages.current + step;
  if(n < 0 || n >= pages.list.length)
    return;
  show_page(n);
  document.querySelector('#score_popup_window').scrollTop = 0;
}

// 關閉譜面時呼叫，下次打開從第一頁開始
export function reset_pages() {
  pages = { list: [], current: 0, song: null };
  score_lines = { starts: [], bars: 0, default_breaks: [] };
  container().classList.remove('setting-breaks');
  show_break_bar();
}

// 畫面最上面看得到的那一行（第幾行）
function top_visible_line() {
  var top = document.querySelector('#score_popup_window').getBoundingClientRect().top;
  var index = line_containers().findIndex((line)=>line.getClientRects().length && line.getBoundingClientRect().bottom > top);
  return Math.max(index, 0);
}

// 進入設定分頁：整首都顯示，目前這頁的第一行捲到最上面
export function enter_break_mode() {
  if(!container().classList.contains('open'))
    return;
  var first = (pages.list[pages.current] || [0])[0];
  container().classList.add('setting-breaks');
  paginate_score();
  var line = line_containers()[first];
  var win = document.querySelector('#score_popup_window');
  win.scrollTop = 0;
  if(line && first > 0)
    win.scrollTop = line.getBoundingClientRect().top - win.getBoundingClientRect().top;
}

// 離開設定分頁：分頁時顯示畫面最上面那一行所在的那一頁
function exit_break_mode() {
  if(!is_setting_breaks())
    return;
  var line = top_visible_line();
  container().classList.remove('setting-breaks');
  pages.current = page_of_line(pages.list, line);
  paginate_score();
  document.querySelector('#score_popup_window').scrollTop = 0;
}

// 設定分頁時下方的提示列：「還原預設」只在這首歌設定過（和 %%newpage 的預設不同）時才能按
function show_break_bar() {
  var bar = document.querySelector('#page_break_bar');
  bar.classList.toggle('hide', !is_setting_breaks());
  var customized = Object.prototype.hasOwnProperty.call(load_store(), current_song());
  document.querySelector('#page_break_default').setAttribute('aria-disabled', !customized);
}

function save_breaks(breaks) {
  save_store(set_song_breaks(load_store(), current_song(), breaks, score_lines.default_breaks));
  paginate_score();
}

// 點在第 line 行的哪裡：上面三分之一是和上一行之間、下面三分之一是和下一行之間，中間不算
function boundary_at(lines, y) {
  var index = lines.findIndex((line)=>line.getBoundingClientRect().bottom > y);
  if(index < 0)
    return null;
  var box = lines[index].getBoundingClientRect();
  var position = (y - box.top) / box.height;
  if(position < 1 / 3)
    return index > 0 ? index : null;
  if(position > 2 / 3)
    return index + 1 < lines.length ? index + 1 : null;
  return null;
}

// 設定分頁時點譜紙：加入或取消那兩行之間的分頁
function toggle_break_at(y) {
  var lines = line_containers();
  var line = boundary_at(lines, y);
  if(line == null || score_lines.starts.length != lines.length)
    return;
  save_breaks(toggle_break(current_breaks(), score_lines.starts, score_lines.bars, line));
}

// 鍵盤換頁：→／PageDown 下一頁，←／PageUp 上一頁。
// 焦點在工具列（按鈕、選單、歌號輸入）上時不搶，那些地方的方向鍵有自己的用途；
// 其他地方（例如譜面後面列表的搜尋框，從列表開譜時焦點常留在那裡）都換頁。
// 設定分頁時不換頁，Esc 離開設定（有選單開著時先收起選單）
const PAGE_KEYS = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 };
function page_keydown(event) {
  if(!container().classList.contains('open'))
    return;
  if(is_setting_breaks()){
    if(event.key == 'Escape' && !document.querySelector('#score_popup_top_bar .menu:not(.hide)'))
      exit_break_mode();
    return;
  }
  var step = PAGE_KEYS[event.key];
  if(!step || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
    return;
  if(!is_paged() || pages.list.length < 2)
    return;
  if(document.querySelector('#score_popup_top_bar').contains(event.target))
    return;
  event.preventDefault();
  turn_page(step);
}

// 點譜紙換頁（設定分頁時是加入或取消分頁）；有選單開著時這一下只是收起選單（dom.js 的 setup_dropdown），不換頁
export function setup_score_pages() {
  // keydown 的 Esc 要比選單（setup_dropdown）先判斷有沒有選單開著，所以用 capture
  document.addEventListener('keydown', page_keydown, true);
  document.querySelector('#score_page').addEventListener('click', (event)=>{
    if(document.querySelector('#score_popup_top_bar .menu:not(.hide)'))
      return;
    if(is_setting_breaks()){
      toggle_break_at(event.clientY);
      return;
    }
    if(!is_paged() || pages.list.length < 2)
      return;
    var view = document.querySelector('#score_popup_window').getBoundingClientRect();
    turn_page(event.clientY >= view.top + view.height / 2 ? 1 : -1);
  });
  for(const [selector, action] of [['#page_break_done', exit_break_mode], ['#page_break_default', restore_default]]){
    document.querySelector(selector).addEventListener('click', action);
    click_on_enter(selector);
  }
}

// 還原預設：刪掉這首歌的設定，回到 %%newpage（沒有就是不手動分頁）
function restore_default() {
  if(document.querySelector('#page_break_default').getAttribute('aria-disabled') == 'true')
    return;
  save_breaks(score_lines.default_breaks);
}
