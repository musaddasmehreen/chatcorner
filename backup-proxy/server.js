const express = require('express');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

const app = express();
app.use(express.json({ limit: '25mb' }));

const PORT = Number(process.env.PORT || 5000);
const TERABOX_EMAIL = process.env.TERABOX_EMAIL || '';
const TERABOX_PASS = process.env.TERABOX_PASS || '';
const PROXY_API_KEY = process.env.BACKUP_PROXY_API_KEY || '';
const TERABOX_UPSTREAM_URL = process.env.TERABOX_UPSTREAM_URL || '';
const ENABLE_PROXY_MOCK = process.env.ENABLE_PROXY_MOCK === 'true';
const AUTH_TTL_MS = 12 * 60 * 60 * 1000;

const tokenCache = {
  token: null,
  exp: 0
};

const metrics = {
  authCalls: 0,
  uploads: 0,
  uploadBlob: 0,
  deletes: 0,
  failures: 0,
  lastError: null,
  startedAt: new Date().toISOString()
};

function logError(scope, error) {
  metrics.failures += 1;
  metrics.lastError = `${scope}: ${error?.message || error || 'Unknown error'}`;
  console.error(`[BACKUP_PROXY:${scope}]`, error);
}

function requireClientAccess(req, res, next) {
  if (!PROXY_API_KEY) {
    return next();
  }

  if (req.headers['x-api-key'] !== PROXY_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized client' });
  }

  next();
}

function requireProxyAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token || token !== tokenCache.token || tokenCache.exp <= Date.now()) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  next();
}

function ensureTeraboxCredentials() {
  if (!TERABOX_EMAIL || !TERABOX_PASS) {
    throw new Error('TERABOX_EMAIL and TERABOX_PASS must be configured');
  }
}

function issueToken() {
  const token = crypto
    .createHash('sha256')
    .update(`${TERABOX_EMAIL}:${Date.now()}:${Math.random()}`)
    .digest('hex');

  tokenCache.token = token;
  tokenCache.exp = Date.now() + AUTH_TTL_MS;

  return { token: tokenCache.token, exp: tokenCache.exp };
}

async function uploadToTerabox(payload) {
  if (TERABOX_UPSTREAM_URL) {
    const response = await fetch(`${TERABOX_UPSTREAM_URL}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Terabox upstream upload failed');
    }

    return result;
  }

  if (!ENABLE_PROXY_MOCK) {
    throw new Error('Terabox upload integration is not configured. Set TERABOX_UPSTREAM_URL or ENABLE_PROXY_MOCK=true.');
  }

  // Mock mode is only for smoke-testing in development environments.
  return {
    success: true,
    path: payload.path,
    size: payload.size || (payload.content ? String(payload.content).length : null),
    uploadedAt: new Date().toISOString()
  };
}

async function deleteFromTerabox(path) {
  if (TERABOX_UPSTREAM_URL) {
    const response = await fetch(`${TERABOX_UPSTREAM_URL}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Terabox upstream delete failed');
    }

    return result;
  }

  if (!ENABLE_PROXY_MOCK) {
    throw new Error('Terabox delete integration is not configured. Set TERABOX_UPSTREAM_URL or ENABLE_PROXY_MOCK=true.');
  }

  // Mock mode is only for smoke-testing in development environments.
  return {
    success: true,
    deleted: path,
    deletedAt: new Date().toISOString()
  };
}

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/health', (_req, res) => {
  const credentialsConfigured = Boolean(TERABOX_EMAIL && TERABOX_PASS);

  res.json({
    status: 'ok',
    credentialsConfigured,
    authCached: Boolean(tokenCache.token && tokenCache.exp > Date.now()),
    uptimeSeconds: Math.round(process.uptime())
  });
});

app.get('/metrics', (_req, res) => {
  res.json({
    ...metrics,
    tokenExpiresInMs: Math.max(tokenCache.exp - Date.now(), 0)
  });
});

app.post('/auth', requireClientAccess, async (_req, res) => {
  try {
    ensureTeraboxCredentials();
    metrics.authCalls += 1;

    if (tokenCache.token && tokenCache.exp > Date.now()) {
      return res.json({ token: tokenCache.token, exp: tokenCache.exp, cached: true });
    }

    const issued = issueToken();
    res.json({ ...issued, cached: false });
  } catch (error) {
    logError('AUTH', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/upload', requireClientAccess, requireProxyAuth, async (req, res) => {
  try {
    metrics.uploads += 1;
    const { path, content, type } = req.body || {};

    if (!path || typeof content === 'undefined' || !type) {
      return res.status(400).json({ error: 'path, content, and type are required' });
    }

    const uploadResult = await uploadToTerabox({ path, content, type });
    res.json(uploadResult);
  } catch (error) {
    logError('UPLOAD', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/upload-blob', requireClientAccess, requireProxyAuth, async (req, res) => {
  try {
    metrics.uploadBlob += 1;
    const { path, blob, size, mimeType } = req.body || {};

    if (!path || !blob) {
      return res.status(400).json({ error: 'path and blob are required' });
    }

    const uploadResult = await uploadToTerabox({ path, blob, size, mimeType, type: 'blob' });
    res.json(uploadResult);
  } catch (error) {
    logError('UPLOAD_BLOB', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/delete', requireClientAccess, requireProxyAuth, async (req, res) => {
  try {
    metrics.deletes += 1;
    const { path } = req.body || {};

    if (!path) {
      return res.status(400).json({ error: 'path is required' });
    }

    const deleteResult = await deleteFromTerabox(path);
    res.json(deleteResult);
  } catch (error) {
    logError('DELETE', error);
    res.status(500).json({ error: error.message });
  }
});

app.use((error, _req, res, _next) => {
  logError('UNHANDLED', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[BACKUP_PROXY] Listening on port ${PORT}`);
});
