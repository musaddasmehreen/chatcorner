// TERABOX BACKUP MODULE - Optimized for ChatCorner
const TERABOX_CREDS = btoa('chatroomcorner01@gmail.com:Hussain@#12');
const BACKUP_PROXY = 'https://chatcorner-proxy.onrender.com';
const BACKUP_INTERVAL = 12 * 60 * 60 * 1000;
const RETENTION_3M = 3 * 30 * 24 * 60 * 60 * 1000;

let backupQueue = [];
let isBackupRunning = false;

// Initialize backup on app start
async function initTeraboxBackup() {
  console.log('[BACKUP] System initialized');
  setTimeout(() => performDailyBackup(), BACKUP_INTERVAL);
  setInterval(performDailyBackup, BACKUP_INTERVAL);
}

// Main backup pipeline
async function performDailyBackup() {
  if (isBackupRunning) return;
  isBackupRunning = true;
  
  try {
    console.log('[BACKUP] Starting 12-hour cycle');
    const auth = await getTeraboxAuth();
    
    // Backup messages (text only - lean)
    await backupMessages(auth);
    
    // Backup user data (forever)
    await backupUserData(auth);
    
    // Process queued media
    await processMediaQueue(auth);
    
    // Cleanup old files (3 months)
    await cleanupRetention(auth);
    
    console.log('[BACKUP] Cycle complete');
  } catch (e) {
    console.error('[BACKUP ERROR]', e);
  } finally {
    isBackupRunning = false;
  }
}

// Get auth token (cached)
let cachedAuth = null;
async function getTeraboxAuth() {
  if (cachedAuth && cachedAuth.exp > Date.now()) return cachedAuth;
  
  const res = await fetch(`${BACKUP_PROXY}/auth`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${TERABOX_CREDS}` }
  });
  
  cachedAuth = await res.json();
  return cachedAuth;
}

// Backup message archives as single JSON file
async function backupMessages(auth) {
  const { data } = await supabase
    .from('message_archives')
    .select('*')
    .eq('backup_status', 'pending')
    .limit(5000);
  
  if (!data.length) return;
  
  const date = new Date().toISOString().split('T')[0];
  const filename = `messages-${date}.json`;
  const path = `/ChatCorner-Backup/messages/${filename}`;
  
  await uploadToTerabox(auth, path, JSON.stringify(data), 'json');
  
  // Mark as backed up
  await supabase
    .from('message_archives')
    .update({ backup_status: 'backed_up' })
    .eq('backup_status', 'pending');
}

// Backup user metadata (names, avatars - forever)
async function backupUserData(auth) {
  const { data: users } = await supabase
    .from('user_references')
    .select('*');
  
  if (!users.length) return;
  
  // Save user index
  const date = new Date().toISOString().split('T')[0];
  await uploadToTerabox(auth, `/ChatCorner-Backup/metadata/users-${date}.json`, 
    JSON.stringify(users), 'json');
  
  // Queue avatar backups
  for (const user of users) {
    if (user.avatar_url) {
      backupQueue.push({
        type: 'image',
        url: user.avatar_url,
        username: user.username,
        path: `/ChatCorner-Backup/images/${user.username}/avatar.png`
      });
    }
  }
}

// Process queued media (images/video/voice)
async function processMediaQueue(auth) {
  for (const item of backupQueue) {
    try {
      const blob = await fetch(item.url).then(r => r.blob());
      await uploadBlobTerabox(auth, item.path, blob);
      backupQueue.splice(backupQueue.indexOf(item), 1);
    } catch (e) {
      console.error('[MEDIA QUEUE]', e);
    }
  }
}

// Cleanup files older than 3 months (video/voice/gif only)
async function cleanupRetention(auth) {
  const { data: oldFiles } = await supabase
    .from('backup_logs')
    .select('terabox_path')
    .in('file_type', ['video', 'voice', 'gif'])
    .lt('created_at', new Date(Date.now() - RETENTION_3M).toISOString());
  
  for (const file of oldFiles || []) {
    await fetch(`${BACKUP_PROXY}/delete`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${auth.token}` },
      body: JSON.stringify({ path: file.terabox_path })
    });
  }
}

// Upload text to Terabox
async function uploadToTerabox(auth, path, content, type) {
  const res = await fetch(`${BACKUP_PROXY}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ path, content, type })
  });
  return res.json();
}

// Upload binary blob to Terabox
async function uploadBlobTerabox(auth, path, blob) {
  const buffer = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  
  return fetch(`${BACKUP_PROXY}/upload-blob`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ path, blob: base64, size: blob.size })
  }).then(r => r.json());
}

// Hook to capture media from WebRTC
async function queueMediaBackup(blob, type, username) {
  const ext = type === 'video' ? 'mp4' : type === 'voice' ? 'webm' : 'gif';
  const date = new Date().toISOString().split('T')[0];
  
  backupQueue.push({
    type,
    blob,
    username,
    path: `/ChatCorner-Backup/${type}s/${username}/${date}/${username}_${type}_${Date.now()}.${ext}`
  });
  
  // Log in database
  await supabase.from('backup_logs').insert({
    username,
    file_type: type,
    file_name: `${username}_${type}_${Date.now()}.${ext}`,
    file_size: blob.size,
    terabox_status: 'queued'
  });
}