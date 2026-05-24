/*
SQL Setup Guide (run in Supabase SQL editor before using all admin features):

-- Add admin flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_at timestamp with time zone;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_by uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_mod boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ban_expires_at timestamp with time zone;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kicked_until timestamp with time zone;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- FIX 5A — Moderation columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_mod boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ban_expires_at timestamp with time zone;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kicked_until timestamp with time zone;

-- Add rooms table if not exists
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  is_audio_enabled boolean DEFAULT false,
  is_locked boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Add room_id to messages if not exists
ALTER TABLE messages ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES rooms(id) ON DELETE CASCADE;

-- Settings table
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamp with time zone DEFAULT now()
);

-- Broadcasts table
CREATE TABLE IF NOT EXISTS broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text,
  sent_by uuid REFERENCES profiles(id),
  room_id uuid REFERENCES rooms(id),
  created_at timestamp with time zone DEFAULT now()
);

-- RLS: allow admins to read all profiles
CREATE POLICY "Admins read all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Admins update profiles" ON profiles FOR UPDATE USING (true);
*/

let adminUser = null;
let adminProfile = null;
let roomsCache = [];
let profilesCache = [];
let messageCache = [];
let logsPage = 1;
let loadingCount = 0;

const settingsDefaults = {
  allow_guest_login: 'true',
  maintenance_mode: 'false',
  allow_registrations: 'true',
  max_message_length: '500',
  welcome_message: 'Welcome to ChatCorner!'
};

window.addEventListener('DOMContentLoaded', async () => {
  bindUI();
  await checkAdminAuth();
  await initDashboard();
});

function bindUI() {
  document.getElementById('admin-logout').addEventListener('click', adminLogout);
  document.getElementById('refresh-stats').addEventListener('click', loadStats);
  document.getElementById('refresh-analytics').addEventListener('click', loadAnalytics);

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });

  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('nav-list').classList.toggle('open');
  });

  document.getElementById('btn-create-room').addEventListener('click', () => {
    document.getElementById('room-modal').classList.remove('hidden');
  });
  document.getElementById('close-room-modal').addEventListener('click', closeRoomModal);
  document.getElementById('create-room-confirm').addEventListener('click', createRoom);

  document.getElementById('logs-search-btn').addEventListener('click', () => {
    logsPage = 1;
    renderLogsTable();
  });
  document.getElementById('logs-room-select').addEventListener('change', () => {
    logsPage = 1;
    loadMessages();
  });
  document.getElementById('export-csv-btn').addEventListener('click', exportLogsCsv);

  document.getElementById('users-apply').addEventListener('click', renderUsersTable);
  document.getElementById('users-select-all').addEventListener('change', toggleSelectAllUsers);
  document.getElementById('bulk-run').addEventListener('click', runBulkAction);

  document.getElementById('manual-ban-form').addEventListener('submit', manualBanSubmit);

  document.getElementById('broadcast-message').addEventListener('input', updateBroadcastPreview);
  document.getElementById('send-broadcast').addEventListener('click', sendBroadcast);

  document.getElementById('save-settings').addEventListener('click', saveSettings);
}

async function checkAdminAuth() {
  showLoading(true);
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session?.user) {
    window.location.href = 'adminup.html';
    return;
  }

  adminUser = session.user;
  const { data: profile, error } = await sbClient.from('profiles').select('*').eq('id', session.user.id).maybeSingle();

  if (error || !profile?.is_admin) {
    await sbClient.auth.signOut();
    window.location.href = 'adminup.html?denied=1';
    return;
  }

  adminProfile = profile;
  document.getElementById('admin-name').textContent = profile.username || adminUser.email || 'Admin';
  showLoading(false);
}

async function initDashboard() {
  await Promise.all([
    loadRooms(),
    loadProfiles(),
    loadStats(),
    loadMessages(),
    loadUsers(),
    loadBannedUsers(),
    loadBroadcastHistory(),
    loadSettings(),
    loadAnalytics()
  ]);

  setInterval(loadStats, 20000);
}

function switchPanel(panelName) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const panel = document.getElementById('panel-' + panelName);
  if (panel) panel.classList.add('active');

  const activeBtn = document.querySelector(`.nav-btn[data-panel="${panelName}"]`);
  if (activeBtn) activeBtn.classList.add('active');
}

async function adminLogout() {
  await sbClient.auth.signOut();
  window.location.href = 'adminup.html';
}

function showLoading(on) {
  loadingCount += on ? 1 : -1;
  if (loadingCount < 0) loadingCount = 0;
  document.getElementById('loading-overlay').classList.toggle('hidden', loadingCount === 0);
}

function toast(msg, type = 'success') {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function formatBanExpiry(profile) {
  if (!profile?.is_banned) return '—';
  if (!profile?.ban_expires_at) return 'Lifetime';
  return formatDate(profile.ban_expires_at);
}

function getBanExpiresAt(durationHours) {
  if (durationHours === null || durationHours === undefined || durationHours === '' || durationHours === 'lifetime') return null;
  const hours = Number(durationHours);
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function escHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function safeCount(queryBuilder) {
  const { count, error } = await queryBuilder;
  if (error) return 0;
  return count || 0;
}

async function loadStats() {
  const statsGrid = document.getElementById('stats-grid');
  showLoading(true);
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalUsers, registeredUsers, guestUsers, totalRooms, totalMessages, todayMessages, onlineUsers] = await Promise.all([
      safeCount(sbClient.from('profiles').select('*', { count: 'exact', head: true })),
      safeCount(sbClient.from('profiles').select('*', { count: 'exact', head: true }).eq('is_registered', true)),
      safeCount(sbClient.from('profiles').select('*', { count: 'exact', head: true }).eq('is_registered', false)),
      safeCount(sbClient.from('rooms').select('*', { count: 'exact', head: true })),
      safeCount(sbClient.from('messages').select('*', { count: 'exact', head: true })),
      safeCount(sbClient.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString())),
      getOnlineUserEstimate()
    ]);

    const cards = [
      { label: 'Total Users', icon: '👥', value: totalUsers },
      { label: 'Registered Users', icon: '✅', value: registeredUsers },
      { label: 'Guest Users', icon: '👤', value: guestUsers },
      { label: 'Total Rooms', icon: '💬', value: totalRooms },
      { label: 'Total Messages', icon: '📨', value: totalMessages },
      { label: 'Messages Today', icon: '📅', value: todayMessages },
      { label: 'Currently Online (live est.)', icon: '🟢', value: onlineUsers }
    ];

    statsGrid.innerHTML = cards.map(c => `
      <div class="stat-card" title="${escHtml(c.label)}">
        <div class="stat-label">${c.icon} ${escHtml(c.label)}</div>
        <div class="stat-value">${c.value}</div>
      </div>
    `).join('');
  } catch (_) {
    statsGrid.innerHTML = '<div class="card">Could not load stats right now.</div>';
    toast('Failed to load overview stats.', 'error');
  }
  showLoading(false);
}

async function getOnlineUserEstimate() {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await sbClient.from('messages').select('user_id').gte('created_at', since).limit(1000);
  if (error || !Array.isArray(data)) return 0;
  return new Set(data.map(r => r.user_id).filter(Boolean)).size;
}

async function loadRooms() {
  showLoading(true);
  const { data, error } = await sbClient.from('rooms').select('*').order('created_at', { ascending: false });
  showLoading(false);

  if (error) {
    roomsCache = [];
    document.getElementById('rooms-body').innerHTML = '<tr><td colspan="6">No rooms found or table not ready.</td></tr>';
    fillRoomSelects([]);
    return;
  }

  roomsCache = data || [];
  fillRoomSelects(roomsCache);
  await renderRoomsTable();
}

function fillRoomSelects(rooms) {
  const logsSelect = document.getElementById('logs-room-select');
  const bSelect = document.getElementById('broadcast-room');
  logsSelect.innerHTML = '';
  bSelect.innerHTML = '<option value="all">All Rooms</option>';

  if (!rooms.length) {
    logsSelect.innerHTML = '<option value="">No rooms found</option>';
    bSelect.innerHTML += '<option value="" disabled>No rooms found</option>';
    return;
  }

  rooms.forEach(r => {
    const o1 = document.createElement('option');
    o1.value = r.id;
    o1.textContent = r.name;
    logsSelect.appendChild(o1);

    const o2 = document.createElement('option');
    o2.value = r.id;
    o2.textContent = r.name;
    bSelect.appendChild(o2);
  });
}

async function renderRoomsTable() {
  const body = document.getElementById('rooms-body');
  if (!roomsCache.length) {
    body.innerHTML = '<tr><td colspan="6">No rooms available yet. Create your first room.</td></tr>';
    return;
  }

  const msgCounts = {};
  const { data: counts } = await sbClient.from('messages').select('room_id');
  (counts || []).forEach(m => { msgCounts[m.room_id] = (msgCounts[m.room_id] || 0) + 1; });

  body.innerHTML = roomsCache.map(room => `
    <tr>
      <td>${escHtml(room.name)}</td>
      <td>${room.is_audio_enabled ? 'voice' : 'text'}</td>
      <td>${formatDate(room.created_at)}</td>
      <td>${msgCounts[room.id] || 0}</td>
      <td>${room.is_locked ? '<span class="badge banned">Locked</span>' : '<span class="badge registered">Open</span>'}</td>
      <td class="inline-row">
        <button class="btn" title="Edit room name" onclick="editRoomName('${room.id}')">✏️ Edit Name</button>
        <button class="btn" title="Toggle voice chat availability" onclick="toggleRoomVoice('${room.id}')">🔊 Toggle Voice</button>
        <button class="btn" title="Lock or unlock message sending" onclick="toggleRoomLock('${room.id}')">🔒 Lock/Unlock</button>
        <button class="btn danger" title="Delete this room permanently" onclick="deleteRoom('${room.id}')">🗑️ Delete</button>
      </td>
    </tr>
  `).join('');
}

async function editRoomName(roomId) {
  const room = roomsCache.find(r => r.id === roomId);
  if (!room) return;
  const nextName = prompt(`Rename room "${room.name}" to:`, room.name);
  if (!nextName || nextName.trim() === room.name) return;
  showLoading(true);
  const { error } = await sbClient.from('rooms').update({ name: nextName.trim() }).eq('id', roomId);
  showLoading(false);
  if (error) return toast(error.message, 'error');
  toast('Room name updated.');
  await loadRooms();
}

async function toggleRoomVoice(roomId) {
  const room = roomsCache.find(r => r.id === roomId);
  if (!room) return;
  showLoading(true);
  const { error } = await sbClient.from('rooms').update({ is_audio_enabled: !room.is_audio_enabled }).eq('id', roomId);
  showLoading(false);
  if (error) return toast(error.message, 'error');
  toast('Room voice setting changed.');
  await loadRooms();
}

async function toggleRoomLock(roomId) {
  const room = roomsCache.find(r => r.id === roomId);
  if (!room) return;
  const actionText = room.is_locked ? 'unlock' : 'lock';
  if (!confirm(`Are you sure you want to ${actionText} "${room.name}"? Locked rooms cannot send messages.`)) return;
  showLoading(true);
  const { error } = await sbClient.from('rooms').update({ is_locked: !room.is_locked }).eq('id', roomId);
  showLoading(false);
  if (error) return toast(error.message, 'error');
  toast(`Room ${actionText}ed successfully.`);
  await loadRooms();
}

async function deleteRoom(roomId) {
  const room = roomsCache.find(r => r.id === roomId);
  if (!room) return;
  if (!confirm(`WARNING: Delete room "${room.name}" and all related messages? This action cannot be undone.`)) return;
  showLoading(true);
  const { error } = await sbClient.from('rooms').delete().eq('id', roomId);
  showLoading(false);
  if (error) return toast(error.message, 'error');
  toast('Room deleted successfully.');
  await Promise.all([loadRooms(), loadMessages(), loadStats()]);
}

function closeRoomModal() {
  document.getElementById('room-name').value = '';
  document.getElementById('room-description').value = '';
  document.getElementById('room-type').value = 'text';
  document.getElementById('room-modal').classList.add('hidden');
}

async function createRoom() {
  const name = document.getElementById('room-name').value.trim();
  const description = document.getElementById('room-description').value.trim();
  const type = document.getElementById('room-type').value;
  if (!name) return toast('Room name is required.', 'error');
  showLoading(true);
  const { error } = await sbClient.from('rooms').insert({
    name,
    description: description || null,
    is_audio_enabled: type === 'voice',
    is_locked: false
  });
  showLoading(false);
  if (error) return toast(error.message, 'error');
  closeRoomModal();
  toast('Room created successfully.');
  await loadRooms();
}

async function loadProfiles() {
  const { data, error } = await sbClient.from('profiles').select('*').order('created_at', { ascending: false });
  profilesCache = error ? [] : (data || []);
}

async function loadMessages() {
  const roomId = document.getElementById('logs-room-select').value;
  const body = document.getElementById('logs-body');
  if (!roomId) {
    messageCache = [];
    body.innerHTML = '<tr><td colspan="5">No room selected.</td></tr>';
    document.getElementById('logs-pagination').innerHTML = '';
    return;
  }

  showLoading(true);
  const { data, error } = await sbClient.from('messages').select('*').eq('room_id', roomId).order('created_at', { ascending: false });
  showLoading(false);
  if (error) {
    messageCache = [];
    body.innerHTML = '<tr><td colspan="5">Could not load room messages.</td></tr>';
    return;
  }
  messageCache = data || [];
  renderLogsTable();
}

function getFilteredMessages() {
  const term = document.getElementById('logs-search').value.trim().toLowerCase();
  if (!term) return messageCache;
  return messageCache.filter(m => String(m.username || '').toLowerCase().includes(term) || String(m.content || '').toLowerCase().includes(term));
}

function renderLogsTable() {
  const body = document.getElementById('logs-body');
  const pagination = document.getElementById('logs-pagination');
  const filtered = getFilteredMessages();
  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="5">No messages found for this room/filter.</td></tr>';
    pagination.innerHTML = '';
    return;
  }

  const pageSize = 50;
  const totalPages = Math.ceil(filtered.length / pageSize);
  logsPage = Math.min(logsPage, totalPages);
  const start = (logsPage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  body.innerHTML = pageRows.map(m => {
    const profile = profilesCache.find(p => p.id === m.user_id);
    const type = profile?.is_registered ? 'registered ✓' : 'guest';
    return `
      <tr>
        <td>${formatDate(m.created_at)}</td>
        <td>${escHtml(m.username || 'Unknown')}</td>
        <td><span class="badge ${profile?.is_registered ? 'registered' : 'guest'}">${escHtml(type)}</span></td>
        <td>${escHtml(m.content || '')}</td>
        <td class="inline-row">
          <button class="btn danger" title="Delete this message permanently" onclick="deleteMessage('${m.id}')">🗑️ Delete</button>
          <button class="btn" title="Ban this message sender" onclick="banFromMessage('${m.user_id}','${escHtml(m.username || 'User')}')">🚫 Ban User</button>
        </td>
      </tr>
    `;
  }).join('');

  pagination.innerHTML = '';
  const prev = document.createElement('button');
  prev.className = 'btn';
  prev.textContent = 'Previous';
  prev.disabled = logsPage === 1;
  prev.onclick = () => { logsPage -= 1; renderLogsTable(); };
  const next = document.createElement('button');
  next.className = 'btn';
  next.textContent = 'Next';
  next.disabled = logsPage === totalPages;
  next.onclick = () => { logsPage += 1; renderLogsTable(); };
  const info = document.createElement('span');
  info.textContent = `Page ${logsPage} / ${totalPages} (${filtered.length} messages)`;
  pagination.append(prev, info, next);
}

async function deleteMessage(messageId) {
  if (!confirm('Delete this message permanently? This cannot be undone.')) return;
  showLoading(true);
  const { error } = await sbClient.from('messages').delete().eq('id', messageId);
  showLoading(false);
  if (error) return toast(error.message, 'error');
  toast('Message deleted successfully.');
  await Promise.all([loadMessages(), loadStats(), loadAnalytics()]);
}

async function banFromMessage(userId, username) {
  if (!userId) return;
  const reason = prompt(`Ban user ${username}? Add reason (optional):`, 'Violation');
  if (reason === null) return;
  await setUserBan(userId, true, reason);
}

async function exportLogsCsv() {
  const roomId = document.getElementById('logs-room-select').value;
  if (!roomId) return toast('Select a room first.', 'error');
  const rows = getFilteredMessages();
  if (!rows.length) return toast('No messages to export.', 'error');

  const lines = [['timestamp', 'username', 'message', 'user_type'].join(',')];
  rows.forEach(m => {
    const profile = profilesCache.find(p => p.id === m.user_id);
    const userType = profile?.is_registered ? 'registered' : 'guest';
    const values = [m.created_at || '', m.username || '', m.content || '', userType].map(v => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(values.join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `chat-log-${roomId}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function loadUsers() {
  await loadProfiles();
  renderUsersTable();
}

function renderUsersTable() {
  const body = document.getElementById('users-body');
  const term = document.getElementById('users-search').value.trim().toLowerCase();
  const filter = document.getElementById('users-filter').value;
  let rows = [...profilesCache];

  if (term) rows = rows.filter(p => String(p.username || '').toLowerCase().includes(term) || String(p.email || '').toLowerCase().includes(term));
  if (filter === 'registered') rows = rows.filter(p => p.is_registered);
  if (filter === 'guest') rows = rows.filter(p => !p.is_registered);
  if (filter === 'banned') rows = rows.filter(p => p.is_banned);
  if (filter === 'admins') rows = rows.filter(p => p.is_admin);
  if (filter === 'mods') rows = rows.filter(p => p.is_mod && !p.is_admin);

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="8">No users match your current filter.</td></tr>';
    return;
  }

  body.innerHTML = rows.map(p => {
    const typeBadge = p.is_admin
      ? '<span class="badge admin">admin</span>'
      : (p.is_mod
        ? '<span class="badge registered">mod</span>'
        : `<span class="badge ${p.is_registered ? 'registered' : 'guest'}">${p.is_registered ? 'registered' : 'guest'}</span>`);
    const statusBadge = p.is_banned
      ? `<span class="badge banned"><span class="status-dot red"></span>banned (${escHtml(formatBanExpiry(p))})</span>`
      : '<span class="badge registered"><span class="status-dot green"></span>active</span>';
    const roleActions = p.is_admin || p.is_mod
      ? `<button class="btn" title="Remove admin/mod privileges" onclick="demoteUser('${p.id}')">⬇️ Demote</button>`
      : `<button class="btn" title="Promote to admin" onclick="promoteToAdmin('${p.id}')">👑 Promote to Admin</button>
         <button class="btn" title="Grant moderator role" onclick="makeMod('${p.id}')">🛡️ Make Mod</button>`;
    return `
      <tr>
        <td><input type="checkbox" class="user-select" value="${p.id}" /></td>
        <td>${escHtml(p.username || 'Unknown')}</td>
        <td>${escHtml(p.email || '—')}</td>
        <td>${typeBadge}</td>
        <td>${formatDate(p.created_at)}</td>
        <td>${formatDate(p.last_active || p.updated_at || p.created_at)}</td>
        <td>${statusBadge}</td>
        <td class="inline-row">
          <button class="btn" title="View full profile details" onclick="viewProfile('${p.id}')">👁️ View</button>
          <button class="btn" title="Ban or unban this user" onclick="toggleBan('${p.id}')">🚫 ${p.is_banned ? 'Unban' : 'Ban'}</button>
          <button class="btn" title="Kick this user for 30 minutes" onclick="kickUser('${p.id}')">⚡ Kick</button>
          <button class="btn danger" title="Delete this user profile" onclick="deleteUser('${p.id}')">🗑️ Delete</button>
          ${roleActions}
        </td>
      </tr>
    `;
  }).join('');

  updateBulkCount();
  document.querySelectorAll('.user-select').forEach(cb => cb.addEventListener('change', updateBulkCount));
}

function viewProfile(userId) {
  const p = profilesCache.find(x => x.id === userId);
  if (!p) return;
  alert(`Profile Details\n\nUsername: ${p.username || '—'}\nEmail: ${p.email || '—'}\nRegistered: ${p.is_registered ? 'Yes' : 'No'}\nAdmin: ${p.is_admin ? 'Yes' : 'No'}\nMod: ${p.is_mod ? 'Yes' : 'No'}\nBanned: ${p.is_banned ? 'Yes' : 'No'}\nBan Expires: ${formatBanExpiry(p)}\nKicked Until: ${formatDate(p.kicked_until)}\nJoined: ${formatDate(p.created_at)}\nLast Active: ${formatDate(p.last_active || p.updated_at || p.created_at)}\nReason: ${p.ban_reason || '—'}`);
}

async function setUserBan(userId, banned, reason = '', durationHours = null) {
  const warning = banned ? 'This user will be blocked from access. Continue?' : 'Unban this user and restore access?';
  if (!confirm(warning)) return;
  showLoading(true);
  let ban_expires_at = null;
  if (banned && durationHours > 0) {
    ban_expires_at = new Date(Date.now() + durationHours * 3600000).toISOString();
  }
  const payload = banned
    ? {
      is_banned: true,
      banned_at: new Date().toISOString(),
      banned_by: adminUser.id,
      ban_reason: reason || 'Banned by admin',
      ban_expires_at: getBanExpiresAt(durationHours)
    }
    : { is_banned: false, banned_at: null, banned_by: null, ban_reason: null, ban_expires_at: null };
  const { error } = await sbClient.from('profiles').update(payload).eq('id', userId);
  showLoading(false);
  if (error) return toast(error.message, 'error');
  toast(`User ${banned ? 'banned' : 'unbanned'} successfully.`);
  await Promise.all([loadUsers(), loadBannedUsers(), loadStats()]);
}

async function toggleBan(userId) {
  const p = profilesCache.find(x => x.id === userId);
  if (!p) return;
  const reason = p.is_banned ? '' : (prompt('Reason for ban (optional):', 'Policy violation') || '');
  let duration = null;
  if (!p.is_banned) {
    const selected = prompt('Ban duration: lifetime, 1h, 6h, 24h, 7d, 30d', 'lifetime');
    if (selected === null) return;
    const map = { lifetime: null, '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720 };
    const key = String(selected).trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(map, key)) return toast('Invalid duration. Use lifetime, 1h, 6h, 24h, 7d, or 30d.', 'error');
    duration = map[key];
  }
  await setUserBan(userId, !p.is_banned, reason, duration);
}

async function deleteUser(userId) {
  if (!confirm('WARNING: Delete this user profile? This action cannot be undone.')) return;
  showLoading(true);
  const { error } = await sbClient.from('profiles').delete().eq('id', userId);
  showLoading(false);
  if (error) return toast(error.message, 'error');
  toast('User profile deleted.');
  await Promise.all([loadUsers(), loadBannedUsers(), loadStats()]);
}

async function promoteToAdmin(userId) {
  if (!confirm('Promote this user to admin?')) return;
  showLoading(true);
  const { error } = await sbClient.from('profiles').update({ is_admin: true, is_mod: false }).eq('id', userId);
  showLoading(false);
  if (error) return toast(error.message, 'error');
  toast('User promoted to admin.');
  await Promise.all([loadUsers(), loadStats()]);
}

async function makeMod(userId) {
  if (!confirm('Grant moderator role to this user?')) return;
  showLoading(true);
  const { error } = await sbClient.from('profiles').update({ is_mod: true, is_admin: false }).eq('id', userId);
  showLoading(false);
  if (error) return toast(error.message, 'error');
  toast('User is now a moderator.');
  await Promise.all([loadUsers(), loadStats()]);
}

async function demoteUser(userId) {
  if (!confirm('Remove elevated role from this user?')) return;
  showLoading(true);
  const { error } = await sbClient.from('profiles').update({ is_admin: false, is_mod: false }).eq('id', userId);
  showLoading(false);
  if (error) return toast(error.message, 'error');
  toast('User role removed.');
  await Promise.all([loadUsers(), loadStats()]);
}

async function kickUser(userId) {
  if (!confirm('Kick this user for 30 minutes?')) return;
  showLoading(true);
  const { error } = await sbClient.from('profiles').update({
    kicked_until: new Date(Date.now() + (30 * 60 * 1000)).toISOString()
  }).eq('id', userId);
  showLoading(false);
  if (error) return toast(error.message, 'error');
  toast('User kicked for 30 minutes.');
  await loadUsers();
}

// FIX 5D — Kick a user for 30 minutes
async function kickUser(userId) {
  const p = profilesCache.find(x => x.id === userId);
  if (!p || !confirm('Kick ' + p.username + ' for 30 minutes?')) return;
  showLoading(true);
  const { error } = await sbClient.from('profiles').update({ kicked_until: new Date(Date.now() + 1800000).toISOString() }).eq('id', userId);
  showLoading(false);
  if (error) return toast(error.message, 'error');
  toast('User kicked for 30 minutes.');
  await loadUsers();
}

// FIX 5E — Toggle moderator role
async function toggleMod(userId) {
  const p = profilesCache.find(x => x.id === userId);
  if (!p) return;
  if (!confirm((p.is_mod ? 'Remove mod from ' : 'Make mod: ') + p.username)) return;
  showLoading(true);
  const { error } = await sbClient.from('profiles').update({ is_mod: !p.is_mod }).eq('id', userId);
  showLoading(false);
  if (error) return toast(error.message, 'error');
  toast('Mod status updated.');
  await loadUsers();
}

function getSelectedUserIds() {
  return Array.from(document.querySelectorAll('.user-select:checked')).map(cb => cb.value);
}

function updateBulkCount() {
  document.getElementById('bulk-count').textContent = `${getSelectedUserIds().length} selected`;
}

function toggleSelectAllUsers(event) {
  document.querySelectorAll('.user-select').forEach(cb => { cb.checked = event.target.checked; });
  updateBulkCount();
}

async function runBulkAction() {
  const action = document.getElementById('bulk-action').value;
  const ids = getSelectedUserIds();
  if (!action) return toast('Choose a bulk action first.', 'error');
  if (!ids.length) return toast('Select at least one user.', 'error');

  if (action === 'ban') {
    if (!confirm(`Ban ${ids.length} selected users?`)) return;
    showLoading(true);
    const { error } = await sbClient.from('profiles').update({
      is_banned: true,
      banned_at: new Date().toISOString(),
      banned_by: adminUser.id,
      ban_reason: 'Bulk ban by admin',
      ban_expires_at: null
    }).in('id', ids);
    showLoading(false);
    if (error) return toast(error.message, 'error');
    toast(`Banned ${ids.length} users.`);
  }

  if (action === 'delete') {
    if (!confirm(`WARNING: Delete ${ids.length} selected user profiles permanently?`)) return;
    showLoading(true);
    const { error } = await sbClient.from('profiles').delete().in('id', ids);
    showLoading(false);
    if (error) return toast(error.message, 'error');
    toast(`Deleted ${ids.length} user profiles.`);
  }

  document.getElementById('users-select-all').checked = false;
  await Promise.all([loadUsers(), loadBannedUsers(), loadStats()]);
}

async function loadBannedUsers() {
  const body = document.getElementById('banned-body');
  const { data, error } = await sbClient.from('profiles').select('*').eq('is_banned', true).order('banned_at', { ascending: false });
  if (error) {
    body.innerHTML = '<tr><td colspan="6">Could not load banned users.</td></tr>';
    return;
  }
  const rows = data || [];
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6">No banned users right now.</td></tr>';
    return;
  }
  body.innerHTML = rows.map(p => {
    const bannedBy = profilesCache.find(x => x.id === p.banned_by)?.username || p.banned_by || '—';
    const expiresAt = p.ban_expires_at ? formatDate(p.ban_expires_at) : 'Lifetime';
    return `
      <tr>
        <td>${escHtml(p.username || p.id)}</td>
        <td>${formatDate(p.banned_at)}</td>
        <td>${escHtml(formatBanExpiry(p))}</td>
        <td>${escHtml(bannedBy)}</td>
        <td>${escHtml(p.ban_reason || '—')}</td>
        <td>${escHtml(expiresAt)}</td>
        <td><button class="btn" onclick="setUserBan('${p.id}', false)">Unban</button></td>
      </tr>
    `;
  }).join('');
}

async function manualBanSubmit(event) {
  event.preventDefault();
  const userLookup = document.getElementById('manual-ban-user').value.trim();
  const reason = document.getElementById('manual-ban-reason').value.trim() || 'Manual admin ban';
  const durationRaw = document.getElementById('manual-ban-duration').value;
  const durationHours = durationRaw === 'lifetime' ? null : Number(durationRaw);
  if (!userLookup) return toast('Enter a username or user ID.', 'error');

  showLoading(true);
  const { data, error } = await sbClient.from('profiles').select('id,username').or(`id.eq.${userLookup},username.ilike.${userLookup}`).limit(1);
  if (error || !data?.length) {
    showLoading(false);
    return toast('User not found for manual ban.', 'error');
  }
  const userId = data[0].id;
  const { error: banErr } = await sbClient.from('profiles').update({
    is_banned: true,
    banned_at: new Date().toISOString(),
    banned_by: adminUser.id,
    ban_reason: reason,
    ban_expires_at: getBanExpiresAt(durationHours)
  }).eq('id', userId);
  showLoading(false);
  if (banErr) return toast(banErr.message, 'error');
  document.getElementById('manual-ban-user').value = '';
  document.getElementById('manual-ban-reason').value = '';
  document.getElementById('manual-ban-duration').value = 'lifetime';
  toast('User banned successfully.');
  await Promise.all([loadUsers(), loadBannedUsers(), loadStats()]);
}

function updateBroadcastPreview() {
  const msg = document.getElementById('broadcast-message').value.trim();
  document.getElementById('broadcast-preview').textContent = msg || 'Your message preview will appear here.';
}

async function sendBroadcast() {
  const roomId = document.getElementById('broadcast-room').value;
  const message = document.getElementById('broadcast-message').value.trim();
  if (!message) return toast('Type a message before sending.', 'error');
  if (!confirm('Send this system broadcast now?')) return;

  showLoading(true);
  let error = null;
  if (roomId === 'all') {
    if (!roomsCache.length) {
      showLoading(false);
      return toast('No rooms available for broadcast.', 'error');
    }
    const messageRows = roomsCache.map(r => ({
      room_id: r.id,
      user_id: adminUser.id,
      username: adminProfile.username || 'Admin',
      content: `[Broadcast] ${message}`,
      type: 'system'
    }));
    const insertMsg = await sbClient.from('messages').insert(messageRows);
    error = insertMsg.error;
    if (!error) {
      const bRes = await sbClient.from('broadcasts').insert({ message, sent_by: adminUser.id, room_id: null });
      error = bRes.error;
    }
  } else {
    const insertMsg = await sbClient.from('messages').insert({
      room_id: roomId,
      user_id: adminUser.id,
      username: adminProfile.username || 'Admin',
      content: `[Broadcast] ${message}`,
      type: 'system'
    });
    error = insertMsg.error;
    if (!error) {
      const bRes = await sbClient.from('broadcasts').insert({ message, sent_by: adminUser.id, room_id: roomId });
      error = bRes.error;
    }
  }
  showLoading(false);
  if (error) return toast(error.message, 'error');
  document.getElementById('broadcast-message').value = '';
  updateBroadcastPreview();
  toast('Broadcast sent successfully.');
  await Promise.all([loadBroadcastHistory(), loadStats()]);
}

async function loadBroadcastHistory() {
  const list = document.getElementById('broadcast-history');
  const { data, error } = await sbClient.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(10);
  if (error) {
    list.innerHTML = '<li>Could not load broadcast history.</li>';
    return;
  }
  const rows = data || [];
  if (!rows.length) {
    list.innerHTML = '<li>No broadcasts sent yet.</li>';
    return;
  }
  list.innerHTML = rows.map(b => {
    const sender = profilesCache.find(p => p.id === b.sent_by)?.username || 'Admin';
    const room = b.room_id ? (roomsCache.find(r => r.id === b.room_id)?.name || b.room_id) : 'All Rooms';
    return `<li><strong>${escHtml(room)}</strong> · ${escHtml(b.message || '')} <br/><small>By ${escHtml(sender)} at ${formatDate(b.created_at)}</small></li>`;
  }).join('');
}

async function loadSettings() {
  const keys = Object.keys(settingsDefaults);
  const { data, error } = await sbClient.from('app_settings').select('*').in('key', keys);
  const settingsMap = { ...settingsDefaults };
  if (!error) (data || []).forEach(s => { settingsMap[s.key] = s.value; });
  document.getElementById('set-allow-guest').checked = settingsMap.allow_guest_login === 'true';
  document.getElementById('set-maintenance').checked = settingsMap.maintenance_mode === 'true';
  document.getElementById('set-allow-register').checked = settingsMap.allow_registrations === 'true';
  document.getElementById('set-max-message').value = Number(settingsMap.max_message_length || 500);
  document.getElementById('set-welcome').value = settingsMap.welcome_message || '';
}

async function saveSettings() {
  const maxLen = Number(document.getElementById('set-max-message').value || 500);
  if (maxLen < 50 || maxLen > 2000) return toast('Max message length must be between 50 and 2000.', 'error');
  const rows = [
    { key: 'allow_guest_login', value: String(document.getElementById('set-allow-guest').checked) },
    { key: 'maintenance_mode', value: String(document.getElementById('set-maintenance').checked) },
    { key: 'allow_registrations', value: String(document.getElementById('set-allow-register').checked) },
    { key: 'max_message_length', value: String(maxLen) },
    { key: 'welcome_message', value: document.getElementById('set-welcome').value.trim() || settingsDefaults.welcome_message }
  ].map(r => ({ ...r, updated_at: new Date().toISOString() }));
  showLoading(true);
  const { error } = await sbClient.from('app_settings').upsert(rows, { onConflict: 'key' });
  showLoading(false);
  if (error) return toast(error.message, 'error');
  toast('Settings saved successfully.');
}

async function loadAnalytics() {
  await Promise.all([renderMessagesPerDay(), renderUsersPerDay(), renderTopRooms(), renderTopUsers()]);
}

function last7DayLabels() {
  const labels = [];
  for (let i = 6; i >= 0; i--) labels.push(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  return labels;
}

function renderBars(containerId, series) {
  const el = document.getElementById(containerId);
  if (!series.length) {
    el.innerHTML = '<div>No data available.</div>';
    return;
  }
  const max = Math.max(...series.map(s => s.value), 1);
  el.innerHTML = series.map(item => {
    const width = Math.max(2, Math.round((item.value / max) * 100));
    return `
      <div class="bar-row">
        <span>${item.label.slice(5)}</span>
        <div class="bar-wrap"><div class="bar" style="width:${width}%"></div></div>
        <strong>${item.value}</strong>
      </div>
    `;
  }).join('');
}

async function renderMessagesPerDay() {
  const labels = last7DayLabels();
  const { data, error } = await sbClient.from('messages').select('created_at').gte('created_at', labels[0] + 'T00:00:00.000Z');
  if (error) {
    document.getElementById('chart-messages').innerHTML = '<div>Could not load message analytics.</div>';
    return;
  }
  const byDay = Object.fromEntries(labels.map(l => [l, 0]));
  (data || []).forEach(m => {
    const key = String(m.created_at || '').slice(0, 10);
    if (byDay[key] !== undefined) byDay[key] += 1;
  });
  renderBars('chart-messages', labels.map(l => ({ label: l, value: byDay[l] })));
}

async function renderUsersPerDay() {
  const labels = last7DayLabels();
  const { data, error } = await sbClient.from('profiles').select('created_at').gte('created_at', labels[0] + 'T00:00:00.000Z');
  if (error) {
    document.getElementById('chart-users').innerHTML = '<div>Could not load user analytics.</div>';
    return;
  }
  const byDay = Object.fromEntries(labels.map(l => [l, 0]));
  (data || []).forEach(p => {
    const key = String(p.created_at || '').slice(0, 10);
    if (byDay[key] !== undefined) byDay[key] += 1;
  });
  renderBars('chart-users', labels.map(l => ({ label: l, value: byDay[l] })));
}

async function renderTopRooms() {
  const target = document.getElementById('top-rooms');
  const { data, error } = await sbClient.from('messages').select('room_id');
  if (error) {
    target.innerHTML = '<li>Could not load active rooms.</li>';
    return;
  }
  const counts = {};
  (data || []).forEach(m => { if (m.room_id) counts[m.room_id] = (counts[m.room_id] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!top.length) {
    target.innerHTML = '<li>No room activity yet.</li>';
    return;
  }
  target.innerHTML = top.map(([roomId, count]) => {
    const roomName = roomsCache.find(r => r.id === roomId)?.name || roomId;
    return `<li>${escHtml(roomName)} — <strong>${count}</strong> messages</li>`;
  }).join('');
}

async function renderTopUsers() {
  const target = document.getElementById('top-users');
  const { data, error } = await sbClient.from('messages').select('user_id,username');
  if (error) {
    target.innerHTML = '<li>Could not load active users.</li>';
    return;
  }
  const counts = {};
  const names = {};
  (data || []).forEach(m => {
    const key = m.user_id || m.username;
    if (!key) return;
    counts[key] = (counts[key] || 0) + 1;
    if (m.username) names[key] = m.username;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!top.length) {
    target.innerHTML = '<li>No user activity yet.</li>';
    return;
  }
  target.innerHTML = top.map(([userId, count]) => {
    const name = profilesCache.find(p => p.id === userId)?.username || names[userId] || userId;
    return `<li>${escHtml(name)} — <strong>${count}</strong> messages</li>`;
  }).join('');
}
