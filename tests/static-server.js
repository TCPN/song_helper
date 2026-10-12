// 零相依的靜態檔案伺服器：把 repo 根目錄當成網站根目錄。
// 用法：node tests/static-server.js [port]（預設 4173）
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  // 不允許跳出根目錄，也不提供 tests/、node_modules/、.git/ 目錄（根目錄的 package.json 等檔案仍可存取）
  if (!file.startsWith(ROOT + path.sep) || /[\\/](tests|node_modules|\.git)[\\/]/.test(file)) {
    res.writeHead(404).end('Not found');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`serving ${ROOT} at http://127.0.0.1:${PORT}`));
