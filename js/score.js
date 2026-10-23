// 譜面彈窗：用 abcjs 渲染譜面、移調、換歌、關閉
import { state } from './state.js';
import { key_display_name, with_stretchlast } from './abc.js';
import { parse_hash, update_hash } from './route.js';
import { save_scroll, restore_scroll, toggleClass, click_on_enter, setup_dropdown } from './dom.js';
import { svg_elem_add_box, score_line_widths, fix_score_line_widths, fix_score_line_heights } from './score-layout.js';
import { update_toolbar_layout } from './toolbar.js';
import { update_content_ratio } from './score-view.js';
import { build_render_params, build_midi_params, widened_staffwidth } from './render-params.js';
import { current_layout, show_layout } from './layout-panel.js';

// 點譜面上的音符時呼叫（abcjs 的 clickListener）
var clickListener = console.log;

// song_id 為 'next'／'prev' 時相對於目前網址的歌；歌存在才改網址，傳回是否存在
export function open_score(song_id){
  if(song_id == 'next' || song_id == 'prev'){
    var sid = parseInt(parse_hash().song_id);
    if(song_id == 'prev')
      song_id = sid - 1;
    else
      song_id = sid + 1;
  }
  if(state.songs.find((s)=>(s.id == song_id))){
    update_hash('song_id', song_id);
    return true;
  }
  else
    return false;
}

// 渲染 state.displayingSong 的譜；transpose 是移調半音數（呼叫端決定，這裡不讀 #transpose）
export function render_score(transpose){
  var song = state.displayingSong;
  var score_container = document.querySelector('#score_popup_container');
  score_container.classList.add('open');
  // open at the first so the abcjs can measure the elements' boxes and do good arrangement
  document.querySelector('#current_song_id').textContent = song.id;

  //scroll to the song
  const song_item_in_list = document.querySelector(`#song_list tbody [data-target="${song.id}"]`);
  song_item_in_list.scrollIntoView({ block: 'nearest' });

  var display_tone = draw_score(song, transpose);
  ABCJS.renderMidi('player-control', song.abc, build_midi_params({ transpose }));
  document.querySelector('#current_visual_tone').textContent = display_tone;
  // 移調 icon 旁邊顯示目前的半音數（0 時不顯示）
  document.querySelector('#transpose_badge').textContent = transpose_badge(transpose);
  // 曲號、調性、移調的字數會影響工具列寬度
  update_toolbar_layout();
  document.title = `${song.name} (${display_tone})`
  state.displayingSong = song;
}

// 只重畫譜面（「排版…」改了譜面寬度、字級時）：不重建播放器、不捲動歌單、工具列不變
export function redraw_score(){
  if(state.displayingSong)
    draw_score(state.displayingSong, current_transpose());
}

// 用 abcjs 把譜畫到 #score_paper，再修正版面；傳回顯示用的調性名稱
function draw_score(song, transpose){
  // reset the score_paper
  var score_paper = document.querySelector('#score_paper');
  score_paper.className = '';
  score_paper.style = '';
  var params = build_render_params({ transpose, layout: current_layout() });
  params.clickListener = function(abcElem, tuneNumber, classes) {clickListener(abcElem, tuneNumber, classes);};
  var abc = with_stretchlast(song.abc);
  var tuneObjectArray = ABCJS.renderAbc('score_paper', abc, params);
  // 有行塞不進譜面寬度時，用最寬那行的寬度重新渲染，每行才會一樣大；這就是這首歌最小的譜面寬度。
  // 重新渲染後那行可能還是寬一點點，最後把每行 viewBox 的寬度對齊
  var widened = widened_staffwidth(score_line_widths('#score_paper'), params.staffwidth);
  if(widened){
    params.staffwidth = widened;
    tuneObjectArray = ABCJS.renderAbc('score_paper', abc, params);
    fix_score_line_widths('#score_paper');
  }
  // 「排版…」面板顯示實際用的寬度
  state.staffwidthUsed = params.staffwidth;
  state.staffwidthAtMin = !!widened;
  show_layout();

  // add bounding box of the part marks
  var part_texts = document.querySelectorAll('.abcjs-part');
  for(let p of part_texts){
    svg_elem_add_box(p);
  }
  // fix the line heights and line styles
  fix_score_line_heights('#score_paper', current_layout());
  // 不分頁時譜紙的高寬比依譜的內容
  update_content_ratio();

  if(params.oneSvgPerLine) {
    try{
      var tone_signature = tuneObjectArray[0].lines[0].staff[0].key;
    }catch(e){}
  }
  else {
    try{
      var tone_signature = tuneObjectArray[0].engraver.engraver.startlimitelem.abcelem;
    }catch(e){}
  }
  return key_display_name(tone_signature);
}

function transpose_badge(transpose){
  if(!transpose)
    return '';
  return (transpose > 0 ? '+' : '') + transpose;
}

// 移調選單目前的半音數
export function current_transpose(){
  return Number(document.querySelector('#transpose').value);
}

function clearSettings(){
  document.querySelector('#transpose').value = 0;
}

export function close_score(){
  document.title = state.originalTitle;
  document.querySelector('#score_popup_container').classList.remove('open');
  // 收起譜面上的選單，下一首才不會一打開就是展開的
  for(const [button, menu] of [['#transpose_button', '#transpose-menu'], ['#view_button', '#view-menu'], ['#more_button', '#more-menu'], ['#edit_button', '#editor-menu'], ['#view_button', '#layout-panel']]){
    document.querySelector(menu).classList.add('hide');
    document.querySelector(button).setAttribute('aria-expanded', false);
  }
  state.displayingSong = null;
  clearSettings();
  save_scroll('html');
  update_hash('song_id', undefined);
  update_hash('transpose', undefined);
  restore_scroll('html');
}

// 移調半音數（#transpose）的 change，由 ＋／− 按鈕觸發
function set_transpose(value){
  render_score(Number(value));
  value = Number(value) || undefined; // remove hash when value is zero
  update_hash('transpose', value);
}

// 移調選單的 −／＋ 按鈕：this 是按鈕，data-target 指向顯示半音數的 <output>，data-add／data-value 是要加的值／要設的值
function value_modify(event) {
  var target = document.querySelector(this.dataset.target);
  if(this.dataset.value != null)
    target.value = this.dataset.value;
  else if(this.dataset.add != null)
    target.value = Number(target.value) + Number(this.dataset.add);
  else
    console.log('No specified method for modification.', '\n trigger:', this, '\n target:', target);
  target.dispatchEvent(new Event('change'));
}

// 註冊譜面彈窗（背景、換歌、上方工具列）的事件
export function setup_score_controls() {
  // 點譜紙以外的暗色背景就關閉；#score_popup_window 是蓋滿背景、可捲動的那一層，
  // 點在它的捲軸上（offsetX／offsetY 超出內容區）不算
  document.querySelector('#score_popup_bg').addEventListener('click', function(event){
    var win = event.target;
    if(event.target == this
      || (win.id == 'score_popup_window' && event.offsetX < win.clientWidth && event.offsetY < win.clientHeight))
      close_score();
  });
  document.querySelector('.change-song.prev').addEventListener('click', ()=>{ open_score('prev'); });
  document.querySelector('.change-song.next').addEventListener('click', ()=>{ open_score('next'); });
  document.querySelector('#transpose').addEventListener('change', function(){ set_transpose(this.value); });
  // 點調性按鈕開關移調選單
  setup_dropdown('#transpose_button', '#transpose-menu');
  for(const button of document.querySelectorAll('.step-button[data-target]')){
    button.addEventListener('click', value_modify);
    click_on_enter(button);
  }
  click_on_enter('#close_score_button');
  // 工具列上和「⋮」選單裡各有一組列印、播放
  for(const button of document.querySelectorAll('.print-button'))
    button.addEventListener('click', ()=>{ window.print(); });
  for(const button of document.querySelectorAll('.play-button'))
    button.addEventListener('click', ()=>{ toggleClass('#player-set', 'hide'); });
  document.querySelector('#close_score_button').addEventListener('click', ()=>{ close_score(); });
}
