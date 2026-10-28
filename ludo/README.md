# Ludo Engine Notes

## Board coordinates and layout
- Board grid is 15x15 (`.cell` uses `100% / 15`).
- Main loop path length: 51 (`MAIN_ROUTE_LENGTH`), home distance: 56.
- Color start indexes (`startMainIndex`): yellow 0, blue 13, red 26, green 39.
- Safe main indexes: `0, 8, 13, 21, 26, 34, 39, 47`.
- Home lanes and arrow-jump mapping are defined in `ludo/ludo.js` (`homeLanes`, `arrowJumpMapByCoord`, `visualArrowClasses`).

## Dice/turn queue behavior
- Supports pending multi-roll queue (`game.rollQueue`) and selected roll index.
- Extra rolls and penalty windows tracked by `mandatoryBonusRolls` and `consecutiveSixes`.
- Live control state is gated by current turn ownership (`canLocalControlColor`, `canThisBrowserPlayLiveTurn`).

## Spectator synchronization
- Match state remains on existing live-table API polling/update cycle (`get_table.php`, `update_game.php`, `start_table.php`).
- Spectators are rendered as `viewer` role and remain read-only for roll/token actions.
- New room session layer syncs seats/chat/voice via Supabase broadcast events (`q/s/m/v/a`) and does not duplicate token state.

## Admin takeover hooks
- Admin role resolves from authenticated Supabase profile (`is_admin | is_owner | is_mod`).
- Room adapter actions:
  - `Kick`: demote seat occupant to spectator and emit system notification.
  - `Kick & Take Over Seat`: vacate target and assign admin to same color seat while preserving current board positions/scores.
- If Supabase auth/channel is unavailable, session adapter degrades to local-only behavior without fabricating backend state.
