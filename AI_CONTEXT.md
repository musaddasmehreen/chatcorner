# AI Context Cheat Sheet

## File ownership (edit only where needed)

### Chat messaging
- Main room messaging/UI/render pipeline: `/js/chat-v3.js`
- Legacy messaging path: `/chat.js` and `/js/chat.js`
- Shared sanitization/security helpers: `/js/security.js`

### Voice / audio
- Main room voice stack: `/js/audio-v3.js`
- Legacy audio stack: `/js/audio.js`
- PM voice signaling: `/js/pm.js`

### Permissions / admin / role policy
- Session + Supabase client bootstrap: `/js/config.js`
- Auth/session redirects: `/js/auth.js`
- Permission prompts: `/js/permissions.js`
- Admin panel actions: `/js/admin.js`

### Ludo (keep Ludo changes under `/ludo`)
- Ludo app entry/layout: `/ludo/index.html`
- Ludo board/game logic + live table sync: `/ludo/ludo.js`
- Ludo full-screen/dock styles: `/ludo/style.css`
- Ludo room seat/chat/voice/admin session layer: `/ludo/room-session.js`, `/ludo/room-ui.js`
