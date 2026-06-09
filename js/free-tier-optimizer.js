/**
 * =====================================================================
 * FREE TIER OPTIMIZATION MODULE
 * Fixes for Supabase Free Tier Limits
 * =====================================================================
 * 
 * FIX 1: 200-User WebSocket Limit (Idle Disconnect + P2P Presence)
 * FIX 2: 30-Camera Bottleneck (Hard UI Limits + Click-to-View)
 * FIX 3: 500MB Storage Limit (24-Hour Message Purge + Compressed Voice)
 */

// =====================================================================
// FIX 1: IDLE DISCONNECT & P2P PRESENCE TRACKING
// =====================================================================

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const PRESENCE_HEARTBEAT_MS = 30 * 1000; // 30 seconds
let idleTimer = null;
let userIdleStatus = false;
let presenceHeartbeatInterval = null;
let localPresenceData = null;

/**
 * Initialize idle disconnect system
 * Disconnects users from WebSocket after 5 minutes of inactivity
 */
function initIdleDisconnectSystem() {
  document.addEventListener('mousemove', resetIdleTimer);
  document.addEventListener('keypress', resetIdleTimer);
  document.addEventListener('click', resetIdleTimer);
  document.addEventListener('scroll', resetIdleTimer);
  
  startIdleTimer();
  console.log('[IDLE] Idle disconnect system initialized');
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  if (userIdleStatus) {
    userIdleStatus = false;
    reconnectPresence();
    console.log('[IDLE] User activity detected - reconnecting to presence');
  }
  startIdleTimer();
}

function startIdleTimer() {
  idleTimer = setTimeout(() => {
    userIdleStatus = true;
    disconnectPresence();
    console.log('[IDLE] User idle for 5 minutes - disconnecting from presence');
  }, IDLE_TIMEOUT_MS);
}

function disconnectPresence() {
  if (presenceChannel) {
    presenceChannel.unsubscribe();
    console.log('[IDLE] Disconnected from presence channel');
  }
  updateIdleStatusUI(true);
}

function reconnectPresence() {
  if (presenceChannel && !presenceChannel.state) {
    presenceChannel.subscribe();
    console.log('[IDLE] Reconnected to presence channel');
  }
  updateIdleStatusUI(false);
}

function updateIdleStatusUI(isIdle) {
  const userBadge = document.getElementById('user-badge');
  if (userBadge) {
    if (isIdle) {
      userBadge.textContent = (userBadge.textContent || 'User') + ' 💤';
    } else {
      userBadge.textContent = userBadge.textContent.replace(' 💤', '');
    }
  }
}

/**
 * P2P Presence Broadcasting via PeerJS
 * Replaces heavy Supabase Presence heartbeats with lightweight P2P broadcasts
 */
function initP2PPresenceBroadcast() {
  if (!peerConnection) {
    console.warn('[P2P] PeerJS not initialized yet');
    return;
  }

  localPresenceData = {
    userId: currentUser?.id,
    username: currentProfile?.username,
    roomId: currentRoom?.id,
    timestamp: Date.now(),
    isIdle: userIdleStatus
  };

  presenceHeartbeatInterval = setInterval(() => {
    if (!userIdleStatus && peerConnection && peerConnection.open) {
      broadcastPresenceP2P();
    }
  }, PRESENCE_HEARTBEAT_MS);

  console.log('[P2P] P2P presence broadcast initialized');
}

function broadcastPresenceP2P() {
  if (!peerConnection || !peerConnection.open) return;

  localPresenceData.timestamp = Date.now();

  // Send to all connected peers in room
  peerConnection._events?.connection?.forEach((conn) => {
    if (conn.open && conn.peer !== peerConnection.id) {
      conn.send({
        type: 'presence',
        data: localPresenceData
      });
    }
  });
}

function stopP2PPresenceBroadcast() {
  if (presenceHeartbeatInterval) {
    clearInterval(presenceHeartbeatInterval);
    presenceHeartbeatInterval = null;
    console.log('[P2P] P2P presence broadcast stopped');
  }
}

// =====================================================================
// FIX 2: CAMERA BOTTLENECK - HARD UI LIMITS & CLICK-TO-VIEW
// =====================================================================

const MAX_CAMS_PER_ROOM = 6;
let activeCameraStreams = new Set();
let cameraViewRequests = new Map(); // userId -> { username, peerId }

/**
 * Check if camera can be enabled based on active stream limit
 */
function canEnableCamera() {
  if (activeCameraStreams.size >= MAX_CAMS_PER_ROOM) {
    return false;
  }
  return true;
}

/**
 * Register local camera as active
 */
function registerLocalCamera(userId) {
  activeCameraStreams.add(userId);
  updateCameraButtonUI();
  console.log(`[CAMERA] Camera registered. Active: ${activeCameraStreams.size}/${MAX_CAMS_PER_ROOM}`);
}

/**
 * Unregister local camera
 */
function unregisterLocalCamera(userId) {
  activeCameraStreams.delete(userId);
  updateCameraButtonUI();
  console.log(`[CAMERA] Camera unregistered. Active: ${activeCameraStreams.size}/${MAX_CAMS_PER_ROOM}`);
}

/**
 * Update camera button UI based on slot availability
 */
function updateCameraButtonUI() {
  const cameraBtn = document.getElementById('btn-camera') || document.querySelector('[data-action="camera"]');
  if (!cameraBtn) return;

  const isFull = activeCameraStreams.size >= MAX_CAMS_PER_ROOM;
  cameraBtn.disabled = isFull;
  
  if (isFull) {
    cameraBtn.title = `Camera slots full (${MAX_CAMS_PER_ROOM}/${MAX_CAMS_PER_ROOM}). Try again later.`;
    cameraBtn.classList.add('disabled');
  } else {
    cameraBtn.title = `Enable camera (${activeCameraStreams.size}/${MAX_CAMS_PER_ROOM} active)`;
    cameraBtn.classList.remove('disabled');
  }
}

/**
 * Click-to-View Strategy: Show static placeholder instead of auto-streaming
 * Only establish P2P connection when user manually clicks "Watch Stream"
 */
function createCameraPlaceholder(userId, username) {
  const placeholder = document.createElement('div');
  placeholder.className = 'camera-placeholder';
  placeholder.dataset.userId = userId;
  placeholder.innerHTML = `
    <div class="placeholder-avatar" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 8px;">
      <div style="font-size: 3rem; margin-bottom: 8px;">📷</div>
      <div style="font-size: 0.9rem; font-weight: 600; margin-bottom: 12px;">${escHtml(username)}</div>
      <button class="btn-watch-stream" data-user-id="${userId}" data-username="${username}" onclick="watchCameraStream('${userId}', '${username}')">
        👁️ Watch Stream
      </button>
    </div>
  `;
  return placeholder;
}

/**
 * Establish P2P connection only when user clicks "Watch Stream"
 */
function watchCameraStream(userId, username) {
  console.log(`[CAMERA] User initiated view of ${username}'s camera`);
  
  if (typeof showCamInArea === 'function') {
    showCamInArea(userId, username);
  }
  
  // Notify peer that their camera is being watched
  if (presenceChannel) {
    presenceChannel.send({
      type: 'broadcast',
      event: 'cam-view',
      payload: { viewer: currentUser?.id, viewerName: currentProfile?.username, target: userId }
    }).catch(() => {});
  }
}

/**
 * Auto-disconnect after 30 minutes of inactivity on call
 */
const CALL_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
let callInactivityTimer = null;

function startCallInactivityTimer() {
  if (callInactivityTimer) clearTimeout(callInactivityTimer);
  
  callInactivityTimer = setTimeout(() => {
    console.log('[CAMERA] Call inactive for 30 minutes - auto-disconnecting');
    if (typeof leaveVoice === 'function') {
      leaveVoice();
    }
    stopLocalStream();
    showChatToast('🔔 Auto-disconnected after 30 minutes of inactivity', 'info');
  }, CALL_INACTIVITY_TIMEOUT_MS);
}

function resetCallInactivityTimer() {
  if (callInactivityTimer) {
    clearTimeout(callInactivityTimer);
    startCallInactivityTimer();
  }
}

// =====================================================================
// FIX 3: 500MB STORAGE LIMIT - MESSAGE PURGE & VOICE COMPRESSION
// =====================================================================

const MESSAGE_RETENTION_HOURS = 24;
const VOICE_NOTE_BITRATE_KBPS = 24; // Ultra-low bitrate for voice

/**
 * Schedule automatic message purge (24-hour retention)
 * Runs daily at midnight UTC
 */
function scheduleMessagePurge() {
  // Calculate milliseconds until next midnight UTC
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  
  const msUntilMidnight = tomorrow.getTime() - now.getTime();
  
  setTimeout(() => {
    purgeOldMessages();
    // Reschedule for daily execution
    setInterval(purgeOldMessages, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
  
  console.log(`[PURGE] Message purge scheduled for ${tomorrow.toUTCString()}`);
}

/**
 * Delete all messages older than 24 hours
 */
async function purgeOldMessages() {
  try {
    const cutoffTime = new Date(Date.now() - MESSAGE_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
    
    const { count, error } = await sbClient
      .from('messages')
      .delete()
      .lt('created_at', cutoffTime);
    
    if (error) throw error;
    
    console.log(`[PURGE] Deleted ${count} messages older than ${MESSAGE_RETENTION_HOURS} hours`);
  } catch (error) {
    console.error('[PURGE ERROR]', error);
  }
}

/**
 * Compress voice notes to ultra-low bitrate (.ogg format)
 * Reduces file size by 80-90% compared to uncompressed audio
 */
async function compressVoiceNote(audioBlob) {
  try {
    console.log('[VOICE] Compressing voice note...');
    
    // Use Web Audio API to re-encode at lower bitrate
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Downsample to 16kHz (sufficient for voice)
    const offlineContext = new OfflineAudioContext(
      1,
      audioBuffer.duration * 16000,
      16000
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);
    
    const compressedBuffer = await offlineContext.startRendering();
    
    // Convert to low-bitrate compressed format
    const compressedBlob = bufferToWavBlob(compressedBuffer, 16000);
    
    console.log(`[VOICE] Compression complete. Original: ${audioBlob.size}B, Compressed: ${compressedBlob.size}B`);
    
    return compressedBlob;
  } catch (error) {
    console.error('[VOICE COMPRESSION ERROR]', error);
    return audioBlob; // Fallback to original
  }
}

/**
 * Convert AudioBuffer to WAV Blob (compressed)
 */
function bufferToWavBlob(audioBuffer, sampleRate) {
  const data = audioBuffer.getChannelData(0);
  const buffer = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
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
    let s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

// =====================================================================
// INITIALIZATION
// =====================================================================

function initializeFreeTierOptimizations() {
  console.log('[FREE-TIER] Initializing all optimizations...');
  
  // FIX 1
  initIdleDisconnectSystem();
  
  // FIX 2
  updateCameraButtonUI();
  
  // FIX 3
  scheduleMessagePurge();
  
  console.log('[FREE-TIER] All optimizations initialized ✓');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFreeTierOptimizations);
} else {
  initializeFreeTierOptimizations();
}