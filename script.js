
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
	});
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

function createList(songs){
	var song_list_dom = document.querySelector('#song_list');
	var li_tpl = document.createElement('li');
	for(i in songs){
		var to_append = li_tpl.cloneNode(true);
		to_append.textContent = songs[i].id + '. ' + songs[i].name;
		if(songs[i].abc && songs[i].abc.length > 0){
			to_append.textContent += ' (abc)';
		}
		song_list_dom.appendChild(to_append);
		to_append.song_obj = songs[i];
		to_append.onclick = render_score;
	}
}

function render_score(event){
	var song = displayingSong || event.target.song_obj;
	var score_container = document.querySelector('#score_popup_container');
	var settings = getUserSettings();
	var presetSettings = {
		// TODO: decide the staffwidth dynamically
		staffwidth: 800,
		responsive: 'resize',
		wrap: {
			minSpacing: 1.8,
			maxSpacing: 3,
			preferredMeasuresPerLine: 4,
		},
	};
	params = Object.assign({}, presetSettings, settings);
	tuneObjectArray = ABCJS.renderAbc('score_paper', song.abc, params);
	
	var display_tone = "";
	try{
		var tone_signature = tuneObjectArray[0].engraver.engraver.startlimitelem.abcelem;
		display_tone = (tone_signature.acc + tone_signature.root + tone_signature.mode) || "C";
	}catch(e){
	}finally{
		document.querySelector('#current_visual_tone').textContent = display_tone;
	}
	score_container.classList.add('open');
	displayingSong = song;
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
