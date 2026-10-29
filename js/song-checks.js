// 試算表歌曲資料的檢查（scripts/check-songs.mjs 用；不碰 DOM、不呼叫 abcjs）
// 要加新的檢查：在 SONG_CHECKS 加一項，check-songs 就會一起列出

// 譜本體（第一個 K: 行之後）有沒有段落標記：P: 行或行內 [P:…]
// K: 之前的 P: 是演唱順序（例如 P:ABAB），不是段落標記
export function has_part_marks(abc){
  var key_line = abc && abc.match(/^K:.*$/m);
  if(!key_line)
    return false;
  var body = abc.slice(key_line.index + key_line[0].length);
  return /^P:|\[P:/m.test(body);
}

// 有沒有跟著音符的歌詞（w: 行）
export function has_lyrics(abc){
  return !!abc && /^w:/m.test(abc);
}

// id：check-songs --only 用的名稱；title：報告上的說明；match(song)：這首歌有這個問題
export const SONG_CHECKS = [
  {
    id: 'no-parts',
    title: '有歌詞但沒有 P: 段落標記（投影片歌詞會整首當一段，分成 V1、V2…）',
    match: (song) => has_lyrics(song.abc) && !has_part_marks(song.abc),
  },
];

// 每個檢查列出有問題的歌（只放編號與歌名，不放歌詞）
export function run_checks(songs, checks = SONG_CHECKS){
  return checks.map((check) => ({
    id: check.id,
    title: check.title,
    songs: songs.filter((song) => check.match(song)).map((song) => ({ id: song.id, name: song.name })),
  }));
}
