/*
SQL to run in Supabase:
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_at timestamp with time zone;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_by uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ban_reason text;

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  is_audio_enabled boolean DEFAULT false,
  is_locked boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES rooms(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text,
  sent_by uuid REFERENCES profiles(id),
  room_id uuid REFERENCES rooms(id),
  created_at timestamp with time zone DEFAULT now()
);
*/

const state = {
  user: null,
  profile: null,
  rooms: [],
  users: [],
  settings: {},
  activePanel: 'overview',
  logsPage: 1,
  logsPageSize: 50,
  lastLogRows: [],
  onlinePoller: null,
  messageChannel: null
};

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.endsWith('/adminup') || path.endsWith('/adminup.html')) initAdminLogin();
  if (path.endsWith('/admin') || path.endsWith('/admin.html')) initAdminDashboard();
});

async function initAdminLogin() {
  const form = document.getElementById('admin-login-form');
  if (!form) return;

  const { data: { session } } = await sbClient.auth.getSession();
  if (session?.user) {
    const ok = await verifyAdmin(session.user.id);
    if (ok) {
      window.location.href = 'admin.html';
      return;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await loginAdmin();
  });
}

async function loginAdmin() {
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const btn = document.getElementById('admin-login-btn');
  const msg = document.getElementById('admin-login-msg');

  if (!email || !password) {
    setStatus(msg, 'Please enter your email and password.', 'error');
    return;
  }

  btn.disabled = true;
  setStatus(msg, 'Signing in…', '');

  const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
  if (error) {
    btn.disabled = false;
    setStatus(msg, error.message, 'error');
    return;
  }

  const adminOk = await verifyAdmin(data.user.id);
  if (!adminOk) {
    await sbClient.auth.signOut();
    btn.disabled = false;
    setStatus(msg, 'Access Denied. Admins only.', 'error');
    return;
  }

  setStatus(msg, 'Login successful. Redirecting…', 'success');
  window.location.href = 'admin.html';
}

async function initAdminDashboard() {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session?.user) {
    window.location.href = 'adminup.html';
    return;
  }

  state.user = session.user;

  const { data: profile } = await sbClient
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (!profile?.is_admin) {
    await sbClient.auth.signOut();
    alert('Access Denied. Admins only.');
    window.location.href = 'adminup.html';
    return;
  }

  state.profile = profile;
  document.getElementById('admin-name').textContent = profile.username || 'Admin';

  bindDashboardEvents();
  switchPanel('overview');
  await loadSharedData();
  await refreshCurrentPanel();
  startLiveOnlineCount();
}

function bindDashboardEvents() {
  const nav = document.getElementById('panel-nav');
  nav.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-panel]');
    if (!btn) return;
    switchPanel(btn.dataset.panel);
    await refreshCurrentPanel();
  });

  const logoutBtn = document.getElementById('admin-logout');
  logoutBtn.addEventListener('click', async () => {
    await sbClient.auth.signOut();
    window.location.href = 'adminup.html';
  });

  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('admin-sidebar');
  sidebarToggle?.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

  document.getElementById('modal-backdrop')?.addEventListener('click', (event) => {
    if (event.target.id === 'modal-backdrop') closeModal();
  });
}

function switchPanel(panelName) {
  state.activePanel = panelName;
  document.querySelectorAll('#panel-nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.panel === panelName);
  });
  document.querySelectorAll('.admin-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${panelName}`);
  });
}

async function refreshCurrentPanel() {
  if (state.activePanel === 'overview') return renderOverviewPanel();
  if (state.activePanel === 'rooms') return renderRoomsPanel();
  if (state.activePanel === 'logs') return renderChatLogsPanel();
  if (state.activePanel === 'users') return renderUsersPanel();
  if (state.activePanel === 'banned') return renderBannedPanel();
  if (state.activePanel === 'broadcast') return renderBroadcastPanel();
  if (state.activePanel === 'settings') return renderSettingsPanel();
  if (state.activePanel === 'analytics') return renderAnalyticsPanel();
}

async function loadSharedData() {
  await Promise.all([loadRooms(), loadUsers()]);
}

async function loadRooms() {
  const { data, error } = await sbClient
    .from('rooms')
    .select('*')
    .order('created_at', { ascending: false });
  if (!error) state.rooms = data || [];
}

async function loadUsers() {
  const { data, error } = await sbClient
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (!error) state.users = data || [];
}

async function renderOverviewPanel() {
  const panel = document.getElementById('panel-overview');
  panel.innerHTML = loadingState('Loading overview…');

  const [
    usersCount,
    registeredCount,
    guestCount,
    roomsCount,
    messagesCount,
    todayMessages,
    onlineUsers
  ] = await Promise.all([
    countRows('profiles'),
    countRows('profiles', query => query.eq('is_registered', true)),
    countRows('profiles', query => query.eq('is_registered', false)),
    countRows('rooms'),
    countRows('messages'),
    countRows('messages', query => query.gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())),
    estimateOnlineUsers()
  ]);

  panel.innerHTML = `
    <div class="panel-head"><h2>📊 Platform Overview</h2></div>
    <div class="cards-grid">
      ${statCard('👥 Total Users', usersCount)}
      ${statCard('✅ Registered', registeredCount)}
      ${statCard('👤 Guests', guestCount)}
      ${statCard('🏠 Total Rooms', roomsCount)}
      ${statCard('💬 Total Messages', messagesCount)}
      ${statCard('🕒 Messages Today', todayMessages)}
      ${statCard('🟢 Online Users (live)', onlineUsers)}
    </div>
  `;
}

async function renderRoomsPanel() {
  await loadRooms();
  const panel = document.getElementById('panel-rooms');

  if (!state.rooms.length) {
    panel.innerHTML = `
      <div class="panel-head"><h2>🏠 Room Manager</h2><button class="btn-primary" id="create-room-btn">+ Create New Room</button></div>
      <div class="empty-state">No rooms found yet.</div>`;
    document.getElementById('create-room-btn').onclick = openCreateRoomModal;
    return;
  }

  const messageCounts = await Promise.all(state.rooms.map(async (room) => ({
    roomId: room.id,
    count: await countRows('messages', query => query.eq('room_id', room.id))
  })));
  const countMap = Object.fromEntries(messageCounts.map(item => [item.roomId, item.count]));

  panel.innerHTML = `
    <div class="panel-head">
      <h2>🏠 Room Manager</h2>
      <button class="btn-primary" id="create-room-btn">+ Create New Room</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Name</th><th>Type</th><th>Created</th><th>Messages</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${state.rooms.map(room => `
            <tr>
              <td>${escapeHtml(room.name || 'Untitled')}</td>
              <td>${room.is_audio_enabled ? '<span class="badge admin">Voice</span>' : '<span class="badge guest">Text</span>'}</td>
              <td>${formatDate(room.created_at)}</td>
              <td>${countMap[room.id] || 0}</td>
              <td>
                <div class="inline-actions">
                  <button class="btn-ghost" data-room-action="edit" data-room-id="${room.id}" title="Edit room name">✏️ Edit Name</button>
                  <button class="btn-secondary" data-room-action="voice" data-room-id="${room.id}" title="Enable or disable voice">${room.is_audio_enabled ? '🔇 Disable Voice' : '🎙️ Enable Voice'}</button>
                  <button class="btn-secondary" data-room-action="lock" data-room-id="${room.id}" title="Lock or unlock room">${room.is_locked ? '🔓 Unlock' : '🔒 Lock Room'}</button>
                  <button class="btn-danger" data-room-action="delete" data-room-id="${room.id}" title="Delete room permanently">🗑️ Delete</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('create-room-btn').onclick = openCreateRoomModal;
  panel.querySelectorAll('[data-room-action]').forEach(btn => btn.addEventListener('click', handleRoomAction));
}

async function handleRoomAction(event) {
  const action = event.currentTarget.dataset.roomAction;
  const roomId = event.currentTarget.dataset.roomId;
  const room = state.rooms.find(item => item.id === roomId);
  if (!room) return;

  if (action === 'edit') {
    const nextName = window.prompt('Enter new room name:', room.name || '');
    if (!nextName || nextName.trim() === room.name) return;
    const { error } = await sbClient.from('rooms').update({ name: nextName.trim() }).eq('id', room.id);
    if (error) return showToast(error.message, 'error');
    showToast('Room name updated.', 'success');
  }

  if (action === 'voice') {
    const { error } = await sbClient.from('rooms').update({ is_audio_enabled: !room.is_audio_enabled }).eq('id', room.id);
    if (error) return showToast(error.message, 'error');
    showToast('Room voice setting updated.', 'success');
  }

  if (action === 'lock') {
    const { error } = await sbClient.from('rooms').update({ is_locked: !room.is_locked }).eq('id', room.id);
    if (error) return showToast(error.message, 'error');
    showToast(room.is_locked ? 'Room unlocked.' : 'Room locked.', 'success');
  }

  if (action === 'delete') {
    if (!window.confirm(`Delete room "${room.name}"? This cannot be undone.`)) return;
    const { error } = await sbClient.from('rooms').delete().eq('id', room.id);
    if (error) return showToast(error.message, 'error');
    showToast('Room deleted.', 'success');
  }

  await renderRoomsPanel();
  await renderOverviewPanel();
}

function openCreateRoomModal() {
  openModal(`
    <h3>Create New Room</h3>
    <div class="search-row">
      <input id="new-room-name" placeholder="Room name" />
      <input id="new-room-desc" placeholder="Description (optional)" />
    </div>
    <label><input type="checkbox" id="new-room-voice" /> Enable voice room</label>
    <div class="inline-actions" style="margin-top:.8rem;">
      <button class="btn-primary" id="save-room-btn">Create Room</button>
      <button class="btn-ghost" id="cancel-room-btn">Cancel</button>
    </div>
  `);

  document.getElementById('cancel-room-btn').onclick = closeModal;
  document.getElementById('save-room-btn').onclick = async () => {
    const name = document.getElementById('new-room-name').value.trim();
    const description = document.getElementById('new-room-desc').value.trim();
    const isAudio = document.getElementById('new-room-voice').checked;

    if (!name) return showToast('Please enter room name.', 'error');
    const { error } = await sbClient.from('rooms').insert({ name, description, is_audio_enabled: isAudio });
    if (error) return showToast(error.message, 'error');

    closeModal();
    showToast('Room created successfully.', 'success');
    await renderRoomsPanel();
    await renderOverviewPanel();
  };
}

async function renderChatLogsPanel() {
  await loadRooms();
  const panel = document.getElementById('panel-logs');
  panel.innerHTML = `
    <div class="panel-head"><h2>📜 Chat Logs (Private)</h2></div>
    <div class="search-row">
      <select id="log-room-filter">
        <option value="all">All Rooms</option>
        ${state.rooms.map(room => `<option value="${room.id}">${escapeHtml(room.name)}</option>`).join('')}
      </select>
      <input id="log-search" placeholder="Search keyword or username" />
      <button class="btn-secondary" id="log-search-btn">Search</button>
      <button class="btn-ghost" id="log-export-btn">Export CSV</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Time</th><th>Username</th><th>Message</th><th>User Type</th><th>Actions</th></tr></thead>
      <tbody id="chat-log-body"><tr><td colspan="5">Loading logs…</td></tr></tbody>
    </table></div>
    <div class="pagination">
      <button class="btn-ghost" id="logs-prev">← Prev</button>
      <span id="logs-page-label">Page ${state.logsPage}</span>
      <button class="btn-ghost" id="logs-next">Next →</button>
    </div>
  `;

  const reload = async () => {
    state.logsPage = Math.max(1, state.logsPage);
    await loadChatLogs();
  };

  document.getElementById('log-search-btn').onclick = async () => { state.logsPage = 1; await reload(); };
  document.getElementById('logs-prev').onclick = async () => { state.logsPage--; await reload(); };
  document.getElementById('logs-next').onclick = async () => { state.logsPage++; await reload(); };
  document.getElementById('log-room-filter').onchange = async () => { state.logsPage = 1; await reload(); };
  document.getElementById('log-export-btn').onclick = exportLogsCsv;

  await loadChatLogs();
}

async function loadChatLogs() {
  const roomId = document.getElementById('log-room-filter')?.value || 'all';
  const searchText = (document.getElementById('log-search')?.value || '').trim();

  let query = sbClient
    .from('messages')
    .select('id,created_at,username,content,user_id,type,room_id')
    .order('created_at', { ascending: false })
    .range((state.logsPage - 1) * state.logsPageSize, state.logsPage * state.logsPageSize - 1);

  if (roomId !== 'all') query = query.eq('room_id', roomId);
  if (searchText) query = query.or(`username.ilike.%${searchText}%,content.ilike.%${searchText}%`);

  const { data, error } = await query;
  if (error) {
    showToast(error.message, 'error');
    document.getElementById('chat-log-body').innerHTML = '<tr><td colspan="5">Unable to load logs.</td></tr>';
    return;
  }

  state.lastLogRows = data || [];
  if (!state.lastLogRows.length && state.logsPage > 1) {
    state.logsPage -= 1;
    return loadChatLogs();
  }

  document.getElementById('logs-page-label').textContent = `Page ${state.logsPage}`;
  const body = document.getElementById('chat-log-body');

  if (!state.lastLogRows.length) {
    body.innerHTML = '<tr><td colspan="5">No messages found for this filter.</td></tr>';
    return;
  }

  body.innerHTML = state.lastLogRows.map(row => {
    const user = state.users.find(item => item.id === row.user_id);
    return `
      <tr>
        <td>${formatDate(row.created_at)}</td>
        <td>${escapeHtml(row.username || 'Unknown')}</td>
        <td>${escapeHtml(row.content || '')}</td>
        <td>${user?.is_registered ? '<span class="badge registered">Registered</span>' : '<span class="badge guest">Guest</span>'}</td>
        <td>
          <div class="inline-actions">
            <button class="btn-danger" data-log-action="delete" data-id="${row.id}">Delete</button>
            <button class="btn-secondary" data-log-action="ban" data-user-id="${row.user_id}">Ban User</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  body.querySelectorAll('[data-log-action]').forEach(btn => btn.addEventListener('click', handleLogAction));
}

async function handleLogAction(event) {
  const action = event.currentTarget.dataset.logAction;
  if (action === 'delete') {
    if (!window.confirm('Delete this message?')) return;
    const id = event.currentTarget.dataset.id;
    const { error } = await sbClient.from('messages').delete().eq('id', id);
    if (error) return showToast(error.message, 'error');
    showToast('Message deleted.', 'success');
    await loadChatLogs();
    await renderOverviewPanel();
  }

  if (action === 'ban') {
    const userId = event.currentTarget.dataset.userId;
    await banUserById(userId, 'Banned from chat logs moderation panel');
  }
}

function exportLogsCsv() {
  if (!state.lastLogRows.length) return showToast('No data to export.', 'error');
  const header = ['created_at', 'username', 'content', 'user_id', 'room_id', 'type'];
  const rows = state.lastLogRows.map(item => header.map(key => csvEscape(item[key])));
  const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `chat-logs-page-${state.logsPage}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function renderUsersPanel() {
  await loadUsers();
  const panel = document.getElementById('panel-users');
  panel.innerHTML = `
    <div class="panel-head"><h2>👥 User Manager</h2></div>
    <div class="search-row">
      <input id="user-search" placeholder="Search username or email" />
      <select id="user-type-filter">
        <option value="all">All Types</option>
        <option value="registered">Registered</option>
        <option value="guest">Guest</option>
      </select>
      <select id="user-status-filter">
        <option value="all">All Statuses</option>
        <option value="active">Active</option>
        <option value="banned">Banned</option>
      </select>
      <button class="btn-secondary" id="user-filter-btn">Apply Filter</button>
    </div>
    <div class="inline-actions" style="margin-bottom:.6rem;">
      <button class="btn-danger" id="bulk-ban-btn">Bulk Ban</button>
      <button class="btn-danger" id="bulk-delete-btn">Bulk Delete</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th><input type="checkbox" id="users-select-all"/></th><th>Username</th><th>Email</th><th>Type</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody id="users-table-body"></tbody>
    </table></div>
  `;

  document.getElementById('user-filter-btn').onclick = fillUsersTable;
  document.getElementById('users-select-all').onchange = (event) => {
    document.querySelectorAll('.user-select').forEach(chk => { chk.checked = event.target.checked; });
  };
  document.getElementById('bulk-ban-btn').onclick = bulkBanUsers;
  document.getElementById('bulk-delete-btn').onclick = bulkDeleteUsers;
  fillUsersTable();
}

function filteredUsers() {
  const searchText = (document.getElementById('user-search')?.value || '').trim().toLowerCase();
  const typeFilter = document.getElementById('user-type-filter')?.value || 'all';
  const statusFilter = document.getElementById('user-status-filter')?.value || 'all';

  return state.users.filter(user => {
    const matchSearch = !searchText || (user.username || '').toLowerCase().includes(searchText) || (user.email || '').toLowerCase().includes(searchText);
    const matchType = typeFilter === 'all' || (typeFilter === 'registered' && user.is_registered) || (typeFilter === 'guest' && !user.is_registered);
    const matchStatus = statusFilter === 'all' || (statusFilter === 'banned' && user.is_banned) || (statusFilter === 'active' && !user.is_banned);
    return matchSearch && matchType && matchStatus;
  });
}

function fillUsersTable() {
  const users = filteredUsers();
  const body = document.getElementById('users-table-body');

  if (!users.length) {
    body.innerHTML = '<tr><td colspan="7">No users match your filters.</td></tr>';
    return;
  }

  body.innerHTML = users.map(user => `
    <tr>
      <td><input type="checkbox" class="user-select" data-user-id="${user.id}"/></td>
      <td>${escapeHtml(user.username || 'Unknown')}</td>
      <td>${escapeHtml(user.email || 'Not available')}</td>
      <td>${user.is_registered ? '<span class="badge registered">Registered</span>' : '<span class="badge guest">Guest</span>'} ${user.is_admin ? '<span class="badge admin">Admin</span>' : ''}</td>
      <td>${formatDate(user.created_at)}</td>
      <td>${user.is_banned ? '<span class="badge banned">Banned</span>' : '<span class="badge registered">Active</span>'}</td>
      <td>
        <div class="inline-actions">
          <button class="btn-ghost" data-user-action="view" data-user-id="${user.id}">View</button>
          <button class="btn-secondary" data-user-action="ban" data-user-id="${user.id}">${user.is_banned ? 'Unban' : 'Ban'}</button>
          <button class="btn-secondary" data-user-action="admin" data-user-id="${user.id}">${user.is_admin ? 'Demote' : 'Promote'}</button>
          <button class="btn-danger" data-user-action="delete" data-user-id="${user.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  body.querySelectorAll('[data-user-action]').forEach(btn => btn.addEventListener('click', handleUserAction));
}

async function handleUserAction(event) {
  const action = event.currentTarget.dataset.userAction;
  const userId = event.currentTarget.dataset.userId;
  const user = state.users.find(item => item.id === userId);
  if (!user) return;

  if (action === 'view') {
    alert(`Username: ${user.username || 'Unknown'}\nEmail: ${user.email || 'N/A'}\nRegistered: ${user.is_registered ? 'Yes' : 'No'}\nAdmin: ${user.is_admin ? 'Yes' : 'No'}\nStatus: ${user.is_banned ? 'Banned' : 'Active'}`);
    return;
  }

  if (action === 'ban') {
    if (user.is_banned) {
      if (!window.confirm(`Unban ${user.username || 'this user'}?`)) return;
      const { error } = await sbClient.from('profiles').update({ is_banned: false, banned_at: null, banned_by: null, ban_reason: null }).eq('id', userId);
      if (error) return showToast(error.message, 'error');
      showToast('User unbanned.', 'success');
    } else {
      await banUserById(userId, 'Banned by admin from user manager');
    }
  }

  if (action === 'admin') {
    if (!window.confirm(`${user.is_admin ? 'Demote' : 'Promote'} ${user.username || 'user'} ${user.is_admin ? 'from' : 'to'} admin?`)) return;
    const { error } = await sbClient.from('profiles').update({ is_admin: !user.is_admin }).eq('id', userId);
    if (error) return showToast(error.message, 'error');
    showToast(user.is_admin ? 'Admin role removed.' : 'User promoted to admin.', 'success');
  }

  if (action === 'delete') {
    if (!window.confirm(`Delete ${user.username || 'this user'} profile and messages?`)) return;
    const { error: msgError } = await sbClient.from('messages').delete().eq('user_id', userId);
    if (msgError) return showToast(msgError.message, 'error');
    const { error } = await sbClient.from('profiles').delete().eq('id', userId);
    if (error) return showToast(error.message, 'error');
    showToast('User profile deleted.', 'success');
  }

  await loadUsers();
  fillUsersTable();
  await renderOverviewPanel();
}

function selectedUserIds() {
  return Array.from(document.querySelectorAll('.user-select:checked')).map(el => el.dataset.userId).filter(Boolean);
}

async function bulkBanUsers() {
  const ids = selectedUserIds();
  if (!ids.length) return showToast('Select users first.', 'error');
  if (!window.confirm(`Ban ${ids.length} selected user(s)?`)) return;
  const { error } = await sbClient
    .from('profiles')
    .update({ is_banned: true, banned_at: new Date().toISOString(), banned_by: state.user.id, ban_reason: 'Bulk ban from admin panel' })
    .in('id', ids);
  if (error) return showToast(error.message, 'error');
  showToast('Selected users were banned.', 'success');
  await loadUsers();
  fillUsersTable();
}

async function bulkDeleteUsers() {
  const ids = selectedUserIds();
  if (!ids.length) return showToast('Select users first.', 'error');
  if (!window.confirm(`Delete ${ids.length} selected user(s)? This cannot be undone.`)) return;
  const { error: msgError } = await sbClient.from('messages').delete().in('user_id', ids);
  if (msgError) return showToast(msgError.message, 'error');
  const { error } = await sbClient.from('profiles').delete().in('id', ids);
  if (error) return showToast(error.message, 'error');
  showToast('Selected users deleted.', 'success');
  await loadUsers();
  fillUsersTable();
  await renderOverviewPanel();
}

async function renderBannedPanel() {
  await loadUsers();
  const panel = document.getElementById('panel-banned');
  const bannedUsers = state.users.filter(user => user.is_banned);

  panel.innerHTML = `
    <div class="panel-head"><h2>🚫 Banned Users</h2></div>
    <div class="search-row">
      <input id="manual-ban-name" placeholder="Username to ban" />
      <input id="manual-ban-reason" placeholder="Reason" />
      <button class="btn-danger" id="manual-ban-btn">Manual Ban</button>
    </div>
    ${bannedUsers.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Username</th><th>Reason</th><th>Banned At</th><th>Action</th></tr></thead>
        <tbody>
          ${bannedUsers.map(user => `
            <tr>
              <td>${escapeHtml(user.username || 'Unknown')}</td>
              <td>${escapeHtml(user.ban_reason || 'Not provided')}</td>
              <td>${formatDate(user.banned_at)}</td>
              <td><button class="btn-secondary" data-unban-id="${user.id}">Unban</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>
    ` : '<div class="empty-state">No banned users.</div>'}
  `;

  document.getElementById('manual-ban-btn').onclick = manualBanByUsername;
  panel.querySelectorAll('[data-unban-id]').forEach(btn => {
    btn.onclick = async () => {
      if (!window.confirm('Unban this user?')) return;
      const { error } = await sbClient.from('profiles').update({ is_banned: false, banned_at: null, banned_by: null, ban_reason: null }).eq('id', btn.dataset.unbanId);
      if (error) return showToast(error.message, 'error');
      showToast('User unbanned.', 'success');
      await renderBannedPanel();
      await renderUsersPanel();
      await renderOverviewPanel();
    };
  });
}

async function manualBanByUsername() {
  const username = document.getElementById('manual-ban-name').value.trim();
  const reason = document.getElementById('manual-ban-reason').value.trim() || 'Manual ban by admin';
  if (!username) return showToast('Enter username to ban.', 'error');
  if (!window.confirm(`Ban user ${username}?`)) return;

  const { data, error } = await sbClient
    .from('profiles')
    .select('id,username')
    .ilike('username', username)
    .limit(1)
    .maybeSingle();
  if (error) return showToast(error.message, 'error');
  if (!data?.id) return showToast('User not found.', 'error');

  await banUserById(data.id, reason);
  await renderBannedPanel();
  await renderUsersPanel();
}

async function banUserById(userId, reason) {
  if (!window.confirm('Ban this user?')) return;
  const { error } = await sbClient.from('profiles').update({
    is_banned: true,
    banned_at: new Date().toISOString(),
    banned_by: state.user.id,
    ban_reason: reason
  }).eq('id', userId);
  if (error) return showToast(error.message, 'error');
  showToast('User banned successfully.', 'success');
  await loadUsers();
  if (state.activePanel === 'users') fillUsersTable();
  if (state.activePanel === 'banned') await renderBannedPanel();
  await renderOverviewPanel();
}

async function renderBroadcastPanel() {
  await loadRooms();
  const panel = document.getElementById('panel-broadcast');
  panel.innerHTML = `
    <div class="panel-head"><h2>📣 Broadcast Center</h2></div>
    <div class="data-card">
      <div class="search-row">
        <select id="broadcast-room">
          <option value="all">All Rooms</option>
          ${state.rooms.map(room => `<option value="${room.id}">${escapeHtml(room.name)}</option>`).join('')}
        </select>
        <textarea id="broadcast-message" rows="2" placeholder="Type system announcement..."></textarea>
      </div>
      <div class="inline-actions">
        <button class="btn-secondary" id="preview-broadcast">Preview</button>
        <button class="btn-primary" id="send-broadcast">Send Broadcast</button>
      </div>
      <div id="broadcast-preview" class="empty-state" style="margin-top:.6rem;">Preview will appear here.</div>
    </div>
    <div class="data-card" style="margin-top:.8rem;">
      <h3 style="margin-top:0;">Broadcast History</h3>
      <div id="broadcast-history">Loading history…</div>
    </div>
  `;

  document.getElementById('preview-broadcast').onclick = () => {
    const text = document.getElementById('broadcast-message').value.trim();
    const roomId = document.getElementById('broadcast-room').value;
    const roomName = roomId === 'all' ? 'All Rooms' : (state.rooms.find(r => r.id === roomId)?.name || 'Selected room');
    document.getElementById('broadcast-preview').textContent = text ? `[${roomName}] ${text}` : 'Preview will appear here.';
  };
  document.getElementById('send-broadcast').onclick = sendBroadcast;
  await loadBroadcastHistory();
}

async function sendBroadcast() {
  const roomId = document.getElementById('broadcast-room').value;
  const message = document.getElementById('broadcast-message').value.trim();
  if (!message) return showToast('Enter a broadcast message first.', 'error');
  if (!window.confirm('Send this broadcast now?')) return;

  const targetRooms = roomId === 'all' ? state.rooms.map(room => room.id) : [roomId];
  if (!targetRooms.length) return showToast('No target rooms found.', 'error');

  const broadcastRows = targetRooms.map(targetRoomId => ({ message, sent_by: state.user.id, room_id: targetRoomId }));
  const { error: broadcastError } = await sbClient.from('broadcasts').insert(broadcastRows);
  if (broadcastError) return showToast(broadcastError.message, 'error');

  const messageRows = targetRooms.map(targetRoomId => ({
    room_id: targetRoomId,
    user_id: state.user.id,
    username: 'System',
    content: message,
    type: 'system'
  }));
  const { error: messageError } = await sbClient.from('messages').insert(messageRows);
  if (messageError) return showToast(messageError.message, 'error');

  showToast('Broadcast sent successfully.', 'success');
  document.getElementById('broadcast-message').value = '';
  document.getElementById('broadcast-preview').textContent = 'Preview will appear here.';
  await loadBroadcastHistory();
}

async function loadBroadcastHistory() {
  const { data, error } = await sbClient
    .from('broadcasts')
    .select('id,message,room_id,created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const el = document.getElementById('broadcast-history');
  if (error) {
    el.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    return;
  }
  if (!data?.length) {
    el.innerHTML = '<div class="empty-state">No broadcast history yet.</div>';
    return;
  }

  const roomMap = Object.fromEntries(state.rooms.map(room => [room.id, room.name]));
  el.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr><th>Time</th><th>Room</th><th>Message</th></tr></thead>
      <tbody>
        ${data.map(item => `
          <tr>
            <td>${formatDate(item.created_at)}</td>
            <td>${escapeHtml(roomMap[item.room_id] || 'Unknown room')}</td>
            <td>${escapeHtml(item.message || '')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table></div>
  `;
}

async function renderSettingsPanel() {
  const panel = document.getElementById('panel-settings');
  panel.innerHTML = `
    <div class="panel-head"><h2>⚙️ Settings</h2></div>
    <div class="data-card">
      <div class="search-row" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));">
        <label><input type="checkbox" id="setting-guest-login" /> Allow guest login</label>
        <label><input type="checkbox" id="setting-maintenance" /> Maintenance mode</label>
        <label><input type="checkbox" id="setting-registrations" /> Allow new registrations</label>
      </div>
      <div class="search-row">
        <input id="setting-max-length" type="number" min="10" max="2000" placeholder="Max message length" />
        <input id="setting-welcome" placeholder="Welcome message" />
      </div>
      <button class="btn-primary" id="save-settings">Save Settings</button>
      <div class="status-msg" id="settings-msg"></div>
    </div>
  `;

  await loadSettings();
  fillSettingsForm();
  document.getElementById('save-settings').onclick = saveSettings;
}

async function loadSettings() {
  const { data, error } = await sbClient.from('app_settings').select('key,value');
  if (error) return showToast(error.message, 'error');
  state.settings = Object.fromEntries((data || []).map(row => [row.key, row.value]));
}

function fillSettingsForm() {
  document.getElementById('setting-guest-login').checked = parseBool(state.settings.guest_login_enabled, true);
  document.getElementById('setting-maintenance').checked = parseBool(state.settings.maintenance_mode, false);
  document.getElementById('setting-registrations').checked = parseBool(state.settings.new_registrations_enabled, true);
  document.getElementById('setting-max-length').value = state.settings.max_message_length || '500';
  document.getElementById('setting-welcome').value = state.settings.welcome_message || 'Welcome to ChatCorner!';
}

async function saveSettings() {
  const payload = [
    { key: 'guest_login_enabled', value: String(document.getElementById('setting-guest-login').checked) },
    { key: 'maintenance_mode', value: String(document.getElementById('setting-maintenance').checked) },
    { key: 'new_registrations_enabled', value: String(document.getElementById('setting-registrations').checked) },
    { key: 'max_message_length', value: String(document.getElementById('setting-max-length').value || '500') },
    { key: 'welcome_message', value: document.getElementById('setting-welcome').value || '' }
  ];

  const { error } = await sbClient.from('app_settings').upsert(payload, { onConflict: 'key' });
  if (error) {
    document.getElementById('settings-msg').textContent = error.message;
    document.getElementById('settings-msg').className = 'status-msg error';
    return;
  }

  document.getElementById('settings-msg').textContent = 'Settings saved successfully.';
  document.getElementById('settings-msg').className = 'status-msg success';
  showToast('Settings updated.', 'success');
}

async function renderAnalyticsPanel() {
  const panel = document.getElementById('panel-analytics');
  panel.innerHTML = loadingState('Loading analytics…');

  const start = new Date();
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const [messagesRes, usersRes] = await Promise.all([
    sbClient.from('messages').select('created_at,room_id,username').gte('created_at', start.toISOString()),
    sbClient.from('profiles').select('created_at').gte('created_at', start.toISOString())
  ]);

  if (messagesRes.error || usersRes.error) {
    panel.innerHTML = `<div class="empty-state">${escapeHtml(messagesRes.error?.message || usersRes.error?.message || 'Analytics unavailable')}</div>`;
    return;
  }

  const days = lastNDays(7);
  const msgByDay = tallyByDay(messagesRes.data || [], 'created_at', days);
  const usersByDay = tallyByDay(usersRes.data || [], 'created_at', days);

  const roomCounts = {};
  const userCounts = {};
  (messagesRes.data || []).forEach(item => {
    roomCounts[item.room_id] = (roomCounts[item.room_id] || 0) + 1;
    userCounts[item.username || 'Unknown'] = (userCounts[item.username || 'Unknown'] || 0) + 1;
  });

  const roomMap = Object.fromEntries(state.rooms.map(room => [room.id, room.name]));
  const topRooms = Object.entries(roomCounts).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const topUsers = Object.entries(userCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  panel.innerHTML = `
    <div class="panel-head"><h2>📈 Analytics (Last 7 Days)</h2></div>
    <div class="cards-grid">
      <div class="data-card"><h3>Messages per Day</h3>${renderBars(msgByDay)}</div>
      <div class="data-card"><h3>New Users per Day</h3>${renderBars(usersByDay)}</div>
      <div class="data-card">
        <h3>Most Active Rooms</h3>
        ${topRooms.length ? `<ul>${topRooms.map(item => `<li>${escapeHtml(roomMap[item[0]] || 'Unknown room')} (${item[1]})</li>`).join('')}</ul>` : '<div class="empty-state">No room activity.</div>'}
      </div>
      <div class="data-card">
        <h3>Top 10 Users</h3>
        ${topUsers.length ? `<ol>${topUsers.map(item => `<li>${escapeHtml(item[0])} (${item[1]})</li>`).join('')}</ol>` : '<div class="empty-state">No user activity.</div>'}
      </div>
    </div>
  `;
}

function startLiveOnlineCount() {
  if (state.onlinePoller) clearInterval(state.onlinePoller);
  state.onlinePoller = setInterval(async () => {
    if (state.activePanel === 'overview') await renderOverviewPanel();
  }, 20000);

  state.messageChannel = sbClient
    .channel('admin:live-overview')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
      if (state.activePanel === 'overview') renderOverviewPanel();
    })
    .subscribe();
}

async function estimateOnlineUsers() {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await sbClient.from('messages').select('user_id').gte('created_at', cutoff);
  if (error || !data) return 0;
  return new Set(data.map(item => item.user_id).filter(Boolean)).size;
}

async function verifyAdmin(userId) {
  const { data, error } = await sbClient.from('profiles').select('is_admin').eq('id', userId).single();
  if (error) return false;
  return !!data?.is_admin;
}

async function countRows(table, applyFilter) {
  let query = sbClient.from(table).select('*', { count: 'exact', head: true });
  if (typeof applyFilter === 'function') query = applyFilter(query);
  const { count, error } = await query;
  if (error) return 0;
  return count || 0;
}

function statCard(label, value) {
  return `<article class="stat-card"><h3>${label}</h3><div class="stat-number">${value ?? 0}</div></article>`;
}

function loadingState(text) {
  return `<div class="empty-state"><span class="loading-spinner"></span>${text}</div>`;
}

function openModal(content) {
  document.getElementById('modal-box').innerHTML = content;
  document.getElementById('modal-backdrop').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
  document.getElementById('modal-box').innerHTML = '';
}

function showToast(message, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`.trim();
  toast.textContent = message;
  container.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3500);
}

function setStatus(el, text, type) {
  el.textContent = text;
  el.className = `status-msg ${type || ''}`.trim();
}

function parseBool(value, fallback) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[,\"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function lastNDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function tallyByDay(rows, dateField, dayKeys) {
  const counter = Object.fromEntries(dayKeys.map(day => [day, 0]));
  rows.forEach(row => {
    const key = (row[dateField] || '').slice(0, 10);
    if (counter[key] !== undefined) counter[key] += 1;
  });
  return Object.entries(counter).map(([day, count]) => ({ day, count }));
}

function renderBars(list) {
  const max = Math.max(...list.map(item => item.count), 1);
  return `<div class="bar-chart">${list.map(item => `
    <div class="bar-row">
      <span>${item.day.slice(5)}</span>
      <div class="bar" style="width:${Math.max((item.count / max) * 100, 3)}%"></div>
      <strong>${item.count}</strong>
    </div>
  `).join('')}</div>`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
