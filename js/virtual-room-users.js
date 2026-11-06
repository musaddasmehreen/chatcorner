/**
 * Virtual Room Online Users Drawer
 * Provides a hamburger toggle button and slide-in panel showing active users in
 * YouTube, Spotify, IPTV, and Ludo virtual rooms.
 */
(function() {
  'use strict';

  const CHANNEL_PREFIX = 'vr-presence-v2';
  let activeChannel = null;
  let activeRoomKey = null;
  let roomUsersMap = new Map();
  let pollInterval = null;

  function getActiveVirtualRoom() {
    const room = window.currentRoom;
    if (!room || !room._virtual) return null;
    const id = String(room.id || '');
    if (id === 'iptv-virtual') return { type: 'iptv', key: 'global' };
    if (id === 'yt-virtual') return { type: 'yt', key: 'global' };
    if (id === 'sp-virtual') return { type: 'sp', key: 'global' };
    if (id === 'ludo-virtual') {
      let key = 'global';
      try {
        const iframe = document.getElementById('ludo-iframe');
        const src = iframe && iframe.getAttribute('src');
        if (src) {
          const parsed = new URL(src, window.location.href).searchParams.get('room');
          if (parsed) key = parsed.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'global';
        }
      } catch (_) {}
      return { type: 'ludo', key: key };
    }
    return null;
  }

  function getMyDisplayName() {
    const p = window.currentProfile;
    const u = window.currentUser;
    return String((p && p.username) || (u && u.user_metadata && u.user_metadata.username) || (u && u.email && u.email.split('@')[0]) || 'Guest').trim().slice(0, 40);
  }

  function getMyUserId() {
    return String((window.currentUser && window.currentUser.id) || (window.currentProfile && window.currentProfile.id) || 'guest_' + Math.random().toString(36).slice(2, 8));
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

  window.toggleVirtualRoomUsers = function() {
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
      pollInterval = setInterval(checkRoomState, 600);
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
