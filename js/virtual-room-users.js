/* Online-user drawer shared by ChatCorner virtual rooms (IPTV, YouTube, Spotify, Ludo). */
(function initVirtualRoomUsers() {
  const CHANNEL_PREFIX = 'virtual-room-users-v1';
  const ROOT_ID = 'cc-virtual-users';
  let activeKey = '';
  let presenceChannel = null;
  let roomUsers = new Map();
  let pollTimer = null;

  const styles = `
    .cc-vru-toggle{position:absolute;z-index:25;top:10px;left:10px;width:42px;height:42px;border:1px solid var(--border,#34304f);border-radius:10px;background:rgba(14,15,32,.92);color:var(--text,#eee);font-size:1.2rem;cursor:pointer;box-shadow:0 3px 12px #0005}
    .cc-vru-toggle:hover,.cc-vru-toggle[aria-expanded=true]{background:var(--accent,#8b6ded);color:#fff}
    .cc-vru-count{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:20px;background:#22c55e;color:#07130b;font:bold 11px/18px sans-serif;text-align:center}
    .cc-vru-panel{position:absolute;z-index:24;inset:0 auto 0 0;width:min(300px,82vw);display:flex;flex-direction:column;background:rgba(19,20,40,.98);border-right:1px solid var(--border,#34304f);box-shadow:8px 0 24px #0005;transform:translateX(-105%);transition:transform .18s ease;overflow:hidden}
    .cc-vru-panel.open{transform:translateX(0)}
    .cc-vru-head{display:flex;align-items:center;gap:8px;padding:12px;border-bottom:1px solid var(--border,#34304f);color:var(--text,#eee);font-weight:700}
    .cc-vru-head span:first-child{flex:1}
    .cc-vru-head button{border:0;background:transparent;color:inherit;font-size:1.2rem;cursor:pointer}
    .cc-vru-list{list-style:none;margin:0;padding:8px;overflow:auto;flex:1}
    .cc-vru-list li{padding:9px 10px;margin:2px 0;border-radius:8px;color:var(--text,#eee);font-size:.88rem;overflow-wrap:anywhere}
    .cc-vru-list li:before{content:'●';color:#22c55e;margin-right:8px;font-size:.72rem}
    .cc-vru-empty{color:var(--muted,#aaa);padding:10px;font-size:.85rem}
    .cc-vru-count-label{font-size:.75rem;color:var(--muted,#aaa);font-weight:500}
    .page-shell.cc-vru-active .chat-main{position:relative}
    .page-shell.ludo-active .cc-vru-panel{z-index:10001}
    @media(max-width:1024px){.cc-vru-panel{position:fixed;top:0;bottom:0;left:0;z-index:10001}.cc-vru-toggle{z-index:10002}}
  `;

  function addStyles() {
    if (document.getElementById('cc-vru-styles')) return;
    const style = document.createElement('style');
    style.id = 'cc-vru-styles';
    style.textContent = styles;
    document.head.appendChild(style);
  }

  function escapeRoomKey(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'global';
  }

  function getVirtualRoom() {
    const room = window.currentRoom;
    if (!room?._virtual) return null;
    const id = String(room.id || '');
    if (id === 'iptv-virtual') return { kind: 'iptv', key: 'global' };
    if (id === 'yt-virtual' || id === 'sp-virtual') return { kind: id === 'yt-virtual' ? 'youtube' : 'spotify', key: 'global' };
    if (id === 'ludo-virtual') {
      let key = 'global';
      try {
        const iframe = document.getElementById('ludo-iframe');
        const src = iframe?.getAttribute('src');
        if (src) key = escapeRoomKey(new URL(src, location.href).searchParams.get('room'));
      } catch (_) {}
      return { kind: 'ludo', key };
    }
    return null;
  }

  function getDisplayName(user) {
    const profileName = window.currentProfile?.username;
    const userName = window.currentUser?.user_metadata?.username || window.currentUser?.email?.split('@')[0];
    return String(profileName || userName || 'Guest').trim().slice(0, 60) || 'Guest';
  }

  function ensureUi() {
    addStyles();
    const main = document.querySelector('.chat-main');
    if (!main) return null;
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
      root.innerHTML = `
        <button type="button" class="cc-vru-toggle" aria-label="Show online users" aria-expanded="false" title="Users online">
          ☰<span class="cc-vru-count" aria-live="polite">0</span>
        </button>
        <aside class="cc-vru-panel" aria-label="Users online in this room" aria-hidden="true">
          <div class="cc-vru-head"><span>👥 Users in this room</span><span class="cc-vru-count-label"></span><button type="button" aria-label="Close online users">×</button></div>
          <ul class="cc-vru-list"><li class="cc-vru-empty">Connecting…</li></ul>
        </aside>`;
      main.appendChild(root);
      const toggle = root.querySelector('.cc-vru-toggle');
      const panel = root.querySelector('.cc-vru-panel');
      const close = root.querySelector('.cc-vru-head button');
      const setOpen = (open) => {
        panel.classList.toggle('open', open);
        panel.setAttribute('aria-hidden', String(!open));
        toggle.setAttribute('aria-expanded', String(open));
      };
      toggle.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
      close.addEventListener('click', () => setOpen(false));
      document.addEventListener('keydown', event => { if (event.key === 'Escape') setOpen(false); });
    } else if (root.parentElement !== main) {
      main.appendChild(root);
    }
    return root;
  }

  function renderUsers() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const list = root.querySelector('.cc-vru-list');
    const counter = root.querySelector('.cc-vru-count');
    const label = root.querySelector('.cc-vru-count-label');
    const users = Array.from(roomUsers.values()).sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));
    counter.textContent = String(users.length);
    label.textContent = `${users.length} online`;
    list.replaceChildren();
    if (!users.length) {
      const empty = document.createElement('li');
      empty.className = 'cc-vru-empty';
      empty.textContent = 'No users online yet.';
      list.appendChild(empty);
      return;
    }
    users.forEach(user => {
      const li = document.createElement('li');
      li.textContent = user.username + (user.userId === window.currentUser?.id ? ' (you)' : '');
      list.appendChild(li);
    });
  }

  function presenceUsers() {
    if (!presenceChannel) return;
    const next = new Map();
    const state = presenceChannel.presenceState() || {};
    Object.values(state).forEach(entries => (entries || []).forEach(entry => {
      if (!entry?.userId) return;
      next.set(String(entry.userId), { userId: String(entry.userId), username: String(entry.username || 'Guest') });
    }));
    roomUsers = next;
    renderUsers();
  }

  async function leaveRoom() {
    if (presenceChannel) {
      try { await window.sbClient.removeChannel(presenceChannel); } catch (_) {}
      presenceChannel = null;
    }
    roomUsers.clear();
    const root = document.getElementById(ROOT_ID);
    if (root) root.querySelector('.cc-vru-list').innerHTML = '<li class="cc-vru-empty">Not in a virtual room.</li>';
  }

  async function joinRoom(room) {
    const uid = String(window.currentUser?.id || '');
    if (!uid || !window.sbClient) return;
    const key = `${room.kind}:${room.key}`;
    if (activeKey === key && presenceChannel) return;
    await leaveRoom();
    activeKey = key;
    roomUsers = new Map();
    renderUsers();

    const channel = window.sbClient.channel(`${CHANNEL_PREFIX}:${key}`, {
      config: { presence: { key: uid } }
    });
    presenceChannel = channel;
    channel
      .on('presence', { event: 'sync' }, presenceUsers)
      .on('presence', { event: 'join' }, presenceUsers)
      .on('presence', { event: 'leave' }, presenceUsers)
      .subscribe(async status => {
        if (presenceChannel !== channel) return;
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({ userId: uid, username: getDisplayName(window.currentUser) });
          } catch (error) {
            console.warn('[VIRTUAL USERS] Could not publish presence:', error);
          }
        }
      });
  }

  async function syncRoom() {
    const room = getVirtualRoom();
    const shell = document.querySelector('.page-shell');
    if (!room) {
      shell?.classList.remove('cc-vru-active');
      if (activeKey || presenceChannel) {
        activeKey = '';
        await leaveRoom();
      }
      return;
    }
    const root = ensureUi();
    if (!root) return;
    shell?.classList.add('cc-vru-active');
    const roomKey = `${room.kind}:${room.key}`;
    if (activeKey !== roomKey || !presenceChannel) await joinRoom(room);
  }

  function start() {
    if (pollTimer) return;
    syncRoom();
    pollTimer = setInterval(syncRoom, 500);
    window.addEventListener('pagehide', () => { void leaveRoom(); }, { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
