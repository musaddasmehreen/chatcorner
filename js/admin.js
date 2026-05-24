let adminUser = null;
let adminProfile = null;
let roomsCache = [];
let profilesCache = [];
let messageCache = [];
let logsPage = 1;
let logsPages = 1;
let loadingCount = 0;

const settingsDefaults = {
  allow_guest: 'true',
  maintenance: 'false',
  allow_register: 'true',
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

  document.querySelectorAll('.nav-btn').forEach((btn) => {
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
    loadMessages();
  });
  document.getElementById('logs-room-select').addEventListener('change', () => {
    logsPage = 1;
    loadMessages();
  });
  document.getElementById('export-csv-btn').addEventListener('click', exportLogsCsv);

  document.getElementById('users-apply').addEventListener('click', loadUsers);
  document.getElementById('users-select-all').addEventListener('change', toggleSelectAllUsers);
  document.getElementById('bulk-run').addEventListener('click', runBulkAction);

  document.getElementById('manual-ban-form').addEventListener('submit', manualBanSubmit);

  document.getElementById('broadcast-message').addEventListener('input', updateBroadcastPreview);
  document.getElementById('send-broadcast').addEventListener('click', sendBroadcast);

  document.getElementById('save-settings').addEventListener('click', saveSettings);
}

async function checkAdminAuth() {
  showLoading(true);
  const res = await apiFetch('/api/auth/session', { method: 'GET' });
  if (!res.ok) {
    clearToken();
    window.location.href = 'adminup.html';
    return;
  }

  const payload = await res.json();
  if (!payload?.user?.is_admin) {
    clearToken();
    window.location.href = 'adminup.html?denied=1';
    return;
  }

  adminUser = payload.user;
  adminProfile = payload.profile;
  document.getElementById('admin-name').textContent = adminProfile?.username || adminUser.email || 'Admin';
  showLoading(false);
}

async function initDashboard() {
  await Promise.all([
    loadRooms(),
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
  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));

  document.getElementById('panel-' + panelName)?.classList.add('active');
  document.querySelector(`.nav-btn[data-panel="${panelName}"]`)?.classList.add('active');
}

async function adminLogout() {
  await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => null);
  clearToken();
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

function escHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadStats() {
  const statsGrid = document.getElementById('stats-grid');
  showLoading(true);
  try {
    const res = await apiFetch('/api/admin/stats');
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to load stats');

    const cards = [
      { label: 'Total Users', icon: '👥', value: data.totalUsers || 0 },
      { label: 'Registered Users', icon: '✅', value: data.registeredUsers || 0 },
      { label: 'Total Rooms', icon: '💬', value: data.totalRooms || 0 },
      { label: 'Total Messages', icon: '📨', value: data.totalMessages || 0 },
      { label: 'Banned Users', icon: '🚫', value: data.bannedUsers || 0 }
    ];

    statsGrid.innerHTML = cards.map((c) => `
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

async function loadRooms() {
  showLoading(true);
  const res = await apiFetch('/api/admin/rooms');
  const payload = await res.json().catch(() => ({ data: [] }));
  showLoading(false);

  if (!res.ok) {
    roomsCache = [];
    document.getElementById('rooms-body').innerHTML = '<tr><td colspan="6">No rooms found or table not ready.</td></tr>';
    fillRoomSelects([]);
    return;
  }

  roomsCache = payload.data || [];
  fillRoomSelects(roomsCache);
  renderRoomsTable();
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

  rooms.forEach((r) => {
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

function renderRoomsTable() {
  const body = document.getElementById('rooms-body');
  if (!roomsCache.length) {
    body.innerHTML = '<tr><td colspan="6">No rooms available yet. Create your first room.</td></tr>';
    return;
  }

  body.innerHTML = roomsCache.map((room) => `
    <tr>
      <td>${escHtml(room.name)}</td>
      <td>${room.is_audio_enabled ? 'voice' : 'text'}</td>
      <td>${formatDate(room.created_at)}</td>
      <td>${room.message_count || 0}</td>
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
  const room = roomsCache.find((r) => r.id === roomId);
  if (!room) return;
  const nextName = prompt(`Rename room "${room.name}" to:`, room.name);
  if (!nextName || nextName.trim() === room.name) return;
  showLoading(true);
  const res = await apiFetch(`/api/admin/rooms/${roomId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: nextName.trim() })
  });
  showLoading(false);
  if (!res.ok) return toast('Failed to update room name.', 'error');
  toast('Room name updated.');
  await loadRooms();
}

async function toggleRoomVoice(roomId) {
  const room = roomsCache.find((r) => r.id === roomId);
  if (!room) return;
  showLoading(true);
  const res = await apiFetch(`/api/admin/rooms/${roomId}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_audio_enabled: !room.is_audio_enabled })
  });
  showLoading(false);
  if (!res.ok) return toast('Failed to update room.', 'error');
  toast('Room voice setting changed.');
  await loadRooms();
}

async function toggleRoomLock(roomId) {
  const room = roomsCache.find((r) => r.id === roomId);
  if (!room) return;
  const actionText = room.is_locked ? 'unlock' : 'lock';
  if (!confirm(`Are you sure you want to ${actionText} "${room.name}"? Locked rooms cannot send messages.`)) return;

  showLoading(true);
  const res = await apiFetch(`/api/admin/rooms/${roomId}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_locked: !room.is_locked })
  });
  showLoading(false);
  if (!res.ok) return toast('Failed to update room lock.', 'error');

  toast(`Room ${actionText}ed successfully.`);
  await loadRooms();
}

async function deleteRoom(roomId) {
  const room = roomsCache.find((r) => r.id === roomId);
  if (!room) return;
  if (!confirm(`WARNING: Delete room "${room.name}" and all related messages? This action cannot be undone.`)) return;
  showLoading(true);
  const res = await apiFetch(`/api/admin/rooms/${roomId}`, { method: 'DELETE' });
  showLoading(false);
  if (!res.ok) return toast('Failed to delete room.', 'error');
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
  const res = await apiFetch('/api/admin/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description: description || null,
      is_audio_enabled: type === 'voice',
      is_locked: false
    })
  });
  showLoading(false);
  if (!res.ok) return toast('Failed to create room.', 'error');

  closeRoomModal();
  toast('Room created successfully.');
  await loadRooms();
}

async function loadMessages() {
  const roomId = document.getElementById('logs-room-select').value;
  const search = document.getElementById('logs-search').value.trim();
  const body = document.getElementById('logs-body');

  showLoading(true);
  const res = await apiFetch(`/api/admin/messages?roomId=${encodeURIComponent(roomId || '')}&search=${encodeURIComponent(search)}&page=${logsPage}&limit=50`);
  const payload = await res.json().catch(() => ({ data: [], total: 0, pages: 1 }));
  showLoading(false);

  if (!res.ok) {
    messageCache = [];
    body.innerHTML = '<tr><td colspan="5">Could not load room messages.</td></tr>';
    return;
  }

  messageCache = payload.data || [];
  logsPages = payload.pages || 1;
  renderLogsTable(payload.total || 0);
}

function renderLogsTable(total = 0) {
  const body = document.getElementById('logs-body');
  const pagination = document.getElementById('logs-pagination');

  if (!messageCache.length) {
    body.innerHTML = '<tr><td colspan="5">No messages found for this room/filter.</td></tr>';
    pagination.innerHTML = '';
    return;
  }

  body.innerHTML = messageCache.map((m) => {
    const profile = profilesCache.find((p) => p.id === m.user_id);
    const type = profile?.is_guest ? 'guest' : 'registered ✓';
    return `
      <tr>
        <td>${formatDate(m.created_at)}</td>
        <td>${escHtml(m.username || 'Unknown')}</td>
        <td><span class="badge ${profile?.is_guest ? 'guest' : 'registered'}">${escHtml(type)}</span></td>
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
  prev.disabled = logsPage <= 1;
  prev.onclick = () => { logsPage -= 1; loadMessages(); };

  const next = document.createElement('button');
  next.className = 'btn';
  next.textContent = 'Next';
  next.disabled = logsPage >= logsPages;
  next.onclick = () => { logsPage += 1; loadMessages(); };

  const info = document.createElement('span');
  info.textContent = `Page ${logsPage} / ${logsPages} (${total} messages)`;
  pagination.append(prev, info, next);
}

async function deleteMessage(messageId) {
  if (!confirm('Delete this message permanently? This cannot be undone.')) return;
  showLoading(true);
  const res = await apiFetch(`/api/admin/messages/${messageId}`, { method: 'DELETE' });
  showLoading(false);
  if (!res.ok) return toast('Failed to delete message.', 'error');
  toast('Message deleted successfully.');
  await Promise.all([loadMessages(), loadStats(), loadAnalytics()]);
}

async function banFromMessage(userId, username) {
  if (!userId) return;
  const reason = prompt(`Ban user ${username}? Add reason (optional):`, 'Violation');
  if (reason === null) return;
  await setUserBan(userId, true, reason);
}

function exportLogsCsv() {
  if (!messageCache.length) return toast('No messages to export.', 'error');

  const lines = [['timestamp', 'username', 'message'].join(',')];
  messageCache.forEach((m) => {
    const values = [m.created_at || '', m.username || '', m.content || ''].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(values.join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'chat-log.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function loadUsers() {
  const term = document.getElementById('users-search').value.trim();
  const filter = document.getElementById('users-filter').value;
  const res = await apiFetch(`/api/admin/users?search=${encodeURIComponent(term)}&filter=${encodeURIComponent(filter)}`);
  const payload = await res.json().catch(() => ({ data: [] }));
  profilesCache = res.ok ? (payload.data || []) : [];
  renderUsersTable();
}

function renderUsersTable() {
  const body = document.getElementById('users-body');
  if (!profilesCache.length) {
    body.innerHTML = '<tr><td colspan="8">No users match your current filter.</td></tr>';
    return;
  }

  body.innerHTML = profilesCache.map((p) => {
    const typeBadge = p.is_admin
      ? '<span class="badge admin">admin</span>'
      : `<span class="badge ${p.is_guest ? 'guest' : 'registered'}">${p.is_guest ? 'guest' : 'registered'}</span>`;
    const statusBadge = p.is_banned
      ? '<span class="badge banned"><span class="status-dot red"></span>banned</span>'
      : '<span class="badge registered"><span class="status-dot green"></span>active</span>';
    return `
      <tr>
        <td><input type="checkbox" class="user-select" value="${p.id}" /></td>
        <td>${escHtml(p.username || 'Unknown')}</td>
        <td>${escHtml(p.email || '—')}</td>
        <td>${typeBadge}</td>
        <td>${formatDate(p.created_at)}</td>
        <td>${formatDate(p.last_active || p.created_at)}</td>
        <td>${statusBadge}</td>
        <td class="inline-row">
          <button class="btn" title="View full profile details" onclick="viewProfile('${p.id}')">👁️ View</button>
          <button class="btn" title="Ban or unban this user" onclick="toggleBan('${p.id}')">🚫 ${p.is_banned ? 'Unban' : 'Ban'}</button>
          <button class="btn danger" title="Delete this user profile" onclick="deleteUser('${p.id}')">🗑️ Delete</button>
          <button class="btn" title="Toggle admin role for this user" onclick="toggleAdmin('${p.id}')">👑 ${p.is_admin ? 'Demote' : 'Promote'}</button>
        </td>
      </tr>
    `;
  }).join('');

  updateBulkCount();
  document.querySelectorAll('.user-select').forEach((cb) => cb.addEventListener('change', updateBulkCount));
}

function viewProfile(userId) {
  const p = profilesCache.find((x) => x.id === userId);
  if (!p) return;
  alert(`Profile Details\n\nUsername: ${p.username || '—'}\nEmail: ${p.email || '—'}\nGuest: ${p.is_guest ? 'Yes' : 'No'}\nAdmin: ${p.is_admin ? 'Yes' : 'No'}\nBanned: ${p.is_banned ? 'Yes' : 'No'}\nJoined: ${formatDate(p.created_at)}\nLast Active: ${formatDate(p.last_active || p.created_at)}\nReason: ${p.ban_reason || '—'}`);
}

async function setUserBan(userId, banned, reason = '') {
  const warning = banned ? 'This user will be blocked from access. Continue?' : 'Unban this user and restore access?';
  if (!confirm(warning)) return;
  showLoading(true);
  const res = await apiFetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_banned: banned, reason })
  });
  showLoading(false);
  if (!res.ok) return toast('Failed to update user ban.', 'error');
  toast(`User ${banned ? 'banned' : 'unbanned'} successfully.`);
  await Promise.all([loadUsers(), loadBannedUsers(), loadStats()]);
}

async function toggleBan(userId) {
  const p = profilesCache.find((x) => x.id === userId);
  if (!p) return;
  const reason = p.is_banned ? '' : (prompt('Reason for ban (optional):', 'Policy violation') || '');
  await setUserBan(userId, !p.is_banned, reason);
}

async function deleteUser(userId) {
  if (!confirm('WARNING: Delete this user profile? This action cannot be undone.')) return;
  showLoading(true);
  const res = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
  showLoading(false);
  if (!res.ok) return toast('Failed to delete user.', 'error');
  toast('User profile deleted.');
  await Promise.all([loadUsers(), loadBannedUsers(), loadStats()]);
}

async function toggleAdmin(userId) {
  const p = profilesCache.find((x) => x.id === userId);
  if (!p) return;
  const action = p.is_admin ? 'demote' : 'promote';
  if (!confirm(`Are you sure you want to ${action} this user ${action === 'promote' ? 'to admin' : 'from admin'}?`)) return;
  showLoading(true);
  const res = await apiFetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_admin: !p.is_admin })
  });
  showLoading(false);
  if (!res.ok) return toast('Failed to update admin role.', 'error');
  toast(`User ${action}d successfully.`);
  await loadUsers();
}

function getSelectedUserIds() {
  return Array.from(document.querySelectorAll('.user-select:checked')).map((cb) => cb.value);
}

function updateBulkCount() {
  document.getElementById('bulk-count').textContent = `${getSelectedUserIds().length} selected`;
}

function toggleSelectAllUsers(event) {
  document.querySelectorAll('.user-select').forEach((cb) => { cb.checked = event.target.checked; });
  updateBulkCount();
}

async function runBulkAction() {
  const action = document.getElementById('bulk-action').value;
  const ids = getSelectedUserIds();
  if (!action) return toast('Choose a bulk action first.', 'error');
  if (!ids.length) return toast('Select at least one user.', 'error');

  if (action === 'ban') {
    if (!confirm(`Ban ${ids.length} selected users?`)) return;
    await Promise.all(ids.map((id) => apiFetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_banned: true, reason: 'Bulk ban by admin' })
    })));
    toast(`Banned ${ids.length} users.`);
  }

  if (action === 'delete') {
    if (!confirm(`WARNING: Delete ${ids.length} selected user profiles permanently?`)) return;
    await Promise.all(ids.map((id) => apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' })));
    toast(`Deleted ${ids.length} user profiles.`);
  }

  document.getElementById('users-select-all').checked = false;
  await Promise.all([loadUsers(), loadBannedUsers(), loadStats()]);
}

async function loadBannedUsers() {
  const body = document.getElementById('banned-body');
  const res = await apiFetch('/api/admin/banned');
  const payload = await res.json().catch(() => ({ data: [] }));
  const rows = payload.data || [];
  if (!res.ok) {
    body.innerHTML = '<tr><td colspan="5">Could not load banned users.</td></tr>';
    return;
  }
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5">No banned users right now.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((p) => `
    <tr>
      <td>${escHtml(p.username || p.user_id)}</td>
      <td>${formatDate(p.created_at)}</td>
      <td>${escHtml(p.banned_by || '—')}</td>
      <td>${escHtml(p.reason || '—')}</td>
      <td><button class="btn" onclick="setUserBan('${p.user_id}', false)">Unban</button></td>
    </tr>
  `).join('');
}

async function manualBanSubmit(event) {
  event.preventDefault();
  const userLookup = document.getElementById('manual-ban-user').value.trim();
  const reason = document.getElementById('manual-ban-reason').value.trim() || 'Manual admin ban';
  if (!userLookup) return toast('Enter a username or user ID.', 'error');

  const match = profilesCache.find((p) => p.id === userLookup || p.username?.toLowerCase() === userLookup.toLowerCase());
  if (!match) return toast('User not found for manual ban.', 'error');

  showLoading(true);
  const res = await apiFetch('/api/admin/banned', {
    method: 'POST',
    body: JSON.stringify({ user_id: match.id, reason })
  });
  showLoading(false);

  if (!res.ok) return toast('Failed to ban user.', 'error');
  document.getElementById('manual-ban-user').value = '';
  document.getElementById('manual-ban-reason').value = '';
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
  const res = await apiFetch('/api/admin/broadcast', {
    method: 'POST',
    body: JSON.stringify({ roomId, message })
  });
  showLoading(false);

  if (!res.ok) return toast('Failed to send broadcast.', 'error');
  document.getElementById('broadcast-message').value = '';
  updateBroadcastPreview();
  toast('Broadcast sent successfully.');
  await Promise.all([loadBroadcastHistory(), loadStats()]);
}

async function loadBroadcastHistory() {
  const list = document.getElementById('broadcast-history');
  const res = await apiFetch('/api/admin/messages?search=%5BBroadcast%5D&page=1&limit=10');
  const payload = await res.json().catch(() => ({ data: [] }));
  if (!res.ok) {
    list.innerHTML = '<li>Could not load broadcast history.</li>';
    return;
  }

  const rows = payload.data || [];
  if (!rows.length) {
    list.innerHTML = '<li>No broadcasts sent yet.</li>';
    return;
  }

  list.innerHTML = rows.map((b) => {
    const room = roomsCache.find((r) => r.id === b.room_id)?.name || b.room_id || 'All Rooms';
    return `<li><strong>${escHtml(room)}</strong> · ${escHtml(b.content || '')} <br/><small>By ${escHtml(b.username || 'Admin')} at ${formatDate(b.created_at)}</small></li>`;
  }).join('');
}

async function loadSettings() {
  const res = await apiFetch('/api/admin/settings');
  const payload = await res.json().catch(() => ({ data: {} }));
  const settingsMap = { ...settingsDefaults, ...(payload.data || {}) };

  document.getElementById('set-allow-guest').checked = settingsMap.allow_guest === 'true';
  document.getElementById('set-maintenance').checked = settingsMap.maintenance === 'true';
  document.getElementById('set-allow-register').checked = settingsMap.allow_register === 'true';
  document.getElementById('set-max-message').value = Number(settingsMap.max_message_length || 500);
  document.getElementById('set-welcome').value = settingsMap.welcome_message || '';
}

async function saveSettings() {
  const maxLen = Number(document.getElementById('set-max-message').value || 500);
  if (maxLen < 50 || maxLen > 2000) return toast('Max message length must be between 50 and 2000.', 'error');

  const body = {
    allow_guest: String(document.getElementById('set-allow-guest').checked),
    maintenance: String(document.getElementById('set-maintenance').checked),
    allow_register: String(document.getElementById('set-allow-register').checked),
    max_message_length: String(maxLen),
    welcome_message: document.getElementById('set-welcome').value.trim() || settingsDefaults.welcome_message
  };

  showLoading(true);
  const res = await apiFetch('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(body)
  });
  showLoading(false);

  if (!res.ok) return toast('Failed to save settings.', 'error');
  toast('Settings saved successfully.');
}

async function loadAnalytics() {
  const res = await apiFetch('/api/admin/analytics');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    document.getElementById('chart-messages').innerHTML = '<div>Could not load message analytics.</div>';
    document.getElementById('chart-users').innerHTML = '<div>Could not load user analytics.</div>';
    document.getElementById('top-rooms').innerHTML = '<li>Could not load active rooms.</li>';
    document.getElementById('top-users').innerHTML = '<li>Could not load active users.</li>';
    return;
  }

  renderBars('chart-messages', normalizeLast7(data.messagesPerDay || []));
  renderBars('chart-users', normalizeLast7(data.usersPerDay || []));

  const topRooms = data.topRooms || [];
  document.getElementById('top-rooms').innerHTML = topRooms.length
    ? topRooms.map((r) => {
      const roomName = roomsCache.find((x) => x.id === r.room_id)?.name || r.room_id;
      return `<li>${escHtml(roomName)} — <strong>${Number(r.count || 0)}</strong> messages</li>`;
    }).join('')
    : '<li>No room activity yet.</li>';

  const topUsers = data.topUsers || [];
  document.getElementById('top-users').innerHTML = topUsers.length
    ? topUsers.map((u) => `<li>${escHtml(u.username || 'Unknown')} — <strong>${Number(u.count || 0)}</strong> messages</li>`).join('')
    : '<li>No user activity yet.</li>';
}

function normalizeLast7(rows) {
  const map = {};
  rows.forEach((r) => { map[r.day] = Number(r.count || 0); });
  const labels = [];
  for (let i = 6; i >= 0; i--) {
    labels.push(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }
  return labels.map((day) => ({ label: day, value: map[day] || 0 }));
}

function renderBars(containerId, series) {
  const el = document.getElementById(containerId);
  if (!series.length) {
    el.innerHTML = '<div>No data available.</div>';
    return;
  }
  const max = Math.max(...series.map((s) => s.value), 1);
  el.innerHTML = series.map((item) => {
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
