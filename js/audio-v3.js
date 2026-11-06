/**
 * ChatCorner Live Voice & Video Chat (v3)
 * Full WebRTC mesh with Perfect Negotiation & deterministic initiator.
 * Prevents glare/offer collision, queues ICE candidates, unlocks browser autoplay,
 * and ensures all room participants can speak and hear seamlessly.
 */

let localStream = null;
let peers = {};
let peerStreams = {};
let peerAudioEls = {};
let peerMuted = {};
let iceQueues = {};
let audioChannel = null;
let isMuted = false;
let inVoice = false;
let isCameraOn = false;

let audioCtx = null;
let analyserNodes = {};
let analyserData = {};
let participantLevels = {};
let visualizerFrame = null;
let floatingCameraPeerId = null;

const VISUALIZER_BARS = 28;
const MAX_VOICE_SPEAKERS = 12;
let isListenerMode = false;
let listenerQueue = [];
let voiceJoinAt = null;
let isPromotingSpeaker = false;

window.addEventListener('DOMContentLoaded', () => {
  setupFloatingCameraWindow();
  clearAllVisualizers();
});

function getVoiceUserId() {
  const u = window.currentUser;
  const p = window.currentProfile;
  if (u && u.id) return String(u.id);
  if (p && p.id) return String(p.id);
  let stored = null;
  try { stored = sessionStorage.getItem('cc_voice_uid'); } catch (_) {}
  if (!stored) {
    stored = 'v_' + Math.random().toString(36).slice(2, 9);
    try { sessionStorage.setItem('cc_voice_uid', stored); } catch (_) {}
  }
  return stored;
}

function getVoiceUsername() {
  const p = window.currentProfile;
  const u = window.currentUser;
  return String(
    (p && p.username) ||
    (u && u.user_metadata && u.user_metadata.username) ||
    (u && u.email && u.email.split('@')[0]) ||
    'User'
  ).trim().slice(0, 40);
}

function getUsernameById(userId) {
  if (typeof onlineUsers !== 'undefined' && onlineUsers[userId]) {
    return onlineUsers[userId].username || onlineUsers[userId].nick || 'User';
  }
  return 'User';
}

async function joinVoice() {
  if (typeof stopRadioPlayer === 'function') {
    stopRadioPlayer();
  }
  if (!currentRoom?.is_audio_enabled || inVoice) return;

  const myId = getVoiceUserId();
  const myName = getVoiceUsername();

  // Resume or start AudioContext on user gesture to satisfy browser autoplay
  ensureAudioContext();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  // Request microphone permission
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    isCameraOn = false;
    isListenerMode = false;
  } catch (e) {
    console.warn('[Voice] Microphone unavailable or denied, joining in listener mode:', e);
    localStream = null;
    isListenerMode = true;
  }

  inVoice = true;
  isMuted = false;
  listenerQueue = [];
  isPromotingSpeaker = false;
  voiceJoinAt = Date.now();
  participantLevels[myId] = 0;

  document.getElementById('btn-join-voice')?.classList.add('hidden');
  document.getElementById('btn-leave-voice')?.classList.remove('hidden');

  const btnMute = document.getElementById('btn-mute');
  if (btnMute) {
    if (isListenerMode) {
      btnMute.classList.add('hidden');
    } else {
      btnMute.classList.remove('hidden');
      btnMute.textContent = '🔇 Mute';
    }
  }

  const btnCam = document.getElementById('btn-toggle-camera');
  if (btnCam) btnCam.classList.toggle('hidden', isListenerMode);

  document.getElementById('voice-visualizer')?.classList.remove('hidden');
  updateVoiceStatus();

  updateVideoButtons();
  updateLocalPreview();
  if (localStream) {
    attachAnalyserForStream(myId, localStream);
  }
  startVisualizerLoop();

  if (typeof setLocalCameraState === 'function') {
    await setLocalCameraState(isCameraOn);
  }

  // All participants subscribe to the SAME room voice channel
  const channelName = 'voice:' + (currentRoom.id || 'main');
  audioChannel = sbClient.channel(channelName, {
    config: { presence: { key: myId } }
  });

  audioChannel
    .on('broadcast', { event: 'offer' }, ({ payload }) => handleOffer(payload))
    .on('broadcast', { event: 'answer' }, ({ payload }) => handleAnswer(payload))
    .on('broadcast', { event: 'ice' }, ({ payload }) => handleIce(payload))
    .on('broadcast', { event: 'join' }, ({ payload }) => handlePeerJoin(payload))
    .on('broadcast', { event: 'leave' }, ({ payload }) => handlePeerLeave(payload))
    .on('broadcast', { event: 'camera-state' }, ({ payload }) => handleCameraState(payload))
    .on('broadcast', { event: 'speaker-left' }, () => {
      maybePromoteFromListenerQueue();
    })
    .on('presence', { event: 'sync' }, () => {
      syncVoiceRoleState();
      connectMissingPeers();
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        syncVoiceRoleState();
        await trackVoicePresence(isListenerMode ? 'listener' : 'speaker');
        await audioChannel.send({
          type: 'broadcast',
          event: 'join',
          payload: {
            from: myId,
            username: myName,
            cameraOn: isCameraOn,
            listenOnly: isListenerMode
          }
        });
        await broadcastCameraState();
        connectMissingPeers();
      }
    });
}

// Fallback listen-only function
async function joinVoiceListenOnly() {
  await joinVoice();
}

/**
 * Deterministic Initiator:
 * To avoid race conditions and simultaneous offers (glare), only the peer
 * with the higher ID initiates the WebRTC offer when two peers need connection.
 */
function connectMissingPeers() {
  if (!inVoice || !audioChannel) return;
  const myId = getVoiceUserId();
  const state = audioChannel.presenceState();
  Object.values(state).forEach(entries => {
    (entries || []).forEach(u => {
      if (u.userId && u.userId !== myId && !peers[u.userId]) {
        if (myId.localeCompare(u.userId) > 0) {
          initiateOfferToPeer(u.userId, u.username || 'User');
        }
      }
    });
  });
}

async function handlePeerJoin({ from, username, cameraOn, listenOnly }) {
  const myId = getVoiceUserId();
  if (!from || from === myId || peers[from]) return;
  if (!inVoice || !audioChannel) return;

  addPeerTag(from, username);
  if (!listenOnly) {
    updatePeerCameraIcon(from, !!cameraOn);
    if (typeof setUserCameraState === 'function') setUserCameraState(from, !!cameraOn);
  }

  // Only the peer with the higher ID creates the offer
  if (myId.localeCompare(from) > 0) {
    await initiateOfferToPeer(from, username);
  }
}

async function initiateOfferToPeer(peerId, username) {
  if (!inVoice || !audioChannel) return;
  const myId = getVoiceUserId();
  const myName = getVoiceUsername();

  addPeerTag(peerId, username);
  const pc = getOrCreatePeerConnection(peerId, username);

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await audioChannel.send({
      type: 'broadcast',
      event: 'offer',
      payload: {
        from: myId,
        to: peerId,
        sdp: offer,
        username: myName,
        cameraOn: isCameraOn
      }
    });
  } catch (err) {
    console.error('[Voice] Error creating offer to', peerId, err);
  }
}

async function handleOffer({ from, to, sdp, username, cameraOn }) {
  const myId = getVoiceUserId();
  if (to !== myId) return;

  addPeerTag(from, username);
  updatePeerCameraIcon(from, !!cameraOn);
  if (typeof setUserCameraState === 'function') setUserCameraState(from, !!cameraOn);

  const pc = getOrCreatePeerConnection(from, username);
  const isPolite = myId.localeCompare(from) < 0;
  const isCollision = pc.signalingState !== 'stable';

  if (isCollision) {
    if (!isPolite) {
      console.warn('[Voice] Impolite peer ignoring offer collision from', from);
      return;
    }
    console.log('[Voice] Polite peer rolling back local offer for', from);
    try {
      await pc.setLocalDescription({ type: 'rollback' });
    } catch (err) {
      console.warn('[Voice] Rollback failed:', err);
    }
  }

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    flushIceCandidates(from, pc);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await audioChannel.send({
      type: 'broadcast',
      event: 'answer',
      payload: { from: myId, to: from, sdp: answer }
    });
  } catch (err) {
    console.error('[Voice] Error handling offer from', from, err);
  }
}

async function handleAnswer({ from, to, sdp }) {
  const myId = getVoiceUserId();
  if (to !== myId || !peers[from]) return;

  const pc = peers[from];
  try {
    if (pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      flushIceCandidates(from, pc);
    }
  } catch (err) {
    console.error('[Voice] Error handling answer from', from, err);
  }
}

async function handleIce({ from, to, candidate }) {
  const myId = getVoiceUserId();
  if (to !== myId || !candidate) return;

  const pc = peers[from];
  if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
    if (!iceQueues[from]) iceQueues[from] = [];
    iceQueues[from].push(candidate);
    return;
  }

  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.warn('[Voice] addIceCandidate error:', err);
  }
}

function flushIceCandidates(peerId, pc) {
  const queue = iceQueues[peerId];
  if (queue && queue.length > 0) {
    queue.forEach(candidate => {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
        console.warn('[Voice] Flushed ICE error:', err);
      });
    });
    delete iceQueues[peerId];
  }
}

function getOrCreatePeerConnection(peerId, username) {
  if (peers[peerId] && ['new', 'connecting', 'connected'].includes(peers[peerId].connectionState)) {
    return peers[peerId];
  }

  if (peers[peerId]) {
    try { peers[peerId].close(); } catch (_) {}
    delete peers[peerId];
  }

  const pc = new RTCPeerConnection(ICE_SERVERS);
  peers[peerId] = pc;

  if (localStream) {
    localStream.getTracks().forEach(track => {
      try {
        pc.addTrack(track, localStream);
      } catch (err) {
        console.warn('[Voice] addTrack warning:', err);
      }
    });
  }

  pc.onicecandidate = async ({ candidate }) => {
    if (!candidate || !audioChannel) return;
    const myId = getVoiceUserId();
    await audioChannel.send({
      type: 'broadcast',
      event: 'ice',
      payload: { from: myId, to: peerId, candidate }
    });
  };

  pc.ontrack = (event) => {
    let stream = (event.streams && event.streams[0]) || peerStreams[peerId];
    if (!stream) {
      stream = new MediaStream();
    }
    if (event.track && !stream.getTracks().includes(event.track)) {
      stream.addTrack(event.track);
    }
    peerStreams[peerId] = stream;

    // Guarantee audio track is unmuted
    stream.getAudioTracks().forEach(t => { t.enabled = true; });

    const videoEl = ensurePeerTile(peerId, username);
    if (videoEl && videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
    }

    ensurePeerAudioElement(peerId, stream);
    attachAnalyserForStream(peerId, stream);
  };

  pc.onconnectionstatechange = () => {
    if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
      handlePeerLeave({ from: peerId });
    }
  };

  return pc;
}

function ensurePeerAudioElement(peerId, stream) {
  let audioEl = document.getElementById('audio-peer-' + peerId);
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = 'audio-peer-' + peerId;
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    const container = document.getElementById('audio-elements') || document.body;
    container.appendChild(audioEl);
  }
  if (audioEl.srcObject !== stream) {
    audioEl.srcObject = stream;
  }
  audioEl.volume = peerMuted[peerId] ? 0 : 1;
  audioEl.muted = false;
  peerAudioEls[peerId] = audioEl;

  // Unblock autoplay policy
  const playPromise = audioEl.play();
  if (playPromise !== undefined) {
    playPromise.catch(err => {
      console.warn('[Voice] Autoplay prevented, unlocking on click:', err);
      const unlockAudio = () => {
        audioEl.play().catch(() => {});
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
      };
      document.addEventListener('click', unlockAudio, { once: true });
      document.addEventListener('touchstart', unlockAudio, { once: true });
    });
  }
}

function handleCameraState({ from, cameraOn }) {
  const myId = getVoiceUserId();
  if (!from || from === myId) return;
  updatePeerCameraIcon(from, !!cameraOn);
  if (typeof setUserCameraState === 'function') setUserCameraState(from, !!cameraOn);
  if (!cameraOn) {
    hidePeerTile(from);
    if (floatingCameraPeerId === from) closeFloatingCamera();
  } else if (peerStreams[from]) {
    ensurePeerTile(from, getUsernameById(from));
  }
}

function handlePeerLeave({ from }) {
  if (!from) return;
  if (peers[from]) {
    try { peers[from].close(); } catch (_) {}
    delete peers[from];
  }
  delete iceQueues[from];
  cleanupPeerMedia(from);
  document.getElementById('peer-' + from)?.remove();
  document.getElementById('video-tile-' + from)?.remove();
  if (typeof setUserCameraState === 'function') setUserCameraState(from, false);
  if (floatingCameraPeerId === from) closeFloatingCamera();
}

async function leaveVoice() {
  const previouslyInVoice = inVoice;
  inVoice = false;

  const myId = getVoiceUserId();

  if (previouslyInVoice && audioChannel) {
    if (!isListenerMode) {
      await audioChannel.send({
        type: 'broadcast',
        event: 'speaker-left',
        payload: { from: myId }
      }).catch(() => {});
    }
    await audioChannel.send({
      type: 'broadcast',
      event: 'leave',
      payload: { from: myId }
    }).catch(() => {});
    try {
      sbClient.removeChannel(audioChannel);
    } catch (_) {}
    audioChannel = null;
  }

  if (previouslyInVoice) {
    localStream?.getTracks().forEach(t => t.stop());
    localStream = null;

    Object.entries(peers).forEach(([peerId, pc]) => {
      try { pc.close(); } catch (_) {}
      cleanupPeerMedia(peerId);
    });
    peers = {};
    iceQueues = {};

    closeFloatingCamera();
    clearAllVisualizers();
    participantLevels = {};
  }

  const videoGrid = document.getElementById('video-grid');
  if (videoGrid) {
    videoGrid.innerHTML = '';
    videoGrid.classList.add('hidden');
  }
  const localVideo = document.getElementById('local-video');
  if (localVideo) {
    localVideo.srcObject = null;
    localVideo.classList.add('hidden');
  }
  const peersList = document.getElementById('peers-list');
  if (peersList) peersList.innerHTML = '';

  document.getElementById('btn-join-voice')?.classList.remove('hidden');
  document.getElementById('btn-leave-voice')?.classList.add('hidden');
  document.getElementById('btn-mute')?.classList.add('hidden');
  document.getElementById('btn-toggle-camera')?.classList.add('hidden');
  document.getElementById('voice-visualizer')?.classList.add('hidden');

  const statusEl = document.getElementById('audio-status');
  if (statusEl) {
    statusEl.textContent = '🎙️ Voice: Off';
    statusEl.classList.remove('listener-mode');
  }

  if (previouslyInVoice) {
    isMuted = false;
    isCameraOn = false;
    isListenerMode = false;
    listenerQueue = [];
    voiceJoinAt = null;
    isPromotingSpeaker = false;

    if (typeof setLocalCameraState === 'function') {
      await setLocalCameraState(false);
    }
  }
}

function toggleMute() {
  if (!localStream) return;
  if (isListenerMode) {
    updateVoiceStatus();
    return;
  }
  const track = localStream.getAudioTracks()[0];
  if (!track) return;
  isMuted = !isMuted;
  track.enabled = !isMuted;
  const btnMute = document.getElementById('btn-mute');
  if (btnMute) btnMute.textContent = isMuted ? '🎙️ Unmute' : '🔇 Mute';
}

async function toggleCamera() {
  if (!inVoice || !localStream) return;

  const videoTracks = localStream.getVideoTracks();
  if (!videoTracks.length && !isCameraOn) {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = videoStream.getVideoTracks()[0];
      localStream.addTrack(videoTrack);
      attachVideoTrackToPeers(videoTrack);
      isCameraOn = true;
    } catch (e) {
      alert('Camera access denied. Please allow camera in your browser settings.');
      return;
    }
  } else {
    isCameraOn = !isCameraOn;
    localStream.getVideoTracks().forEach(track => {
      track.enabled = isCameraOn;
    });
  }

  updateVideoButtons();
  updateLocalPreview();
  if (typeof setLocalCameraState === 'function') {
    await setLocalCameraState(isCameraOn);
  }
  await broadcastCameraState();
}

function ensurePeerTile(peerId, username) {
  let tile = document.getElementById('video-tile-' + peerId);

  const grid = document.getElementById('video-grid');
  if (!tile && grid) {
    tile = document.createElement('div');
    tile.className = 'video-tile';
    tile.id = 'video-tile-' + peerId;

    const videoEl = document.createElement('video');
    videoEl.id = 'video-' + peerId;
    videoEl.autoplay = true;
    videoEl.playsInline = true;

    const label = document.createElement('span');
    label.className = 'video-label';
    label.textContent = username || 'User';

    tile.appendChild(videoEl);
    tile.appendChild(label);
    grid.appendChild(tile);
  }

  const cameraOn = typeof cameraStates !== 'undefined' ? !!cameraStates[peerId] : true;
  tile?.classList.toggle('hidden', !cameraOn);
  grid?.classList.remove('hidden');
  return tile?.querySelector('video');
}

function hidePeerTile(peerId) {
  document.getElementById('video-tile-' + peerId)?.classList.add('hidden');
}

function addPeerTag(peerId, username) {
  const existing = document.getElementById('peer-' + peerId);
  if (existing) return;

  const tag = document.createElement('div');
  tag.className = 'peer-tag';
  tag.id = 'peer-' + peerId;
  tag.innerHTML = `
    <span class="peer-name">🎙 ${escHtml(username || 'User')}</span>
    <canvas class="peer-soundbar mini-soundbar" data-user-id="${peerId}" width="32" height="10" aria-hidden="true"></canvas>
    <button type="button" class="peer-camera-btn hidden" data-peer-id="${peerId}" title="View camera">📷</button>
    <button type="button" class="peer-mute-btn" data-peer-id="${peerId}" title="Mute/Unmute peer">🔇</button>
  `;

  tag.querySelector('.peer-mute-btn')?.addEventListener('click', () => togglePeerMute(peerId));
  tag.querySelector('.peer-camera-btn')?.addEventListener('click', () => {
    openFloatingCamera(peerId, username || getUsernameById(peerId));
  });

  document.getElementById('peers-list')?.appendChild(tag);
}

function togglePeerMute(peerId) {
  peerMuted[peerId] = !peerMuted[peerId];
  const audioEl = peerAudioEls[peerId] || document.getElementById('audio-peer-' + peerId);
  if (audioEl) audioEl.volume = peerMuted[peerId] ? 0 : 1;
  const btn = document.getElementById('peer-' + peerId)?.querySelector('.peer-mute-btn');
  if (btn) btn.textContent = peerMuted[peerId] ? '🔊' : '🔇';
}

function updatePeerCameraIcon(peerId, cameraOn) {
  const btn = document.getElementById('peer-' + peerId)?.querySelector('.peer-camera-btn');
  if (btn) btn.classList.toggle('hidden', !cameraOn);
}

function cleanupPeerMedia(peerId) {
  delete peerStreams[peerId];
  const audioEl = peerAudioEls[peerId] || document.getElementById('audio-peer-' + peerId);
  if (audioEl) {
    audioEl.srcObject = null;
    audioEl.remove();
  }
  delete peerAudioEls[peerId];
  delete peerMuted[peerId];
  detachAnalyser(peerId);
  delete participantLevels[peerId];
}

function updateLocalPreview() {
  const localVideo = document.getElementById('local-video');
  const hasVideo = !!localStream?.getVideoTracks().length && isCameraOn;

  if (hasVideo) {
    if (localVideo) localVideo.srcObject = localStream;
    localVideo?.classList.remove('hidden');
  } else {
    if (localVideo) localVideo.srcObject = null;
    localVideo?.classList.add('hidden');
  }

  if (inVoice) {
    document.getElementById('video-grid')?.classList.remove('hidden');
  }
}

function updateVideoButtons() {
  const btnToggleCamera = document.getElementById('btn-toggle-camera');
  if (btnToggleCamera) btnToggleCamera.textContent = isCameraOn ? '📷 Camera Off' : '📷 Camera On';
}

function attachVideoTrackToPeers(videoTrack) {
  Object.values(peers).forEach((pc) => {
    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) sender.replaceTrack(videoTrack);
    else pc.addTrack(videoTrack, localStream);
  });
}

async function broadcastCameraState() {
  if (!audioChannel || !inVoice) return;
  const myId = getVoiceUserId();
  await audioChannel.send({
    type: 'broadcast',
    event: 'camera-state',
    payload: { from: myId, cameraOn: isCameraOn }
  }).catch(() => {});
}

function getVoicePresenceParticipants() {
  if (!audioChannel) return [];
  const state = audioChannel.presenceState();
  const users = [];
  Object.values(state).forEach((entries) => {
    (entries || []).forEach((entry) => {
      users.push({
        userId: entry.userId,
        username: entry.username || 'User',
        role: entry.role === 'listener' ? 'listener' : 'speaker',
        joinedAt: Number(entry.joinedAt) || 0
      });
    });
  });
  return users;
}

async function trackVoicePresence(role) {
  if (!audioChannel) return;
  const myId = getVoiceUserId();
  const myName = getVoiceUsername();
  await audioChannel.track({
    userId: myId,
    username: myName,
    role,
    joinedAt: voiceJoinAt || Date.now()
  }).catch(() => {});
}

function updateVoiceStatus(speakerCount = null) {
  const statusEl = document.getElementById('audio-status');
  if (!statusEl) return;
  const count = speakerCount ?? getVoicePresenceParticipants().filter(p => p.role === 'speaker').length;

  if (!inVoice) {
    statusEl.textContent = '🎙️ Voice: Off';
    statusEl.classList.remove('listener-mode');
    return;
  }

  const myId = getVoiceUserId();
  if (isListenerMode) {
    const pos = Math.max(1, listenerQueue.findIndex(item => item.userId === myId) + 1);
    statusEl.textContent = `👂 Voice: Listening (position ${pos}) • ⏳ Waiting for a slot… (${Math.min(count, MAX_VOICE_SPEAKERS)}/${MAX_VOICE_SPEAKERS} speakers active)`;
    statusEl.classList.add('listener-mode');
    return;
  }

  statusEl.textContent = '🎙️ Voice: Connected';
  statusEl.classList.remove('listener-mode');
}

async function promoteListenerToSpeaker() {
  if (!inVoice || !isListenerMode || isPromotingSpeaker) return;
  isPromotingSpeaker = true;
  try {
    isListenerMode = false;
    isMuted = false;
    const track = localStream?.getAudioTracks()[0];
    if (track) track.enabled = true;
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) btnMute.textContent = '🔇 Mute';
    await trackVoicePresence('speaker');
    updateVoiceStatus();
  } finally {
    isPromotingSpeaker = false;
  }
}

function maybePromoteFromListenerQueue() {
  if (!inVoice || !isListenerMode || !audioChannel) return;
  const myId = getVoiceUserId();
  const participants = getVoicePresenceParticipants();
  const speakers = participants.filter(p => p.role === 'speaker');
  const listeners = participants
    .filter(p => p.role === 'listener')
    .sort((a, b) => (a.joinedAt - b.joinedAt) || a.userId.localeCompare(b.userId));
  listenerQueue = listeners.map(item => ({ userId: item.userId, username: item.username }));
  if (speakers.length < MAX_VOICE_SPEAKERS && listeners[0]?.userId === myId) {
    promoteListenerToSpeaker();
  }
  updateVoiceStatus(speakers.length);
}

function syncVoiceRoleState() {
  if (!inVoice || !audioChannel) return;
  const myId = getVoiceUserId();
  const participants = getVoicePresenceParticipants();
  const speakers = participants.filter(p => p.role === 'speaker');
  const listeners = participants
    .filter(p => p.role === 'listener')
    .sort((a, b) => (a.joinedAt - b.joinedAt) || a.userId.localeCompare(b.userId));
  listenerQueue = listeners.map(item => ({ userId: item.userId, username: item.username }));

  const me = participants.find(p => p.userId === myId);
  if (!me) {
    const shouldListen = speakers.length >= MAX_VOICE_SPEAKERS;
    isListenerMode = shouldListen;
    const track = localStream?.getAudioTracks()[0];
    if (track) track.enabled = !shouldListen;
    isMuted = shouldListen;
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) btnMute.textContent = shouldListen ? '🎙️ Unmute' : '🔇 Mute';
    trackVoicePresence(shouldListen ? 'listener' : 'speaker').catch(() => {});
  } else {
    isListenerMode = me.role === 'listener';
    const track = localStream?.getAudioTracks()[0];
    if (track && isListenerMode) track.enabled = false;
  }

  maybePromoteFromListenerQueue();
  updateVoiceStatus(speakers.length);
}

function ensureAudioContext() {
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioCtx = AudioCtx ? new AudioCtx() : null;
  }
  if (audioCtx?.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function attachAnalyserForStream(userId, stream) {
  const ctx = ensureAudioContext();
  if (!ctx || !stream) return;

  detachAnalyser(userId);

  try {
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);

    analyserNodes[userId] = { source, analyser };
    analyserData[userId] = new Uint8Array(analyser.frequencyBinCount);
    participantLevels[userId] = 0;
  } catch (err) {
    console.warn('[Voice] attachAnalyser warning:', err);
  }
}

function detachAnalyser(userId) {
  const node = analyserNodes[userId];
  if (node) {
    try { node.source.disconnect(); } catch (_) {}
    try { node.analyser.disconnect(); } catch (_) {}
  }
  delete analyserNodes[userId];
  delete analyserData[userId];
}

function sampleAudioLevels() {
  Object.entries(analyserNodes).forEach(([userId, node]) => {
    const data = analyserData[userId];
    if (!data) return;
    node.analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    participantLevels[userId] = data.length ? (sum / data.length) / 255 : 0;
  });
}

function drawMainVisualizer() {
  const canvas = document.getElementById('voice-visualizer');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--accent').trim() || '#7c3aed';
  const accent2 = styles.getPropertyValue('--accent2').trim() || '#38c8e8';
  const accentRgb = styles.getPropertyValue('--accent-rgb').trim() || '124, 58, 237';

  const levels = Object.values(participantLevels);
  const maxLevel = levels.length ? Math.max(...levels) : 0;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = `rgba(${accentRgb},0.16)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const barWidth = canvas.width / VISUALIZER_BARS;
  for (let i = 0; i < VISUALIZER_BARS; i++) {
    const mod = Math.sin((performance.now() / 220) + i * 0.9) * 0.18;
    const barLevel = Math.max(0.06, Math.min(1, maxLevel + mod));
    const h = barLevel * canvas.height;
    ctx.fillStyle = i % 2 ? accent : accent2;
    ctx.fillRect(i * barWidth + 1, canvas.height - h, Math.max(2, barWidth - 2), h);
  }
}

function drawMiniSoundbars() {
  const bars = document.querySelectorAll('.mini-soundbar');
  if (!bars.length) return;
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--accent').trim() || '#7c3aed';
  const accent2 = styles.getPropertyValue('--accent2').trim() || '#38c8e8';
  const accentRgb = styles.getPropertyValue('--accent-rgb').trim() || '124, 58, 237';

  bars.forEach((canvas) => {
    const userId = canvas.dataset.userId;
    const level = participantLevels[userId] || 0;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = `rgba(${accentRgb},0.18)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const width = Math.max(2, Math.floor(level * canvas.width));
    ctx.fillStyle = level > 0.12 ? accent2 : accent;
    ctx.fillRect(0, 0, width, canvas.height);
  });
}

function visualizerTick() {
  sampleAudioLevels();
  drawMainVisualizer();
  drawMiniSoundbars();
  visualizerFrame = requestAnimationFrame(visualizerTick);
}

function startVisualizerLoop() {
  if (visualizerFrame) return;
  visualizerFrame = requestAnimationFrame(visualizerTick);
}

function clearAllVisualizers() {
  if (visualizerFrame) {
    cancelAnimationFrame(visualizerFrame);
    visualizerFrame = null;
  }

  Object.keys(analyserNodes).forEach(detachAnalyser);

  const main = document.getElementById('voice-visualizer');
  if (main) {
    const ctx = main.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, main.width, main.height);
  }

  document.querySelectorAll('.mini-soundbar').forEach((canvas) => {
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
}

function setupFloatingCameraWindow() {
  const floatingWindow = document.getElementById('floating-camera-window');
  const header = document.getElementById('floating-camera-header');
  const closeBtn = document.getElementById('floating-camera-close');
  if (!floatingWindow || !header || !closeBtn) return;

  closeBtn.onclick = closeFloatingCamera;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  header.onmousedown = (e) => {
    dragging = true;
    const rect = floatingWindow.getBoundingClientRect();
    floatingWindow.style.left = rect.left + 'px';
    floatingWindow.style.top = rect.top + 'px';
    floatingWindow.style.right = 'auto';
    floatingWindow.style.bottom = 'auto';
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  };

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    floatingWindow.style.left = `${Math.max(8, e.clientX - offsetX)}px`;
    floatingWindow.style.top = `${Math.max(56, e.clientY - offsetY)}px`;
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
  });
}

function openFloatingCamera(peerId, username) {
  const stream = peerStreams[peerId];
  const cameraOn = typeof cameraStates !== 'undefined' ? !!cameraStates[peerId] : true;
  if (!stream || !cameraOn) {
    appendSystemMessage?.(`${username || 'User'} camera is currently off.`);
    return;
  }

  const floatingWindow = document.getElementById('floating-camera-window');
  const video = document.getElementById('floating-camera-video');
  const title = document.getElementById('floating-camera-title');
  if (!floatingWindow || !video || !title) return;

  floatingCameraPeerId = peerId;
  title.textContent = `📷 ${username || getUsernameById(peerId)}`;
  video.srcObject = stream;
  floatingWindow.classList.remove('hidden');
  if (typeof broadcastCamView === 'function') broadcastCamView(peerId);
  if (typeof markSelfAsViewer === 'function') markSelfAsViewer(true);
}

function closeFloatingCamera() {
  const floatingWindow = document.getElementById('floating-camera-window');
  const video = document.getElementById('floating-camera-video');
  if (video) video.srcObject = null;
  if (floatingWindow) floatingWindow.classList.add('hidden');
  floatingCameraPeerId = null;
  if (typeof markSelfAsViewer === 'function') markSelfAsViewer(false);
}
