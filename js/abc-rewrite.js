// 把 ABC 譜改寫成和弦、旋律兩個聲部（給 MIDI 播放用）。目前沒有被使用，保留給之後的播放功能。

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
export function rewrite_abc(str, melody_first=false) {
  // var str = document.querySelector('#abc').value;
  var obj = str;
  obj = remove_backslash_breakline(obj);
  obj = split_lines(obj);
  obj = split_measures(obj);
  obj = extract_chord_voice(obj);
  obj = form_score(obj, melody_first);;
  return obj;
}
