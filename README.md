# ChatCorner

ChatCorner is a mixed static + Supabase realtime chat app with virtual rooms (including Ludo and IPTV), PM, voice, moderation, and an auxiliary Vite frontend bundle.

## Stack
- Static entry pages: HTML/CSS/vanilla JS
- Realtime/auth/data: Supabase (`@supabase/supabase-js`)
- Voice/PM signaling: Supabase broadcast + WebRTC helpers
- Optional frontend app: React + Vite under `/frontend`
- Deployment: Cloudflare Pages assets configuration via `wrangler.jsonc`

## Primary entry points
- Root chat UI: `/chat.html`, `/js/chat-v3.js`, `/js/audio-v3.js`, `/js/pm.js`
- Legacy/alternate chat UI: `/chat.js`, `/js/chat.js`, `/js/audio.js`
- Shared client/session config: `/js/config.js`
- Ludo room app: `/ludo/index.html`, `/ludo/ludo.js`, `/ludo/style.css`
- Admin flows: `/admin.html`, `/adminup.html`, `/setup-admin.html`, `/js/admin.js`

## Architecture map
- High-level system lifecycle and realtime event directory: `/ARCHITECTURE.md`
- AI file ownership cheat sheet: `/AI_CONTEXT.md`
- Ludo engine/session notes: `/ludo/README.md`

## Local run
- Static pages: serve repository root (or open `chat.html` directly for basic flows)
- React frontend (optional):
  - `cd /home/runner/work/chatcorner/chatcorner/frontend`
  - `npm install`
  - `npm run dev` or `npm run build`

## Deployment notes
- Cloudflare deploy workflow uses Wrangler 4 for assets-only deployment (`wrangler.jsonc` + `.github/workflows/deploy.yml`).
- Supabase schema bootstrap files live at `/schema.sql` and `/schema-updates.sql`.

## License
MIT — see `/LICENSE`.
