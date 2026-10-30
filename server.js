'use strict';

// Сервер тренажёра: раздаёт статику из public/ и хранит результаты в SQLite.
// Без внешних зависимостей: нужен Node.js 22.5+ (встроенный node:sqlite).

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'letters.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS results (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user       TEXT    NOT NULL,
    user_key   TEXT    NOT NULL,
    layout     TEXT    NOT NULL,
    level      INTEGER NOT NULL,
    letters    TEXT    NOT NULL,
    duration   INTEGER NOT NULL,
    elapsed    INTEGER NOT NULL,
    hits       INTEGER NOT NULL,
    errors     INTEGER NOT NULL,
    misses     INTEGER NOT NULL,
    accuracy   INTEGER NOT NULL,
    cpm        INTEGER NOT NULL,
    created_at TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS results_user ON results (user_key, created_at);
`);

const stmt = {
  users: db.prepare(`
    SELECT user FROM results r
    WHERE id = (SELECT MAX(id) FROM results WHERE user_key = r.user_key)
    ORDER BY created_at DESC LIMIT 200`),
  list: db.prepare(`
    SELECT id, user, layout, level, letters, duration, elapsed, hits, errors, misses, accuracy, cpm, created_at
    FROM results WHERE user_key = ? ORDER BY id DESC LIMIT 100`),
  insert: db.prepare(`
    INSERT INTO results (user, user_key, layout, level, letters, duration, elapsed, hits, errors, misses, accuracy, cpm, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  clear: db.prepare('DELETE FROM results WHERE user_key = ?'),
};

const LAYOUTS = ['ru', 'en'];
const LETTERS = ['home', 'homeTop', 'homeBottom', 'all'];
const DURATIONS = [30, 60, 120, 300];

const userKey = name => name.toLocaleLowerCase('ru-RU');

function cleanUser(value) {
  const user = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!user || user.length > 40) throw new HttpError(400, 'Укажите имя пользователя (до 40 символов)');
  return user;
}

function count(value, max) {
  if (!Number.isInteger(value) || value < 0 || value > max) throw new HttpError(400, 'Некорректные данные результата');
  return value;
}

function validateResult(body) {
  const user = cleanUser(body.user);
  if (!LAYOUTS.includes(body.layout) || !LETTERS.includes(body.letters) || !DURATIONS.includes(body.duration)
    || !Number.isInteger(body.level) || body.level < 0 || body.level > 5) {
    throw new HttpError(400, 'Некорректные настройки игры');
  }
  const elapsed = count(body.elapsed, body.duration + 1);
  if (elapsed < 1) throw new HttpError(400, 'Некорректная длительность');
  const hits = count(body.hits, 10000);
  const errors = count(body.errors, 10000);
  const misses = count(body.misses, 10000);
  const total = hits + errors + misses;
  return {
    user, layout: body.layout, level: body.level, letters: body.letters, duration: body.duration,
    elapsed, hits, errors, misses,
    accuracy: total ? Math.round(hits / total * 100) : 0,
    cpm: Math.round(hits / elapsed * 60),
  };
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 10_000) {
        reject(new HttpError(413, 'Слишком большой запрос'));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'Некорректный JSON')); }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, url) {
  const route = `${req.method} ${url.pathname}`;
  switch (route) {
    case 'GET /api/health':
      return sendJson(res, 200, { ok: true });
    case 'GET /api/users':
      return sendJson(res, 200, stmt.users.all().map(r => r.user));
    case 'GET /api/results': {
      const user = cleanUser(url.searchParams.get('user'));
      return sendJson(res, 200, stmt.list.all(userKey(user)));
    }
    case 'POST /api/results': {
      const r = validateResult(await readBody(req));
      const info = stmt.insert.run(r.user, userKey(r.user), r.layout, r.level, r.letters, r.duration, r.elapsed,
        r.hits, r.errors, r.misses, r.accuracy, r.cpm, new Date().toISOString());
      return sendJson(res, 201, { id: Number(info.lastInsertRowid), ...r });
    }
    case 'DELETE /api/results': {
      const user = cleanUser(url.searchParams.get('user'));
      const info = stmt.clear.run(userKey(user));
      return sendJson(res, 200, { deleted: Number(info.changes) });
    }
    default:
      throw new HttpError(404, 'Не найдено');
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Метод не поддерживается');
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) throw new HttpError(404, 'Не найдено');
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Не найдено');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    if (!res.headersSent) sendJson(res, status, { error: status === 500 ? 'Внутренняя ошибка сервера' : e.message });
  }
});

server.listen(PORT, () => console.log(`letters: http://localhost:${PORT}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close();
    db.close();
    process.exit(0);
  });
}
