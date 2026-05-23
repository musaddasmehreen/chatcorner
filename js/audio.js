let localStream    = null;
let peers          = {};
let audioChannel   = null;
let isMuted        = false;
let inVoice        = false;
let isVideoEnabled = true;
let isCameraOn     = true;

async function joinVoice() {
  if (!currentUser) {
    alert('🔒 Please log in to use voice chat.');
    return;
  }
  if (!currentRoom?.is_audio_enabled) return;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    isVideoEnabled = true;
    isCameraOn = true;
  } catch (e) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      isVideoEnabled = false;
      isCameraOn = false;
      alert('Camera access denied. Joined in audio-only mode.');
    } catch (audioErr) {
      alert('Microphone access denied. Please allow microphone in your browser settings.');
      return;
    }
  }

  inVoice = true;
  isMuted = false;
  document.getElementById('btn-join-voice').classList.add('hidden');
  document.getElementById('btn-leave-voice').classList.remove('hidden');
  document.getElementById('btn-mute').classList.remove('hidden');
  document.getElementById('btn-toggle-video').classList.remove('hidden');
  document.getElementById('btn-toggle-camera').classList.remove('hidden');
  document.getElementById('audio-status').textContent = '🎙️ Voice: Connected';
  document.getElementById('btn-mute').textContent = '🔇 Mute';

  updateVideoButtons();
  updateLocalPreview();

  audioChannel = sbClient.channel('voice:' + currentRoom.id);

  audioChannel
    .on('broadcast', { event: 'offer' },   ({ payload }) => handleOffer(payload))
    .on('broadcast', { event: 'answer' },  ({ payload }) => handleAnswer(payload))
    .on('broadcast', { event: 'ice' },     ({ payload }) => handleIce(payload))
    .on('broadcast', { event: 'join' },    ({ payload }) => handlePeerJoin(payload))
    .on('broadcast', { event: 'leave' },   ({ payload }) => handlePeerLeave(payload))
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await audioChannel.send({
          type: 'broadcast', event: 'join',
          payload: { from: currentUser.id, username: currentProfile.username }
        });
      }
    });
}

async function leaveVoice() {
  if (!inVoice) return;
  inVoice = false;

  if (audioChannel) {
    await audioChannel.send({
      type: 'broadcast', event: 'leave',
      payload: { from: currentUser.id }
    });
    sbClient.removeChannel(audioChannel);
    audioChannel = null;
  }

  localStream?.getTracks().forEach(t => t.stop());
  localStream = null;

  Object.values(peers).forEach(pc => pc.close());
  peers = {};

  document.getElementById('video-grid').innerHTML = '';
  document.getElementById('video-grid').classList.add('hidden');
  document.getElementById('local-video').srcObject = null;
  document.getElementById('local-video').classList.add('hidden');
  document.getElementById('peers-list').innerHTML = '';

  document.getElementById('btn-join-voice').classList.remove('hidden');
  document.getElementById('btn-leave-voice').classList.add('hidden');
  document.getElementById('btn-mute').classList.add('hidden');
  document.getElementById('btn-toggle-video').classList.add('hidden');
  document.getElementById('btn-toggle-camera').classList.add('hidden');
  document.getElementById('audio-status').textContent = '🎙️ Voice: Off';
}

function toggleMute() {
  if (!localStream) return;
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(t => (t.enabled = !isMuted));
  document.getElementById('btn-mute').textContent = isMuted ? '🎙️ Unmute' : '🔇 Mute';
}

async function toggleVideo() {
  if (!inVoice) return;

  isVideoEnabled = !isVideoEnabled;

  if (isVideoEnabled) {
    if (!localStream?.getVideoTracks().length) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        localStream.addTrack(videoTrack);
        Object.values(peers).forEach(pc => pc.addTrack(videoTrack, localStream));
      } catch (e) {
        isVideoEnabled = false;
        alert('Camera access denied. Staying in audio-only mode.');
      }
    }
    if (localStream?.getVideoTracks().length) isCameraOn = true;
  } else {
    isCameraOn = false;
  }

  localStream?.getVideoTracks().forEach(track => (track.enabled = isVideoEnabled && isCameraOn));
  updateVideoButtons();
  updateLocalPreview();
}

async function toggleCamera() {
  if (!inVoice) return;

  if (!localStream?.getVideoTracks().length) {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = videoStream.getVideoTracks()[0];
      localStream.addTrack(videoTrack);
      Object.values(peers).forEach(pc => pc.addTrack(videoTrack, localStream));
      isVideoEnabled = true;
      isCameraOn = true;
    } catch (e) {
      alert('Camera access denied. Please allow camera in your browser settings.');
      return;
    }
  } else {
    isCameraOn = !isCameraOn;
  }

  localStream?.getVideoTracks().forEach(track => (track.enabled = isVideoEnabled && isCameraOn));
  updateVideoButtons();
  updateLocalPreview();
}

async function handlePeerJoin({ from, username }) {
  if (from === currentUser.id || peers[from]) return;
  addPeerTag(from, username);
  const pc = createPeerConnection(from, username);
  peers[from] = pc;

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await audioChannel.send({
    type: 'broadcast', event: 'offer',
    payload: { from: currentUser.id, to: from, sdp: offer, username: currentProfile.username }
  });
}

async function handleOffer({ from, to, sdp, username }) {
  if (to !== currentUser.id) return;
  addPeerTag(from, username);

  const pc = createPeerConnection(from, username);
  peers[from] = pc;

  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await audioChannel.send({
    type: 'broadcast', event: 'answer',
    payload: { from: currentUser.id, to: from, sdp: answer }
  });
}

async function handleAnswer({ from, to, sdp }) {
  if (to !== currentUser.id || !peers[from]) return;
  await peers[from].setRemoteDescription(new RTCSessionDescription(sdp));
}

async function handleIce({ from, to, candidate }) {
  if (to !== currentUser.id || !peers[from]) return;
  try { await peers[from].addIceCandidate(new RTCIceCandidate(candidate)); } catch(e){}
}

function handlePeerLeave({ from }) {
  if (peers[from]) { peers[from].close(); delete peers[from]; }
  document.getElementById('peer-' + from)?.remove();
  document.getElementById('video-tile-' + from)?.remove();
}

function createPeerConnection(peerId, username) {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  localStream?.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.onicecandidate = async ({ candidate }) => {
    if (!candidate) return;
    await audioChannel.send({
      type: 'broadcast', event: 'ice',
      payload: { from: currentUser.id, to: peerId, candidate }
    });
  };

  pc.ontrack = ({ streams }) => {
    const stream = streams[0];
    const videoEl = ensurePeerTile(peerId, username);
    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
    }
  };

  pc.onconnectionstatechange = () => {
    if (['disconnected','failed','closed'].includes(pc.connectionState)) {
      handlePeerLeave({ from: peerId });
    }
  };

  return pc;
}

function ensurePeerTile(peerId, username) {
  let tile = document.getElementById('video-tile-' + peerId);
  if (!tile) {
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
    document.getElementById('video-grid').appendChild(tile);
  }

  document.getElementById('video-grid').classList.remove('hidden');
  return tile.querySelector('video');
}

function addPeerTag(peerId, username) {
  const existing = document.getElementById('peer-' + peerId);
  if (existing) return;
  const tag = document.createElement('span');
  tag.className = 'peer-tag';
  tag.id = 'peer-' + peerId;
  tag.textContent = '🎙 ' + (username || 'User');
  document.getElementById('peers-list').appendChild(tag);
}

function updateLocalPreview() {
  const localVideo = document.getElementById('local-video');
  const hasVideo = !!localStream?.getVideoTracks().length && isVideoEnabled && isCameraOn;
  if (hasVideo) {
    localVideo.srcObject = localStream;
    localVideo.classList.remove('hidden');
  } else {
    localVideo.classList.add('hidden');
  }
  if (inVoice) {
    document.getElementById('video-grid').classList.remove('hidden');
  }
}

function updateVideoButtons() {
  document.getElementById('btn-toggle-video').textContent = isVideoEnabled ? '🎥 Video Off' : '🎥 Video On';
  document.getElementById('btn-toggle-camera').textContent = isCameraOn ? '📷 Camera Off' : '📷 Camera On';
}
