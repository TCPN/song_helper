// 「編輯」選單：在新分頁開編輯器（放在學校網頁時編輯器在 App Engine 上）

export function open_editor(song_id) {
  var editor_url = (location.hostname == 'www.csie.ntu.edu.tw' ? '//tcpn-web.appspot.com/song_edit/' : '/song_edit/');
  var url = editor_url + (song_id ? '#song_id=' + song_id : '');
  window.open(url);
}

export function open_chord_editor(song_id) {
  var editor_url = (location.hostname == 'www.csie.ntu.edu.tw' ? '//tcpn-web.appspot.com/chord_editor/' : '/chord_editor/');
  var url = editor_url + (song_id ? '#song_id=' + song_id : '');
  window.open(url);
}
