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
  if (userBadge) {
    if (isIdle) {
      if (!userBadge.textContent.includes('💤')) {
        userBadge.textContent = (userBadge.textContent || 'User') + ' 💤';
      }
    } else {
      userBadge.textContent = userBadge.textContent.replace(' 💤', '');
    }
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
    if (typeof showChatToast === 'function') {
      showChatToast('🔔 Auto-disconnected after 30 minutes of inactivity', 'info');
    }
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

/**
 * Compress voice notes to 16kHz before base64 encoding to save DB space
 */
window.compressVoiceNote = async function(audioBlob) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Downsample to 16kHz
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
    
    // Convert to wav blob
    const compressedBlob = bufferToWavBlob(compressedBuffer, 16000);
    return compressedBlob;
  } catch (error) {
    console.warn('[VOICE COMPRESSION ERROR]', error);
    return audioBlob; // Fallback to original
  }
};

function bufferToWavBlob(audioBuffer, sampleRate) {
  const data = audioBuffer.getChannelData(0);
  const buffer = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(buffer);
  
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

function scheduleMessagePurge() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  
  const msUntilMidnight = tomorrow.getTime() - now.getTime();
  setTimeout(() => {
    purgeOldMessages();
    setInterval(purgeOldMessages, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}

async function purgeOldMessages() {
  try {
    if (typeof sbClient === 'undefined') return;
    const cutoffTime = new Date(Date.now() - MESSAGE_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
    // This frontend purge is a fallback for the Postgres CRON. 
    // It will only succeed if the user has admin RLS privileges.
    await sbClient.from('messages').delete().lt('created_at', cutoffTime);
  } catch (error) {}
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