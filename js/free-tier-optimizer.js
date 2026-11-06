/**
 * =====================================================================
 * FREE TIER OPTIMIZATION MODULE
 * Fixes for Supabase Free Tier Limits
 * =====================================================================
 */

// =====================================================================
// FIX 1: IDLE DISCONNECT (Free up WebSocket connections)
// =====================================================================
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
let idleTimer = null;
let userIdleStatus = false;

function initIdleDisconnectSystem() {
  document.addEventListener('mousemove', resetIdleTimer);
  document.addEventListener('keypress', resetIdleTimer);
  document.addEventListener('click', resetIdleTimer);
  document.addEventListener('scroll', resetIdleTimer);
  document.addEventListener('touchstart', resetIdleTimer);
  startIdleTimer();
  console.log('[IDLE] Idle disconnect system initialized');
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  if (userIdleStatus) {
    userIdleStatus = false;
    reconnectPresence();
  }
  localStorage.setItem('cc_guest_last_active', Date.now().toString());
  startIdleTimer();
}

function startIdleTimer() {
  idleTimer = setTimeout(() => {
    userIdleStatus = true;
    disconnectPresence();
  }, IDLE_TIMEOUT_MS);
}

function disconnectPresence() {
  if (typeof presenceChannel !== 'undefined' && presenceChannel) {
    presenceChannel.unsubscribe();
    console.log('[IDLE] User idle for 30 minutes - disconnected from presence channel');
  }
  updateIdleStatusUI(true);
}

function reconnectPresence() {
  if (typeof presenceChannel !== 'undefined' && presenceChannel) {
    presenceChannel.subscribe(async status => {
      if (status === 'SUBSCRIBED' && typeof presenceBaseData !== 'undefined') {
        try { await presenceChannel.track(presenceBaseData); } catch (_) {}
      }
    });
    console.log('[IDLE] User active - reconnected to presence channel');
  }
  updateIdleStatusUI(false);
}

function updateIdleStatusUI(isIdle) {
  const badge = document.getElementById('user-badge');
  if (!badge) return;
  if (isIdle) {
    if (!badge.textContent.includes('💤')) badge.textContent = (badge.textContent || 'User') + ' 💤';
  } else {
    badge.textContent = badge.textContent.replace(' 💤', '');
  }
}

// =====================================================================
// FIX 2: CAMERA UI OPTIMIZATION
// =====================================================================
const CALL_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
let callInactivityTimer = null;

function startCallInactivityTimer() {
  if (callInactivityTimer) clearTimeout(callInactivityTimer);
  callInactivityTimer = setTimeout(() => {
    console.log('[CAMERA] Call inactive for 30 minutes - auto-disconnecting');
    if (typeof leaveVoice === 'function') leaveVoice();
    if (typeof stopLocalStream === 'function') stopLocalStream();
    if (typeof showChatToast === 'function') showChatToast('🔔 Auto-disconnected after 30 minutes of inactivity', 'info');
  }, CALL_INACTIVITY_TIMEOUT_MS);
}

function resetCallInactivityTimer() {
  if (callInactivityTimer) {
    clearTimeout(callInactivityTimer);
    startCallInactivityTimer();
  }
}

document.addEventListener('mousemove', resetCallInactivityTimer);
document.addEventListener('keypress', resetCallInactivityTimer);

// =====================================================================
// FIX 3: VOICE NOTE COMPRESSION & MESSAGE PURGE
// =====================================================================
const MESSAGE_RETENTION_HOURS = 24;

window.compressVoiceNote = async function(audioBlob) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(await audioBlob.arrayBuffer());
    const offlineContext = new OfflineAudioContext(1, audioBuffer.duration * 16000, 16000);
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);
    return bufferToWavBlob(await offlineContext.startRendering(), 16000);
  } catch (error) {
    console.warn('[VOICE COMPRESSION ERROR]', error);
    return audioBlob;
  }
};

function bufferToWavBlob(audioBuffer, sampleRate) {
  const data = audioBuffer.getChannelData(0);
  const buffer = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + data.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, data.length * 2, true);
  let offset = 44;
  for (let i = 0; i < data.length; i++, offset += 2) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function scheduleMessagePurge() {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  setTimeout(() => {
    purgeOldMessages();
    setInterval(purgeOldMessages, 24 * 60 * 60 * 1000);
  }, tomorrow.getTime() - Date.now());
}

async function purgeOldMessages() {
  try {
    if (typeof sbClient === 'undefined') return;
    const cutoff = new Date(Date.now() - MESSAGE_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
    // Fallback for Postgres CRON; succeeds only where RLS permits deletion.
    await sbClient.from('messages').delete().lt('created_at', cutoff);
  } catch (_) {}
}

// =====================================================================
// FIX 4: Queue media state until the YouTube/Spotify embed is ready.
// =====================================================================
if (typeof initYouTubeRoom === 'function') {
  let ytPlayerReady = false;
  let ytPendingState = null;
  let ytSyncRequested = false;

  _ytApply = function(payload) {
    if (!payload?.videoId) return;
    if (!ytPlayerReady || !_ytPlayer?.loadVideoById) {
      ytPendingState = payload;
      return;
    }
    const time = Math.max(0, (Number(payload.time) || 0) + (
      payload.playing ? (Date.now() - (Number(payload.ts) || Date.now())) / 1000 : 0
    ));
    const changedVideo = _ytState.videoId !== payload.videoId;
    _ytState = { videoId: payload.videoId, playing: !!payload.playing, time };
    if (changedVideo) {
      if (payload.playing || ytSyncRequested) _ytPlayer.loadVideoById(payload.videoId, time);
      else _ytPlayer.cueVideoById(payload.videoId, time);
    } else if (Math.abs((_ytPlayer.getCurrentTime() || 0) - time) > 2) {
      _ytPlayer.seekTo(time, true);
    }
    if (payload.playing || ytSyncRequested) {
      _ytPlayer.unMute();
      _ytPlayer.playVideo();
      ytSyncRequested = false;
    } else if (_ytPlayer.getPlayerState() === 1) {
      _ytPlayer.pauseVideo();
    }
  };

  initYouTubeRoom = async function() {
    const admin = _mediaIsAdmin();
    document.getElementById('yt-admin-bar')?.classList.toggle('hidden', !admin);
    document.getElementById('yt-guard')?.classList.toggle('hidden', admin);
    document.getElementById('yt-sync-btn')?.classList.toggle('hidden', admin);
    _mediaToast(admin ? 'You control playback.' : 'Only admins control playback.');

    const channel = _mediaOpenChannel('yt-chat-room');
    channel.on('broadcast', { event: 'yt-state' }, ({ payload }) => {
      if (!_mediaIsAdmin()) _ytApply(payload);
    });
    channel.on('broadcast', { event: 'yt-request' }, () => {
      if (_mediaIsAdmin()) _ytBroadcast();
    });
    channel.subscribe(status => {
      _mediaMarkChannelReady(status);
      if (status === 'SUBSCRIBED') _mediaSend('yt-request', {});
    });

    await _ytLoadApi();
    if (_mediaKind !== 'yt') return;
    if (!_ytPlayer) {
      _ytPlayer = new YT.Player('yt-player', {
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0, controls: _mediaIsAdmin() ? 1 : 0, disablekb: _mediaIsAdmin() ? 0 : 1 },
        events: {
          onReady() {
            ytPlayerReady = true;
            const pending = ytPendingState;
            ytPendingState = null;
            if (pending) _ytApply(pending);
            else if (_ytState.videoId) _ytApply(_ytState);
          },
          onStateChange: _ytOnState
        }
      });
    } else {
      try {
        _ytPlayer.getPlayerState();
        ytPlayerReady = true;
        if (ytPendingState) {
          const pending = ytPendingState;
          ytPendingState = null;
          _ytApply(pending);
        }
      } catch (_) {
        ytPlayerReady = false;
      }
    }
    if (!_ytState.videoId && _virtualRoomConfig.virtual_youtube_default) {
      const defaultId = _ytParseId(_virtualRoomConfig.virtual_youtube_default);
      if (defaultId) {
        _ytState = { videoId: defaultId, playing: false, time: 0 };
        if (ytPlayerReady) _ytPlayer.cueVideoById(defaultId, 0);
      }
    }
    clearInterval(_mediaTimer);
    _mediaTimer = setInterval(() => { if (_mediaIsAdmin() && _ytState.videoId) _ytBroadcast(); }, 4000);
  };

  window.ytSyncNow = function() {
    ytSyncRequested = true;
    _mediaSend('yt-request', {});
  };
}

if (typeof initSpotifyRoom === 'function') {
  let spPendingState = null;
  let spApplyTimer = null;
  let spSyncRequested = false;
  let spApiUnavailable = false;
  let spSuppressTimer = null;

  function applySpotifyPlayback(payload) {
    if (!_spController || !payload?.uri) return;
    const position = Math.max(0, Number(payload.position) || 0);
    const shouldPlay = !payload.paused || spSyncRequested;
    _spSuppress = true;
    clearTimeout(spSuppressTimer);
    if (shouldPlay) {
      _spController.seek(Math.floor(position));
      if (typeof _spController.resume === 'function') _spController.resume();
      else if (typeof _spController.play === 'function') _spController.play();
    } else if (typeof _spController.pause === 'function') {
      _spController.pause();
    }
    spSyncRequested = false;
    spSuppressTimer = setTimeout(() => { _spSuppress = false; }, 1800);
  }

  _spApply = function(payload) {
    if (!payload?.uri) return;
    const next = {
      uri: payload.uri,
      paused: !!payload.paused,
      position: Number(payload.position) || 0,
      ts: Number(payload.ts) || Date.now()
    };
    _spState = { uri: next.uri, paused: next.paused, position: next.position };
    if (!_spController) {
      spPendingState = next;
      if (spApiUnavailable) _spRenderFallback(next.uri);
      return;
    }
    const uriChanged = _spController._ccCurrentUri !== next.uri;
    _spController._ccCurrentUri = next.uri;
    clearTimeout(spApplyTimer);
    if (uriChanged) {
      spPendingState = next;
      _spSuppress = true;
      clearTimeout(spSuppressTimer);
      _spController.loadUri(next.uri);
      spApplyTimer = setTimeout(() => {
        const latest = spPendingState;
        spPendingState = null;
        if (latest) applySpotifyPlayback(latest);
      }, 900);
      return;
    }
    applySpotifyPlayback(next);
  };

  initSpotifyRoom = async function() {
    const channel = _mediaOpenChannel('sp-chat-room');
    channel.on('presence', { event: 'sync' }, _spRefreshUi);
    channel.on('broadcast', { event: 'sp-state' }, ({ payload }) => {
      if (!_spAmController()) _spApply(payload);
    });
    channel.on('broadcast', { event: 'sp-request' }, () => {
      if (_spAmController()) _spBroadcast();
    });
    channel.subscribe(async status => {
      _mediaMarkChannelReady(status);
      if (status === 'SUBSCRIBED') {
        await _spTrack();
        _mediaSend('sp-request', {});
      }
    });
    _spRefreshUi();

    const api = await _spLoadApi();
    if (_mediaKind !== 'sp') return;
    const defaultUri = _spState.uri || _spParseUri(_virtualRoomConfig.virtual_spotify_default) || 'spotify:playlist:37i9dQZEVXbMDoHDwVN2tF';
    if (!_spState.uri) _spState = { uri: defaultUri, paused: true, position: 0 };
    if (_spController) return;
    const holder = document.getElementById('sp-embed');
    if (!api) {
      spApiUnavailable = true;
      _spRenderFallback(spPendingState?.uri || defaultUri);
      _mediaToast('Spotify playback sync is unavailable in this browser session.');
      return;
    }
    spApiUnavailable = false;
    holder.innerHTML = '<div id="sp-embed-inner"></div>';
    api.createController(document.getElementById('sp-embed-inner'),
      { uri: defaultUri, width: '100%', height: 352 },
      ctrl => {
        _spController = ctrl;
        _spController._ccCurrentUri = defaultUri;
        const initial = spPendingState || { uri: _spState.uri, paused: _spState.paused, position: _spState.position, ts: Date.now() };
        if (initial.uri !== defaultUri) {
          _spController._ccCurrentUri = initial.uri;
          _spController.loadUri(initial.uri);
          spApplyTimer = setTimeout(() => {
            const latest = spPendingState || initial;
            spPendingState = null;
            applySpotifyPlayback(latest);
          }, 900);
        } else {
          spPendingState = null;
          applySpotifyPlayback(initial);
        }
        ctrl.addListener('playback_update', event => {
          if (!event?.data || !_spAmController() || _spSuppress) return;
          _spState.paused = !!event.data.isPaused;
          _spState.position = Math.floor((event.data.position || 0) / 1000);
          _spBroadcast();
        });
      });
    setTimeout(() => {
      if (!_spController && _mediaKind === 'sp') {
        spApiUnavailable = true;
        _spRenderFallback(spPendingState?.uri || defaultUri);
        _mediaToast('Spotify playback sync is unavailable in this browser session.');
      }
    }, 6000);
    clearInterval(_mediaTimer);
    _mediaTimer = setInterval(() => { if (_spAmController() && _spState.uri) _spBroadcast(); }, 5000);
  };

  window.spSyncNow = function() {
    spSyncRequested = true;
    if (_spController && _spState.uri) {
      applySpotifyPlayback({ uri: _spState.uri, paused: false, position: _spState.position, ts: Date.now() });
    }
    _mediaSend('sp-request', {});
  };
}

// Load online-user drawer after chat-v3 has initialized the shared room state.
function loadVirtualRoomUsersPanel() {
  if (document.getElementById('cc-virtual-users-script')) return;
  const script = document.createElement('script');
  script.id = 'cc-virtual-users-script';
  script.src = 'js/virtual-room-users.js?v=1';
  script.async = true;
  script.onerror = () => console.error('[VIRTUAL USERS] Could not load the online-users panel.');
  document.head.appendChild(script);
}

// =====================================================================
// INITIALIZATION
// =====================================================================
function initializeFreeTierOptimizations() {
  initIdleDisconnectSystem();
  scheduleMessagePurge();
  loadVirtualRoomUsersPanel();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFreeTierOptimizations);
} else {
  initializeFreeTierOptimizations();
}
