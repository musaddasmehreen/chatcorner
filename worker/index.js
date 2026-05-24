import { ChatRoom, PmHub } from './realtime.js';

export { ChatRoom, PmHub };

const textEncoder = new TextEncoder();
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

function withCors(response) {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(data, status = 200) {
  return withCors(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));
}

function error(message, status = 400) {
  return json({ error: message }, status);
}

function base64UrlEncode(input) {
  return btoa(input).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function randomId(length = 5) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function base64UrlToUint8Array(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  return Uint8Array.from(atob(b64 + pad), (c) => c.charCodeAt(0));
}

async function signJwt(payload, secret) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, textEncoder.encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${sigB64}`;
}

async function verifyJwt(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('HMAC', key, base64UrlToUint8Array(sig), textEncoder.encode(data));
  if (!valid) return null;
  const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
  if (!payload.exp || payload.exp < Date.now() / 1000) return null;
  return payload;
}

async function hashPassword(password, salt) {
  const keyMaterial = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: textEncoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

async function parseJson(request) {
  try { return await request.json(); } catch { return null; }
}

function getTokenFromHeader(request) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

async function getSessionFromToken(token, env) {
  if (!token) return null;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) return null;
  if (env.KV) {
    const revoked = await env.KV.get(`revoked:${token}`);
    if (revoked) return null;
  }

  const row = await env.DB.prepare(`
    SELECT u.id, u.email, u.is_guest, u.is_admin, u.is_banned, u.created_at,
           p.username, p.avatar_color, p.is_registered, p.last_active
      FROM users u
      LEFT JOIN profiles p ON p.id = u.id
     WHERE u.id = ?
  `).bind(payload.sub).first();

  if (!row || row.is_banned) return null;

  return {
    token,
    payload,
    user: {
      id: row.id,
      email: row.email,
      is_guest: !!row.is_guest,
      is_admin: !!row.is_admin,
      is_banned: !!row.is_banned,
      created_at: row.created_at,
      username: row.username
    },
    profile: {
      id: row.id,
      username: row.username,
      avatar_color: row.avatar_color,
      is_registered: !!row.is_registered,
      last_active: row.last_active
    }
  };
}

async function requireSession(request, env) {
  const token = getTokenFromHeader(request);
  return getSessionFromToken(token, env);
}

async function requireAdmin(request, env) {
  const session = await requireSession(request, env);
  if (!session?.user?.is_admin) return null;
  return session;
}

async function scalar(env, sql, binds = []) {
  const row = await env.DB.prepare(sql).bind(...binds).first();
  if (!row) return 0;
  const key = Object.keys(row)[0];
  return Number(row[key] || 0);
}

async function forwardRoomBroadcast(env, roomId, message) {
  const id = env.CHAT_ROOM.idFromName(roomId);
  const stub = env.CHAT_ROOM.get(id);
  const req = new Request(`https://do.internal/room/${roomId}/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  await stub.fetch(req).catch(() => null);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return fetch(request);
    }

    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }));
    }

    const parts = url.pathname.split('/').filter(Boolean);

    try {
      // Auth
      if (url.pathname === '/api/auth/register' && request.method === 'POST') {
        const body = await parseJson(request);
        const username = String(body?.username || '').trim();
        const email = String(body?.email || '').trim().toLowerCase();
        const password = String(body?.password || '');
        if (!username || !email || !password) return error('Missing required fields', 400);
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return error('Invalid username format', 400);
        if (password.length < 6) return error('Password must be at least 6 characters', 400);

        const userId = crypto.randomUUID();
        const salt = crypto.randomUUID();
        const passwordHash = await hashPassword(password, salt);

        const tx1 = await env.DB.prepare(
          'INSERT INTO users (id, email, password_hash, salt, is_guest, is_admin, is_banned) VALUES (?, ?, ?, ?, 0, 0, 0)'
        ).bind(userId, email, passwordHash, salt).run();
        if (!tx1.success) return error('Could not create user', 400);

        const tx2 = await env.DB.prepare(
          'INSERT INTO profiles (id, username, avatar_color, is_registered, last_active) VALUES (?, ?, ?, 1, ?)'
        ).bind(userId, username, '#7c3aed', new Date().toISOString()).run();
        if (!tx2.success) return error('Could not create profile', 400);

        const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
        const token = await signJwt({ sub: userId, username, is_admin: false, is_guest: false, exp }, env.JWT_SECRET);
        return json({ token, email_confirmation: false });
      }

      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        const body = await parseJson(request);
        const email = String(body?.email || '').trim().toLowerCase();
        const password = String(body?.password || '');
        if (!email || !password) return error('Missing email or password', 400);

        const row = await env.DB.prepare(
          'SELECT id, password_hash, salt, is_admin, is_guest, is_banned FROM users WHERE email = ?'
        ).bind(email).first();
        if (!row || !row.password_hash || row.is_banned) return error('Invalid login credentials', 401);

        const expected = await hashPassword(password, row.salt || '');
        if (expected !== row.password_hash) return error('Invalid login credentials', 401);

        const profile = await env.DB.prepare('SELECT username FROM profiles WHERE id = ?').bind(row.id).first();
        const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
        const token = await signJwt({ sub: row.id, username: profile?.username || 'User', is_admin: !!row.is_admin, is_guest: !!row.is_guest, exp }, env.JWT_SECRET);
        return json({ token });
      }

      if (url.pathname === '/api/auth/guest' && request.method === 'POST') {
        const userId = crypto.randomUUID();
        const guestName = `Guest_${randomId(5)}`;

        await env.DB.prepare('INSERT INTO users (id, is_guest, is_admin, is_banned) VALUES (?, 1, 0, 0)').bind(userId).run();
        await env.DB.prepare(
          'INSERT INTO profiles (id, username, avatar_color, is_registered, last_active) VALUES (?, ?, ?, 0, ?)'
        ).bind(userId, guestName, '#7c3aed', new Date().toISOString()).run();

        const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
        const token = await signJwt({ sub: userId, username: guestName, is_admin: false, is_guest: true, exp }, env.JWT_SECRET);
        return json({ token });
      }

      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        const token = getTokenFromHeader(request);
        if (token && env.KV) {
          const payload = await verifyJwt(token, env.JWT_SECRET);
          if (payload?.exp) {
            const ttl = Math.max(60, Math.floor(payload.exp - Date.now() / 1000));
            await env.KV.put(`revoked:${token}`, '1', { expirationTtl: ttl });
          }
        }
        return json({ ok: true });
      }

      if (url.pathname === '/api/auth/session' && request.method === 'GET') {
        const session = await requireSession(request, env);
        if (!session) return error('Unauthorized', 401);
        return json({ user: session.user, profile: session.profile });
      }

      // Rooms & Profiles
      if (url.pathname === '/api/rooms' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT * FROM rooms ORDER BY name').all();
        return json({ data: rows.results || [] });
      }

      if (parts[1] === 'rooms' && parts[3] === 'messages' && request.method === 'GET') {
        const roomId = parts[2];
        const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 50)));
        const rows = await env.DB.prepare(
          'SELECT * FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT ?'
        ).bind(roomId, limit).all();
        const data = (rows.results || []).reverse();
        return json({ data });
      }

      if (parts[1] === 'rooms' && parts[3] === 'messages' && request.method === 'POST') {
        const session = await requireSession(request, env);
        if (!session) return error('Unauthorized', 401);
        const roomId = parts[2];
        const body = await parseJson(request);
        const content = String(body?.content || '').trim();
        if (!content) return error('Message content is required', 400);

        const id = body?.id || crypto.randomUUID();
        const createdAt = new Date().toISOString();
        await env.DB.prepare(
          'INSERT INTO messages (id, room_id, user_id, username, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, roomId, session.user.id, session.profile.username, content, 'text', createdAt).run();
        return json({ id, room_id: roomId, user_id: session.user.id, username: session.profile.username, content, type: 'text', created_at: createdAt });
      }

      if (parts[1] === 'profiles' && parts[2] && request.method === 'GET') {
        const row = await env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(parts[2]).first();
        if (!row) return error('Profile not found', 404);
        return json({ data: row });
      }

      if (parts[1] === 'profiles' && parts[2] && request.method === 'PATCH') {
        const session = await requireSession(request, env);
        if (!session) return error('Unauthorized', 401);
        if (session.user.id !== parts[2] && !session.user.is_admin) return error('Forbidden', 403);
        const body = await parseJson(request);
        const username = body?.username ? String(body.username).trim() : null;
        const avatarColor = body?.avatar_color ? String(body.avatar_color).trim() : null;
        await env.DB.prepare(
          'UPDATE profiles SET username = COALESCE(?, username), avatar_color = COALESCE(?, avatar_color), last_active = ? WHERE id = ?'
        ).bind(username, avatarColor, new Date().toISOString(), parts[2]).run();
        const row = await env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(parts[2]).first();
        return json({ data: row });
      }

      if (parts[1] === 'pm' && parts[2] === 'history' && parts[3] && request.method === 'GET') {
        const session = await requireSession(request, env);
        if (!session) return error('Unauthorized', 401);
        const otherUserId = parts[3];
        const rows = await env.DB.prepare(`
          SELECT * FROM private_messages
           WHERE (sender_id = ? AND recipient_id = ?)
              OR (sender_id = ? AND recipient_id = ?)
           ORDER BY created_at DESC
           LIMIT 50
        `).bind(session.user.id, otherUserId, otherUserId, session.user.id).all();
        return json({ data: (rows.results || []).reverse() });
      }

      // WebSockets -> Durable Objects
      if (parts[1] === 'ws' && parts[2] === 'room' && parts[3] && request.method === 'GET') {
        const id = env.CHAT_ROOM.idFromName(parts[3]);
        const stub = env.CHAT_ROOM.get(id);
        return stub.fetch(request);
      }

      if (url.pathname === '/api/ws/pm' && request.method === 'GET') {
        const id = env.PM_HUB.idFromName('global');
        const stub = env.PM_HUB.get(id);
        return stub.fetch(request);
      }

      // Admin
      if (url.pathname.startsWith('/api/admin/')) {
        const admin = await requireAdmin(request, env);
        if (!admin) return error('Forbidden', 403);

        if (url.pathname === '/api/admin/stats' && request.method === 'GET') {
          const [totalUsers, registeredUsers, totalMessages, totalRooms, bannedUsers] = await Promise.all([
            scalar(env, 'SELECT count(*) AS c FROM users'),
            scalar(env, 'SELECT count(*) AS c FROM users WHERE is_guest = 0'),
            scalar(env, 'SELECT count(*) AS c FROM messages'),
            scalar(env, 'SELECT count(*) AS c FROM rooms'),
            scalar(env, 'SELECT count(*) AS c FROM banned_users')
          ]);
          return json({ totalUsers, registeredUsers, totalMessages, totalRooms, bannedUsers });
        }

        if (url.pathname === '/api/admin/users' && request.method === 'GET') {
          const search = (url.searchParams.get('search') || '').trim().toLowerCase();
          const filter = url.searchParams.get('filter') || 'all';
          const query = [
            `SELECT u.id, u.email, u.is_guest, u.is_admin, u.is_banned, u.created_at,`,
            `p.username, p.avatar_color, p.is_registered, p.last_active,`,
            `b.reason AS ban_reason, b.banned_by, b.created_at AS banned_at`,
            `FROM users u`,
            `LEFT JOIN profiles p ON p.id = u.id`,
            `LEFT JOIN banned_users b ON b.user_id = u.id`,
            `WHERE 1=1`
          ];
          const binds = [];
          if (search) {
            query.push('AND (lower(p.username) LIKE ? OR lower(u.email) LIKE ? OR lower(u.id) LIKE ?)');
            binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
          }
          if (filter === 'registered') query.push('AND u.is_guest = 0');
          if (filter === 'guest') query.push('AND u.is_guest = 1');
          if (filter === 'banned') query.push('AND u.is_banned = 1');
          if (filter === 'admins') query.push('AND u.is_admin = 1');
          query.push('ORDER BY u.created_at DESC');

          const rows = await env.DB.prepare(query.join(' ')).bind(...binds).all();
          return json({ data: rows.results || [] });
        }

        if (parts[2] === 'users' && parts[3] && request.method === 'PATCH') {
          const userId = parts[3];
          const body = await parseJson(request);

          if (Object.prototype.hasOwnProperty.call(body || {}, 'is_admin')) {
            await env.DB.prepare('UPDATE users SET is_admin = ? WHERE id = ?').bind(body.is_admin ? 1 : 0, userId).run();
          }

          if (Object.prototype.hasOwnProperty.call(body || {}, 'is_banned')) {
            const isBanned = body.is_banned ? 1 : 0;
            await env.DB.prepare('UPDATE users SET is_banned = ? WHERE id = ?').bind(isBanned, userId).run();
            if (isBanned) {
              await env.DB.prepare(
                'INSERT INTO banned_users (id, user_id, banned_by, reason, created_at) VALUES (?, ?, ?, ?, ?)'
              ).bind(crypto.randomUUID(), userId, admin.user.id, String(body.reason || 'Banned by admin'), new Date().toISOString()).run();
            } else {
              await env.DB.prepare('DELETE FROM banned_users WHERE user_id = ?').bind(userId).run();
            }
          }

          return json({ ok: true });
        }

        if (parts[2] === 'users' && parts[3] && request.method === 'DELETE') {
          const userId = parts[3];
          await env.DB.prepare('DELETE FROM private_messages WHERE sender_id = ? OR recipient_id = ?').bind(userId, userId).run();
          await env.DB.prepare('DELETE FROM messages WHERE user_id = ?').bind(userId).run();
          await env.DB.prepare('DELETE FROM banned_users WHERE user_id = ?').bind(userId).run();
          await env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(userId).run();
          await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
          return json({ ok: true });
        }

        if (url.pathname === '/api/admin/rooms' && request.method === 'GET') {
          const rows = await env.DB.prepare(`
            SELECT r.*, (
              SELECT count(*) FROM messages m WHERE m.room_id = r.id
            ) AS message_count
            FROM rooms r
            ORDER BY r.created_at DESC
          `).all();
          return json({ data: rows.results || [] });
        }

        if (url.pathname === '/api/admin/rooms' && request.method === 'POST') {
          const body = await parseJson(request);
          const id = body?.id || `room-${crypto.randomUUID().slice(0, 8)}`;
          const name = String(body?.name || '').trim();
          if (!name) return error('Room name is required', 400);
          await env.DB.prepare(
            'INSERT INTO rooms (id, name, description, is_audio_enabled, is_locked, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(id, name, body?.description || null, body?.is_audio_enabled ? 1 : 0, body?.is_locked ? 1 : 0, new Date().toISOString()).run();
          return json({ ok: true, id });
        }

        if (parts[2] === 'rooms' && parts[3] && request.method === 'PATCH') {
          const body = await parseJson(request);
          await env.DB.prepare(
            'UPDATE rooms SET name = COALESCE(?, name), description = COALESCE(?, description), is_audio_enabled = COALESCE(?, is_audio_enabled), is_locked = COALESCE(?, is_locked) WHERE id = ?'
          ).bind(
            body?.name ?? null,
            body?.description ?? null,
            Object.prototype.hasOwnProperty.call(body || {}, 'is_audio_enabled') ? (body.is_audio_enabled ? 1 : 0) : null,
            Object.prototype.hasOwnProperty.call(body || {}, 'is_locked') ? (body.is_locked ? 1 : 0) : null,
            parts[3]
          ).run();
          return json({ ok: true });
        }

        if (parts[2] === 'rooms' && parts[3] && request.method === 'DELETE') {
          await env.DB.prepare('DELETE FROM messages WHERE room_id = ?').bind(parts[3]).run();
          await env.DB.prepare('DELETE FROM rooms WHERE id = ?').bind(parts[3]).run();
          return json({ ok: true });
        }

        if (url.pathname === '/api/admin/messages' && request.method === 'GET') {
          const roomId = url.searchParams.get('roomId');
          const search = (url.searchParams.get('search') || '').trim();
          const page = Math.max(1, Number(url.searchParams.get('page') || 1));
          const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 50)));
          const offset = (page - 1) * limit;

          const where = [];
          const binds = [];
          if (roomId) {
            where.push('room_id = ?');
            binds.push(roomId);
          }
          if (search) {
            where.push('(content LIKE ? OR username LIKE ?)');
            binds.push(`%${search}%`, `%${search}%`);
          }
          const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

          const totalRow = await env.DB.prepare(`SELECT count(*) AS total FROM messages ${whereSql}`).bind(...binds).first();
          const rows = await env.DB.prepare(
            `SELECT * FROM messages ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
          ).bind(...binds, limit, offset).all();
          const total = Number(totalRow?.total || 0);
          return json({ data: rows.results || [], total, page, pages: Math.max(1, Math.ceil(total / limit)) });
        }

        if (parts[2] === 'messages' && parts[3] && request.method === 'DELETE') {
          await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(parts[3]).run();
          return json({ ok: true });
        }

        if (url.pathname === '/api/admin/banned' && request.method === 'GET') {
          const rows = await env.DB.prepare(`
            SELECT b.*, p.username
            FROM banned_users b
            LEFT JOIN profiles p ON p.id = b.user_id
            ORDER BY b.created_at DESC
          `).all();
          return json({ data: rows.results || [] });
        }

        if (url.pathname === '/api/admin/banned' && request.method === 'POST') {
          const body = await parseJson(request);
          const userId = String(body?.user_id || '').trim();
          if (!userId) return error('user_id is required', 400);
          await env.DB.prepare('UPDATE users SET is_banned = 1 WHERE id = ?').bind(userId).run();
          await env.DB.prepare(
            'INSERT INTO banned_users (id, user_id, banned_by, reason, created_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(crypto.randomUUID(), userId, admin.user.id, String(body?.reason || 'Manual ban'), new Date().toISOString()).run();
          return json({ ok: true });
        }

        if (parts[2] === 'banned' && parts[3] && request.method === 'DELETE') {
          await env.DB.prepare('UPDATE users SET is_banned = 0 WHERE id = ?').bind(parts[3]).run();
          await env.DB.prepare('DELETE FROM banned_users WHERE user_id = ?').bind(parts[3]).run();
          return json({ ok: true });
        }

        if (url.pathname === '/api/admin/broadcast' && request.method === 'POST') {
          const body = await parseJson(request);
          const message = String(body?.message || '').trim();
          const roomId = body?.roomId;
          if (!message) return error('Message is required', 400);

          const createdAt = new Date().toISOString();
          const username = admin.profile.username || 'Admin';
          const content = `[Broadcast] ${message}`;

          if (!roomId || roomId === 'all') {
            const rooms = await env.DB.prepare('SELECT id FROM rooms').all();
            for (const room of rooms.results || []) {
              const id = crypto.randomUUID();
              await env.DB.prepare(
                'INSERT INTO messages (id, room_id, user_id, username, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
              ).bind(id, room.id, admin.user.id, username, content, 'system', createdAt).run();
              await forwardRoomBroadcast(env, room.id, { type: 'chat_message', id, room_id: room.id, user_id: admin.user.id, username, content, type: 'system', created_at: createdAt });
            }
          } else {
            const id = crypto.randomUUID();
            await env.DB.prepare(
              'INSERT INTO messages (id, room_id, user_id, username, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).bind(id, roomId, admin.user.id, username, content, 'system', createdAt).run();
            await forwardRoomBroadcast(env, roomId, { type: 'chat_message', id, room_id: roomId, user_id: admin.user.id, username, content, type: 'system', created_at: createdAt });
          }

          return json({ ok: true });
        }

        if (url.pathname === '/api/admin/settings' && request.method === 'GET') {
          const rows = await env.DB.prepare('SELECT * FROM settings').all();
          const out = {};
          for (const row of rows.results || []) out[row.key] = row.value;
          return json({ data: out });
        }

        if (url.pathname === '/api/admin/settings' && request.method === 'PUT') {
          const body = await parseJson(request);
          const entries = Object.entries(body || {});
          for (const [key, value] of entries) {
            await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').bind(key, String(value)).run();
          }
          return json({ ok: true });
        }

        if (url.pathname === '/api/admin/analytics' && request.method === 'GET') {
          const [messagesPerDay, usersPerDay, topRooms, topUsers] = await Promise.all([
            env.DB.prepare(`
              SELECT date(created_at) AS day, count(*) AS count
              FROM messages
              WHERE created_at >= datetime('now', '-7 days')
              GROUP BY day
              ORDER BY day ASC
            `).all(),
            env.DB.prepare(`
              SELECT date(created_at) AS day, count(*) AS count
              FROM users
              WHERE created_at >= datetime('now', '-7 days')
              GROUP BY day
              ORDER BY day ASC
            `).all(),
            env.DB.prepare('SELECT room_id, count(*) AS count FROM messages GROUP BY room_id ORDER BY count DESC LIMIT 5').all(),
            env.DB.prepare('SELECT username, count(*) AS count FROM messages GROUP BY username ORDER BY count DESC LIMIT 10').all()
          ]);
          return json({
            messagesPerDay: messagesPerDay.results || [],
            usersPerDay: usersPerDay.results || [],
            topRooms: topRooms.results || [],
            topUsers: topUsers.results || []
          });
        }
      }

      return error('Not found', 404);
    } catch (err) {
      return error(err?.message || 'Internal server error', 500);
    }
  }
};
