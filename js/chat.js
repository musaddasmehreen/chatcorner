let currentUser    = null;
let currentProfile = null;
let currentRoom    = null;
let messageChannel = null;
let presenceChannel= null;
let onlineUsers    = {};

window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  currentUser = session.user;

  let { data: prof } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();

  if (!prof) {
    const username = 'User_' + currentUser.id.substr(0,5);
    await supabase.from('profiles').insert({ id: currentUser.id, username, avatar_color: randomColor(), is_registered: false });
    ({ data: prof } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single());
  }

  currentProfile = prof;
  document.getElementById('user-badge').textContent = prof.username + (prof.is_registered ? ' ✓' : ' 👤');

  if (prof.is_registered) {
    document.getElementById('audio-bar').classList.remove('hidden');
  }

  await loadRooms();
});

async function loadRooms() {
  const { data: rooms } = await supabase.from('rooms').select('*').order('name');

  const textList  = document.getElementById('room-list');
  const voiceList = document.getElementById('voice-room-list');
  textList.innerHTML = '';
  voiceList.innerHTML = '';

  rooms.forEach(room => {
    const li = document.createElement('li');
    li.innerHTML = `${room.is_audio_enabled ? '🎙️' : '💬'} ${room.name}`;
    li.onclick = () => enterRoom(room);
    if (room.is_audio_enabled) voiceList.appendChild(li);
    else textList.appendChild(li);
  });

  if (rooms.length) enterRoom(rooms[0]);
}

async function enterRoom(room) {
  if (currentRoom?.id === room.id) return;

  if (messageChannel) supabase.removeChannel(messageChannel);
  if (presenceChannel) supabase.removeChannel(presenceChannel);
  if (typeof leaveVoice === 'function') leaveVoice();

  currentRoom = room;
  document.getElementById('current-room-name').textContent = '# ' + room.name;
  document.getElementById('messages').innerHTML = '';
  onlineUsers = {};

  document.querySelectorAll('.room-list li').forEach(li => {
    li.classList.toggle('active', li.textContent.includes(room.name));
  });

  const audioBar = document.getElementById('audio-bar');
  if (currentProfile?.is_registered && room.is_audio_enabled) {
    audioBar.classList.remove('hidden');
  } else {
    audioBar.classList.add('hidden');
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', room.id)
    .order('created_at', { ascending: true })
    .limit(50);

  messages?.forEach(m => appendMessage(m));
  scrollToBottom();

  messageChannel = supabase
    .channel('room:' + room.id)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `room_id=eq.${room.id}`
    }, payload => {
      appendMessage(payload.new);
      scrollToBottom();
    })
    .subscribe();

  presenceChannel = supabase.channel('presence:' + room.id, {
    config: { presence: { key: currentUser.id } }
  });

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      onlineUsers = {};
      Object.values(state).forEach(arr => arr.forEach(u => { onlineUsers[u.userId] = u; }));
      renderUserList();
    })
    .on('presence', { event: 'join' }, ({ newPresences }) => {
      newPresences.forEach(u => { onlineUsers[u.userId] = u; });
      renderUserList();
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
      leftPresences.forEach(u => delete onlineUsers[u.userId]);
      renderUserList();
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          userId:     currentUser.id,
          username:   currentProfile.username,
          color:      currentProfile.avatar_color,
          registered: currentProfile.is_registered
        });
      }
    });

  appendSystemMessage(`You joined #${room.name}`);
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text  = input.value.trim();
  if (!text || !currentRoom) return;

  input.value = '';

  await supabase.from('messages').insert({
    room_id:  currentRoom.id,
    user_id:  currentUser.id,
    username: currentProfile.username,
    content:  text,
    type:     'text'
  });
}

function appendMessage(msg) {
  if (msg.type === 'system') { appendSystemMessage(msg.content); return; }

  const isMe = msg.user_id === currentUser?.id;
  const div  = document.createElement('div');
  div.className = 'msg-row' + (isMe ? ' self' : '');

  const initial = (msg.username || '?')[0].toUpperCase();
  const color   = isMe ? (currentProfile?.avatar_color || '#7c3aed') : stringToColor(msg.username);

  div.innerHTML = `
    <div class="avatar" style="background:${color}">${initial}</div>
    <div class="msg-bubble">
      <div class="msg-username">${escHtml(msg.username || 'Unknown')}</div>
      <div class="msg-text">${escHtml(msg.content)}</div>
      <div class="msg-time">${formatTime(msg.created_at)}</div>
    </div>`;

  document.getElementById('messages').appendChild(div);
}

function appendSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg-system';
  div.textContent = '— ' + text + ' —';
  document.getElementById('messages').appendChild(div);
}

function renderUserList() {
  const ul = document.getElementById('user-list');
  ul.innerHTML = '';
  Object.values(onlineUsers).forEach(u => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="dot${u.registered ? '' : ' guest'}"></span>${escHtml(u.username)}${u.registered ? ' ✓' : ''}`;
    ul.appendChild(li);
  });
}

function scrollToBottom() {
  const el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function stringToColor(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#7c3aed','#06b6d4','#f59e0b','#10b981','#ef4444','#ec4899','#6366f1','#0ea5e9'];
  return colors[Math.abs(hash) % colors.length];
}

function randomColor() {
  const colors = ['#7c3aed','#06b6d4','#f59e0b','#10b981','#ef4444','#ec4899','#6366f1'];
  return colors[Math.floor(Math.random() * colors.length)];
}