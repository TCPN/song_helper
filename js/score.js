// 譜面彈窗：用 abcjs 渲染譜面、移調、換歌、關閉
import { state } from './state.js';
import { key_display_name } from './abc.js';
import { getSongData } from './list.js';
import { parse_hash, update_hash } from './route.js';
import { save_scroll, restore_scroll, toggleClass, click_on_enter } from './dom.js';
import { svg_elem_add_box, fix_score_line_heights } from './score-layout.js';
import { update_toolbar_layout } from './toolbar.js';

// 點譜面上的音符時呼叫（abcjs 的 clickListener）
var clickListener = console.log;

function findTargetSongFromParents(dom){
  while(dom.dataset.target == null)
    dom = dom.parentElement;
  return getSongData(dom.dataset.target);
}

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

export function render_score(event){
  var song = state.displayingSong || findTargetSongFromParents(event.target) || event.target.song_obj;
  var score_container = document.querySelector('#score_popup_container');
  score_container.classList.add('open');
  // open at the first so the abcjs can measure the elements' boxes and do good arrangement
  // reset the score_paper
  var score_paper = document.querySelector('#score_paper');
  score_paper.className = '';
  score_paper.style = '';
  document.querySelector('#current_song_id').textContent = song.id;

  //scroll to the song
  const song_item_in_list = document.querySelector(`#song_list tbody [data-target="${song.id}"]`);
  song_item_in_list.scrollIntoView({ block: 'nearest' });

  var settings = getUserSettings();
  var presetSettings = {
    // TODO: decide the staffwidth dynamically
    //staffwidth: 800,
    responsive: 'resize',
    //wrap: {
      //minSpacing: 1.8,
      //maxSpacing: 3,
      //preferredMeasuresPerLine: 4,
    //},
    oneSvgPerLine: true,
    add_classes: true,
    // generate_midi: true,
    // midi_id: 'player_control',
    clickListener: function(abcElem, tuneNumber, classes) {clickListener(abcElem, tuneNumber, classes);},
    format: {
      gchordfont: 'Times New Roman',
      textfont: 'Times New Roman',
      partsfont: '14px Times New Roman',
      // vocalfont: 'PMingLiU',
      // titlefont: '"Microsoft JhengHei" 24px',
    },
  };
  var params = Object.assign({}, presetSettings, settings);
  var tuneObjectArray = ABCJS.renderAbc('score_paper', song.abc, params);
  ABCJS.renderMidi('player-control', song.abc, settings);

  // add bounding box of the part marks
  var part_texts = document.querySelectorAll('.abcjs-part');
  for(let p of part_texts){
    svg_elem_add_box(p);
  }
  // fix the line heights and line styles
  fix_score_line_heights('#score_paper');

  var display_tone = "";
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
  display_tone = key_display_name(tone_signature);
  document.querySelector('#current_visual_tone').textContent = display_tone;
  // 曲號、調性、移調的字數會影響工具列寬度
  update_toolbar_layout();
  document.title = `${song.name} (${display_tone})`
  state.displayingSong = song;
}

function getUserSettings(){
  var settings = {};
  settings.visualTranspose = Number(document.querySelector('#transpose').value);
  //settings.midiTranspose = Number(document.querySelector('#transpose').value);
  return settings;
}

function clearSettings(){
  document.querySelector('#transpose').value = undefined;
}

export function close_score(){
  document.title = state.originalTitle;
  document.querySelector('#score_popup_container').classList.remove('open');
  // 收起譜面上的選單，下一首才不會一打開就是展開的
  for(const [button, menu] of [['#more_button', '#more-menu'], ['#edit_button', '#editor-menu']]){
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

// 移調輸入框的 change
function set_transpose(value, event){
  render_score(event);
  value = Number(value) || undefined; // remove hash when value is zero
  update_hash('transpose', value);
}

// 移調的 ▴▾ 按鈕：this 是按鈕，data-target 指向輸入框，data-add／data-value 是要加的值／要設的值
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
  document.querySelector('#score_popup_bg').addEventListener('click', function(event){
    if(event.target == this)
      close_score();
  });
  document.querySelector('.change-song.prev').addEventListener('click', ()=>{ open_score('prev'); });
  document.querySelector('.change-song.next').addEventListener('click', ()=>{ open_score('next'); });
  document.querySelector('#transpose').addEventListener('change', function(event){ set_transpose(this.value, event); });
  for(const button of document.querySelectorAll('.popup-button[data-target]'))
    button.addEventListener('click', value_modify);
  // 工具列上和「⋮」選單裡各有一組列印、播放
  for(const button of document.querySelectorAll('.print-button'))
    button.addEventListener('click', ()=>{ window.print(); });
  for(const button of document.querySelectorAll('.play-button'))
    button.addEventListener('click', ()=>{ toggleClass('#player-set', 'hide'); });
  click_on_enter('#close_score_button');
  document.querySelector('#close_score_button').addEventListener('click', ()=>{ close_score(); });
}
