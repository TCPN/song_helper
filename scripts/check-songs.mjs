// 檢查試算表裡的歌曲，列出需要整理的歌（npm run check-songs）。檢查項目在 js/song-checks.js。
//   npm run check-songs                              抓試算表即時檢查
//   npm run check-songs -- --snapshot songs.json     改讀 update-songs 產生的快照（連不到試算表時）
//   npm run check-songs -- --only no-parts           只跑指定的檢查
//   npm run check-songs -- --json                    輸出 JSON（給程式或 agent 讀）
// 只輸出編號與歌名，不輸出歌詞；結果不要 commit。
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { SONG_CHECKS, run_checks } from '../js/song-checks.js';
import { fetch_songs } from './fetch-songs.mjs';

const { values: args } = parseArgs({
  options: {
    snapshot: { type: 'string' },
    only: { type: 'string' },
    json: { type: 'boolean', default: false },
  },
});

let checks = SONG_CHECKS;
if (args.only) {
  checks = SONG_CHECKS.filter((check) => check.id === args.only);
  if (checks.length === 0)
    throw new Error(`沒有這個檢查：${args.only}（可用：${SONG_CHECKS.map((check) => check.id).join(', ')}）`);
}

const songs = args.snapshot ? JSON.parse(readFileSync(args.snapshot, 'utf8')).songs : await fetch_songs();
const results = run_checks(songs, checks);

if (args.json) {
  console.log(JSON.stringify({ total: songs.length, checks: results }, null, 2));
} else {
  for (const result of results) {
    console.log(`[${result.id}] ${result.title}：${result.songs.length} 首（共 ${songs.length} 首）`);
    for (const song of result.songs)
      console.log(`  ${song.id}\t${song.name ?? ''}`);
  }
}
