/**
 * ChatCorner - Collaborative Virtual Room: Browser
 * Features:
 * - Dynamic 4-digit PIN passcode lock (Admin-only generate, view, regenerate, toggle)
 * - Instant 1-click admin bypass; non-admin pin verification with error feedback
 * - Synchronized Browsing & Navigation (URL, Back, Forward, Reload, Home)
 * - Real-time Viewport & Scroll synchronization
 * - Real-time Glowing Cursor / Pointer synchronization
 * - Live WebRTC Screen / Tab Streaming (Watch Party mode for OTT & media platforms)
 * - Granular Permission Hierarchy & "Pass the Wheel" delegation with Admin absolute override
 */

(function() {
  'use strict';

  // Constants & State
  const DEFAULT_PIN = '1234';
  const DEFAULT_URL = 'https://en.wikipedia.org/wiki/Main_Page';
  const CHANNEL_NAME = 'browser-collab-room';

  let _active = false;
  let _channel = null;
  let _roomPin = DEFAULT_PIN;
  let _isLocked = true;
  let _currentUrl = DEFAULT_URL;
  let _controllerId = null;
  let _controllerName = 'Host';
  let _historyStack = [DEFAULT_URL];
  let _historyIndex = 0;

  // Screen sharing state
  let _screenStream = null;
  let _isScreenSharing = false;
  let _screenPeers = {}; // viewerId -> RTCPeerConnection

  // Realtime throttle timers
  let _lastScrollBroadcast = 0;
  let _lastCursorBroadcast = 0;
  let _isHandlingRemoteScroll = false;

  function getMyUserId() {
    return String(
      (window.currentUser && window.currentUser.id) ||
      (window.currentProfile && window.currentProfile.id) ||
      sessionStorage.getItem('cc_voice_uid') ||
      'guest_' + Math.random().toString(36).slice(2, 8)
    );
  }

  function getMyDisplayName() {
    const p = window.currentProfile;
    const u = window.currentUser;
    return String(
      (p && p.username) ||
      (u && u.user_metadata && u.user_metadata.username) ||
      (u && u.email && u.email.split('@')[0]) ||
      'Guest'
    ).trim().slice(0, 40);
  }

  function isAdmin() {
    if (typeof window.getViewerRoleLevel === 'function') {
      return window.getViewerRoleLevel() >= 4;
    }
    const p = window.currentProfile;
    return !!(p && (p.is_admin || p.is_owner));
  }

  function isController() {
    if (isAdmin()) return true; // Admins always have executive control rights
    return _controllerId === getMyUserId();
  }

  /* ══ PIN & Access Control ═════════════════════════════════════════ */

  async function loadPinConfig() {
    try {
      if (!window.sbClient) return;
      const { data, error } = await window.sbClient
        .from('app_settings')
        .select('key,value')
        .in('key', ['virtual_browser_pin', 'virtual_browser_locked']);

      if (!error && data) {
        data.forEach(row => {
          if (row.key === 'virtual_browser_pin' && row.value) {
            _roomPin = String(row.value).trim().slice(0, 4);
          }
          if (row.key === 'virtual_browser_locked') {
            _isLocked = row.value === 'true';
          }
        });
      }
    } catch (e) {
      console.warn('[BrowserRoom] Failed to load PIN config, using defaults:', e);
    }
    updateAdminPinDisplay();
  }

  function updateAdminPinDisplay() {
    const textEl = document.getElementById('browser-admin-pin-text');
    const btnEl = document.getElementById('browser-btn-pin-mgr');
    const mgrValueEl = document.getElementById('browser-mgr-pin-value');
    const mgrToggle = document.getElementById('browser-mgr-lock-toggle');

    if (textEl) {
      textEl.textContent = _isLocked ? `PIN: ${_roomPin}` : 'Unlocked';
    }
    if (btnEl) {
      btnEl.classList.toggle('hidden', !isAdmin());
    }
    if (mgrValueEl) {
      mgrValueEl.textContent = _roomPin;
    }
    if (mgrToggle) {
      mgrToggle.checked = _isLocked;
    }
  }

  function openPinModal() {
    const modal = document.getElementById('browser-pin-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('visible');

    // Reset pin inputs & error
    const errorEl = document.getElementById('browser-pin-error');
    if (errorEl) errorEl.classList.add('hidden');

    for (let i = 1; i <= 4; i++) {
      const input = document.getElementById('browser-pin-d' + i);
      if (input) input.value = '';
    }
    const firstInput = document.getElementById('browser-pin-d1');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }

  function closePinModal() {
    const modal = document.getElementById('browser-pin-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('visible');
    }
  }

  function setupPinInputHandlers() {
    const inputs = [
      document.getElementById('browser-pin-d1'),
      document.getElementById('browser-pin-d2'),
      document.getElementById('browser-pin-d3'),
      document.getElementById('browser-pin-d4')
    ].filter(Boolean);

    inputs.forEach((input, idx) => {
      input.oninput = (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = val ? val[0] : '';
        if (val && idx < 3) {
          inputs[idx + 1].focus();
        }
        if (inputs.every(inp => inp.value.length === 1)) {
          submitPin();
        }
      };

      input.onkeydown = (e) => {
        if (e.key === 'Backspace' && !input.value && idx > 0) {
          inputs[idx - 1].focus();
        } else if (e.key === 'Enter') {
          submitPin();
        }
      };

      input.onpaste = (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
        if (pasted.length >= 4) {
          inputs.forEach((inp, i) => { inp.value = pasted[i] || ''; });
          submitPin();
        }
      };
    });
  }

  function submitPin() {
    const entered = [
      document.getElementById('browser-pin-d1')?.value || '',
      document.getElementById('browser-pin-d2')?.value || '',
      document.getElementById('browser-pin-d3')?.value || '',
      document.getElementById('browser-pin-d4')?.value || ''
    ].join('');

    const errorEl = document.getElementById('browser-pin-error');
    const container = document.getElementById('browser-pin-inputs');

    if (entered === _roomPin) {
      if (errorEl) errorEl.classList.add('hidden');
      try {
        sessionStorage.setItem('cc_browser_unlocked_' + _roomPin, 'true');
      } catch (_) {}
      closePinModal();
      enterRoomInternal();
    } else {
      if (errorEl) {
        errorEl.textContent = '❌ Incorrect PIN. Please try again.';
        errorEl.classList.remove('hidden');
      }
      if (container) {
        container.classList.add('pin-shake');
        setTimeout(() => container.classList.remove('pin-shake'), 600);
      }
      for (let i = 1; i <= 4; i++) {
        const input = document.getElementById('browser-pin-d' + i);
        if (input) input.value = '';
      }
      document.getElementById('browser-pin-d1')?.focus();
    }
  }

  function openPinManagerModal() {
    if (!isAdmin()) return;
    const modal = document.getElementById('browser-pin-mgr-modal');
    if (!modal) return;
    updateAdminPinDisplay();
    modal.classList.remove('hidden');
    modal.classList.add('visible');
  }

  function closePinManagerModal() {
    const modal = document.getElementById('browser-pin-mgr-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('visible');
    }
  }

  async function regeneratePin() {
    if (!isAdmin()) return;
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    _roomPin = newPin;
    updateAdminPinDisplay();

    // Persist to Supabase app_settings
    if (window.sbClient) {
      try {
        await window.sbClient.from('app_settings').upsert({
          key: 'virtual_browser_pin',
          value: newPin,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      } catch (e) {
        console.warn('[BrowserRoom] Error persisting regenerated PIN:', e);
      }
    }

    // Broadcast pin update to room participants
    broadcastEvent('pin-update', { pin: newPin, locked: _isLocked });

    if (typeof window.showChatToast === 'function') {
      window.showChatToast(`🎲 New Browser Room PIN generated: ${newPin}`, 'info', 4000);
    }
  }

  async function togglePinLock(locked) {
    if (!isAdmin()) return;
    _isLocked = !!locked;
    updateAdminPinDisplay();

    if (window.sbClient) {
      try {
        await window.sbClient.from('app_settings').upsert({
          key: 'virtual_browser_locked',
          value: String(_isLocked),
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      } catch (e) {
        console.warn('[BrowserRoom] Error persisting lock toggle:', e);
      }
    }

    broadcastEvent('pin-update', { pin: _roomPin, locked: _isLocked });

    if (typeof window.showChatToast === 'function') {
      window.showChatToast(_isLocked ? '🔒 Browser Room is now PIN-locked.' : '🔓 Browser Room unlocked for all users.', 'info');
    }
  }

  function copyPin() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(_roomPin);
      if (typeof window.showChatToast === 'function') {
        window.showChatToast(`📋 PIN ${_roomPin} copied to clipboard!`, 'info');
      }
    }
  }

  /* ══ Room Entry & Lifecycle ═════════════════════════════════════════ */

  async function enter() {
    await loadPinConfig();

    // 1. Check Admin instant bypass
    if (isAdmin()) {
      enterRoomInternal();
      return;
    }

    // 2. Check if room is locked
    if (!_isLocked) {
      enterRoomInternal();
      return;
    }

    // 3. Check session unlock
    let isUnlocked = false;
    try {
      isUnlocked = sessionStorage.getItem('cc_browser_unlocked_' + _roomPin) === 'true';
    } catch (_) {}

    if (isUnlocked) {
      enterRoomInternal();
      return;
    }

    // 4. Prompt PIN
    openPinModal();
  }

  function enterRoomInternal() {
    if (typeof window.cleanupVirtualRooms === 'function') {
      window.cleanupVirtualRooms();
    }

    _active = true;

    // Highlight sidebar
    document.querySelectorAll('#room-list li').forEach(li => li.classList.remove('active'));
    const li = document.querySelector('#room-list li[data-room-id="browser-virtual"]');
    if (li) li.classList.add('active');

    // Show container & return button
    const container = document.getElementById('browser-container');
    if (container) container.classList.remove('hidden');

    const btnReturn = document.getElementById('btn-iptv-return');
    if (btnReturn) btnReturn.classList.remove('hidden');

    // Update title
    const titleEl = document.getElementById('current-room-name');
    if (titleEl) titleEl.textContent = '🌐 Browser Room';
    document.title = '🌐 Browser – ChatCorner';

    const shell = document.querySelector('.page-shell');
    if (shell) shell.classList.add('iptv-active', 'media-room');

    if (typeof window.switchMobileTab === 'function') {
      window.switchMobileTab('chat');
    }

    // Setup chat wrapper
    const chatMain = document.querySelector('.chat-main');
    const messages = document.getElementById('messages');
    const inputStrip = document.querySelector('.input-strip');
    if (chatMain && messages && inputStrip && !document.querySelector('.iptv-chat-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'iptv-chat-wrapper';
      chatMain.appendChild(wrapper);
      wrapper.appendChild(messages);
      wrapper.appendChild(inputStrip);
    }

    // Set virtual room state
    window.currentRoom = {
      id: 'browser-virtual',
      name: 'Browser',
      is_audio_enabled: true,
      _virtual: true
    };
    if (typeof window.updateComposerState === 'function') {
      window.updateComposerState();
    }

    initBrowserSession();
  }

  function exit() {
    if (!_active) return;
    _active = false;

    stopScreenShare(false);

    if (_channel && window.sbClient) {
      try {
        window.sbClient.removeChannel(_channel);
      } catch (_) {}
      _channel = null;
    }

    const container = document.getElementById('browser-container');
    if (container) container.classList.add('hidden');

    const iframe = document.getElementById('browser-iframe');
    if (iframe) iframe.src = 'about:blank';

    closePinModal();
    closePinManagerModal();
    closePassWheelModal();
  }

  /* ══ Collaborative Browsing Engine ═══════════════════════════════ */

  function initBrowserSession() {
    setupPinInputHandlers();
    setupStageInteractions();

    const myId = getMyUserId();
    const myName = getMyDisplayName();

    // Default controller: if Admin, self takes wheel; else Host
    if (isAdmin()) {
      _controllerId = myId;
      _controllerName = myName;
    }

    updateControlsUI();
    updateAdminPinDisplay();

    // Subscribe to Supabase realtime channel
    if (window.sbClient) {
      if (_channel) window.sbClient.removeChannel(_channel);

      _channel = window.sbClient.channel(CHANNEL_NAME, {
        config: { presence: { key: myId } }
      });

      _channel
        .on('broadcast', { event: 'browser-nav' }, ({ payload }) => handleRemoteNav(payload))
        .on('broadcast', { event: 'browser-scroll' }, ({ payload }) => handleRemoteScroll(payload))
        .on('broadcast', { event: 'browser-cursor' }, ({ payload }) => handleRemoteCursor(payload))
        .on('broadcast', { event: 'control-grant' }, ({ payload }) => handleControlGrant(payload))
        .on('broadcast', { event: 'control-revoke' }, ({ payload }) => handleControlRevoke(payload))
        .on('broadcast', { event: 'pin-update' }, ({ payload }) => handleRemotePinUpdate(payload))
        .on('broadcast', { event: 'sync-request' }, () => handleSyncRequest())
        .on('broadcast', { event: 'sync-state' }, ({ payload }) => handleSyncState(payload))
        .on('broadcast', { event: 'stream-offer' }, ({ payload }) => handleStreamOffer(payload))
        .on('broadcast', { event: 'stream-answer' }, ({ payload }) => handleStreamAnswer(payload))
        .on('broadcast', { event: 'stream-ice' }, ({ payload }) => handleStreamIce(payload))
        .on('broadcast', { event: 'stream-state' }, ({ payload }) => handleStreamState(payload))
        .on('presence', { event: 'sync' }, () => handlePresenceSync())
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            trackPresence();
            // Request latest state from any host already in room
            broadcastEvent('sync-request', { from: myId });
          }
        });
    }

    // Load initial URL
    navigate(_currentUrl, false);
  }

  function trackPresence() {
    if (!_channel) return;
    _channel.track({
      userId: getMyUserId(),
      username: getMyDisplayName(),
      isAdmin: isAdmin(),
      isController: isController(),
      joinedAt: Date.now()
    }).catch(() => {});
  }

  function broadcastEvent(event, payload) {
    if (!_channel) return;
    _channel.send({
      type: 'broadcast',
      event,
      payload
    }).catch(err => console.warn('[BrowserRoom] Broadcast error:', event, err));
  }

  /* ══ Navigation & Viewport Controls ═══════════════════════════════ */

  function normalizeUrl(input) {
    let url = String(input || '').trim();
    if (!url) return DEFAULT_URL;
    if (!/^https?:\/\//i.test(url)) {
      if (url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        // Search query
        url = 'https://en.wikipedia.org/w/index.php?search=' + encodeURIComponent(url);
      }
    }
    return url;
  }

  function navigate(url, broadcast = true) {
    const finalUrl = normalizeUrl(url);
    _currentUrl = finalUrl;

    const input = document.getElementById('browser-url-input');
    if (input) input.value = finalUrl;

    const iframe = document.getElementById('browser-iframe');
    if (iframe && iframe.src !== finalUrl) {
      iframe.src = finalUrl;
    }

    if (broadcast && isController()) {
      broadcastEvent('browser-nav', {
        url: finalUrl,
        controllerId: getMyUserId(),
        controllerName: getMyDisplayName(),
        ts: Date.now()
      });
      // Add to history
      if (_historyStack[_historyIndex] !== finalUrl) {
        _historyStack = _historyStack.slice(0, _historyIndex + 1);
        _historyStack.push(finalUrl);
        _historyIndex = _historyStack.length - 1;
      }
    }

    updateStatusText(`Loaded: ${finalUrl}`);
  }

  function navigateInput() {
    if (!isController()) {
      if (typeof window.showChatToast === 'function') {
        window.showChatToast('🔒 You are in view-only mode. Controller has the wheel.', 'warning');
      }
      return;
    }
    const input = document.getElementById('browser-url-input');
    if (input && input.value) {
      navigate(input.value.trim(), true);
    }
  }

  function goBack() {
    if (!isController() || _historyIndex <= 0) return;
    _historyIndex--;
    navigate(_historyStack[_historyIndex], true);
  }

  function goForward() {
    if (!isController() || _historyIndex >= _historyStack.length - 1) return;
    _historyIndex++;
    navigate(_historyStack[_historyIndex], true);
  }

  function reload() {
    if (!isController()) return;
    const iframe = document.getElementById('browser-iframe');
    if (iframe) {
      const src = iframe.src;
      iframe.src = 'about:blank';
      setTimeout(() => { iframe.src = src; }, 80);
    }
    broadcastEvent('browser-nav', { url: _currentUrl, ts: Date.now() });
  }

  function goHome() {
    if (!isController()) return;
    navigate(DEFAULT_URL, true);
  }

  function updateStatusText(text) {
    const el = document.getElementById('browser-status');
    if (el) el.textContent = text;
  }

  function requestSync() {
    broadcastEvent('sync-request', { from: getMyUserId() });
    if (typeof window.showChatToast === 'function') {
      window.showChatToast('🔄 Requesting view sync from controller...', 'info');
    }
  }

  /* ══ Remote Event Handlers ════════════════════════════════════════ */

  function handleRemoteNav(p) {
    if (!p || !p.url) return;
    _currentUrl = p.url;
    if (p.controllerName) _controllerName = p.controllerName;
    if (p.controllerId) _controllerId = p.controllerId;

    const input = document.getElementById('browser-url-input');
    if (input) input.value = p.url;

    const iframe = document.getElementById('browser-iframe');
    if (iframe && iframe.src !== p.url) {
      iframe.src = p.url;
    }

    updateControlsUI();
    updateStatusText(`Navigated to: ${p.url}`);
  }

  function handleRemoteScroll(p) {
    if (!p || isController()) return;
    const wrapper = document.getElementById('browser-iframe-wrapper');
    if (!wrapper) return;

    _isHandlingRemoteScroll = true;
    const maxScroll = wrapper.scrollHeight - wrapper.clientHeight;
    if (maxScroll > 0 && typeof p.percentY === 'number') {
      wrapper.scrollTop = maxScroll * p.percentY;
    }
    setTimeout(() => { _isHandlingRemoteScroll = false; }, 40);
  }

  function handleRemoteCursor(p) {
    if (!p || isController()) return;
    const cursorEl = document.getElementById('browser-synced-cursor');
    const labelEl = document.getElementById('browser-cursor-label');
    const stage = document.getElementById('browser-stage');

    if (!cursorEl || !stage) return;

    if (p.hide) {
      cursorEl.classList.add('hidden');
      return;
    }

    cursorEl.classList.remove('hidden');
    if (labelEl && p.name) labelEl.textContent = p.name;

    const x = (p.xPercent || 0) * stage.clientWidth;
    const y = (p.yPercent || 0) * stage.clientHeight;
    cursorEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    if (p.clicking) {
      cursorEl.classList.add('cursor-click');
      setTimeout(() => cursorEl.classList.remove('cursor-click'), 200);
    }
  }

  function handleControlGrant(p) {
    if (!p || !p.controllerId) return;
    _controllerId = p.controllerId;
    _controllerName = p.controllerName || 'User';

    updateControlsUI();

    const isMe = _controllerId === getMyUserId();
    if (typeof window.showChatToast === 'function') {
      if (isMe) {
        window.showChatToast('🎮 You were given the wheel! You now have interactive control.', 'success', 5000);
      } else {
        window.showChatToast(`🤝 Control delegated to ${_controllerName}.`, 'info', 3000);
      }
    }
  }

  function handleControlRevoke(p) {
    _controllerId = p?.controllerId || null;
    _controllerName = p?.controllerName || 'Host';

    updateControlsUI();

    const isMe = (p?.revokedId === getMyUserId()) || (!isAdmin() && _controllerId !== getMyUserId());
    if (typeof window.showChatToast === 'function') {
      if (isAdmin()) {
        window.showChatToast('⛔ You have taken back interactive control.', 'info');
      } else {
        window.showChatToast('🔒 Interactive control revoked by Admin. View-only mode restored.', 'warning', 4000);
      }
    }
  }

  function handleRemotePinUpdate(p) {
    if (!p) return;
    if (p.pin) _roomPin = String(p.pin);
    if (typeof p.locked === 'boolean') _isLocked = p.locked;
    updateAdminPinDisplay();
  }

  function handleSyncRequest() {
    if (isController()) {
      broadcastEvent('sync-state', {
        url: _currentUrl,
        controllerId: _controllerId,
        controllerName: _controllerName,
        isLocked: _isLocked,
        pin: _roomPin,
        isScreenSharing: _isScreenSharing
      });
    }
  }

  function handleSyncState(p) {
    if (!p) return;
    if (p.url && !isController()) {
      navigate(p.url, false);
    }
    if (p.controllerId) _controllerId = p.controllerId;
    if (p.controllerName) _controllerName = p.controllerName;
    if (typeof p.isLocked === 'boolean') _isLocked = p.isLocked;
    if (p.pin && isAdmin()) _roomPin = p.pin;
    updateControlsUI();
    updateAdminPinDisplay();
  }

  /* ══ Viewport Interactions (Scroll & Cursor Sync) ═════════════════ */

  function setupStageInteractions() {
    const stage = document.getElementById('browser-stage');
    const wrapper = document.getElementById('browser-iframe-wrapper');

    if (stage) {
      stage.onmousemove = (e) => {
        if (!isController()) return;
        const now = Date.now();
        if (now - _lastCursorBroadcast < 45) return;
        _lastCursorBroadcast = now;

        const rect = stage.getBoundingClientRect();
        const xPercent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const yPercent = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        broadcastEvent('browser-cursor', {
          xPercent,
          yPercent,
          clicking: false,
          name: getMyDisplayName()
        });
      };

      stage.onmousedown = (e) => {
        if (!isController()) return;
        const rect = stage.getBoundingClientRect();
        const xPercent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const yPercent = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        broadcastEvent('browser-cursor', {
          xPercent,
          yPercent,
          clicking: true,
          name: getMyDisplayName()
        });
      };

      stage.onmouseleave = () => {
        if (!isController()) return;
        broadcastEvent('browser-cursor', { hide: true });
      };
    }

    if (wrapper) {
      wrapper.onscroll = () => {
        if (!isController() || _isHandlingRemoteScroll) return;
        const now = Date.now();
        if (now - _lastScrollBroadcast < 50) return;
        _lastScrollBroadcast = now;

        const maxScroll = wrapper.scrollHeight - wrapper.clientHeight;
        const percentY = maxScroll > 0 ? (wrapper.scrollTop / maxScroll) : 0;

        broadcastEvent('browser-scroll', { percentY, ts: now });
      };
    }
  }

  /* ══ Granular Permission Hierarchy & "Pass the Wheel" ══════════════ */

  function updateControlsUI() {
    const hasControl = isController();
    const isAdm = isAdmin();

    // URL input & Go button
    const urlInput = document.getElementById('browser-url-input');
    const goBtn = document.querySelector('.browser-btn-go');
    const navButtons = document.querySelectorAll('.browser-nav-btn, .browser-preset-btn');
    const streamBtn = document.getElementById('browser-btn-stream');
    const guardEl = document.getElementById('browser-guard');

    if (urlInput) {
      urlInput.disabled = !hasControl;
      if (!hasControl) {
        urlInput.title = `Controlled by ${_controllerName}`;
      } else {
        urlInput.title = 'Enter URL and press Enter or Go';
      }
    }
    if (goBtn) goBtn.disabled = !hasControl;
    navButtons.forEach(btn => { btn.disabled = !hasControl; });

    if (streamBtn) {
      streamBtn.style.display = hasControl ? 'inline-flex' : 'none';
    }

    // View-only guard overlay
    if (guardEl) {
      guardEl.classList.toggle('hidden', hasControl);
    }

    // Controller badge
    const badgeName = document.getElementById('browser-controller-name');
    const pill = document.getElementById('browser-controller-pill');
    if (badgeName) {
      badgeName.textContent = hasControl
        ? (isAdm ? 'You (Admin)' : 'You')
        : (_controllerName || 'Host');
    }
    if (pill) {
      pill.classList.toggle('pill-active', hasControl);
    }

    // Admin Pass Wheel & Revoke buttons
    const passBtn = document.getElementById('browser-btn-pass-wheel');
    const revokeBtn = document.getElementById('browser-btn-revoke-wheel');

    if (passBtn) {
      passBtn.classList.toggle('hidden', !isAdm);
    }
    if (revokeBtn) {
      // Show revoke button if Admin is present and someone else has the wheel
      const someoneElseHasWheel = _controllerId && _controllerId !== getMyUserId();
      revokeBtn.classList.toggle('hidden', !(isAdm && someoneElseHasWheel));
    }
  }

  function openPassWheelModal() {
    if (!isAdmin()) return;
    const modal = document.getElementById('browser-pass-wheel-modal');
    if (!modal) return;

    const currentNameEl = document.getElementById('browser-wheel-current-name');
    if (currentNameEl) {
      currentNameEl.textContent = _controllerName + (_controllerId === getMyUserId() ? ' (You)' : '');
    }

    const listEl = document.getElementById('browser-wheel-user-list');
    if (listEl) {
      listEl.innerHTML = '';
      const participants = getRoomParticipants();

      if (participants.length === 0) {
        listEl.innerHTML = '<li class="wheel-empty">No other participants online in Browser room</li>';
      } else {
        participants.forEach(u => {
          const li = document.createElement('li');
          li.className = 'wheel-user-item';
          const isCurr = u.userId === _controllerId;
          li.innerHTML = `
            <div class="wheel-user-info">
              <span class="wheel-user-dot"></span>
              <span class="wheel-user-name">${escapeHtml(u.username)}</span>
              ${u.isAdmin ? '<span class="role-badge admin">🛡️</span>' : ''}
              ${isCurr ? '<span class="wheel-active-tag">Active</span>' : ''}
            </div>
            <button type="button" class="btn btn-sm ${isCurr ? 'btn-secondary' : 'btn-primary'}" ${isCurr ? 'disabled' : ''} onclick="BrowserRoom.grantControl('${u.userId}', '${escapeHtml(u.username)}')">
              ${isCurr ? 'Has Wheel' : 'Grant Control 🎮'}
            </button>
          `;
          listEl.appendChild(li);
        });
      }
    }

    modal.classList.remove('hidden');
    modal.classList.add('visible');
  }

  function closePassWheelModal() {
    const modal = document.getElementById('browser-pass-wheel-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('visible');
    }
  }

  function grantControl(targetUserId, targetUsername) {
    if (!isAdmin()) return;
    _controllerId = targetUserId;
    _controllerName = targetUsername;

    broadcastEvent('control-grant', {
      controllerId: targetUserId,
      controllerName: targetUsername,
      grantedBy: getMyDisplayName()
    });

    closePassWheelModal();
    updateControlsUI();

    if (typeof window.showChatToast === 'function') {
      window.showChatToast(`🎮 Wheel passed to ${targetUsername}!`, 'success');
    }
  }

  function revokeWheel() {
    if (!isAdmin()) return;
    const prevController = _controllerName;
    _controllerId = getMyUserId();
    _controllerName = getMyDisplayName();

    broadcastEvent('control-revoke', {
      controllerId: _controllerId,
      controllerName: _controllerName,
      revokedId: _controllerId,
      revokedBy: _controllerName
    });

    closePassWheelModal();
    updateControlsUI();

    if (typeof window.showChatToast === 'function') {
      window.showChatToast(`⛔ Revoked control from ${prevController}. You have the wheel.`, 'info');
    }
  }

  function getRoomParticipants() {
    if (!_channel) return [];
    const state = _channel.presenceState() || {};
    const myId = getMyUserId();
    const users = [];

    Object.values(state).forEach(entries => {
      (entries || []).forEach(e => {
        if (!e || !e.userId || e.userId === myId) return;
        if (!users.some(u => u.userId === e.userId)) {
          users.push({
            userId: e.userId,
            username: e.username || 'User',
            isAdmin: !!e.isAdmin
          });
        }
      });
    });
    return users;
  }

  function handlePresenceSync() {
    // Refresh participant list if wheel modal is open
    const modal = document.getElementById('browser-pass-wheel-modal');
    if (modal && modal.classList.contains('visible')) {
      openPassWheelModal();
    }
  }

  /* ══ Live WebRTC Screen / Tab Streaming (Watch Party) ══════════════ */

  async function toggleScreenShare() {
    if (!isController()) return;
    if (_isScreenSharing) {
      stopScreenShare(true);
    } else {
      await startScreenShare();
    }
  }

  async function startScreenShare() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      alert('Screen sharing is not supported by your browser.');
      return;
    }

    try {
      _screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: true
      });
    } catch (err) {
      console.warn('[BrowserRoom] getDisplayMedia cancelled or failed:', err);
      return;
    }

    _isScreenSharing = true;

    // Attach to host's video element (muted locally to avoid echo)
    const videoEl = document.getElementById('browser-stream-video');
    const iframeWrapper = document.getElementById('browser-iframe-wrapper');
    const streamLabel = document.getElementById('browser-stream-label');

    if (videoEl) {
      videoEl.srcObject = _screenStream;
      videoEl.muted = true;
      videoEl.classList.remove('hidden');
      videoEl.play().catch(() => {});
    }
    if (iframeWrapper) iframeWrapper.classList.add('hidden');
    if (streamLabel) streamLabel.textContent = 'Stop Streaming';

    // Broadcast stream started
    broadcastEvent('stream-state', {
      active: true,
      hostId: getMyUserId(),
      hostName: getMyDisplayName()
    });

    // Handle user clicking native "Stop sharing" bar
    _screenStream.getVideoTracks()[0].onended = () => {
      stopScreenShare(true);
    };

    updateStatusText('🖥️ Live streaming screen/tab to all participants');
  }

  function stopScreenShare(broadcast = true) {
    if (!_isScreenSharing && !_screenStream) return;
    _isScreenSharing = false;

    if (_screenStream) {
      _screenStream.getTracks().forEach(t => t.stop());
      _screenStream = null;
    }

    Object.values(_screenPeers).forEach(pc => {
      try { pc.close(); } catch (_) {}
    });
    _screenPeers = {};

    const videoEl = document.getElementById('browser-stream-video');
    const iframeWrapper = document.getElementById('browser-iframe-wrapper');
    const streamLabel = document.getElementById('browser-stream-label');

    if (videoEl) {
      videoEl.srcObject = null;
      videoEl.classList.add('hidden');
    }
    if (iframeWrapper) iframeWrapper.classList.remove('hidden');
    if (streamLabel) streamLabel.textContent = 'Stream Tab';

    if (broadcast) {
      broadcastEvent('stream-state', { active: false });
    }
    updateStatusText(`Loaded: ${_currentUrl}`);
  }

  async function handleStreamState(p) {
    if (!p) return;
    const videoEl = document.getElementById('browser-stream-video');
    const iframeWrapper = document.getElementById('browser-iframe-wrapper');

    if (p.active) {
      if (videoEl) videoEl.classList.remove('hidden');
      if (iframeWrapper) iframeWrapper.classList.add('hidden');
      updateStatusText(`🖥️ Watching live stream from ${p.hostName || 'Host'}`);

      // If viewer, request connection from stream host
      if (!_isScreenSharing) {
        broadcastEvent('stream-request', { viewerId: getMyUserId() });
      }
    } else {
      if (videoEl) {
        videoEl.srcObject = null;
        videoEl.classList.add('hidden');
      }
      if (iframeWrapper) iframeWrapper.classList.remove('hidden');
      updateStatusText(`Loaded: ${_currentUrl}`);
    }
  }

  async function handleStreamOffer(p) {
    if (p.to !== getMyUserId() || !p.sdp) return;
    const iceServers = window.ICE_SERVERS || { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    const pc = new RTCPeerConnection(iceServers);
    _screenPeers[p.from] = pc;

    pc.ontrack = (event) => {
      const stream = (event.streams && event.streams[0]) || new MediaStream([event.track]);
      const videoEl = document.getElementById('browser-stream-video');
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.muted = false;
        videoEl.play().catch(() => {});
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      broadcastEvent('stream-ice', { from: getMyUserId(), to: p.from, candidate });
    };

    await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    broadcastEvent('stream-answer', { from: getMyUserId(), to: p.from, sdp: answer });
  }

  async function handleStreamAnswer(p) {
    if (p.to !== getMyUserId() || !p.sdp || !_screenPeers[p.from]) return;
    await _screenPeers[p.from].setRemoteDescription(new RTCSessionDescription(p.sdp));
  }

  async function handleStreamIce(p) {
    if (p.to !== getMyUserId() || !p.candidate || !_screenPeers[p.from]) return;
    try {
      await _screenPeers[p.from].addIceCandidate(new RTCIceCandidate(p.candidate));
    } catch (_) {}
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Public API
  return {
    enter,
    exit,
    submitPin,
    closePinModal,
    openPinManagerModal,
    closePinManagerModal,
    regeneratePin,
    togglePinLock,
    copyPin,
    navigate,
    navigateInput,
    goBack,
    goForward,
    reload,
    goHome,
    requestSync,
    toggleScreenShare,
    openPassWheelModal,
    closePassWheelModal,
    grantControl,
    revokeWheel,
    loadPinConfig
  };
})();
