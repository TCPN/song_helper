
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
	document.querySelector('#loading_icon').style.display = 'flex';
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
		document.querySelector('#loading_icon').style.display = 'none';
		exec_hash();
	});
}

function exec_hash(){
	//select score by url
	if(!!location.hash){
		// parse hash
		var hash_params = location.hash.slice(1).split('&').reduce(
		function(o, s){
			var kv = s.split('=');
			if(kv.length == 1)
				o[s] = true;
			else if(kv.length == 2)
				o[kv[0]] = kv[1];
			else if(kv.length > 2)
				o[kv[0]] = kv.slice(1).join('=');
			return o;
		}, {});
		// execute hash
		if(hash_params['song_id'] != null){
			var dsongobj = songDataObjects.find((s)=>(s.id == hash_params['song_id']));
			if(!dsongobj.abc){
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
			displayingSong = null;
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
	for (var i = 0; i < data.getNumberOfRows(); i++) {
		var song = {
			"id": data.getValue(i, 0),
			"name": data.getValue(i, 1),
			"key": data.getValue(i, 2),
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
	return song.abc.match(/K:.*\n.*\w/);
}

function createList(songs){
	var song_list_dom = document.querySelector('#song_list');
	for(i in songs){
		var item_tpl = createListItem();
		item_tpl.num.textContent = songs[i].id + '.';
		item_tpl.name.textContent = songs[i].name;
		if(songs[i].abc && songs[i].abc.length > 0 && hasSongContent(songs[i])){
			item_tpl.flag.textContent += '(譜)';
		}
		song_list_dom.appendChild(item_tpl.topElem);
		item_tpl.topElem.dataset.target = songs[i].id;
		item_tpl.topElem.song_obj = songs[i];
		item_tpl.topElem.onclick = render_score;
	}
}

function createListItem(){
	var topElem = document.createElement('tr');
	var num = document.createElement('td');
	var name = document.createElement('td');
	var flag = document.createElement('td');
	topElem.appendChild(num);
	topElem.appendChild(name);
	topElem.appendChild(flag);
	return {
		topElem,
		num,
		name,
		flag,
	};
}

function findTargetSongFromParents(dom){
	while(dom.dataset.target == null)
		dom = dom.parentElement;
	return getSongData(dom.dataset.target);
}

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
	};
	params = Object.assign({}, presetSettings, settings);
	tuneObjectArray = ABCJS.renderAbc('score_paper', song.abc, params);
	
	var display_tone = "";
	if(true || params.oneSvgPerLine) {
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
	document.querySelector('#visual_transpose').value = 0;
}

function closePopup(event){
	if(event.target != this)
		return;
	document.querySelector(this.dataset.close).classList.remove("open");
	displayingSong = null;
	clearSettings();
}

function redrawScore(event){
	render_score(event);
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

window.addEventListener('hashchange', exec_hash);

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
