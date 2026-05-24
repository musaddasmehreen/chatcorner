#!/bin/bash
set -e

echo "🚀 ChatCorner — Cloudflare Setup Script"
echo "========================================"

if ! command -v wrangler &> /dev/null; then
  echo "❌ Wrangler not found. Run: npm install -g wrangler"
  exit 1
fi

wrangler login

echo "📦 Creating D1 database..."
D1_OUTPUT=$(wrangler d1 create chatcorner-db 2>&1)
echo "$D1_OUTPUT"
D1_ID=$(echo "$D1_OUTPUT" | grep -oP '"database_id":\s*"\K[^"]+')
if [ -z "$D1_ID" ]; then
  D1_ID=$(echo "$D1_OUTPUT" | grep -oP 'database_id = "\K[^"]+')
fi
if [ -z "$D1_ID" ]; then
  read -p "Paste your D1 database_id: " D1_ID
fi

echo "🗂️  Creating KV namespace..."
KV_OUTPUT=$(wrangler kv:namespace create KV 2>&1)
KV_ID=$(echo "$KV_OUTPUT" | grep -oP '"id":\s*"\K[^"]+' | head -1)
if [ -z "$KV_ID" ]; then
  KV_ID=$(echo "$KV_OUTPUT" | grep -oP 'id = "\K[^"]+' | head -1)
fi
if [ -z "$KV_ID" ]; then
  read -p "Paste your KV namespace id: " KV_ID
fi

echo "🗂️  Creating KV preview namespace..."
KV_PREV_OUTPUT=$(wrangler kv:namespace create KV --preview 2>&1)
KV_PREV_ID=$(echo "$KV_PREV_OUTPUT" | grep -oP '"id":\s*"\K[^"]+' | head -1)
if [ -z "$KV_PREV_ID" ]; then
  KV_PREV_ID=$(echo "$KV_PREV_OUTPUT" | grep -oP 'id = "\K[^"]+' | head -1)
fi
if [ -z "$KV_PREV_ID" ]; then
  read -p "Paste your KV preview namespace id: " KV_PREV_ID
fi

echo "✏️  Patching wrangler.jsonc..."
node -e "
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync('wrangler.jsonc','utf8').replace(/\/\/.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,''));
  c.d1_databases[0].database_id = process.argv[1];
  c.kv_namespaces[0].id = process.argv[2];
  c.kv_namespaces[0].preview_id = process.argv[3];
  fs.writeFileSync('wrangler.jsonc', JSON.stringify(c, null, 2));
  console.log('wrangler.jsonc updated!');
" "$D1_ID" "$KV_ID" "$KV_PREV_ID"

echo "🔐 Setting JWT_SECRET..."
JWT=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
echo "$JWT" | wrangler secret put JWT_SECRET

echo "🗃️  Applying D1 schema..."
wrangler d1 execute chatcorner-db --file=schema.sql

echo "🚀 Deploying..."
wrangler deploy

echo "✅ Done! Your app: https://chatcorner.workers.dev"
