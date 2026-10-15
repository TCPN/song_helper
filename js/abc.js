// ABC 譜的文字判讀（不碰 DOM、不呼叫 abcjs）

// 列表上的譜面標記：'chord'（含和弦）、'note'（僅旋律），沒有可顯示的譜時為 null
// K: 行之後還要有內容才算有譜
export function score_kind(abc){
  if(!(abc && abc.length > 0 && abc.match(/K:.*\r?\n.*\w/)))
    return null;
  return abc.match(/"[^"]+"/) ? 'chord' : 'note';
}

var unicode_note = {
'1/1': '𝅝',
'1/2': '𝅗𝅥',
'1/4': '𝅘𝅥',
'1/8': '𝅘𝅥𝅮',
'3/8': '𝅘𝅥𝅮𝅘𝅥𝅮𝅘𝅥𝅮',
'1/16': '𝅘𝅥𝅯',
};

// 歌曲資訊裡的「速度」：Q:1/4=80 → "𝅘𝅥=80"；沒有 Q: 時為空字串
export function tempo_text(abc){
  var q = abc && abc.match(/Q:.*/);
  if(!q)
    return '';
  var [speed_unit, speed_value] = q[0].replace('Q:', '').replace(/ /g, '').split('=');
  // 單位不在對照表時顯示原本的寫法（例如 1/3=80）；沒有 "=" 的寫法（例如 Q:120）原樣顯示
  var speed_str = speed_value === undefined ? speed_unit
    : (unicode_note[speed_unit] || speed_unit) + '=' + speed_value;
  return speed_str || '';
}

// abcjs 解析出的調號物件 { root, acc, mode } → 顯示用的調性，例如 "F♯m"；拿不到調號時為空字串
export function key_display_name(key){
  try{
    return (key.root + (({"#": "♯", "b": "♭", "": ""})[key.acc]) + key.mode) || "C";
  }catch(e){
    return "";
  }
}
