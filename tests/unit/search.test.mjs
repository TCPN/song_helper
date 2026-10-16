import { test } from 'node:test';
import assert from 'node:assert/strict';
import { search_pattern_to_regexp, make_song_matcher } from '../../js/search.js';

test('search_pattern_to_regexp：不合法的正規表達式傳回 null', () => {
  assert.equal(search_pattern_to_regexp('('), null);
  assert.equal(search_pattern_to_regexp('['), null);
  assert.equal(search_pattern_to_regexp('*'), null);
  assert.ok(search_pattern_to_regexp('a.c') instanceof RegExp);
});

test('make_song_matcher：當成正規表達式比對', () => {
  const m = make_song_matcher('^1\\.');
  assert.equal(m('1.奇異恩典G調'), true);
  assert.equal(m('11.奇異恩典G調'), false);
});

test('make_song_matcher：直接包含輸入的文字也算符合', () => {
  // "歌(一)" 當正規表達式是「歌一」，但原文包含這串字
  assert.equal(make_song_matcher('歌(一)')('3.歌(一)C調'), true);
  assert.equal(make_song_matcher('(')('3.歌(一)C調'), true);
  assert.equal(make_song_matcher('(')('3.歌一C調'), false);
});

test('make_song_matcher：空字串符合全部', () => {
  assert.equal(make_song_matcher('')('任何文字'), true);
});

test('make_song_matcher：區分大小寫（現況）', () => {
  assert.equal(make_song_matcher('amazing')('Amazing Grace'), false);
});
