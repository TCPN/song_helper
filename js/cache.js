// 歌曲資料的 localStorage 快取
const CACHED_DATA_KEY = 'song_data';
const CACHED_DATA_TIMESTAMP_KEY = 'song_data_timestamp';

export function getCachedData() {
  try {
    const data = localStorage.getItem(CACHED_DATA_KEY);
    return data ? JSON.parse(data) : null;

  } catch (err) {
    console.log(err);
  }
  return null;
}

export function getCachedDataTimestamp() {
  return parseInt(localStorage.getItem(CACHED_DATA_TIMESTAMP_KEY));
}

export function setCachedData(data) {
  const strData = JSON.stringify(data);
  localStorage.setItem(CACHED_DATA_KEY, strData);
  localStorage.setItem(CACHED_DATA_TIMESTAMP_KEY, Date.now());
}
