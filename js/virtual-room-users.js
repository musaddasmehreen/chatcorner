/* Online-user drawer for ChatCorner virtual rooms (IPTV, YouTube, Spotify, Ludo).
 * Hamburger button appears ONLY inside virtual rooms, never in regular chat rooms.
 */
(function initVirtualRoomUsers() {
  const CHANNEL_PREFIX = 'virtual-room-users-v1';
  const ROOT_ID = 'cc-virtual-users';
  let activeKey = '';
  let presenceChannel = null;
  let roomUsers = new Map();
  let pollTimer = null;

  const styles = `
    /* Hamburger toggle button - top-left of virtual room area */
    .cc-vru-toggle {
      position: absolute;
      z-index: 25;
      top: 10px;
      left: 10px;
      width: 36px;
      height: 36px;
      border: 1px solid rgba(139,109,237,0.45);
      border-radius: 8px;
      background: rgba(14,15,32,0.90);
      color: var(--text, #eee);
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 7px 8px;
    }
    .cc-vru-toggle:hover,
    .cc-vru-toggle[aria-expanded=true] {
      background: var(--accent, #8b6ded);
      border-color: var(--accent, #8b6ded);
    }
    /* Three-line hamburger drawn as spans */
    .cc-vru-bar {
      display: block;
      width: 16px;
      height: 2px;
      border-radius: 2px;
      background: currentColor;
    }
    /* Online count badge */
    .cc-vru-count {
      position: absolute;
      top: -6px;
      right: -6px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      border-radius: 20px;
      background: #22c55e;
      color: #07130b;
      font: bold 11px/18px sans-serif;
      text-align: center;
    }
    /* Slide-in panel */
    .cc-vru-panel {
      position: absolute;
      z-index: 24;
      inset: 0 auto 0 0;
      width: min(280px, 82vw);
      display: flex;
      flex-direction: column;
      background: rgba(19,20,40,0.98);
      border-right: 1px solid var(--border, #34304f);
      box-shadow: 8px 0 24px rgba(0,0,0,0.35);
      transform: translateX(-105%);
      transition: transform 0.18s ease;
      overflow: hidden;
    }
    .cc-vru-panel.open { transform: translateX(0); }
    .cc-vru-head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-bottom: 1px solid var(--border, #34304f);
      color: var(--text, #eee);
      font-weight: 700;
      font-size: 0.9rem;
    }
    .cc-vru-head span:first-child { flex: 1; }
    .cc-vru-head button {
      border: 0;
      background: transparent;
      color: inherit;
      font-size: 1.1rem;
      cursor: pointer;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .cc-vru-head button:hover { background: rgba(255,255,255,0.1); }
    .cc-vru-list {
      list-style: none;
      margin: 0;
      padding: 8px;
      overflow: auto;
      flex: 1;
    }
    .cc-vru-list li {
      padding: 8px 10px;
      margin: 2px 0;
      border-radius: 8px;
      color: var(--text, #eee);
      font-size: 0.87rem;
      overflow-wrap: anywhere;
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .cc-vru-list li::before {
      content: '';
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22c55e;
      flex-shrink: 0;
    }
    .cc-vru-empty {
      color: var(--muted, #aaa);
      padding: 10px;
      font-size: 0.85rem;
    }
    .cc-vru-count-label {
      font-size: 0.72rem;
      color: var(--muted, #aaa);
      font-weight: 400;
    }
    /* Ensure parent has position context */
    .chat-main { position: relative; }
    @media (max-width: 1024px) {
      .cc-vru-panel { position: fixed; top: 0; bottom: 0; left: 0; z-index: 10001; }
      .cc-vru-toggle { z-index: 10002; }
    }
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
    if (!room || !room._virtual) return null;
    const id = String(room.id || '');
    if (id === 'iptv-virtual') return { kind: 'iptv', key: 'global' };
    if (id === 'yt-virtual') return { kind: 'youtube', key: 'global' };
    if (id === 'sp-virtual') return { kind: 'spotify', key: 'global' };
    if (id === 'ludo-virtual') {
      let key = 'global';
      try {
        const iframe = document.getElementById('ludo-iframe');
        const src = iframe && iframe.getAttribute('src');
        if (src) key = escapeRoomKey(new URL(src, location.href).searchParams.get('room'));
      } catch (_) {}
      return { kind: 'ludo', key };
    }
    return null;
  }

  function getDisplayName() {
    const profileName = window.currentProfile && window.currentProfile.username;
    const user = window.currentUser;
    const userName = user && (
      (user.user_metadata && user.user_metadata.username) ||
      (user.email && user.email.split('@')[0])
    );
    return String(profileName || userName || 'Guest').trim().slice(0, 60) || 'Guest';
  }

  function buildToggleButton() {
    // Three real <span> bars - no emoji, no special chars, works everywhere
    return `<button type="button" class="cc-vru-toggle" aria-label="Show online users" aria-expanded="false" title="Online users in this room">` +
      `<span class="cc-vru-bar"></span>` +
      `<span class="cc-vru-bar"></span>` +
      `<span class="cc-vru-bar"></span>` +
      `<span class="cc-vru-count" aria-live="polite">0</span>` +
      `</button>`;
  }

  function ensureUi() {
    addStyles();
    const main = document.querySelector('.chat-main');
    if (!main) return null;
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
      root.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:24';
      root.innerHTML = buildToggleButton() +
        `<aside class="cc-vru-panel" aria-label="Users online in this room" aria-hidden="true">` +
          `<div class="cc-vru-head">` +
            `<span>Users in this room</span>` +
            `<span class="cc-vru-count-label"></span>` +
            `<button type="button" aria-label="Close">&#x2715;</button>` +
          `</div>` +
          `<ul class="cc-vru-list"><li class="cc-vru-empty">Connecting...</li></ul>` +
        `</aside>`;
      main.appendChild(root);

      const toggle = root.querySelector('.cc-vru-toggle');
      const panel = root.querySelector('.cc-vru-panel');
      const closeBtn = root.querySelector('.cc-vru-head button');

      // Allow pointer events only on the interactive children
      toggle.style.pointerEvents = 'auto';
      panel.style.pointerEvents = 'auto';

      function setOpen(open) {
        panel.classList.toggle('open', open);
        panel.setAttribute('aria-hidden', String(!open));
        toggle.setAttribute('aria-expanded', String(open));
      }
      toggle.addEventListener('click', function () { setOpen(!panel.classList.contains('open')); });
      closeBtn.addEventListener('click', function () { setOpen(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    } else if (root.parentElement !== main) {
      main.appendChild(root);
    }
    return root;
  }

  function removeUi() {
    const root = document.getElementById(ROOT_ID);
    if (root) root.remove();
  }

  function renderUsers() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const list = root.querySelector('.cc-vru-list');
    const counter = root.querySelector('.cc-vru-count');
    const label = root.querySelector('.cc-vru-count-label');
    const users = Array.from(roomUsers.values()).sort(function (a, b) {
      return a.username.localeCompare(b.username, undefined, { sensitivity: 'base' });
    });
    counter.textContent = String(users.length);
    if (label) label.textContent = users.length + ' online';
    while (list.firstChild) list.removeChild(list.firstChild);
    if (!users.length) {
      const empty = document.createElement('li');
      empty.className = 'cc-vru-empty';
      empty.textContent = 'No users online yet.';
      list.appendChild(empty);
      return;
    }
    users.forEach(function (user) {
      const li = document.createElement('li');
      const myId = window.currentUser && window.currentUser.id;
      li.textContent = user.username + (user.userId === myId ? ' (you)' : '');
      list.appendChild(li);
    });
  }

  function presenceSync() {
    if (!presenceChannel) return;
    const next = new Map();
    const state = presenceChannel.presenceState() || {};
    Object.values(state).forEach(function (entries) {
      (entries || []).forEach(function (entry) {
        if (!entry || !entry.userId) return;
        next.set(String(entry.userId), {
          userId: String(entry.userId),
          username: String(entry.username || 'Guest')
        });
      });
    });
    roomUsers = next;
    renderUsers();
  }

  async function leaveRoom() {
    if (presenceChannel) {
      try { await window.sbClient.removeChannel(presenceChannel); } catch (_) {}
      presenceChannel = null;
    }
    roomUsers.clear();
  }

  async function joinRoom(room) {
    const uid = String((window.currentUser && window.currentUser.id) || '');
    if (!uid || !window.sbClient) return;
    const key = room.kind + ':' + room.key;
    if (activeKey === key && presenceChannel) return;
    await leaveRoom();
    activeKey = key;
    roomUsers = new Map();
    renderUsers();

    const channel = window.sbClient.channel(CHANNEL_PREFIX + ':' + key, {
      config: { presence: { key: uid } }
    });
    presenceChannel = channel;
    channel
      .on('presence', { event: 'sync' }, presenceSync)
      .on('presence', { event: 'join' }, presenceSync)
      .on('presence', { event: 'leave' }, presenceSync)
      .subscribe(async function (status) {
        if (presenceChannel !== channel) return;
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({ userId: uid, username: getDisplayName() });
          } catch (e) {
            console.warn('[VRU] Could not track presence:', e);
          }
        }
      });
  }

  async function syncRoom() {
    const room = getVirtualRoom();
    if (!room) {
      // Not in a virtual room - remove UI entirely and leave channel
      removeUi();
      if (activeKey || presenceChannel) {
        activeKey = '';
        await leaveRoom();
      }
      return;
    }
    // In a virtual room - ensure UI exists
    const root = ensureUi();
    if (!root) return;
    const roomKey = room.kind + ':' + room.key;
    if (activeKey !== roomKey || !presenceChannel) await joinRoom(room);
  }

  function start() {
    if (pollTimer) return;
    syncRoom();
    pollTimer = setInterval(syncRoom, 600);
    window.addEventListener('pagehide', function () { leaveRoom(); }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
