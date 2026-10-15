// 試算表資料 → 歌曲物件

// data 是 google.visualization.DataTable（只用到 getNumberOfRows／getValue）
export function getSongArray(data) {
  /*
  0  編號
  1  歌名/曲名
  2  調號
  3  拍號
  4  首句旋律
  5  出處/譜源
  6  分類
  7  譜
  8  投影片
  9  ppt
  10 abc
  */
  var songArray = [];
  console.log('number of songs', data.getNumberOfRows());
  for (var i = 0; i < data.getNumberOfRows(); i++) {
    var song = {
      "id": data.getValue(i, 0),
      "name": data.getValue(i, 1),
      "tone": data.getValue(i, 2),
      "timesig": data.getValue(i, 3),
      "melody": data.getValue(i, 4),
      "abc": data.getValue(i, 10),
    }
    songArray.push(song);
  }
  return songArray;
}
