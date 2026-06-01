const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const basicAuth = require('express-basic-auth');

dotenv.config();
const app = express();
app.use(express.json());

const TERABOX_EMAIL = process.env.TERABOX_EMAIL;
const TERABOX_PASS = process.env.TERABOX_PASS;
let tokenCache = {};

// Basic auth middleware
app.use(basicAuth({
  users: { [TERABOX_EMAIL]: TERABOX_PASS },
  challenge: true
}));

// Auth endpoint
app.post('/auth', async (req, res) => {
  try {
    if (tokenCache.exp > Date.now()) return res.json(tokenCache);
    
    // Terabox OAuth (simplified - uses cookies)
    const token = Buffer.from(`${TERABOX_EMAIL}:${TERABOX_PASS}:${Date.now()}`).toString('base64');
    tokenCache = { token, exp: Date.now() + 3600000 };
    res.json(tokenCache);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Upload endpoint
app.post('/upload', (req, res) => {
  const { path, content, type } = req.body;
  // Implement direct Terabox upload via API or WebDAV
  res.json({ success: true, path });
});

// Upload blob
app.post('/upload-blob', (req, res) => {
  const { path, blob, size } = req.body;
  res.json({ success: true, path, size });
});

// Delete
app.delete('/delete', (req, res) => {
  const { path } = req.body;
  res.json({ success: true, deleted: path });
});

app.listen(process.env.PORT || 5000, () => console.log('Backup proxy running'));
