var ORIGINAL_TITLE = document.title;

// Load the Visualization API and the piechart package.
google.load('visualization', '1.0', {'packages':['corechart']});

// Set a callback to run when the Google Visualization API is loaded.
google.setOnLoadCallback(loadData);

var data;
var cols, rows;
var songDataObjects;
var displayingSong;
const CACHED_DATA_KEY = 'song_data';
const CACHED_DATA_TIMESTAMP_KEY = 'song_data_timestamp';
// 網址 hash 只在載入時處理一次（之後交給 hashchange）；見 updateListUI
var initialHashHandled = false;

// Callback that creates and populates a data table, 
// instantiates the pie chart, passes in the data and
// draws it.
function loadData() {
  /*var URL = 'https://docs.google.com/spreadsheet/tq?key=0AvTQcvEt3SwvdEdaOUpVVHRSMkVXUXlHX1hZbFBzWkE';*//* file deleted! */
  var URL = 'https://docs.google.com/spreadsheet/tq?key=1_8-RZ_a_f47I0IavWYOwg5W07d_M3nQx8VK6wzEvfoM';
  var query = new google.visualization.Query(URL);
  query.send(function handleQueryResponse(response) {
    if (response.isError()) {
      alert('Error in query: ' + response.getMessage() + ' ' + response.getDetailedMessage());
      // 拿不到最新資料：若有快取，就用快取處理還沒處理的 hash
      if (songDataObjects && !initialHashHandled)
        exec_hash();
      return;
    }
    data = response.getDataTable();
    songDataObjects = getSongArray(data);
    updateListUI(songDataObjects, true);
    console.log('rendered with newest data');
    setCachedData(songDataObjects);
    console.log('cached data updated');
  });
}

function renderWithCachedData() {
  songDataObjects = getCachedData();
  if (songDataObjects) {
    updateListUI(songDataObjects);
    console.log('rendered with cached data');
  }
}

// isNewest: songData 是試算表的最新資料（false 表示是 localStorage 的快取）
function updateListUI(songData, isNewest) {
  createList(songData);
  setup_song_list_selection();
  fixedListWidth();
  document.querySelector('#loading_icon').classList.add('hide');
  if (!initialHashHandled) {
    // 快取裡就能開的歌直接開；開不了（沒有譜／不存在）的等最新資料再判斷，
    // 避免快取過舊時誤報，也避免提示出現兩次
    if (isNewest || hash_song_openable(songData))
      exec_hash();
  } else if (isNewest && displayingSong) {
    // 已用快取開了譜面：最新資料裡這首歌的譜有變（或不見了）才重新處理，否則不重複渲染
    var newest = songData.find((s)=>(s.id === displayingSong.id));
    if (newest && newest.abc === displayingSong.abc)
      displayingSong = newest;
    else
      exec_hash();
  }
}

// 網址指定的歌在 songData 裡是否有譜可以開（沒有指定歌也算可以處理）
function hash_song_openable(songData) {
  var song_id = parse_hash()['song_id'];
  if (song_id == null)
    return true;
  var song = songData.find((s)=>(s.id.toString() === song_id));
  return !!(song && song.abc);
}

function fixedListWidth() {
  var song_list_table = document.querySelector('#song_list');
  var r = song_list_table.getClientRects()[0];
  song_list_table.style.maxWidth = `${r.width}px`;
}

function parse_params(s){
  return s.split('&').reduce(
    function(o, s){
      if(s == '')
        return o;
      var kv = s.split('=');
      if(kv.length == 1)
        o[s] = true;
      else if(kv.length == 2)
        o[kv[0]] = kv[1];
      else if(kv.length > 2)
        o[kv[0]] = kv.slice(1).join('=');
      return o;
    }, {});
}

function params_to_str(param){
  var a = [];
  for(var key in param){
    var value = param[key];
    if(value === true)
      a.push('' + key);
    else
      a.push(key + '=' + value);
  }
  return a.join('&');
}

function parse_hash(){
  return parse_params(location.hash.slice(1));
}

function update_hash(key, value, force=false){
  var hash = parse_hash();
  if(hash[key] != value || force){
    if(value === undefined)
      delete(hash[key]);
    else
      hash[key] = value;
    location.hash = params_to_str(hash);
  }
}

function exec_hash(){
  initialHashHandled = true;
  //select score by url
  if(!!location.hash){
    // parse hash
    var hash_params = parse_hash();
    // execute hash
    if(hash_params['song_id'] != null){
      var dsongobj = songDataObjects.find((s)=>(s.id.toString() === hash_params['song_id']));
      if(dsongobj && !dsongobj.abc){
        dsongobj = null;
        alert('No score for song ' + hash_params['song_id']);
      }
    }
    if(hash_params['transpose'] != null){
      var transpose = Number(hash_params['transpose']);
      if(!Number.isInteger(transpose)){
        transpose = 0;
        alert('Invalid transpose is ignored: ' + hash_params['transpose']);
      }
    }
    if(dsongobj){
      select_song(dsongobj.id);
      displayingSong = dsongobj;
      document.querySelector('#transpose').value = transpose;
      render_score();
    }else{
      close_score();
    }
  }
}

//// local storage management

function getCachedData() {
  try {
    const data = localStorage.getItem(CACHED_DATA_KEY);
    return data ? JSON.parse(data) : null;

  } catch (err) {
    console.log(err);
  }
  return null;
}

function getCachedDataTimestamp() {
  return parseInt(localStorage.getItem(CACHED_DATA_TIMESTAMP_KEY));
}

function setCachedData(data) {
  const strData = JSON.stringify(data);
  localStorage.setItem(CACHED_DATA_KEY, strData);
  localStorage.setItem(CACHED_DATA_TIMESTAMP_KEY, Date.now());
}

////

function getSongArray(data) {
  /*
  0  編號
  1  歌名/曲名
  2  調號
  3  拍號
  4  首句旋律
  5  出處/譜源
  6  分類
  7  譜
  8  投影片
  9  ppt
  10 abc
  */
  var songArray = [];
  console.log('number of songs', data.getNumberOfRows());
  for (var i = 0; i < data.getNumberOfRows(); i++) {
    var song = {
      "id": data.getValue(i, 0),
      "name": data.getValue(i, 1),
      "tone": data.getValue(i, 2),
      "timesig": data.getValue(i, 3),
      "melody": data.getValue(i, 4),
      "abc": data.getValue(i, 10),
    }
    songArray.push(song);
  }
  return songArray;
}

function getSongData(song_id){
  return songDataObjects.find(x=>(x.id==song_id));
}

function hasSongContent(song) {
  return song.abc.match(/K:.*\r?\n.*\w/);
}

function createList(songs){
  var song_list_table = document.querySelector('#song_list');
  const rows = Array.from(song_list_table.tBodies[0].rows);
  for(let row of rows.splice(songs.length)){
    row.remove();
  }
  var song_list_dom = song_list_table.tBodies[0];
  for(let i = 0; i < songs.length; i++ ){
    var item_tpl = (rows[i] && rows[i].item)|| createListItem();
    item_tpl.num.textContent = songs[i].id + '.';
    item_tpl.name.textContent = songs[i].name;
    item_tpl.tone.textContent = songs[i].tone + '調';
    // 重用的列先清掉舊的譜面連結（快取與最新資料的譜可能不同）
    item_tpl.scoreMarkLink.classList.remove('chord_score', 'note_score');
    item_tpl.scoreMarkLink.removeAttribute('title');
    item_tpl.scoreMarkLink.removeAttribute('href');
    if(songs[i].abc && songs[i].abc.length > 0 && hasSongContent(songs[i])){
      if(songs[i].abc.match(/"[^"]+"/)) {
        item_tpl.scoreMarkLink.classList.add('chord_score');
        item_tpl.scoreMarkLink.title = '五線譜 (含和弦)';
      } else {
        item_tpl.scoreMarkLink.classList.add('note_score');
        item_tpl.scoreMarkLink.title = '五線譜 (僅旋律)';
      }
      item_tpl.scoreMarkLink.href = '#song_id=' + songs[i].id;
    }
    song_list_dom.appendChild(item_tpl.topElem);
    item_tpl.topElem.dataset.target = songs[i].id;
    item_tpl.topElem.song_obj = songs[i];
    //item_tpl.topElem.onclick = render_score;
  }
}

function createListItem(){
  var topElem = document.createElement('tr');
  var num = document.createElement('td');
  var name = document.createElement('td');
  var tone = document.createElement('td');
  var scoreMark = document.createElement('td');
  var scoreMarkLink = document.createElement('a');
  num.classList.add('song_index');
  name.classList.add('song_name');
  tone.classList.add('song_tone');
  scoreMark.classList.add('song_score');
  topElem.appendChild(num);
  topElem.appendChild(name);
  topElem.appendChild(tone);
  topElem.appendChild(scoreMark);
  scoreMark.appendChild(scoreMarkLink);
  const listItem = {
    topElem,
    num,
    name,
    tone,
    scoreMark,
    scoreMarkLink,
  };
  topElem.item = listItem;
  return listItem;
}

function select_song (id) {
  const songs = document.querySelectorAll('#song_list tr');
  for (const song_dom of songs) {
    song_dom.classList.remove('selected');
  }
  if (typeof id === 'number') {
    const song = document.querySelector(`#song_list tr[data-target="${id}"]`);
    song?.classList.add('selected');
  }
}

function on_click_select_song(event) {
  let target = event.target;
  while (target) {
    if (target.tagName === 'TR') {
      select_song(Number(target.dataset.target));
      return;
    }
    target = target.parentElement;
  }
  select_song(null);
}

function setup_song_list_selection() {
  const list_container = document.querySelector('#list_container');
  list_container.addEventListener('click', on_click_select_song);
}

function findTargetSongFromParents(dom){
  while(dom.dataset.target == null)
    dom = dom.parentElement;
  return getSongData(dom.dataset.target);
}

function open_score(song_id){
  if(song_id == 'next' || song_id == 'prev'){
    var sid = parseInt(parse_hash().song_id);
    if(song_id == 'prev')
      song_id = sid - 1;
    else
      song_id = sid + 1;
  }
  if(songDataObjects.find((s)=>(s.id == song_id))){
    update_hash('song_id', song_id);
    return true;
  }
  else
    return false;
}

clickListener = console.log;

function render_score(event){
  var song = displayingSong || findTargetSongFromParents(event.target) || event.target.song_obj;
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
  params = Object.assign({}, presetSettings, settings);
  tuneObjectArray = ABCJS.renderAbc('score_paper', song.abc, params);
  //var rewrited_abc = rewrite_abc(song.abc, false);
  //console.log(rewrited_abc);
  midiRendered = ABCJS.renderMidi('player-control', song.abc, settings);

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
  try{
    display_tone = (tone_signature.root + (({"#": "♯", "b": "♭", "": ""})[tone_signature.acc]) + tone_signature.mode) || "C";
  }catch(e){}
  document.querySelector('#current_visual_tone').textContent = display_tone;
  document.title = `${song.name} (${display_tone})`
  displayingSong = song;
}

function force_redraw(element){
  var saved_value = element.style.display;
  element.style.display = 'none';
  element.offsetHeight;
  element.style.display = 'block';
  element.style.display = saved_value;
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

function fixRenderedScore(score_dom, staff_gap=10){
  Array.from(getDom(score_dom).children).forEach(container=>{
    var svg = container.children[0];
    var svgVisibleChildren = Array.from(svg.children).filter(v=>(v.getClientRects().length > 0));
    var vb_height = Math.max(...svgVisibleChildren.map(v=>{
      var z = v.getBBox(); return z.y + z.height;
    }));
    var vb = svg.getAttribute('viewBox').split(' ');
    vb[3] = `${vb_height + staff_gap}`;
    svg.setAttribute('viewBox', vb.join(' '));
    var staff_top = svg.getBoundingClientRect().top;
    var staff_bottom = Math.max(...svgVisibleChildren.map(v=>(v.getBoundingClientRect().bottom)));
    container.style.paddingBottom = null;
    container.style.height = `${staff_bottom - staff_top + staff_gap}px`;
  });
}

function getDom(target) {
  if(typeof target == 'string')
    target = document.querySelector(target);
  return target;
}

function openDom(target){
  target = getDom(target);
  target.classList.add('open');
}

function isOpenDom(target){
  target = getDom(target);
  return target.classList.contains('open');
}

function closeDom(target){
  target = getDom(target);
  target.classList.remove('open');
}

function closePopup(event){
  if(event.target != this)
    return;
  closeDom(this.dataset.close);
}

function close_score(){
  document.title = ORIGINAL_TITLE;
  document.querySelector('#score_popup_container').classList.remove('open');
  displayingSong = null;
  clearSettings();
  save_scroll('html');
  update_hash('song_id', undefined);
  update_hash('transpose', undefined);
  restore_scroll('html');
}

function set_transpose(value){
  render_score(event);
  value = Number(value) || undefined; // remove hash when value is zero
  update_hash('transpose', value);
}

var unicode_note = {
'1/1': '𝅝',
'1/2': '𝅗𝅥',
'1/4': '𝅘𝅥',
'1/8': '𝅘𝅥𝅮',
'3/8': '𝅘𝅥𝅮𝅘𝅥𝅮𝅘𝅥𝅮',
'1/16': '𝅘𝅥𝅯',
};
function show_song_info(song_id){
  var elem = getDom('#info-popup-container');
  var content_elem = elem.querySelector('.popup-window-content');
  var song = songDataObjects.find(s=>s.id == song_id);
  if(!song)
    return;
  var score_link = '<a href onclick="closeDom(\'#info-popup-container\')">開啟</a>';
  if(song.abc && song.abc.match(/Q:.*/)){
    var [speed_unit, speed_value] = song.abc.match(/Q:.*/)[0].replace('Q:', '').replace(/ /g, '').split('=');
    var speed_str = unicode_note[speed_unit] + '=' + speed_value;
  }
  content_elem.innerHTML=
  `
  <table>
  <tr><td>編號:</td><td>${song.id}</td></tr>
  <tr><td>歌名:</td><td>${song.name}</td></tr>
  <tr><td>調性:</td><td>${song.tone}</td></tr>
  <tr><td>拍號:</td><td>${song.timesig}</td></tr>
  <tr><td>速度:</td><td>${speed_str || ''}</td></tr>
  <tr><td>歌譜:</td><td>${song.abc ? score_link.replace('href', 'href=#song_id='+song.id) : '無'}</td></tr>
  </table>
  `;
  openDom(elem);
}
function song_list_onclick(event){
  var found_target = event.target;
  while(this.contains(found_target) && this != found_target){
    if(found_target.dataset.target || found_target.tagName == 'A')
      break;
    found_target = found_target.parentElement;
  }
  var target_song = found_target.dataset.target;
  if(target_song)
    show_song_info(target_song);
}

var scroll_tmp = {};
function save_scroll(selector){
  dom = document.querySelector(selector);
  scroll_tmp[selector] = dom.scrollTop;
}

function restore_scroll(selector){
  dom = document.querySelector(selector);
  dom.scrollTop = scroll_tmp[selector];
}

function song_id_popup_control(btn){
  var song_id_dom = document.querySelector('#current_song_id');
  var song_id_popup = document.querySelector('#song_id_popup');
  switch(btn) {
    case "ent":
      open_score(song_id_dom.textContent) || restore_edited_song_id();
      closeDom(song_id_popup);
      song_id_dom.blur();
      break;
    case "esc":
      restore_edited_song_id();
      open_score(song_id_dom.textContent);
      closeDom(song_id_popup);
      song_id_dom.blur();
      break;
    case "del": song_id_dom.textContent = song_id_dom.textContent.substr(0, song_id_dom.textContent.length - 1); break;
    case "inc": song_id_dom.textContent = parseInt(_target_song_id) + 1; open_score(song_id_dom.textContent); break;
    case "dec": song_id_dom.textContent = parseInt(_target_song_id) - 1; open_score(song_id_dom.textContent); break;
    case "clr": song_id_dom.textContent = ''; break;
    case "0": case "1": case "2": case "3": case "4": case "5": case "6": case "7": case "8": case "9":
      song_id_dom.textContent += btn; break;
  }
  _target_song_id = song_id_dom.textContent || _target_song_id;
  if(isOpenDom(song_id_popup))
    song_id_dom.focus();
}

function song_id_keydown_handler(event){
  console.log(event);
  var btn_map = {
    '0': '0',
    '1': '1',
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    'Enter': 'ent',
    'Escape': 'esc',
    'ArrowUp': 'dec',
    'ArrowLeft': 'dec',
    'ArrowDown': 'inc',
    'ArrowRight': 'inc',
    'c': 'clr',
    'C': 'clr',
    'Backspace': 'del',
    'Delete': 'del',
  };
  var btn = btn_map[event.key];
  btn && song_id_popup_control(btn);
}

function restore_edited_song_id(){
  var song_id_dom = document.querySelector('#current_song_id');
  song_id_dom.textContent = _original_song_id;
}

/* rewrite the score for midi rendering */
function remove_backslash_breakline(str) {
  return str.replace('\\', '');
}
function split_lines(str) {
  var lines = str.split('\n');
  return lines.map(line=>{
    if(line.match(/^w:/))
      var type = 'lyrics';
    else if(line.match(/^c:/))
      var type = 'chords';
    else if(line.match(/^\s*[a-zA-Z]:/))
      var type = 'meta';
    else
      var type = 'music';
    return {type, content: line};
  });
}
function split_measures(lines) {
  return lines.map(line=>{
    if(line.type != 'music')
      return line;
    var bar_pattern = /\]\s*\||\|\|\d?|\|\]\d?|:\|\[\d?|\[\|\d?|\|\[\d?|:\|\d?|:\|\]\d?|\|:\d?|:\|:\d?|\|\d?|\[\d|\]/g;
    //var bar_pattern = /\|\||\|\]|\[\||:\||\|:|:\|:|\|/g;
    line.measures = line.content.split(bar_pattern);
    if(line.measures[line.measures.length - 1].match(/\s*/))
      line.measures.pop();
    line.bars = line.content.match(bar_pattern);
    return line;
  });
}
function extract_chord_voice(lines) {
  // Assume that we use "&" in a measure to form multiple voices only for denoting chords
  return lines.map(line=>{
    if(line.type != 'music')
      return line;
    var chord_voice = [];
    var melody_voice = [];
    line.measures.forEach(m=>{
      var voices = m.split('&');
      if(voices.length == 2) {
        if(voices[0].match('"')){
          chord_voice.push(voices[0]);
          melody_voice.push(voices[1]);
        }else{
          melody_voice.push(voices[0]);
          chord_voice.push(voices[1]);
        }
      }
      else {
        melody_voice.push(m);
        chord_voice.push(null);
      }
    });
    for (let i in line.measures) {
      if(!chord_voice[i]) {
        var chord_pattern = /"[^"]+"/g;
        var chords = line.measures[i].match(chord_pattern);
        var melody_parts = line.measures[i].split(chord_pattern);
        var clean_melody_parts = melody_parts.map(v=>{
          // v = v.replace(/\(|\)|-/g, ''); // remove "(", ")", and "-"
          v = v.replace(/(\^_=)?[a-gA-GzZxX](,|')*/g, 'x'); // replace notes with x
          return v;
        });
        var s = '';
        for(let j in chords) {
          s += clean_melody_parts[j];
          s += chords[j];
        }
        s += clean_melody_parts[clean_melody_parts.length - 1];
        chord_voice[i] = s;
        melody_voice[i] = melody_parts.join('');
      }
    }
    line.chord_voice = chord_voice;
    line.melody_voice = melody_voice;
    return line;
  });
}
function form_score(lines, melody_first=false) {
  return lines.map(line=>{
    if(line.type != 'music')
      return line.content;
    var ret = '';
    for (let i = 0; i < line.melody_voice.length; i ++) {
      if(i == 0 && line.measures[0].match(/^\s*$/)) // this line start with a bar
        ret += line.bars[i];
      else if(melody_first)
        ret += line.melody_voice[i] + '&' + line.chord_voice[i] + line.bars[i];
      else
        ret += line.chord_voice[i] + '&' + line.melody_voice[i] + line.bars[i];
    }
    return ret;
  }).join('\n');
}
function rewrite_abc(str, melody_first=false) {
  // var str = document.querySelector('#abc').value;
  var obj = str;
  obj = remove_backslash_breakline(obj);
  obj = split_lines(obj);
  obj = split_measures(obj);
  obj = extract_chord_voice(obj);
  obj = form_score(obj, melody_first);;
  return obj;
}

function utf8_to_b64(str) {
  return window.btoa(unescape(encodeURIComponent(str)));
}

function b64_to_utf8(str) {
  return decodeURIComponent(escape(window.atob(str)));
}

function svg2dataURI(elementSelector) {
  var svg = document.querySelector(elementSelector || 'svg');
  var xml = new XMLSerializer().serializeToString(svg);
  var svg64 = utf8_to_b64(xml);
  var b64start = 'data:image/svg+xml;base64,';
  var image64 = b64start + svg64;
  return image64;
};

function value_modify(event) {
  var target = document.querySelector(this.dataset.target);
  if(this.dataset.value != null)
    target.value = this.dataset.value;
  else if(this.dataset.add != null)
    target.value = Number(target.value) + Number(this.dataset.add);
  else
    console.log('No specified method for modification.', '\n trigger:', this, '\n target:', target);
  target.onchange();
}

function filter_song(pattern) {
  var song_list_table = document.querySelector('#song_list');
  var items = Array.from(song_list_table.tBodies[0].children);
  var found_something = false;
  items.forEach(v=>{
    if(!v.textContent.match(pattern))
      v.classList.add('hide');
    else {
      v.classList.remove('hide');
      found_something = true;
    }
  });
  var found_nothing_dom = document.querySelector('#found_nothing');
  if(!found_something){
    found_nothing_dom.classList.remove('hide');
  }
  else
    found_nothing_dom.classList.add('hide');
}

function open_editor(song_id) {
  var editor_url = (location.hostname == 'www.csie.ntu.edu.tw' ? '//tcpn-web.appspot.com/song_edit/' : '/song_edit/');
  var url = editor_url + (song_id ? '#song_id=' + song_id : '');
  window.open(url);
}

function open_chord_editor(song_id) {
  var editor_url = (location.hostname == 'www.csie.ntu.edu.tw' ? '//tcpn-web.appspot.com/chord_editor/' : '/chord_editor/');
  var url = editor_url + (song_id ? '#song_id=' + song_id : '');
  window.open(url);
}

function toggleClass(element, class_name) {
  if(typeof element == 'string')
    element = document.querySelector(element);
  if(element.classList.contains(class_name))
    element.classList.remove(class_name);
  else
    element.classList.add(class_name);
}
function svg_elem_add_box(elem) {
  var bbox = elem.getBBox();
  var new_elem = document.createElement('rect');
  elem.insertAdjacentElement('afterend', new_elem);
  new_elem.outerHTML = `<rect x="${bbox.x - 1}" y="${bbox.y}" width="${bbox.width + 2}" height="${bbox.height}" stroke="#000000" stroke-width="0.5" fill="none"></rect>`;
  return new_elem;
}

/********** fix the height problems of svg lines **********/

function find_svg_needed_height(svg){
  var bottoms = Array.from(svg.children).map(elem=>{
    var bbox = elem.getBBox && elem.getBBox();
    return bbox && (bbox.y + bbox.height);
  }).filter(v=>v!=null);
  return Math.max(...bottoms);
}

function line_containers(score_paper){
  return Array.from(score_paper.querySelectorAll('.abcjs-container'));
}
function line_svgs(score_paper){
  return Array.from(score_paper.querySelectorAll('.abcjs-container svg'));
}
function staff_tops(score_paper){
  var staff_tops = line_svgs(score_paper).map((svg)=>{
    var staff_paths = Array.from(svg.querySelectorAll('.abcjs-staff'));
    return Math.min(...staff_paths.map(p=>p.getBBox().y))
  });
  return staff_tops;
}
function staff_tops(score_paper){
  var staff_tops = line_svgs(score_paper).map((svg)=>{
      var staff_paths = Array.from(svg.querySelectorAll('.abcjs-top-line'));
      return Math.max(...staff_paths.map(p=>(p.getBBox().y + p.getBBox().height)))
  });
  return staff_tops;
}
function staff_bottoms(score_paper){
  var staff_bottoms = line_svgs(score_paper).map((svg)=>{
    var staff_paths = Array.from(svg.querySelectorAll('.abcjs-top-line, .abcjs-top-line ~ .abcjs-staff'));
    return Math.max(...staff_paths.map(p=>(p.getBBox().y + p.getBBox().height)))
  });
  return staff_bottoms;
}
function line_needed_heights(score_paper){
  var svgs = Array.from(score_paper.querySelectorAll('.abcjs-container svg'));
  return line_svgs(score_paper).map(find_svg_needed_height);
}
function line_current_heights(score_paper){
  var svgs = Array.from(score_paper.querySelectorAll('.abcjs-container svg'));
  return line_svgs(score_paper).map(p=>p.viewBox.baseVal.height);
}
function get_height_below_staff(score_paper){
  var line_heights = line_current_heights(score_paper);
  var staff_bottoms = staff_bottoms(score_paper);
  return line_heights.map((h,i)=>(h - staff_bottoms[i]));
}
function set_line_height(svgs, heights){
  svgs.forEach((svg,i)=>{
    svg.viewBox.baseVal.height = heights[i];
  })
}

function fix_svg_viewbox(svg){
  svg.viewBox.baseVal.height = find_svg_needed_height(svg);
}
function fix_line_styles(score_paper) {
  for(let line of line_containers(score_paper)){
    var svg = line.firstElementChild;
    svg.style.position = '';
    line.style.paddingBottom = '';
  }
}
function fix_score_line_heights(score_paper){
  var score_paper = score_paper ? document.querySelector(score_paper) : score_paper;

  var needed_heights = line_needed_heights(score_paper);
  var bottoms = staff_bottoms(score_paper);
  var height_below_staff = needed_heights.map((h,i)=>(h - bottoms[i]));
  var max_height_below_staff = Math.max(...height_below_staff.slice(0, -1));
  var fixed_heights = bottoms.map(b=>(b + max_height_below_staff));
  set_line_height(line_svgs(score_paper).slice(0,-1), fixed_heights.slice(0,-1));
  // set_line_height(line_svgs(score_paper), fixed_heights);
  fix_line_styles(score_paper);
}
/**************************************************************************/
function open_feedback_popup(timeout=5) {
  openDom('#feedback_popup');
  var elem = document.querySelector('#feedback_popup');
  elem.dataset.timeoutCount = (parseInt(elem.dataset.timeoutCount) || 0) + 1;
  setTimeout(function () {
    elem.dataset.timeoutCount = (parseInt(elem.dataset.timeoutCount) - 1) || 0;
    if(!(parseInt(elem.dataset.timeoutCount)) > 0) {
      closeDom('#feedback_popup');
    }
  }, timeout * 1000);
}
window.addEventListener('click', function (){ open_feedback_popup(5); });
window.addEventListener('hashchange', exec_hash);
window.addEventListener('beforeprint', ()=>{save_scroll('html')});
window.addEventListener('afterprint', ()=>{restore_scroll('html')});
document.querySelector('#song_list tbody').addEventListener('click', song_list_onclick)

// 必須放在檔案最後：要等上面所有的 var 初始化（例如 scroll_tmp）與事件監聽都完成才能執行，
// 否則回訪時網址指向沒有譜／不存在的歌，close_score() 會在初始化前就被呼叫而中止整支 script
renderWithCachedData();

/*
function selectionCallback(abcelem) {
  var note = {};
  for (var key in abcelem) {
    if (abcelem.hasOwnProperty(key) && key !== "abselem")
      note[key] = abcelem[key];
  }
  console.log(abcelem);
  var el = document.getElementById("selection");
  el.innerHTML = "<b>selectionCallback parameter:</b><br>" + JSON.stringify(note);
}

function initEditor() {
  new ABCJS.Editor("abc", { paper_id: "paper0",
    generate_midi: true,
    midi_id:"midi",
    midi_download_id: "midi-download",
    generate_warnings: true,
    warnings_id:"warnings",
    abcjsParams: {
      generateDownload: true,
      clickListener: selectionCallback
    }
  });
}

window.addEventListener("load", initEditor, false);
*/

