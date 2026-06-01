# Terabox Backup Deployment Guide

## 1) Apply database schema
Run `/tmp/workspace/musaddasmehreen/chatcorner/backup-schema.sql` in Supabase SQL Editor.

This sets up:
- Archive trigger for `messages` before delete
- 12-hour cron cleanup (`00:00` and `12:00` UTC)
- Backup logs and monitoring tables
- User reference persistence table

## 2) Deploy backup proxy (Render or Railway)
Directory: `/tmp/workspace/musaddasmehreen/chatcorner/backup-proxy`

### Environment variables
- `TERABOX_EMAIL`
- `TERABOX_PASS`
- `BACKUP_PROXY_API_KEY`
- `TERABOX_UPSTREAM_URL` (recommended production adapter endpoint)
- `ENABLE_PROXY_MOCK` (`true` for local smoke tests only)
- `PORT` (optional, default `5000`)

### Start command
```bash
npm install
npm start
```

## 3) Frontend configuration
Set these globals before loading `terabox-integrated.js` (or inject via hosting env replacement):
- `BACKUP_PROXY_URL`
- `BACKUP_PROXY_API_KEY`

Optional (not recommended for production browser exposure):
- `TERABOX_EMAIL`
- `TERABOX_PASS`

## 4) Runtime behavior
- Automatic backup cycle runs every 12 hours
- Queue-based non-blocking media uploads
- Auth token cache valid for one 12-hour cycle
- Batch archive upload up to 5000 messages
- Retention cleanup deletes `video/voice/gif` entries older than 3 months
- `images` and `user_references` are retained forever

## 5) Monitoring
Backup proxy endpoints:
- `GET /health`
- `GET /metrics`

Use logs + `backup_attempts` / `backup_logs` tables to audit backup runs.
