// 網址 hash 的讀寫與執行（#song_id=…&transpose=…，對外契約）
import { parse_params, params_to_str } from './hash.js';
import { state } from './state.js';
import { select_song } from './list.js';
import { render_score, close_score } from './score.js';

export function parse_hash(){
  return parse_params(location.hash.slice(1));
}

export function update_hash(key, value, force=false){
  var hash = parse_hash();
  if(hash[key] != value || force){
    if(value === undefined)
      delete(hash[key]);
    else
      hash[key] = value;
    location.hash = params_to_str(hash);
  }
}

export function exec_hash(){
  state.initialHashHandled = true;
  //select score by url
  if(!!location.hash){
    // parse hash
    var hash_params = parse_hash();
    // execute hash
    if(hash_params['song_id'] != null){
      var dsongobj = state.songs.find((s)=>(s.id.toString() === hash_params['song_id']));
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
      state.displayingSong = dsongobj;
      document.querySelector('#transpose').value = transpose || 0;
      render_score(transpose || 0);
    }else{
      close_score();
    }
  }
}

// 網址指定的歌在 songData 裡是否有譜可以開（沒有指定歌也算可以處理）
export function hash_song_openable(songData) {
  var song_id = parse_hash()['song_id'];
  if (song_id == null)
    return true;
  var song = songData.find((s)=>(s.id.toString() === song_id));
  return !!(song && song.abc);
}
