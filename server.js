const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const HOST = '0.0.0.0';

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

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (parsedUrl.pathname === '/proxy') {
    const targetUrl = parsedUrl.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing url parameter');
      return;
    }
    
    let cleanUrl = targetUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'https://' + cleanUrl;
    }

    const clientModule = cleanUrl.startsWith('https') ? require('https') : require('http');
    const options = {
      headers: {
        'User-Agent': req.headers['user-agent'] || '',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    };

    clientModule.get(cleanUrl, options, (proxyRes) => {
      const resHeaders = {};
      for (const [key, val] of Object.entries(proxyRes.headers)) {
        if (!['x-frame-options', 'content-security-policy', 'frame-options', 'csp'].includes(key.toLowerCase())) {
          resHeaders[key] = val;
        }
      }
      resHeaders['Access-Control-Allow-Origin'] = '*';

      const contentType = proxyRes.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        let body = '';
        proxyRes.on('data', (chunk) => body += chunk);
        proxyRes.on('end', () => {
          const baseTag = `<base href="${cleanUrl}">`;
          const injectScript = `
<script>
  (function() {
    document.addEventListener('click', function(e) {
      var a = e.target.closest('a');
      if (a && a.href) {
        var href = a.href.trim();
        if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        window.location.href = window.location.origin + '/proxy?url=' + encodeURIComponent(a.href);
      }
    }, true);

    document.addEventListener('submit', function(e) {
      var form = e.target;
      var method = (form.method || 'get').toLowerCase();
      if (method === 'get' && form.action) {
        e.preventDefault();
        e.stopPropagation();
        var url = new URL(form.action);
        var formData = new FormData(form);
        for (var pair of formData.entries()) {
          url.searchParams.set(pair[0], pair[1]);
        }
        window.location.href = window.location.origin + '/proxy?url=' + encodeURIComponent(url.toString());
      }
    }, true);
  })();
</script>
`;
          if (body.includes('<head>')) {
            body = body.replace('<head>', `<head>${baseTag}${injectScript}`);
          } else if (body.includes('<HEAD>')) {
            body = body.replace('<HEAD>', `<HEAD>${baseTag}${injectScript}`);
          } else {
            body = baseTag + injectScript + body;
          }
          
          res.writeHead(proxyRes.statusCode || 200, resHeaders);
          res.end(body);
        });
      } else {
        res.writeHead(proxyRes.statusCode || 200, resHeaders);
        proxyRes.pipe(res);
      }
    }).on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Proxy Error: ' + err.message);
    });
    return;
  }

  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/chat.html';

  const filePath = path.join(__dirname, urlPath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const chatPath = path.join(__dirname, 'chat.html');
      fs.readFile(chatPath, (err2, data) => {
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
