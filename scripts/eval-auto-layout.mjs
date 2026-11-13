// 評估自動排版的斷句（npm run eval-auto-layout）：拿試算表裡已經人工排好「投影片」欄、譜上也有 w: 歌詞的歌，
// 從譜上抽出歌詞自動排版，和人工的換行位置比對（以字對齊，空白不算）。
//   npm run eval-auto-layout                               抓試算表即時評估
//   npm run eval-auto-layout -- --snapshot songs.json      改讀 update-songs 產生的快照
//   npm run eval-auto-layout -- --width 13 --lines 2 --max-lines 3   自動排版的設定（預設是網站的預設值）
//   npm run eval-auto-layout -- --worst 20                 列出最差的幾首（只列編號、歌名和分數）
//   npm run eval-auto-layout -- --show 123                 印出某一首的人工排版與自動排版（含歌詞，只在自己電腦上看）
//   npm run eval-auto-layout -- --json                     輸出 JSON
// 比較三種做法：譜的換行（不排版，從譜上抽出的原樣）、只看文字的自動排版（譜的換行不算數）、看譜的自動排版。
// 分數：人工的換行（含分頁）有幾成也換了（recall）、換的地方有幾成人工也換了（precision）、兩者的調和平均（F1）。
// 預設不輸出歌詞；結果不要 commit。
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parse_slide_cell, sections_from_abc } from '../js/slide-lyrics.js';
import { auto_layout_text, align_hints, hints_for, DEFAULT_AUTO_LAYOUT } from '../js/auto-layout.js';
import { section_to_text } from '../js/lyric-layout.js';
import { fetch_songs } from './fetch-songs.mjs';

const { values: args } = parseArgs({
  options: {
    snapshot: { type: 'string' },
    width: { type: 'string' },
    lines: { type: 'string' },
    'max-lines': { type: 'string' },
    worst: { type: 'string', default: '10' },
    show: { type: 'string' },
    json: { type: 'boolean', default: false },
  },
});

const options = {
  width: args.width ? Number(args.width) : DEFAULT_AUTO_LAYOUT.width,
  lines: args.lines ? Number(args.lines) : DEFAULT_AUTO_LAYOUT.lines,
  max_lines: args['max-lines'] ? Number(args['max-lines']) : DEFAULT_AUTO_LAYOUT.max_lines,
};

// 文字（多段，段和段之間算換行）→ { chars: [字…], breaks: Set(第幾個字後面換行) }
export function break_positions(texts) {
  var chars = [];
  var breaks = new Set();
  for (const text of texts) {
    for (const line of String(text).split(/\n+/)) {
      var before = chars.length;
      chars.push(...line.replace(/\s+/g, ''));
      if (chars.length > before)
        breaks.add(chars.length - 1);
    }
  }
  return { chars, breaks };
}

// 兩串字的最長共同子序列 → a 的第 i 個字對到 b 的第幾個字（對不到是 -1）
function align(a, b) {
  var n = a.length, m = b.length, width = m + 1;
  var lcs = new Uint16Array((n + 1) * width);
  for (var i = n - 1; i >= 0; i--)
    for (var j = m - 1; j >= 0; j--)
      lcs[i * width + j] = a[i] == b[j] ? lcs[(i + 1) * width + j + 1] + 1 : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
  var map = new Array(n).fill(-1);
  i = 0; j = 0;
  while (i < n && j < m) {
    if (a[i] == b[j]) { map[i] = j; i++; j++; }
    else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) i++;
    else j++;
  }
  return { map, common: lcs[0] };
}

// 人工的換行 vs 某種做法的換行 → { precision, recall, f1 }（最後一個字後面不算）
function compare(human, guess) {
  var { map } = align(human.chars, guess.chars);
  var last_h = human.chars.length - 1, last_g = guess.chars.length - 1;
  var human_breaks = [...human.breaks].filter((i) => i != last_h && map[i] >= 0);
  var guess_breaks = [...guess.breaks].filter((j) => j != last_g);
  var mapped = new Set(human_breaks.map((i) => map[i]));
  var hit = guess_breaks.filter((j) => mapped.has(j)).length;
  var precision = guess_breaks.length ? hit / guess_breaks.length : 1;
  var recall = human_breaks.length ? hit / human_breaks.length : 1;
  var f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
  return { precision, recall, f1 };
}

function evaluate(song) {
  var human_sections = parse_slide_cell(song.slides).sections;
  var abc_sections = sections_from_abc(song.abc, { hints: true });
  if (!human_sections.length || !abc_sections.length)
    return null;
  var abc_texts = abc_sections.map(section_to_text);
  var human = break_positions(human_sections.map(section_to_text));
  var score_lines = break_positions(abc_texts);
  // 字要大部分對得上才算（「投影片」欄和譜上的歌詞可能是不同版本）
  var { common } = align(human.chars, score_lines.chars);
  if (common < 0.8 * Math.max(human.chars.length, score_lines.chars.length))
    return null;
  // 只看文字：給全是 0 的分數，譜的換行就只當一般的弱斷點（不給的話，原本的換行會被當成人工的換行保留下來）
  var text_only = abc_texts.map((t) => auto_layout_text(t, options, 'half', new Array(t.replace(/\s+/g, '').length).fill(0)));
  var with_score = abc_texts.map((t, i) => auto_layout_text(t, options, 'half', align_hints(t, hints_for(abc_sections, abc_sections[i].name))));
  return {
    id: song.id, name: song.name,
    texts: { human: human_sections.map(section_to_text), score_lines: abc_texts, text_only, with_score },
    score_lines: compare(human, score_lines),
    text_only: compare(human, break_positions(text_only)),
    with_score: compare(human, break_positions(with_score)),
  };
}

const songs = args.snapshot ? JSON.parse(readFileSync(args.snapshot, 'utf8')).songs : await fetch_songs();
const candidates = songs.filter((s) => s.slides && String(s.slides).trim() && s.abc && /^w:/m.test(s.abc));
const results = candidates.map(evaluate).filter(Boolean);
const methods = ['score_lines', 'text_only', 'with_score'];
const LABELS = { score_lines: '譜的換行（原樣）', text_only: '只看文字的自動排版', with_score: '看譜的自動排版' };
const mean = (key, field) => results.reduce((sum, r) => sum + r[key][field], 0) / (results.length || 1);
const summary = Object.fromEntries(methods.map((m) => [m, { precision: mean(m, 'precision'), recall: mean(m, 'recall'), f1: mean(m, 'f1') }]));
const worst = results.slice().sort((a, b) => a.with_score.f1 - b.with_score.f1).slice(0, Number(args.worst));

if (args.show) {
  const r = results.find((r) => String(r.id) == args.show);
  if (!r) {
    console.log(`沒有這首歌，或它沒有「投影片」欄、w: 歌詞，或兩邊的字對不太上：${args.show}`);
  } else {
    for (const m of ['human', ...methods]) {
      console.log(`== ${m == 'human' ? '人工排版' : LABELS[m]}${m == 'human' ? '' : `（F1 ${r[m].f1.toFixed(2)}）`}`);
      console.log(r.texts[m].join('\n\n--\n\n'));
      console.log('');
    }
  }
} else if (args.json) {
  console.log(JSON.stringify({ options, total: songs.length, compared: results.length, summary,
    songs: results.map(({ id, name, score_lines, text_only, with_score }) => ({ id, name, score_lines, text_only, with_score })) }, null, 2));
} else {
  const pct = (x) => (x * 100).toFixed(0).padStart(3) + '%';
  console.log(`設定：每頁 ${options.lines} 行、最多 ${options.max_lines} 行、每行 ${options.width} 字`);
  console.log(`比對 ${results.length} 首（共 ${songs.length} 首，有「投影片」欄和 w: 歌詞、而且字對得上的）\n`);
  console.log('做法                    precision  recall   F1');
  for (const m of methods)
    console.log(`${LABELS[m].padEnd(14, '　')}  ${pct(summary[m].precision)}     ${pct(summary[m].recall)}   ${pct(summary[m].f1)}`);
  console.log(`\n看譜的自動排版 F1 最低的 ${worst.length} 首：`);
  for (const r of worst)
    console.log(`  ${r.id}\t${pct(r.with_score.f1)}（譜的換行 ${pct(r.score_lines.f1)}）\t${r.name ?? ''}`);
}
