// 抓 Google 試算表，傳回歌曲陣列（略過沒有編號的列）。update-songs、check-songs 共用。
import { SHEET_QUERY_URL, parse_gviz_response, getSongArray } from '../js/song-data.js';

export async function fetch_songs(){
  const response = await fetch(SHEET_QUERY_URL, { signal: AbortSignal.timeout(30000) });
  if (!response.ok)
    throw new Error(`試算表下載失敗：HTTP ${response.status}`);
  const rows = getSongArray(parse_gviz_response(await response.text()));
  // 沒有編號的列（空白列等）網站上也沒有用
  const songs = rows.filter((song) => song.id !== null);
  if (songs.length < rows.length)
    console.error(`略過 ${rows.length - songs.length} 列沒有編號的資料`);
  return songs;
}
