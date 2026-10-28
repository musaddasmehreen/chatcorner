# ChatCorner Architecture

## Session / profile / role lifecycle
1. `js/config.js` creates `window.sbClient` and shared globals (`currentUser`, `currentProfile`, `currentRoom`).
2. `js/auth.js` manages login/register/logout and profile upsert.
3. `js/chat-v3.js` restores session, loads profile, and derives staff capabilities from `profiles.is_admin | is_owner | is_mod`.
4. Virtual rooms (Ludo/IPTV) switch `currentRoom` to virtual IDs and mount dedicated containers.

## Room routing + mount/unmount behavior
- Main room switching: `enterRoom(...)` path in `js/chat-v3.js`.
- Virtual room cleanup/mount: `cleanupVirtualRooms()`, `enterLudoRoom()`, `exitLudoRoom()` in `js/chat-v3.js`.
- Ludo is loaded in an iframe (`ludo/index.html`) and now layers room session UI over the board for seat/chat/voice controls.

## Realtime channels and event mapping
### Main chat
- `messages` table stream: room messages.
- Presence/user updates: `active_users` + realtime subscriptions.
- Voice signaling: `js/audio-v3.js` realtime broadcast events for offer/answer/ICE/presence.
- PM signaling: `js/pm.js` broadcast events (`pm-voice-offer`, `pm-voice-answer`, `pm-voice-ice`, `pm-voice-hangup`).

### Ludo
- Match state source of truth remains existing Ludo API polling/update path in `ludo/ludo.js` (`get_table.php`, `update_game.php`, `start_table.php`).
- Room session adapter (`ludo/room-session.js`) uses Supabase broadcast channel `ludo-room-v1:<roomKey>` with compact events:
  - `q`: seat sync request
  - `s`: seat snapshot
  - `m`: room chat message/system notice
  - `v`: voice presence + active-speaker level
  - `a`: admin kick / kick+takes-over-seat action
- On seat/admin changes, adapter requests latest table state through existing Ludo sync hooks instead of duplicating board state.

## Role behavior in Ludo session layer
- `Play`: claims one of four colors (red/green/yellow/blue) when available.
- `Watch`: read-only board interaction, with room chat and voice controls still available.
- Admin-only actions (verified from authenticated profile):
  - Kick seat occupant to spectator
  - Kick & Take Over Seat (rebinds seat ownership without resetting board state)
