// 歌曲列表的搜尋比對

// 搜尋文字當成正規表達式；不是合法的正規表達式（例如單獨的 "("、"["、"*"）時傳回 null
export function search_pattern_to_regexp(pattern) {
  try {
    return new RegExp(pattern);
  } catch (e) {
    return null;
  }
}

// 傳回判斷一列文字是否符合的函式
// 正規表達式符合，或直接包含輸入的文字，都算符合（所以輸入完整的 "歌(一)" 也找得到）
export function make_song_matcher(pattern) {
  var regexp = search_pattern_to_regexp(pattern);
  return function(text) {
    return !!((regexp && regexp.test(text)) || text.includes(pattern));
  };
}
