var ORIGINAL_TITLE = document.title;

// Load the Visualization API and the piechart package.
google.load('visualization', '1.0', {'packages':['corechart']});

// Set a callback to run when the Google Visualization API is loaded.
google.setOnLoadCallback(drawChart);

var data;
var cols, rows;
var songDataObjects;
var displayingSong;
// Callback that creates and populates a data table, 
// instantiates the pie chart, passes in the data and
// draws it.
function drawChart() {
	/*var URL = 'https://docs.google.com/spreadsheet/tq?key=0AvTQcvEt3SwvdEdaOUpVVHRSMkVXUXlHX1hZbFBzWkE';*//* file deleted! */
	var URL = 'https://docs.google.com/spreadsheet/tq?key=1_8-RZ_a_f47I0IavWYOwg5W07d_M3nQx8VK6wzEvfoM';
	var query = new google.visualization.Query(URL);
	query.send(function handleQueryResponse(response) {
		if (response.isError()) {
			alert('Error in query: ' + response.getMessage() + ' ' + response.getDetailedMessage());
			return;
		}
		data = response.getDataTable();
		songDataObjects = getSongArray(data);
		createList(songDataObjects);
		fixedListWidth();
		document.querySelector('#loading_icon').classList.add('hide');
		exec_hash();
	});
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
			displayingSong = dsongobj;
			document.querySelector('#visual_transpose').value = transpose;
			render_score();
		}else{
			close_score();
		}
	}
}

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
	var song_list_dom = song_list_table.tBodies[0];
	for(i in songs){
		var item_tpl = createListItem();
		item_tpl.num.textContent = songs[i].id + '.';
		item_tpl.name.textContent = songs[i].name;
		item_tpl.tone.textContent = songs[i].tone + '調';
		if(songs[i].abc && songs[i].abc.length > 0 && hasSongContent(songs[i])){
			item_tpl.flag.textContent += '(譜)';
		}
		song_list_dom.appendChild(item_tpl.topElem);
		item_tpl.topElem.dataset.target = songs[i].id;
		item_tpl.topElem.song_obj = songs[i];
		//item_tpl.topElem.onclick = render_score;
		item_tpl.topElem.setAttribute('onclick', 'open_score(this.dataset.target)');
	}
}

function createListItem(){
	var topElem = document.createElement('tr');
	var num = document.createElement('td');
	var name = document.createElement('td');
	var tone = document.createElement('td');
	var flag = document.createElement('td');
	topElem.appendChild(num);
	topElem.appendChild(name);
	topElem.appendChild(tone);
	topElem.appendChild(flag);
	return {
		topElem,
		num,
		name,
		tone,
		flag,
	};
}

function findTargetSongFromParents(dom){
	while(dom.dataset.target == null)
		dom = dom.parentElement;
	return getSongData(dom.dataset.target);
}

function open_score(song_id){
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
	var list_container = document.querySelector(`#list_container`);
	var song_item_in_list = document.querySelector(`#song_list tbody [data-target="${song.id}"]`);
	var rect = song_item_in_list.getClientRects()[0];
	if(rect)
		list_container.scrollBy(0, rect.top - rect.height);

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
		// generate_midi: true,
		// midi_id: 'player_control',
		clickListener: function(abcElem, tuneNumber, classes) {clickListener(abcElem, tuneNumber, classes);}
	};
	params = Object.assign({}, presetSettings, settings);
	tuneObjectArray = ABCJS.renderAbc('score_paper', song.abc, params);
	midiRendered = ABCJS.renderMidi('player-control', song.abc, {})
	
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
	var returnSettings = {};
	returnSettings.visualTranspose = Number(document.querySelector('#visual_transpose').value);
	return returnSettings;
}

function clearSettings(){
	document.querySelector('#visual_transpose').value = undefined;
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
	domClose(this.dataset.close);
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
		case "ent": open_score(song_id_dom.textContent) || restore_edited_song_id(); closeDom(song_id_popup); break;
		case "esc": restore_edited_song_id(); closeDom(song_id_popup); break;
		case "del": song_id_dom.textContent = song_id_dom.textContent.substr(0, song_id_dom.textContent.length - 1); break;
		case "inc": song_id_dom.textContent = parseInt(_target_song_id) + 1; break;
		case "dec": song_id_dom.textContent = parseInt(_target_song_id) - 1; break;
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
		'Esc': 'esc',
		'UpArrow': 'inc',
		'DownArrow': 'dec',
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

function toggleClass(element, class_name) {
	if(typeof element == 'string')
		element = document.querySelector(element);
	if(element.classList.contains(class_name))
		element.classList.remove(class_name);
	else
		element.classList.add(class_name);
}

window.addEventListener('hashchange', exec_hash);
window.addEventListener('beforeprint', ()=>{save_scroll('html')});
window.addEventListener('afterprint', ()=>{restore_scroll('html')});

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
