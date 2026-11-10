/**
 * Virtual Room Online Users Drawer
 * Floats a smart, compact 50% opacity hamburger button at top-left of the chatbox,
 * and also places a hamburger button beside the media control bars.
 * Opens the online users drawer showing active users across YouTube, Spotify, IPTV, and Ludo.
 */
(function() {
  'use strict';

  const CHANNEL_PREFIX = 'vr-presence-v2';
  let activeChannel = null;
  let activeRoomKey = null;
  let roomUsersMap = new Map();
  let pollInterval = null;
  let _localGuestId = null;

  function getLudoKey() {
    try {
      const iframe = document.getElementById('ludo-iframe');
      const src = iframe && iframe.getAttribute('src');
      if (src) {
        const parsed = new URL(src, window.location.href).searchParams.get('room');
        if (parsed) return parsed.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'global';
      }
    } catch (_) {}
    return 'global';
  }

  function getActiveVirtualRoom() {
    // 1. Direct container visibility check (always reliable in DOM)
    const browser = document.getElementById('browser-container');
    if (browser && !browser.classList.contains('hidden') && browser.style.display !== 'none') {
      return { type: 'browser', key: 'global' };
    }
    const yt = document.getElementById('yt-container');
    if (yt && !yt.classList.contains('hidden') && yt.style.display !== 'none') {
      return { type: 'yt', key: 'global' };
    }
    const sp = document.getElementById('sp-container');
    if (sp && !sp.classList.contains('hidden') && sp.style.display !== 'none') {
      return { type: 'sp', key: 'global' };
    }
    const iptv = document.getElementById('iptv-container');
    if (iptv && !iptv.classList.contains('hidden') && iptv.style.display !== 'none') {
      return { type: 'iptv', key: 'global' };
    }
    const ludo = document.getElementById('ludo-container');
    if (ludo && !ludo.classList.contains('hidden') && ludo.style.display !== 'none') {
      return { type: 'ludo', key: getLudoKey() };
    }

    // 2. Fallback to currentRoom state
    const room = window.currentRoom;
    if (room && room._virtual) {
      const id = String(room.id || '');
      if (id === 'iptv-virtual') return { type: 'iptv', key: 'global' };
      if (id === 'browser-virtual') return { type: 'browser', key: 'global' };
      if (id === 'yt-virtual') return { type: 'yt', key: 'global' };
      if (id === 'sp-virtual') return { type: 'sp', key: 'global' };
      if (id === 'ludo-virtual') return { type: 'ludo', key: getLudoKey() };
    }
    return null;
  }

  function getMyDisplayName() {
    const p = window.currentProfile;
    const u = window.currentUser;
    return String((p && p.username) || (u && u.user_metadata && u.user_metadata.username) || (u && u.email && u.email.split('@')[0]) || 'Guest').trim().slice(0, 40);
  }

  function getMyUserId() {
    if (window.currentUser && window.currentUser.id) return String(window.currentUser.id);
    if (window.currentProfile && window.currentProfile.id) return String(window.currentProfile.id);
    if (!_localGuestId) {
      try {
        _localGuestId = sessionStorage.getItem('cc_vr_guest_id');
      } catch (_) {}
      if (!_localGuestId) {
        _localGuestId = 'guest_' + Math.random().toString(36).slice(2, 8);
        try { sessionStorage.setItem('cc_vr_guest_id', _localGuestId); } catch (_) {}
      }
    }
    return _localGuestId;
  }

  function updateBadgeCounts(count) {
    const text = String(count);
    const badges = document.querySelectorAll('.vr-badge, .vr-drawer-badge');
    badges.forEach(b => { b.textContent = text; });
  }

  function renderUsersList() {
    const listEl = document.getElementById('vr-drawer-users-list');
    const titleEl = document.getElementById('vr-drawer-count');
    const myId = getMyUserId();
    const users = Array.from(roomUsersMap.values()).sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: 'base' }));

    updateBadgeCounts(users.length);
    if (titleEl) titleEl.textContent = String(users.length);
    if (!listEl) return;

    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

    if (users.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'vr-user-empty';
      emptyLi.textContent = 'No users online yet';
      listEl.appendChild(emptyLi);
      return;
    }

    users.forEach(u => {
      const li = document.createElement('li');
      if (u.userId === myId) li.className = 'vr-user-self';

      const dot = document.createElement('span');
      dot.className = 'vr-user-dot';
      li.appendChild(dot);

      const name = document.createElement('span');
      name.className = 'vr-user-name';
      name.textContent = u.username;
      li.appendChild(name);

      if (u.userId === myId) {
        const you = document.createElement('span');
        you.className = 'vr-user-you';
        you.textContent = '(you)';
        li.appendChild(you);
      }

      listEl.appendChild(li);
    });
  }

  function syncPresence() {
    if (!activeChannel) return;
    const state = activeChannel.presenceState() || {};
    const nextMap = new Map();
    Object.values(state).forEach(entries => {
      (entries || []).forEach(e => {
        if (!e || !e.userId) return;
        nextMap.set(String(e.userId), {
          userId: String(e.userId),
          username: String(e.username || 'Guest')
        });
      });
    });
    roomUsersMap = nextMap;
    renderUsersList();
  }

  async function leavePresence() {
    if (activeChannel && window.sbClient) {
      try {
        await window.sbClient.removeChannel(activeChannel);
      } catch (_) {}
      activeChannel = null;
    }
    activeRoomKey = null;
    roomUsersMap.clear();
    renderUsersList();
  }

  async function joinPresence(vr) {
    if (!window.sbClient) return;
    const key = vr.type + ':' + vr.key;
    if (activeRoomKey === key && activeChannel) return;

    await leavePresence();
    activeRoomKey = key;
    roomUsersMap = new Map();

    const myId = getMyUserId();
    const myName = getMyDisplayName();

    // Immediately add self while connecting
    roomUsersMap.set(myId, { userId: myId, username: myName });
    renderUsersList();

    const chan = window.sbClient.channel(CHANNEL_PREFIX + ':' + key, {
      config: { presence: { key: myId } }
    });

    activeChannel = chan;
    chan
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .subscribe(async status => {
        if (activeChannel !== chan) return;
        if (status === 'SUBSCRIBED') {
          try {
            await chan.track({ userId: myId, username: myName });
          } catch (err) {
            console.warn('[VR-Presence] Track error:', err);
          }
        }
      });
  }

  function createUsersButton(id) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vr-users-btn';
    btn.id = id;
    btn.setAttribute('aria-label', 'Users in this room');
    btn.title = 'Users in this room';
    btn.onclick = window.toggleVirtualRoomUsers;
    btn.innerHTML =
      '<span class="vr-line"></span>' +
      '<span class="vr-line"></span>' +
      '<span class="vr-line"></span>' +
      '<span class="vr-badge">' + (roomUsersMap.size || 0) + '</span>';
    return btn;
  }

  function ensureButton() {
    const vr = getActiveVirtualRoom();
    const floatingBtn = document.getElementById('vr-users-btn');
    const barBtn = document.getElementById('vr-users-btn-bar');

    if (!vr) {
      if (floatingBtn) floatingBtn.style.display = 'none';
      if (barBtn) barBtn.style.display = 'none';
      return;
    }

    // 1. Ensure floating button over chatbox
    let btn = floatingBtn;
    if (!btn) {
      btn = createUsersButton('vr-users-btn');
    }
    btn.style.display = 'flex';

    // Target: inside .iptv-chat-wrapper (the left chatbox) or .chat-main
    const chatbox = document.querySelector('.iptv-chat-wrapper') ||
                    (vr.type === 'ludo' ? document.getElementById('ludo-container') : null) ||
                    document.querySelector('.chat-main');

    if (chatbox && btn.parentElement !== chatbox) {
      chatbox.prepend(btn);
    }

    // 2. Also ensure button in media control bar (YouTube / Spotify bar beside input)
    if (vr.type === 'browser') {
      const browserBar = document.getElementById('browser-nav-bar');
      if (browserBar) {
        let bBtn = document.getElementById('vr-users-btn-bar');
        if (!bBtn) {
          bBtn = createUsersButton('vr-users-btn-bar');
        }
        bBtn.style.display = 'flex';
        bBtn.classList.add('vr-users-btn-inline');
        if (bBtn.parentElement !== browserBar) {
          browserBar.prepend(bBtn);
        }
      }
    } else if (vr.type === 'yt') {
      const ytBar = document.getElementById('yt-admin-bar');
      if (ytBar) {
        let bBtn = document.getElementById('vr-users-btn-bar');
        if (!bBtn) {
          bBtn = createUsersButton('vr-users-btn-bar');
        }
        bBtn.style.display = 'flex';
        bBtn.classList.add('vr-users-btn-inline');
        if (bBtn.parentElement !== ytBar) {
          ytBar.prepend(bBtn);
        }
      }
    } else if (vr.type === 'sp') {
      const spBar = document.getElementById('sp-control-bar');
      if (spBar) {
        let bBtn = document.getElementById('vr-users-btn-bar');
        if (!bBtn) {
          bBtn = createUsersButton('vr-users-btn-bar');
        }
        bBtn.style.display = 'flex';
        bBtn.classList.add('vr-users-btn-inline');
        if (bBtn.parentElement !== spBar) {
          spBar.prepend(bBtn);
        }
      }
    } else {
      if (barBtn) barBtn.style.display = 'none';
    }
  }

  window.toggleVirtualRoomUsers = function(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const drawer = document.getElementById('vr-users-drawer');
    if (!drawer) return;
    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
      window.closeVirtualRoomUsers();
    } else {
      window.openVirtualRoomUsers();
    }
  };

  window.openVirtualRoomUsers = function() {
    const drawer = document.getElementById('vr-users-drawer');
    if (!drawer) return;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  };

  window.closeVirtualRoomUsers = function() {
    const drawer = document.getElementById('vr-users-drawer');
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  };

  function checkRoomState() {
    ensureButton();
    const vr = getActiveVirtualRoom();
    if (!vr) {
      if (activeRoomKey || activeChannel) {
        window.closeVirtualRoomUsers();
        leavePresence();
      }
      return;
    }
    const key = vr.type + ':' + vr.key;
    if (activeRoomKey !== key || !activeChannel) {
      joinPresence(vr);
    }
  }

  function init() {
    checkRoomState();
    if (!pollInterval) {
      pollInterval = setInterval(checkRoomState, 400);
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') window.closeVirtualRoomUsers();
    });

    document.addEventListener('click', function(e) {
      const drawer = document.getElementById('vr-users-drawer');
      if (!drawer || !drawer.classList.contains('open')) return;
      if (e.target.closest('.vr-users-btn') || e.target.closest('#vr-users-drawer')) return;
      window.closeVirtualRoomUsers();
    });

    window.addEventListener('pagehide', function() {
      leavePresence();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
