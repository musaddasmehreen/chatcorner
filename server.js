const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const HOST = '0.0.0.0';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5000,http://127.0.0.1:5000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const REQUEST_WINDOW_MS = 10 * 1000;
const REQUEST_MAX = 120;
const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX = 3;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SUSPICIOUS_BLOCK_MS = 10 * 60 * 1000;

const requestBuckets = new Map();
const loginBuckets = new Map();
const sessionActivity = new Map();
const suspiciousIps = new Map();

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
};

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

function appendEvent(map, key, nowTs, windowMs) {
  const list = (map.get(key) || []).filter((ts) => nowTs - ts < windowMs);
  list.push(nowTs);
  map.set(key, list);
  return list;
}

function buildCspHeader() {
  return "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co https://api.ipapi.is; media-src 'self' blob: data: https:;";
}

function setSecurityHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0] || 'http://localhost:5000');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, X-Request-Signature');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', buildCspHeader());
}

function isRateLimited(ip, nowTs) {
  const events = appendEvent(requestBuckets, ip, nowTs, REQUEST_WINDOW_MS);
  return events.length > REQUEST_MAX;
}

function isLoginRateLimited(ip, nowTs, req) {
  const isLoginRoute = /\/(index\.html)?$/i.test(req.url || '');
  if (!isLoginRoute || req.method !== 'POST') return false;
  const events = appendEvent(loginBuckets, ip, nowTs, LOGIN_WINDOW_MS);
  return events.length > LOGIN_MAX;
}

function isSessionExpired(ip, nowTs) {
  const lastSeen = sessionActivity.get(ip);
  sessionActivity.set(ip, nowTs);
  return lastSeen ? nowTs - lastSeen > SESSION_TIMEOUT_MS : false;
}

function isSuspiciouslyBlocked(ip, nowTs) {
  const blockedUntil = suspiciousIps.get(ip) || 0;
  if (blockedUntil <= nowTs) {
    suspiciousIps.delete(ip);
    return false;
  }
  return true;
}

function recordSuspicious(ip, nowTs) {
  suspiciousIps.set(ip, nowTs + SUSPICIOUS_BLOCK_MS);
}

const server = http.createServer((req, res) => {
  const nowTs = Date.now();
  const ip = getClientIp(req);
  setSecurityHeaders(req, res);
  console.log(`[${new Date(nowTs).toISOString()}] ${ip} ${req.method} ${req.url}`);

  if (isSuspiciouslyBlocked(ip, nowTs)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many suspicious requests' }));
    return;
  }
  if (isRateLimited(ip, nowTs)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
    return;
  }
  if (isLoginRateLimited(ip, nowTs, req)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many login attempts' }));
    return;
  }
  if (isSessionExpired(ip, nowTs) && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    res.writeHead(440, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Session timed out due to inactivity' }));
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(__dirname, urlPath);

  if (!filePath.startsWith(__dirname)) {
    recordSuspicious(ip, nowTs);
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexPath = path.join(__dirname, 'index.html');
      fs.readFile(indexPath, (err2, data) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err2, data) => {
      if (err2) {
        res.writeHead(500);
        res.end('Internal server error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`ChatCorner running at http://${HOST}:${PORT}`);
});
