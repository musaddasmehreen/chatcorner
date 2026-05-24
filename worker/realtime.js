const textEncoder = new TextEncoder();

function base64UrlToUint8Array(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  return Uint8Array.from(atob(b64 + pad), (c) => c.charCodeAt(0));
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

async function parseTokenFromRequest(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) return null;
  if (env.KV) {
    const revoked = await env.KV.get(`revoked:${token}`);
    if (revoked) return null;
  }
  const row = await env.DB.prepare('SELECT p.avatar_color, p.is_registered FROM profiles p WHERE p.id = ?').bind(payload.sub).first();
  return {
    token,
    userId: payload.sub,
    username: payload.username || row?.username || 'User',
    color: row?.avatar_color || '#7c3aed',
    registered: !!row?.is_registered
  };
}

export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.voiceMessages = new Map(); // id -> { id, room_id, user_id, username, audio_data, created_at, expires_at }
  }

  cleanupVoiceMessages() {
    const now = Date.now();
    for (const [id, msg] of this.voiceMessages.entries()) {
      if (msg.expires_at <= now) this.voiceMessages.delete(id);
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (request.method === 'POST' && url.pathname.endsWith('/broadcast')) {
      const body = await request.json().catch(() => null);
      if (!body?.message) return new Response('Invalid payload', { status: 400 });
      this.broadcast(body.message);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // POST /room/:roomId/voice — store voice message in memory and broadcast
    if (request.method === 'POST' && pathParts[pathParts.length - 1] === 'voice') {
      this.cleanupVoiceMessages();
      const body = await request.json().catch(() => null);
      if (!body?.audio_data) return new Response(JSON.stringify({ error: 'audio_data required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

      const now = Date.now();
      const voiceMsg = {
        id: body.id || crypto.randomUUID(),
        room_id: body.room_id || '',
        user_id: body.user_id || '',
        username: body.username || 'Unknown',
        audio_data: body.audio_data,
        created_at: new Date(now).toISOString(),
        expires_at: now + 15 * 60 * 1000
      };
      this.voiceMessages.set(voiceMsg.id, voiceMsg);
      this.broadcast({ type: 'voice_message', id: voiceMsg.id, room_id: voiceMsg.room_id, user_id: voiceMsg.user_id, username: voiceMsg.username, audio_data: voiceMsg.audio_data, created_at: voiceMsg.created_at, expires_at: voiceMsg.expires_at });
      return new Response(JSON.stringify({ ok: true, id: voiceMsg.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // GET /room/:roomId/voice/:voiceId — retrieve a voice message (404 if expired)
    if (request.method === 'GET' && pathParts[pathParts.length - 2] === 'voice') {
      this.cleanupVoiceMessages();
      const voiceId = pathParts[pathParts.length - 1];
      const msg = this.voiceMessages.get(voiceId);
      if (!msg || msg.expires_at <= Date.now()) {
        if (msg) this.voiceMessages.delete(voiceId);
        return new Response(JSON.stringify({ error: 'Voice message not found or expired' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(msg), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 400 });

    const auth = await parseTokenFromRequest(request, this.env);
    if (!auth) return new Response('Unauthorized', { status: 401 });

    const roomId = url.pathname.split('/').pop();
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, {
      server,
      roomId,
      userId: auth.userId,
      username: auth.username,
      color: auth.color,
      registered: auth.registered,
      cameraOn: false
    });

    const presenceList = [...this.sessions.values()].map((s) => ({
      userId: s.userId,
      username: s.username,
      color: s.color,
      registered: s.registered,
      cameraOn: s.cameraOn
    }));
    server.send(JSON.stringify({ type: 'presence_sync', users: presenceList }));

    this.broadcast({ type: 'presence_join', user: { userId: auth.userId, username: auth.username, color: auth.color, registered: auth.registered, cameraOn: false } }, sessionId);

    server.addEventListener('message', async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        await this.handleMessage(msg, sessionId, roomId);
      } catch (_) {}
    });

    server.addEventListener('close', () => {
      const session = this.sessions.get(sessionId);
      this.sessions.delete(sessionId);
      if (session) this.broadcast({ type: 'presence_leave', userId: session.userId });
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async handleMessage(msg, sessionId, roomId) {
    const session = this.sessions.get(sessionId);
    if (!session || !msg?.type) return;

    if (msg.type === 'chat_message') {
      const out = {
        type: 'chat_message',
        id: msg.id || crypto.randomUUID(),
        room_id: roomId,
        user_id: session.userId,
        username: session.username,
        content: String(msg.content || '').slice(0, 2000),
        created_at: new Date().toISOString()
      };
      this.broadcast(out);
      await this.env.DB.prepare(
        'INSERT INTO messages (id, room_id, user_id, username, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(out.id, out.room_id, out.user_id, out.username, out.content, 'text', out.created_at).run().catch(() => {});
      return;
    }

    if (msg.type === 'presence_update') {
      session.cameraOn = !!msg.cameraOn;
      this.broadcast({ type: 'presence_update', userId: session.userId, cameraOn: !!msg.cameraOn }, sessionId);
      return;
    }

    if (['offer', 'answer', 'ice', 'join_voice', 'leave_voice', 'camera_state'].includes(msg.type)) {
      if (msg.to) {
        for (const s of this.sessions.values()) {
          if (s.userId === msg.to) {
            try { s.server.send(JSON.stringify({ ...msg, from: session.userId, username: session.username })); } catch (_) {}
          }
        }
      } else {
        this.broadcast({ ...msg, from: session.userId, username: session.username }, sessionId);
      }
    }
  }

  broadcast(message, excludeSessionId) {
    const data = JSON.stringify(message);
    for (const [sessionId, session] of this.sessions.entries()) {
      if (sessionId === excludeSessionId) continue;
      try { session.server.send(data); } catch (_) {}
    }
  }
}

export class PmHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 400 });

    const auth = await parseTokenFromRequest(request, this.env);
    if (!auth) return new Response('Unauthorized', { status: 401 });

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    if (!this.sessions.has(auth.userId)) this.sessions.set(auth.userId, new Set());
    const userSessions = this.sessions.get(auth.userId);
    userSessions.add(server);

    server.addEventListener('message', async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type !== 'pm' || !msg.to) return;

        const payload = {
          type: 'pm',
          from: auth.userId,
          to: msg.to,
          username: auth.username,
          msgType: msg.msgType || 'text',
          text: msg.text,
          voiceDataUrl: msg.voiceDataUrl,
          createdAt: msg.createdAt || new Date().toISOString()
        };

        const recipientSessions = this.sessions.get(msg.to);
        if (recipientSessions) {
          for (const s of recipientSessions) {
            try { s.send(JSON.stringify(payload)); } catch (_) {}
          }
        }

        if (payload.msgType === 'text' && payload.text) {
          await this.env.DB.prepare(
            'INSERT INTO private_messages (id, sender_id, recipient_id, content, type, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(crypto.randomUUID(), auth.userId, msg.to, payload.text, 'text', payload.createdAt).run().catch(() => {});
        }
      } catch (_) {}
    });

    server.addEventListener('close', () => {
      const current = this.sessions.get(auth.userId);
      if (!current) return;
      current.delete(server);
      if (current.size === 0) this.sessions.delete(auth.userId);
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}
