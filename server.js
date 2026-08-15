/**
 * TraceApp テスト用静的 HTTP サーバー (ES Module)
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;
const ROOT_DIR = fs.existsSync(path.join(__dirname, 'dist')) ? path.join(__dirname, 'dist') : __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split('?')[0];
  let filePath = path.join(ROOT_DIR, reqUrl === '/' ? 'index.html' : reqUrl);

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/plain; charset=utf-8';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`[Static Server] Server running at http://localhost:${PORT}/`);
});
