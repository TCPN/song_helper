// 網址 hash（#song_id=…&transpose=…）的解析與組合。這個格式是對外契約，不可無故改變。

// "a=1&b&c=x=y" → { a: '1', b: true, c: 'x=y' }
export function parse_params(s){
  return s.split('&').reduce(
    function(o, s){
      if(s == '')
        return o;
      var kv = s.split('=');
      if(kv.length == 1)
        o[s] = true;
      else if(kv.length == 2)
        o[kv[0]] = kv[1];
      else if(kv.length > 2)
        o[kv[0]] = kv.slice(1).join('=');
      return o;
    }, {});
}

// parse_params 的反向：值為 true 的只寫 key
export function params_to_str(param){
  var a = [];
  for(var key in param){
    var value = param[key];
    if(value === true)
      a.push('' + key);
    else
      a.push(key + '=' + value);
  }
  return a.join('&');
}
