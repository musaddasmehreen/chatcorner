# ChatCorner (Cloudflare-only)

ChatCorner runs entirely on Cloudflare Workers (Assets + API + Durable Objects + D1 + KV).

## Quick setup (automated)

Run the setup script from the repository root:

```bash
./setup-cloudflare.sh
```

The script logs into Wrangler, creates D1/KV resources, patches `wrangler.jsonc` with real IDs, sets `JWT_SECRET`, applies `schema.sql`, and deploys.

## Setup (manual)

1. Install Wrangler:
   ```bash
   npm install -g wrangler
   ```
2. Login:
   ```bash
   wrangler login
   ```
3. Create D1:
   ```bash
   wrangler d1 create chatcorner-db
   ```
   Copy the returned `database_id` into `/home/runner/work/chatcorner/chatcorner/wrangler.jsonc`.
4. Create KV:
   ```bash
   wrangler kv:namespace create KV
   ```
   Copy the returned namespace IDs into `/home/runner/work/chatcorner/chatcorner/wrangler.jsonc`.
5. Run migrations/schema:
   ```bash
   wrangler d1 execute chatcorner-db --file=schema.sql
   ```
6. Set JWT secret:
   ```bash
   wrangler secret put JWT_SECRET
   ```
7. Deploy:
   ```bash
   wrangler deploy
   ```
