const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const basicAuth = require('express-basic-auth');
const rateLimit = require('express-rate-limit');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

dotenv.config();
const app = express();
app.use(express.json({ limit: '50mb' }));

const TERABOX_EMAIL = process.env.TERABOX_EMAIL;
const TERABOX_PASS = process.env.TERABOX_PASS;
const TERABOX_BASE_URL = process.env.TERABOX_BASE_URL || 'https://www.terabox.com';
const TERABOX_LOGIN_URL = process.env.TERABOX_LOGIN_URL || `${TERABOX_BASE_URL}/api/login`;
const SESSION_TTL_MS = Number(process.env.TERABOX_SESSION_TTL_MS || 3600000);

let tokenCache = null;
const jar = new CookieJar();
const teraboxClient = wrapper(axios.create({
  jar,
  withCredentials: true,
  timeout: 30000
}));

const proxyBasicUser = process.env.BACKUP_PROXY_USER;
const proxyBasicPass = process.env.BACKUP_PROXY_PASS;
if (proxyBasicUser && proxyBasicPass) {
  app.use(basicAuth({
    users: { [proxyBasicUser]: proxyBasicPass },
    challenge: true
  }));
}

function getBearerToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

function requireValidToken(req, res, next) {
  const token = getBearerToken(req);
  if (!tokenCache || tokenCache.exp <= Date.now() || token !== tokenCache.token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, try again later.' }
});

async function loginToTerabox() {
  if (!TERABOX_EMAIL || !TERABOX_PASS) {
    throw new Error('Missing TERABOX_EMAIL or TERABOX_PASS');
  }

  const payload = new URLSearchParams({
    username: TERABOX_EMAIL,
    password: TERABOX_PASS
  });

  const { data } = await teraboxClient.post(TERABOX_LOGIN_URL, payload.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (data && data.errno && data.errno !== 0) {
    throw new Error(`Terabox login failed: ${data.errmsg || data.errno}`);
  }

  tokenCache = {
    token: data?.access_token || data?.token || Buffer.from(`${Date.now()}-${Math.random()}`).toString('base64url'),
    exp: Date.now() + SESSION_TTL_MS
  };
  return tokenCache;
}

// Auth endpoint
app.post('/auth', authRateLimit, async (req, res) => {
  try {
    if (tokenCache && tokenCache.exp > Date.now()) return res.json(tokenCache);
    await loginToTerabox();
    res.json(tokenCache);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Upload endpoint
app.post('/upload', requireValidToken, async (req, res) => {
  const { path, content, type } = req.body;
  if (!path || typeof content !== 'string') {
    return res.status(400).json({ error: 'path and content are required' });
  }

  try {
    const { data } = await teraboxClient.post(`${TERABOX_BASE_URL}/api/create`, {
      path,
      content,
      type: type || 'text',
      size: Buffer.byteLength(content, 'utf8'),
      overwrite: 1
    });
    return res.json({ success: true, path, data });
  } catch (e) {
    return res.status(500).json({ error: e.response?.data || e.message });
  }
});

// Upload blob
app.post('/upload-blob', requireValidToken, async (req, res) => {
  const { path, blob, size } = req.body;
  if (!path || !blob) {
    return res.status(400).json({ error: 'path and blob are required' });
  }

  try {
    const binary = Buffer.from(blob, 'base64');
    const { data } = await teraboxClient.post(`${TERABOX_BASE_URL}/api/create`, {
      path,
      content: binary.toString('base64'),
      encoding: 'base64',
      size: size || binary.length,
      overwrite: 1
    });
    return res.json({ success: true, path, size: size || binary.length, data });
  } catch (e) {
    return res.status(500).json({ error: e.response?.data || e.message });
  }
});

// Delete
app.delete('/delete', requireValidToken, async (req, res) => {
  const { path } = req.body;
  if (!path) {
    return res.status(400).json({ error: 'path is required' });
  }

  try {
    const payload = new URLSearchParams({
      opera: 'delete',
      async: '0',
      filelist: JSON.stringify([path])
    });

    const { data } = await teraboxClient.post(`${TERABOX_BASE_URL}/api/filemanager`, payload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return res.json({ success: true, deleted: path, data });
  } catch (e) {
    return res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.listen(process.env.PORT || 5000, () => console.log('Backup proxy running'));
