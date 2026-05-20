let localStream    = null;
let peers          = {};
let audioChannel   = null;
let isMuted        = false;
let inVoice        = false;

async function joinVoice() {
  if (!currentProfile?.is_registered) {
    alert('🔒 Voice chat is available for registered users only. Create a free account!');
    return;
  }
  if (!currentRoom?.is_audio_enabled) return;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (e) {
    alert('Microphone access denied. Please allow microphone in your browser settings.');
    return;
  }

  inVoice = true;
  document.getElementById('btn-join-voice').classList.add('hidden');
  document.getElementById('btn-leave-voice').classList.remove('hidden');
  document.getElementById('btn-mute').classList.remove('hidden');
  document.getElementById('audio-status').textContent = '🎙️ Voice: Connected';

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

  document.getElementById('audio-elements').innerHTML = '';
  document.getElementById('peers-list').innerHTML = '';

  document.getElementById('btn-join-voice').classList.remove('hidden');
  document.getElementById('btn-leave-voice').classList.add('hidden');
  document.getElementById('btn-mute').classList.add('hidden');
  document.getElementById('audio-status').textContent = '🎙️ Voice: Off';
}

function toggleMute() {
  if (!localStream) return;
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(t => (t.enabled = !isMuted));
  document.getElementById('btn-mute').textContent = isMuted ? '🎙️ Unmute' : '🔇 Mute';
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
  document.getElementById('audio-' + from)?.remove();
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
    const audioEl = document.createElement('audio');
    audioEl.id     = 'audio-' + peerId;
    audioEl.srcObject = streams[0];
    audioEl.autoplay  = true;
    document.getElementById('audio-elements').appendChild(audioEl);
  };

  pc.onconnectionstatechange = () => {
    if (['disconnected','failed','closed'].includes(pc.connectionState)) {
      handlePeerLeave({ from: peerId });
    }
  };

  return pc;
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
