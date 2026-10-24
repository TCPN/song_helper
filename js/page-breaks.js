// 手動分頁的純函式（不碰 DOM）；設定的畫面在 score-pages.js
//
// 分頁位置記成「從第 N 個小節線之後開始新的一頁」（N = 這一行之前的行共有幾個小節線），不記第幾行：
// 之後換行位置變了（例如自動換行），同一個小節還是找得到。使用者不用選小節，點兩行之間就好，
// 程式換算成下一行開頭的位置。

// abcjs 的 tune.lines 裡，有譜的行（有 staff）才是畫面上的一行（oneSvgPerLine 時每行一個 .abcjs-container）；
// 其他是 %%newpage、副標題、文字等。小節線只數第一個譜表的第一個聲部。
// 傳回 starts：每一行開頭之前有幾個小節線；bars：整首有幾個小節線；
// newpage_lines：ABC 裡 %%newpage 之後的那一行（第幾行，0 起算；第一行之前的不算）
export function line_start_bars(tune_lines) {
  var starts = [];
  var newpage_lines = [];
  var bars = 0;
  var newpage = false;
  for(const line of tune_lines || []){
    if(line.newpage != null){
      newpage = true;
      continue;
    }
    if(!line.staff)
      continue;
    if(newpage && starts.length > 0 && !newpage_lines.includes(starts.length))
      newpage_lines.push(starts.length);
    newpage = false;
    starts.push(bars);
    var voice = (line.staff[0] && line.staff[0].voices && line.staff[0].voices[0]) || [];
    bars += voice.filter((elem)=>elem.el_type == 'bar').length;
  }
  return { starts, bars, newpage_lines };
}

// 第幾行（line_indices）換算成分頁位置（小節線數）
export function lines_to_breaks(line_indices, starts) {
  return normalize_breaks(line_indices.filter((i)=>i > 0 && i < starts.length).map((i)=>starts[i]));
}

// 分頁位置（小節線數）換算成要從新的一頁開始的行：剛好是某行開頭的就是那一行，
// 否則是那個小節所在的行；在第一行裡面或超出整首的範圍（試算表的 ABC 改過）就忽略
export function breaks_to_lines(breaks, starts, bars) {
  var lines = [];
  for(const bar of breaks){
    if(!(bar > 0 && bar < bars))
      continue;
    var line = starts.indexOf(bar);
    if(line < 0)
      line = starts.filter((start)=>start < bar).length - 1;
    if(line > 0 && !lines.includes(line))
      lines.push(line);
  }
  return lines.sort((a, b)=>a - b);
}

// 加入或取消第 line 行之前的分頁；傳回新的分頁位置
export function toggle_break(breaks, starts, bars, line) {
  var lines = breaks_to_lines(breaks, starts, bars);
  if(lines.includes(line))
    lines = lines.filter((i)=>i != line);
  else
    lines.push(line);
  return lines_to_breaks(lines, starts);
}

// 分頁位置：正整數、不重複、由小到大
export function normalize_breaks(breaks) {
  if(!Array.isArray(breaks))
    return [];
  var valid = breaks.filter((bar)=>Number.isInteger(bar) && bar > 0);
  return Array.from(new Set(valid)).sort((a, b)=>a - b);
}

// localStorage 存的是 { 歌號: [分頁位置…] } 的 JSON；壞掉的整包或單首都當作沒設定
export function parse_break_store(json) {
  try {
    var store = JSON.parse(json);
  } catch(e) {
    return {};
  }
  if(!store || typeof store != 'object' || Array.isArray(store))
    return {};
  var result = {};
  for(const [song, breaks] of Object.entries(store))
    if(Array.isArray(breaks))
      result[song] = normalize_breaks(breaks);
  return result;
}

// 這首歌用的分頁位置：網頁上設定過就用設定的（就算是空的），否則用 ABC 的 %%newpage（default_breaks）
export function song_breaks(store, song, default_breaks) {
  return Object.prototype.hasOwnProperty.call(store, song) ? store[song] : normalize_breaks(default_breaks);
}

// 設定這首歌的分頁位置；和預設一樣時刪掉設定（「還原預設」也是這樣），傳回新的 store
export function set_song_breaks(store, song, breaks, default_breaks) {
  var result = { ...store };
  breaks = normalize_breaks(breaks);
  if(same_breaks(breaks, normalize_breaks(default_breaks)))
    delete result[song];
  else
    result[song] = breaks;
  return result;
}

function same_breaks(a, b) {
  return a.length == b.length && a.every((bar, i)=>bar == b[i]);
}
