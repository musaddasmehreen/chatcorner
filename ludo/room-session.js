(function () {
  var COLORS = ['red', 'green', 'yellow', 'blue'];
  var CHANNEL_PREFIX = 'ludo-room-v1';
  var SPEAKER_THRESHOLD = 0.12;

  var listeners = [];
  var actorAdminCache = {};
  var pendingSeatRequests = {};

  var state = {
    roomKey: 'global',
    channel: null,
    connected: false,
    mode: 'watch',
    seatColor: '',
    user: {
      id: '',
      nick: 'Guest',
      isAdmin: false,
      isAuthenticated: false
    },
    seats: {
      red: null,
      green: null,
      yellow: null,
      blue: null
    },
    seatTs: 0,
    authorityId: '',
    seatRequestId: 0,
    chat: [],
    voiceUsers: {},
    voice: {
      joined: false,
      muted: false,
      stream: null,
      audioCtx: null,
      analyser: null,
      meterTimer: null
    }
  };

  function now() {
    return Date.now();
  }

  function emit() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](snapshot()); } catch (e) {}
    }
  }

  function snapshot() {
    return {
      roomKey: state.roomKey,
      connected: state.connected,
      mode: state.mode,
      seatColor: state.seatColor,
      user: state.user,
      seats: state.seats,
      activeSeatCount: countActiveSeats(),
      chat: state.chat,
      voiceUsers: state.voiceUsers,
      voice: { joined: state.voice.joined, muted: state.voice.muted }
    };
  }

  function getSearchParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(name) || '';
    } catch (e) {
      return '';
    }
  }

  function getRoomKey() {
    var key = getSearchParam('room') || getSearchParam('game') || getSearchParam('join') || '';
    key = String(key || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return key || 'global';
  }

  function findFallbackNick() {
    var nick = '';
    if (window.ludoDebug && window.ludoDebug.identity && window.ludoDebug.identity.nick) {
      nick = window.ludoDebug.identity.nick;
    }
    return String(nick || '').trim() || 'Guest';
  }

  function notifySystem(text, persistToChat) {
    var msg = {
      id: 'sys-' + now() + '-' + Math.random().toString(36).slice(2, 8),
      ts: now(),
      nick: 'System',
      text: text,
      system: true
    };
    state.chat.push(msg);
    if (state.chat.length > 100) state.chat = state.chat.slice(-100);
    emit();

    if (persistToChat && state.channel) {
      sendEvent('m', {
        id: msg.id,
        ts: msg.ts,
        uid: 'system',
        nick: 'System',
        text: text,
        system: true
      });
    }
  }

  async function resolveUser() {
    var nick = findFallbackNick();
    var id = 'pcid:' + ((window.findPersistentClientId && window.findPersistentClientId()) || ('guest-' + now()));
    var isAdmin = false;
    var isAuthenticated = false;

    try {
      if (window.sbClient && window.sbClient.auth) {
        var sessionRes = await window.sbClient.auth.getSession();
        var session = sessionRes && sessionRes.data ? sessionRes.data.session : null;
        if (session && session.user) {
          id = session.user.id;
          isAuthenticated = true;
          nick = session.user.user_metadata && session.user.user_metadata.username ? session.user.user_metadata.username : nick;
          var prof = await window.sbClient
            .from('profiles')
            .select('username,is_admin,is_owner,is_mod')
            .eq('id', session.user.id)
            .maybeSingle();
          if (prof && prof.data) {
            nick = prof.data.username || nick;
            isAdmin = !!(prof.data.is_admin || prof.data.is_owner || prof.data.is_mod);
          }
        }
      }
    } catch (e) {}

    state.user = {
      id: id,
      nick: nick || 'Guest',
      isAdmin: isAdmin,
      isAuthenticated: isAuthenticated
    };

    actorAdminCache[id] = isAdmin;
    emit();
  }

  function countActiveSeats() {
    var count = 0;
    for (var i = 0; i < COLORS.length; i++) {
      if (state.seats[COLORS[i]]) count++;
    }
    return count;
  }

  function firstOpenSeat() {
    for (var i = 0; i < COLORS.length; i++) {
      if (!state.seats[COLORS[i]]) return COLORS[i];
    }
    return '';
  }

  function updateReadonlyState() {
    var isWatch = state.mode === 'watch';
    document.body.classList.toggle('ludo-watch-mode', isWatch);

    if (window.ludoDebug && window.ludoDebug.liveTable) {
      var lt = window.ludoDebug.liveTable;
      if (!lt.gameCode) {
        if (isWatch) {
          lt.role = 'viewer';
          if (state.seatColor && lt.playerColor === state.seatColor) lt.playerColor = '';
        } else if (state.seatColor) {
          if (!lt.playerColor || lt.role === 'viewer') {
            lt.playerColor = state.seatColor;
            lt.role = lt.role === 'host' ? 'host' : 'player';
          }
        }
      }
      if (typeof window.ludoDebug.syncLiveControlState === 'function') {
        window.ludoDebug.syncLiveControlState();
      }
    }
  }

  function applySeatSnapshot(payload, fromRemote) {
    if (!payload || !payload.seats) return;
    if (payload.requestId && pendingSeatRequests[payload.requestId]) {
      var resolve = pendingSeatRequests[payload.requestId];
      delete pendingSeatRequests[payload.requestId];
      resolve({ ok: payload.ok !== false, reason: payload.reason || '' });
    }

    var incomingTs = Number(payload.ts || 0);
    if (incomingTs && incomingTs < state.seatTs) return;

    var next = { red: null, green: null, yellow: null, blue: null };
    for (var i = 0; i < COLORS.length; i++) {
      var color = COLORS[i];
      var seat = payload.seats[color];
      if (seat && seat.id) {
        next[color] = { id: String(seat.id), nick: String(seat.nick || 'Player') };
      }
    }

    state.seats = next;
    state.seatTs = incomingTs || now();

    state.seatColor = '';
    for (var c = 0; c < COLORS.length; c++) {
      if (state.seats[COLORS[c]] && state.seats[COLORS[c]].id === state.user.id) {
        state.seatColor = COLORS[c];
      }
    }
    var liveTable = window.ludoDebug && window.ludoDebug.liveTable;
    if (liveTable && liveTable.gameCode && liveTable.playerColor && (liveTable.role === 'host' || liveTable.role === 'player')) {
      state.seatColor = liveTable.playerColor;
    }

    if (!state.seatColor && state.mode === 'play' && !(liveTable && liveTable.gameCode)) {
      state.mode = 'watch';
      notifySystem('You are now spectating.', false);
    }

    if (fromRemote && window.ludoDebug && window.ludoDebug.liveTable && window.ludoDebug.liveTable.gameCode && typeof window.ludoDebug.loadTableState === 'function') {
      window.ludoDebug.loadTableState(window.ludoDebug.liveTable.gameCode);
    }

    updateReadonlyState();
    emit();
  }

  function broadcastSeats() {
    if (state.connected && state.authorityId !== state.user.id) return;
    sendEvent('s', { ts: now(), seats: state.seats });
  }

  function clearMySeat() {
    var changed = false;
    for (var i = 0; i < COLORS.length; i++) {
      var color = COLORS[i];
      if (state.seats[color] && state.seats[color].id === state.user.id) {
        state.seats[color] = null;
        changed = true;
      }
    }
    state.seatColor = '';
    return changed;
  }

  function sendEvent(event, payload) {
    if (!state.channel || !state.connected) return;
    try {
      state.channel.send({ type: 'broadcast', event: event, payload: payload || {} });
    } catch (e) {}
  }

  function updateAuthority() {
    if (!state.channel || typeof state.channel.presenceState !== 'function') return;
    var presence = state.channel.presenceState() || {};
    var users = Object.keys(presence).sort();
    state.authorityId = users.length ? users[0] : '';
    if (state.authorityId === state.user.id) {
      var activeUsers = {};
      for (var i = 0; i < users.length; i++) activeUsers[users[i]] = true;
      var changed = false;
      for (var j = 0; j < COLORS.length; j++) {
        var color = COLORS[j];
        if (state.seats[color] && !activeUsers[state.seats[color].id]) {
          state.seats[color] = null;
          changed = true;
        }
      }
      if (changed) {
        state.seatTs = now();
        broadcastSeats();
      }
    }
  }

  function handleSeatRequest(payload) {
    if (
      !payload ||
      !payload.requestId ||
      payload.authorityId !== state.user.id ||
      state.authorityId !== state.user.id ||
      !payload.uid
    ) return;

    var result = { ok: false, reason: 'invalid' };
    var changed = false;
    var color = String(payload.color || '').toLowerCase();
    if (payload.action === 'claim' && COLORS.indexOf(color) !== -1) {
      var occupied = state.seats[color];
      if (occupied && occupied.id !== payload.uid) {
        result.reason = 'taken';
      } else {
        for (var i = 0; i < COLORS.length; i++) {
          var ownedColor = COLORS[i];
          if (state.seats[ownedColor] && state.seats[ownedColor].id === payload.uid) {
            state.seats[ownedColor] = null;
            changed = true;
          }
        }
        state.seats[color] = { id: String(payload.uid), nick: String(payload.nick || 'Player') };
        changed = true;
        result = { ok: true };
      }
    } else if (payload.action === 'release') {
      for (var j = 0; j < COLORS.length; j++) {
        var seatColor = COLORS[j];
        if (state.seats[seatColor] && state.seats[seatColor].id === payload.uid) {
          state.seats[seatColor] = null;
          changed = true;
        }
      }
      result = { ok: true };
    }

    if (changed) state.seatTs = Math.max(now(), state.seatTs + 1);
    sendEvent('s', {
      ts: state.seatTs,
      seats: state.seats,
      requestId: payload.requestId,
      ok: result.ok,
      reason: result.reason || ''
    });
  }

  function requestSeatChange(action, color) {
    if (!state.connected) {
      if (action === 'claim') {
        var localSeat = state.seats[color];
        if (localSeat && localSeat.id !== state.user.id) return Promise.resolve({ ok: false, reason: 'taken' });
        clearMySeat();
        state.seats[color] = { id: state.user.id, nick: state.user.nick };
        state.seatColor = color;
        state.seatTs = now();
        return Promise.resolve({ ok: true });
      }
      clearMySeat();
      return Promise.resolve({ ok: true });
    }
    if (!state.authorityId) return Promise.resolve({ ok: false, reason: 'authority-unavailable' });

    var requestId = state.user.id + '-' + now() + '-' + (++state.seatRequestId);
    return new Promise(function (resolve) {
      var timeout = setTimeout(function () {
        delete pendingSeatRequests[requestId];
        resolve({ ok: false, reason: 'timeout' });
      }, 5000);
      pendingSeatRequests[requestId] = function (result) {
        clearTimeout(timeout);
        resolve(result);
      };
      sendEvent('c', {
        requestId: requestId,
        authorityId: state.authorityId,
        uid: state.user.id,
        nick: state.user.nick,
        action: action,
        color: color
      });
    });
  }

  async function ensureAdminActor(userId) {
    if (!userId) return false;
    if (actorAdminCache[userId] === true) return true;
    if (actorAdminCache[userId] === false) return false;

    if (userId === state.user.id) {
      actorAdminCache[userId] = !!state.user.isAdmin;
      return actorAdminCache[userId];
    }

    try {
      if (!window.sbClient) return false;
      var res = await window.sbClient
        .from('profiles')
        .select('is_admin,is_owner,is_mod')
        .eq('id', userId)
        .maybeSingle();
      var ok = !!(res && res.data && (res.data.is_admin || res.data.is_owner || res.data.is_mod));
      actorAdminCache[userId] = ok;
      return ok;
    } catch (e) {
      return false;
    }
  }

  async function applyAdminAction(action, fromRemote) {
    if (!action || !action.byId || !action.color) return;
    var actorIsAdmin = await ensureAdminActor(action.byId);
    if (!actorIsAdmin) return;

    var target = state.seats[action.color];
    if (target && (!action.targetId || target.id === action.targetId)) {
      state.seats[action.color] = null;
    }

    if (action.takeOver) {
      state.seats[action.color] = { id: action.byId, nick: action.byNick || 'Admin' };
    }

    state.seatTs = Math.max(state.seatTs, Number(action.ts || 0), now());

    if (state.user.id === action.targetId && !action.takeOver) {
      state.mode = 'watch';
      state.seatColor = '';
    }

    if (state.user.id === action.byId && action.takeOver) {
      state.mode = 'play';
      state.seatColor = action.color;
    }

    updateReadonlyState();
    emit();

    var note = action.takeOver
      ? (action.byNick || 'Admin') + ' used Kick & Take Over Seat on ' + action.color + '.'
      : (action.byNick || 'Admin') + ' kicked ' + action.color + ' seat to spectator.';
    notifySystem(note, !fromRemote);

    if (fromRemote && state.authorityId === state.user.id) broadcastSeats();

    if (fromRemote && window.ludoDebug && window.ludoDebug.liveTable && window.ludoDebug.liveTable.gameCode && typeof window.ludoDebug.loadTableState === 'function') {
      window.ludoDebug.loadTableState(window.ludoDebug.liveTable.gameCode);
    }
  }

  function handleChatMessage(payload) {
    if (!payload || !payload.id || !payload.text) return;
    for (var i = state.chat.length - 1; i >= 0; i--) {
      if (state.chat[i].id === payload.id) return;
    }
    state.chat.push({
      id: payload.id,
      ts: Number(payload.ts || now()),
      nick: String(payload.nick || 'User'),
      text: String(payload.text || ''),
      uid: String(payload.uid || ''),
      system: !!payload.system
    });
    if (state.chat.length > 100) state.chat = state.chat.slice(-100);
    emit();
  }

  function handleVoiceState(payload) {
    if (!payload || !payload.uid) return;
    var uid = String(payload.uid);
    if (!payload.joined) {
      delete state.voiceUsers[uid];
      emit();
      return;
    }
    state.voiceUsers[uid] = {
      uid: uid,
      nick: String(payload.nick || 'User'),
      muted: !!payload.muted,
      level: Number(payload.level || 0),
      speaking: Number(payload.level || 0) >= SPEAKER_THRESHOLD,
      ts: Number(payload.ts || now())
    };
    emit();
  }

  function attachChannel() {
    if (!window.sbClient) {
      notifySystem('Supabase client unavailable. Room sync is in local-only mode.', false);
      return;
    }

    var channelName = CHANNEL_PREFIX + ':' + state.roomKey;
    state.channel = window.sbClient.channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: state.user.id }
      }
    });

    state.channel
      .on('presence', { event: 'sync' }, updateAuthority)
      .on('broadcast', { event: 'q' }, function () {
        updateAuthority();
        if (state.authorityId === state.user.id) {
          sendEvent('s', { ts: state.seatTs || now(), seats: state.seats });
        }
      })
      .on('broadcast', { event: 's' }, function (evt) {
        applySeatSnapshot(evt && evt.payload ? evt.payload : null, true);
      })
      .on('broadcast', { event: 'c' }, function (evt) {
        handleSeatRequest(evt && evt.payload ? evt.payload : null);
      })
      .on('broadcast', { event: 'm' }, function (evt) {
        handleChatMessage(evt && evt.payload ? evt.payload : null);
      })
      .on('broadcast', { event: 'v' }, function (evt) {
        handleVoiceState(evt && evt.payload ? evt.payload : null);
      })
      .on('broadcast', { event: 'a' }, function (evt) {
        applyAdminAction(evt && evt.payload ? evt.payload : null, true);
      })
      .subscribe(function (status) {
        state.connected = status === 'SUBSCRIBED';
        emit();
        if (state.connected) {
          state.channel.track({ uid: state.user.id });
          updateAuthority();
          sendEvent('q', { ts: now(), uid: state.user.id });
        }
      });
  }

  async function setMode(nextMode) {
    nextMode = nextMode === 'play' ? 'play' : 'watch';

    if (nextMode === 'watch') {
      state.mode = 'watch';
      var hasRoomSeat = false;
      for (var i = 0; i < COLORS.length; i++) {
        if (state.seats[COLORS[i]] && state.seats[COLORS[i]].id === state.user.id) hasRoomSeat = true;
      }
      var released = hasRoomSeat ? await requestSeatChange('release') : { ok: true };
      updateReadonlyState();
      emit();
      return { ok: released.ok, mode: state.mode, reason: released.reason || '' };
    }

    var liveTable = window.ludoDebug && window.ludoDebug.liveTable;
    if (liveTable && liveTable.gameCode && liveTable.playerColor && (liveTable.role === 'host' || liveTable.role === 'player')) {
      state.seatColor = liveTable.playerColor;
      state.mode = 'play';
      updateReadonlyState();
      emit();
      return { ok: true, mode: state.mode, seatColor: state.seatColor };
    }
    if (liveTable && liveTable.gameCode) return { ok: false, reason: 'live-table-viewer' };

    var activeCount = countActiveSeats();
    var currentMySeat = state.seatColor;
    if (!currentMySeat && activeCount >= 4) {
      emit();
      return { ok: false, reason: 'full' };
    }

    if (!currentMySeat) {
      var open = firstOpenSeat();
      if (!open) return { ok: false, reason: 'full' };
      var claimed = await requestSeatChange('claim', open);
      if (!claimed.ok) return claimed;
      state.mode = 'play';
      updateReadonlyState();
      emit();
      return { ok: true, mode: state.mode, seatColor: open };
    }

    state.mode = 'play';
    updateReadonlyState();
    emit();
    return { ok: true, mode: state.mode, seatColor: currentMySeat };
  }

  async function claimSeat(color) {
    color = String(color || '').toLowerCase();
    if (COLORS.indexOf(color) === -1) return { ok: false, reason: 'invalid' };

    var liveTable = window.ludoDebug && window.ludoDebug.liveTable;
    if (liveTable && liveTable.gameCode) {
      if (!liveTable.playerColor || color !== liveTable.playerColor) {
        return { ok: false, reason: 'live-table' };
      }
      state.seatColor = liveTable.playerColor;
      state.mode = 'play';
      updateReadonlyState();
      emit();
      return { ok: true, mode: state.mode, seatColor: state.seatColor };
    }

    var seat = state.seats[color];
    if (seat && seat.id !== state.user.id) {
      emit();
      return { ok: false, reason: 'taken' };
    }

    if (seat && seat.id === state.user.id) {
      state.mode = 'play';
      updateReadonlyState();
      emit();
      return { ok: true, mode: state.mode, seatColor: color };
    }

    var claimed = await requestSeatChange('claim', color);
    if (!claimed.ok) return claimed;
    state.mode = 'play';
    updateReadonlyState();
    emit();
    return { ok: true, mode: state.mode, seatColor: color };
  }

  function sendChat(text) {
    text = String(text || '').trim();
    if (!text) return false;
    var payload = {
      id: 'm-' + now() + '-' + Math.random().toString(36).slice(2, 8),
      ts: now(),
      uid: state.user.id,
      nick: state.user.nick,
      text: text,
      system: false
    };
    handleChatMessage(payload);
    sendEvent('m', payload);
    return true;
  }

  async function joinVoice() {
    if (state.voice.joined) return true;
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      var audioCtx = AudioCtx ? new AudioCtx() : null;
      var analyser = audioCtx ? audioCtx.createAnalyser() : null;
      var source = analyser && audioCtx ? audioCtx.createMediaStreamSource(stream) : null;
      if (source && analyser) {
        analyser.fftSize = 512;
        source.connect(analyser);
      }

      state.voice.joined = true;
      state.voice.muted = false;
      state.voice.stream = stream;
      state.voice.audioCtx = audioCtx;
      state.voice.analyser = analyser;

      var meter = new Uint8Array(analyser ? analyser.fftSize : 0);
      state.voice.meterTimer = setInterval(function () {
        var level = 0;
        if (analyser) {
          analyser.getByteTimeDomainData(meter);
          var sum = 0;
          for (var i = 0; i < meter.length; i++) {
            var v = (meter[i] - 128) / 128;
            sum += v * v;
          }
          level = Math.min(1, Math.sqrt(sum / Math.max(1, meter.length)) * 3.2);
        }

        if (state.voice.muted) level = 0;

        sendEvent('v', {
          uid: state.user.id,
          nick: state.user.nick,
          joined: true,
          muted: state.voice.muted,
          level: Number(level.toFixed(3)),
          ts: now()
        });
      }, 280);

      emit();
      return true;
    } catch (e) {
      notifySystem('Microphone permission was denied.', false);
      emit();
      return false;
    }
  }

  function toggleMute() {
    if (!state.voice.joined || !state.voice.stream) return false;
    state.voice.muted = !state.voice.muted;
    var tracks = state.voice.stream.getAudioTracks();
    for (var i = 0; i < tracks.length; i++) tracks[i].enabled = !state.voice.muted;

    sendEvent('v', {
      uid: state.user.id,
      nick: state.user.nick,
      joined: true,
      muted: state.voice.muted,
      level: 0,
      ts: now()
    });

    emit();
    return state.voice.muted;
  }

  function leaveVoice() {
    if (!state.voice.joined) return;
    if (state.voice.meterTimer) {
      clearInterval(state.voice.meterTimer);
      state.voice.meterTimer = null;
    }
    if (state.voice.stream) {
      var tracks = state.voice.stream.getTracks();
      for (var i = 0; i < tracks.length; i++) tracks[i].stop();
    }
    if (state.voice.audioCtx) {
      state.voice.audioCtx.close().catch(function () {});
    }

    state.voice.joined = false;
    state.voice.muted = false;
    state.voice.stream = null;
    state.voice.audioCtx = null;
    state.voice.analyser = null;

    sendEvent('v', {
      uid: state.user.id,
      nick: state.user.nick,
      joined: false,
      muted: true,
      level: 0,
      ts: now()
    });

    delete state.voiceUsers[state.user.id];
    emit();
  }

  async function adminKick(color, takeover) {
    if (!state.user.isAdmin) return { ok: false, reason: 'forbidden' };
    var target = state.seats[color];
    if (!target) return { ok: false, reason: 'empty' };

    var action = {
      id: 'a-' + now() + '-' + Math.random().toString(36).slice(2, 8),
      ts: now(),
      byId: state.user.id,
      byNick: state.user.nick,
      color: color,
      targetId: target.id,
      takeOver: !!takeover
    };

    await applyAdminAction(action, false);
    sendEvent('a', action);
    return { ok: true };
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.push(listener);
    listener(snapshot());
    return function () {
      listeners = listeners.filter(function (l) { return l !== listener; });
    };
  }

  function destroy() {
    leaveVoice();
    clearMySeat();
    broadcastSeats();
    if (state.channel && window.sbClient) {
      try { window.sbClient.removeChannel(state.channel); } catch (e) {}
    }
  }

  async function init() {
    state.roomKey = getRoomKey();
    await resolveUser();
    attachChannel();
    state.mode = 'watch';
    updateReadonlyState();
    emit();

    window.addEventListener('beforeunload', destroy);
    window.addEventListener('pagehide', destroy);
  }

  window.LudoRoomSession = {
    init: init,
    subscribe: subscribe,
    getState: snapshot,
    setMode: setMode,
    claimSeat: claimSeat,
    sendChat: sendChat,
    joinVoice: joinVoice,
    toggleMute: toggleMute,
    leaveVoice: leaveVoice,
    adminKick: adminKick,
    countActiveSeats: countActiveSeats,
    colors: COLORS
  };
})();
