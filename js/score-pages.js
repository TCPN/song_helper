// 分頁顯示：譜紙是「分頁」時一次顯示一頁，點畫面下半部換下一頁、上半部回上一頁；「不分頁」時整首上下捲動。
// 每行譜（.abcjs-container）都還在 #score_paper 裡，不在目前這頁的加上 off-page class 藏起來（列印時全部印出），
// 每頁最後一行加上 page-end class，列印時從那裡換頁。
import { paginate, page_of_line, A4_RATIO } from './pagination.js';
import { state } from './state.js';

var pages = { list: [], current: 0, song: null };

function line_containers() {
  return Array.from(document.querySelectorAll('#score_paper .abcjs-container'));
}

function container() {
  return document.querySelector('#score_popup_container');
}

function is_paged() {
  return container().classList.contains('paper-a4');
}

// 每行的高度（以譜紙寬度為 1）；每行譜都是 block（style.css），高度和寬度成正比，
// 所以改視窗大小、顯示方式時不用重新分頁
function measure_lines(lines) {
  var width = document.querySelector('#score_page').getBoundingClientRect().width;
  return lines.map((line)=>line.getBoundingClientRect().height / width);
}

// 重新分頁：渲染完、改了行高、切換譜紙時呼叫。
// 同一首歌留在目前這頁第一行所在的那一頁，換歌（或重新打開）時回到第一頁
export function paginate_score() {
  if(!container().classList.contains('open'))
    return;
  var lines = line_containers();
  var song = state.displayingSong && state.displayingSong.id;
  var anchor = (pages.song == song && pages.list[pages.current]) ? pages.list[pages.current][0] : 0;
  for(const line of lines)
    line.classList.remove('off-page', 'page-end');
  var heights = measure_lines(lines);
  // 手動分頁之後再加（forced_breaks）
  pages.list = paginate(heights, is_paged() ? A4_RATIO : Infinity);
  pages.song = song;
  pages.current = page_of_line(pages.list, anchor);
  for(const page of pages.list)
    lines[page[page.length - 1]].classList.add('page-end');
  show_page(pages.current);
}

// 只顯示第 n 頁（不分頁時全部顯示），更新頁碼
function show_page(n) {
  pages.current = n;
  var lines = line_containers();
  if(is_paged())
    pages.list.forEach((page, i)=>{
      for(const line of page)
        lines[line].classList.toggle('off-page', i != n);
    });
  var indicator = document.querySelector('#page_indicator');
  var show_indicator = is_paged() && pages.list.length > 1;
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
}

// 點譜紙換頁；有選單開著時這一下只是收起選單（dom.js 的 setup_dropdown），不換頁
export function setup_score_pages() {
  document.querySelector('#score_page').addEventListener('click', (event)=>{
    if(!is_paged() || pages.list.length < 2)
      return;
    if(document.querySelector('#score_popup_top_bar .menu:not(.hide)'))
      return;
    var view = document.querySelector('#score_popup_window').getBoundingClientRect();
    turn_page(event.clientY >= view.top + view.height / 2 ? 1 : -1);
  });
}
