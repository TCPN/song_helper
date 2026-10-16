// 抓 Google 試算表，產生網站用的 songs.json 快照（部署前執行：npm run update-songs）。
// songs.json 含整份歌譜與歌詞，repo 是公開的，所以它在 .gitignore 裡，不要 commit。
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SPREADSHEET_KEY, parse_gviz_response, getSongArray } from '../js/song-data.js';

const QUERY_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_KEY}/gviz/tq?tqx=out:json`;
const OUTPUT = fileURLToPath(new URL('../songs.json', import.meta.url));

const response = await fetch(QUERY_URL, { signal: AbortSignal.timeout(30000) });
if (!response.ok)
  throw new Error(`試算表下載失敗：HTTP ${response.status}`);
const songs = getSongArray(parse_gviz_response(await response.text()));

// 防呆：資料看起來不對就不要覆寫，以免部署出空白或錯位的列表
const badSong = songs.find((song) => typeof song.id !== 'number' || typeof song.name !== 'string');
if (songs.length === 0 || badSong)
  throw new Error('試算表資料格式和預期不同，沒有寫入 songs.json：' + JSON.stringify(badSong));

writeFileSync(OUTPUT, JSON.stringify({ updated: new Date().toISOString(), songs }) + '\n');
console.log(`已寫入 ${OUTPUT}（${songs.length} 首）`);
