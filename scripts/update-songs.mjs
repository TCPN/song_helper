// 抓 Google 試算表，產生網站用的 songs.json 快照（部署前執行：npm run update-songs）。
// songs.json 含整份歌譜與歌詞，repo 是公開的，所以它在 .gitignore 裡，不要 commit。
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fetch_songs } from './fetch-songs.mjs';

const OUTPUT = fileURLToPath(new URL('../songs.json', import.meta.url));

const songs = await fetch_songs();

// 防呆：資料看起來不對就不要覆寫，以免部署出空白或錯位的列表
const badSong = songs.find((song) => typeof song.id !== 'number' || (song.name !== null && typeof song.name !== 'string'));
if (songs.length === 0 || badSong)
  throw new Error('試算表資料格式和預期不同，沒有寫入 songs.json：' + JSON.stringify(badSong));

writeFileSync(OUTPUT, JSON.stringify({ updated: new Date().toISOString(), songs }) + '\n');
console.log(`已寫入 ${OUTPUT}（${songs.length} 首）`);
