/**
 * =====================================================================
 * FREE TIER OPTIMIZATION MODULE
 * Fixes for Supabase Free Tier Limits
 * =====================================================================
 */

// =====================================================================
// FIX 1: IDLE DISCONNECT (Free up WebSocket connections)
// =====================================================================

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
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
    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && typeof presenceBaseData !== 'undefined') {
        try { await presenceChannel.track(presenceBaseData); } catch(e) {}
      }
    });
    console.log('[IDLE] User active - reconnected to presence channel');
  }
  updateIdleStatusUI(false);
}

function updateIdleStatusUI(isIdle) {
  const userBadge = document.getElementById('user-badge');
  if (!userBadge) return;
  if (isIdle) {
    if (!userBadge.textContent.includes('💤')) userBadge.textContent = (userBadge.textContent || 'User') + ' 💤';
  } else {
    userBadge.textContent = userBadge.textContent.replace(' 💤', '');
  }
}

// =====================================================================
// FIX 2: CAMERA UI OPTIMIZATION (Prevent CPU/GPU Overload)
// =====================================================================

// Note: Camera Click-to-View strategy is natively implemented in audio-v3.js
// This adds an auto-disconnect safety net for inactive calls.
const CALL_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
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

/** Compress voice notes to 16kHz before base64 encoding to save DB space. */
window.compressVoiceNote = async function(audioBlob) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const offlineContext = new OfflineAudioContext(1, audioBuffer.duration * 16000, 16000);
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);
    const compressedBuffer = await offlineContext.startRendering();
    return bufferToWavBlob(compressedBuffer, 16000);
  } catch (error) {
    console.warn('[VOICE COMPRESSION ERROR]', error);
    return audioBlob;
  }
};

function bufferToWavBlob(audioBuffer, sampleRate) {
  const data = audioBuffer.getChannelData(0);
  const buffer = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
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
    const cutoffTime = new Date(Date.now() - MESSAGE_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
    // This frontend purge is a fallback for the Postgres CRON. It requires admin RLS privileges.
    await sbClient.from('messages').delete().lt('created_at', cutoffTime);
  } catch (error) {}
}

// =====================================================================
// FIX 4: YouTube room state arriving before the IFrame player is ready
// =====================================================================
// This module is loaded after chat-v3.js but before DOMContentLoaded starts rooms.
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

    const targetTime = Math.max(0, (Number(payload.time) || 0) + (
      payload.playing ? (Date.now() - (Number(payload.ts) || Date.now())) / 1000 : 0
    ));
    const changedVideo = _ytState.videoId !== payload.videoId;
    _ytState = { videoId: payload.videoId, playing: !!payload.playing, time: targetTime };

    if (changedVideo) {
      if (payload.playing || ytSyncRequested) _ytPlayer.loadVideoById(payload.videoId, targetTime);
      else _ytPlayer.cueVideoById(payload.videoId, targetTime);
    } else if (Math.abs((_ytPlayer.getCurrentTime() || 0) - targetTime) > 2) {
      _ytPlayer.seekTo(targetTime, true);
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

    const ch = _mediaOpenChannel('yt-chat-room');
    ch.on('broadcast', { event: 'yt-state' }, ({ payload }) => {
      if (!_mediaIsAdmin()) _ytApply(payload);
    });
    ch.on('broadcast', { event: 'yt-request' }, () => {
      if (_mediaIsAdmin()) _ytBroadcast();
    });
    ch.subscribe(status => {
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
      // A player can persist when the user leaves and re-enters the virtual room.
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
      const defaultVideoId = _ytParseId(_virtualRoomConfig.virtual_youtube_default);
      if (defaultVideoId) {
        _ytState = { videoId: defaultVideoId, playing: false, time: 0 };
        if (ytPlayerReady) _ytPlayer.cueVideoById(defaultVideoId, 0);
      }
    }
    clearInterval(_mediaTimer);
    _mediaTimer = setInterval(() => { if (_mediaIsAdmin() && _ytState.videoId) _ytBroadcast(); }, 4000);
  };

  window.ytSyncNow = function() {
    ytSyncRequested = true;
    // The host's response is authoritative for both video ID and position.
    _mediaSend('yt-request', {});
  };
}

// =====================================================================
// FIX 5: Spotify state can arrive before the IFrame controller is ready.
// Queue the latest host snapshot until the controller is created, and defer
// seek/play/pause until a newly loaded URI has had time to initialize.
// =====================================================================
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
    const state = {
      uri: payload.uri,
      paused: !!payload.paused,
      position: Number(payload.position) || 0,
      ts: Number(payload.ts) || Date.now()
    };
    _spState = { uri: state.uri, paused: state.paused, position: state.position };

    if (!_spController) {
      spPendingState = state;
      // If the IFrame API failed, update the static embed to the host's track.
      if (spApiUnavailable) _spRenderFallback(state.uri);
      return;
    }

    const uriChanged = _spController._ccCurrentUri !== state.uri;
    _spController._ccCurrentUri = state.uri;
    clearTimeout(spApplyTimer);
    if (uriChanged) {
      spPendingState = state;
      _spSuppress = true;
      clearTimeout(spSuppressTimer);
      _spController.loadUri(state.uri);
      spApplyTimer = setTimeout(() => {
        const latest = spPendingState;
        spPendingState = null;
        if (latest) applySpotifyPlayback(latest);
      }, 900);
      return;
    }
    applySpotifyPlayback(state);
  };

  initSpotifyRoom = async function() {
    const ch = _mediaOpenChannel('sp-chat-room');
    ch.on('presence', { event: 'sync' }, _spRefreshUi);
    ch.on('broadcast', { event: 'sp-state' }, ({ payload }) => {
      if (!_spAmController()) _spApply(payload);
    });
    ch.on('broadcast', { event: 'sp-request' }, () => {
      if (_spAmController()) _spBroadcast();
    });
    ch.subscribe(async status => {
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
        ctrl.addListener('playback_update', e => {
          if (!e?.data || !_spAmController() || _spSuppress) return;
          _spState.paused = !!e.data.isPaused;
          _spState.position = Math.floor((e.data.position || 0) / 1000);
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

// =====================================================================
// INITIALIZATION
// =====================================================================

function initializeFreeTierOptimizations() {
  initIdleDisconnectSystem();
  scheduleMessagePurge();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFreeTierOptimizations);
} else {
  initializeFreeTierOptimizations();
}
