// TERABOX BACKUP MODULE - Optimized for ChatCorner
const TERABOX_BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000;
const TERABOX_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const TERABOX_MAX_BATCH_SIZE = 5000;
const TERABOX_MAX_RETRIES = 3;

const teraboxState = {
  initialized: false,
  runningCycle: false,
  queueRunning: false,
  queue: [],
  auth: null,
  timers: {
    start: null,
    interval: null,
    queue: null
  },
  metrics: {
    queued: 0,
    uploaded: 0,
    failed: 0,
    retries: 0,
    lastCycleAt: null,
    lastCycleStatus: 'idle',
    lastError: null
  },
  options: {
    getUsername: () => 'anonymous'
  }
};

function getSupabaseClient() {
  if (globalThis.__chatcornerSupabase) return globalThis.__chatcornerSupabase;
  if (typeof supabase !== 'undefined') return supabase;
  return null;
}

function getBackupProxyUrl() {
  return globalThis.BACKUP_PROXY_URL || globalThis.CHATCORNER_BACKUP_PROXY || 'http://localhost:5000';
}

function getProxyHeaders() {
  const headers = {};
  if (globalThis.BACKUP_PROXY_API_KEY) {
    headers['x-api-key'] = globalThis.BACKUP_PROXY_API_KEY;
  }

  if (globalThis.TERABOX_EMAIL && globalThis.TERABOX_PASS) {
    headers.Authorization = `Basic ${btoa(`${globalThis.TERABOX_EMAIL}:${globalThis.TERABOX_PASS}`)}`;
  }

  return headers;
}

function getSafeUsername(raw) {
  return (raw || 'anonymous').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 80);
}

function getNext12HourBoundaryDelay() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  const currentUtcHour = now.getUTCHours();

  if (currentUtcHour < 12) {
    next.setUTCHours(12);
  } else {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0);
  }

  return Math.max(next.getTime() - now.getTime(), 0);
}

function trackError(scope, error) {
  teraboxState.metrics.lastError = `${scope}: ${error?.message || error || 'Unknown error'}`;
  console.error(`[TERABOX ${scope}]`, error);
}

async function callProxy(path, payload, authToken) {
  const response = await fetch(`${getBackupProxyUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getProxyHeaders(),
      ...(authToken ? { Authorization: 'Bearer ' + authToken } : {})
    },
    body: JSON.stringify(payload || {})
  });

  let body = {};
  try {
    body = await response.json();
  } catch (error) {
    // keep empty object
  }

  if (!response.ok) {
    throw new Error(body.error || `Proxy call failed (${response.status})`);
  }

  return body;
}

async function getTeraboxAuth() {
  if (teraboxState.auth && teraboxState.auth.exp > Date.now()) {
    return teraboxState.auth;
  }

  const authData = await callProxy('/auth', {
    cycle: new Date().toISOString().slice(0, 13)
  });

  if (!authData?.token || !authData?.exp) {
    throw new Error('Invalid auth payload from backup proxy');
  }

  teraboxState.auth = authData;
  return authData;
}

function enqueueBackup(item) {
  teraboxState.queue.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    attempts: 0,
    nextAttemptAt: Date.now(),
    ...item
  });
  teraboxState.metrics.queued += 1;
}

async function logBackupEntry(entry) {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.from('backup_logs').insert(entry);
  } catch (error) {
    trackError('LOG_INSERT', error);
  }
}

async function uploadJsonToTerabox(token, path, content) {
  return callProxy('/upload', { path, content, type: 'json' }, token);
}

async function uploadBlobToTerabox(token, path, blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return callProxy(
    '/upload-blob',
    {
      path,
      blob: btoa(binary),
      size: blob.size,
      mimeType: blob.type || 'application/octet-stream'
    },
    token
  );
}

async function backupMessages(token) {
  const client = getSupabaseClient();
  if (!client) return;

  const { data, error } = await client
    .from('message_archives')
    .select('*')
    .eq('backup_status', 'pending')
    .order('archived_at', { ascending: true })
    .limit(TERABOX_MAX_BATCH_SIZE);

  if (error || !data || !data.length) {
    if (error) trackError('MESSAGE_FETCH', error);
    return;
  }

  const timestamp = new Date().toISOString();
  const path = `/ChatCorner-Backup/messages/messages-${timestamp}.json`;

  await uploadJsonToTerabox(token, path, JSON.stringify(data));

  const ids = data.map((item) => item.id);
  await client.from('message_archives').update({ backup_status: 'backed_up' }).in('id', ids);

  await logBackupEntry({
    username: 'system',
    file_type: 'text',
    file_name: `messages-${timestamp}.json`,
    file_size: JSON.stringify(data).length,
    terabox_path: path,
    terabox_status: 'uploaded',
    uploaded_at: new Date().toISOString()
  });
}

async function backupUserData(token) {
  const client = getSupabaseClient();
  if (!client) return;

  const { data: users, error } = await client
    .from('user_references')
    .select('username, avatar_url, room_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(TERABOX_MAX_BATCH_SIZE);

  if (error) {
    trackError('USER_FETCH', error);
    return;
  }

  if (!users || !users.length) return;

  const timestamp = new Date().toISOString();
  await uploadJsonToTerabox(token, `/ChatCorner-Backup/metadata/users-${timestamp}.json`, JSON.stringify(users));

  users.forEach((user) => {
    if (!user.avatar_url) return;

    queueAvatarUrlBackup(user.avatar_url, user.username);
  });
}

async function cleanupRetention(token) {
  const client = getSupabaseClient();
  if (!client) return;

  const threshold = new Date(Date.now() - TERABOX_RETENTION_MS).toISOString();
  const { data: oldFiles, error } = await client
    .from('backup_logs')
    .select('id, username, file_name, terabox_path')
    .in('file_type', ['video', 'voice', 'gif'])
    .eq('terabox_status', 'uploaded')
    .lt('created_at', threshold)
    .limit(TERABOX_MAX_BATCH_SIZE);

  if (error) {
    trackError('RETENTION_FETCH', error);
    return;
  }

  for (const file of oldFiles || []) {
    if (!file.terabox_path) continue;

    try {
      await callProxy('/delete', { path: file.terabox_path }, token);
      await client
        .from('backup_logs')
        .update({ terabox_status: 'deleted' })
        .eq('id', file.id);
    } catch (error) {
      trackError('RETENTION_DELETE', error);
    }
  }
}

async function processQueueItem(token, item) {
  try {
    const blob = item.blob || (item.url ? await fetch(item.url).then((r) => r.blob()) : null);
    if (!blob) throw new Error('No media blob available for backup item');

    await uploadBlobToTerabox(token, item.path, blob);

    teraboxState.metrics.uploaded += 1;

    await logBackupEntry({
      username: item.username,
      file_type: item.type,
      file_name: item.fileName,
      file_size: blob.size,
      terabox_path: item.path,
      terabox_status: 'uploaded',
      uploaded_at: new Date().toISOString(),
      original_created_at: item.createdAt
    });
  } catch (error) {
    item.attempts += 1;

    if (item.attempts < TERABOX_MAX_RETRIES) {
      teraboxState.metrics.retries += 1;
      item.nextAttemptAt = Date.now() + item.attempts * 60 * 1000;
      teraboxState.queue.push(item);
    } else {
      teraboxState.metrics.failed += 1;
      await logBackupEntry({
        username: item.username,
        file_type: item.type,
        file_name: item.fileName,
        file_size: item.size || null,
        terabox_path: item.path,
        terabox_status: 'failed',
        original_created_at: item.createdAt
      });
      trackError('QUEUE_UPLOAD', error);
    }
  }
}

async function processMediaQueue() {
  if (teraboxState.queueRunning || !teraboxState.queue.length) return;

  teraboxState.queueRunning = true;

  try {
    const auth = await getTeraboxAuth();
    let processed = 0;

    while (teraboxState.queue.length && processed < 25) {
      const item = teraboxState.queue.shift();
      if (!item) break;
      if (item.nextAttemptAt > Date.now()) {
        teraboxState.queue.push(item);
        break;
      }

      await processQueueItem(auth.token, item);
      processed += 1;
    }
  } catch (error) {
    trackError('QUEUE_PROCESS', error);
  } finally {
    teraboxState.queueRunning = false;
  }
}

async function performBackupCycle() {
  if (teraboxState.runningCycle) return;

  teraboxState.runningCycle = true;
  teraboxState.metrics.lastCycleAt = new Date().toISOString();
  teraboxState.metrics.lastCycleStatus = 'running';

  try {
    const auth = await getTeraboxAuth();
    await backupMessages(auth.token);
    await backupUserData(auth.token);
    await processMediaQueue();
    await cleanupRetention(auth.token);
    teraboxState.metrics.lastCycleStatus = 'success';
  } catch (error) {
    teraboxState.metrics.lastCycleStatus = 'failed';
    trackError('CYCLE', error);
  } finally {
    teraboxState.runningCycle = false;
  }
}

function queueMediaBackup(blob, type, username) {
  if (!(blob instanceof Blob)) {
    return false;
  }

  const fileType = ['video', 'voice', 'gif', 'image'].includes(type) ? type : 'video';
  const extensionMap = {
    image: 'png',
    video: 'webm',
    voice: 'webm',
    gif: 'gif'
  };

  const safeUsername = getSafeUsername(username || teraboxState.options.getUsername());
  const date = new Date().toISOString().split('T')[0];
  const fileName = `${safeUsername}_${fileType}_${Date.now()}.${extensionMap[fileType]}`;
  const folderMap = {
    image: 'images',
    video: 'videos',
    voice: 'voices',
    gif: 'gifs'
  };

  enqueueBackup({
    type: fileType,
    blob,
    size: blob.size,
    username: safeUsername,
    createdAt: new Date().toISOString(),
    fileName,
    path: `/ChatCorner-Backup/${folderMap[fileType]}/${safeUsername}/${date}/${fileName}`
  });

  return true;
}

function queueAvatarUrlBackup(url, username) {
  if (!url) return false;

  const safeUsername = getSafeUsername(username || teraboxState.options.getUsername());
  enqueueBackup({
    type: 'image',
    url,
    username: safeUsername,
    createdAt: new Date().toISOString(),
    fileName: `avatar_${safeUsername}.png`,
    path: `/ChatCorner-Backup/images/${safeUsername}/avatar.png`
  });

  return true;
}

function captureWebRTCForBackup(stream, username) {
  if (!stream || typeof MediaRecorder === 'undefined') return;
  if (stream.__teraboxRecorderAttached) return;

  const hasVideo = stream.getVideoTracks().length > 0;
  const hasAudio = stream.getAudioTracks().length > 0;
  if (!hasVideo && !hasAudio) return;

  let recorder;
  const mimeCandidates = hasVideo
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['audio/webm;codecs=opus', 'audio/webm'];

  const mimeType = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));

  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch (error) {
    trackError('RECORDER_INIT', error);
    return;
  }

  stream.__teraboxRecorderAttached = true;

  recorder.addEventListener('dataavailable', (event) => {
    if (!event.data || event.data.size === 0) return;
    queueMediaBackup(event.data, hasVideo ? 'video' : 'voice', username);
  });

  recorder.addEventListener('error', (event) => {
    trackError('RECORDER_STREAM', event.error || event);
  });

  recorder.start(60 * 1000);

  const stopRecorder = () => {
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  stream.getTracks().forEach((track) => {
    track.addEventListener('ended', stopRecorder, { once: true });
  });
}

async function initTeraboxBackup(options = {}) {
  if (teraboxState.initialized) return;

  teraboxState.initialized = true;
  teraboxState.options = { ...teraboxState.options, ...options };

  const firstDelay = getNext12HourBoundaryDelay();

  if (teraboxState.timers.start) clearTimeout(teraboxState.timers.start);
  if (teraboxState.timers.interval) clearInterval(teraboxState.timers.interval);
  if (teraboxState.timers.queue) clearInterval(teraboxState.timers.queue);

  teraboxState.timers.start = setTimeout(async () => {
    await performBackupCycle();
    teraboxState.timers.interval = setInterval(performBackupCycle, TERABOX_BACKUP_INTERVAL_MS);
  }, firstDelay);

  teraboxState.timers.queue = setInterval(processMediaQueue, 30 * 1000);

  // Non-blocking startup cycle to prime auth cache and detect errors early
  Promise.resolve().then(() => performBackupCycle());

  console.log('[TERABOX] Backup integration initialized');
}

function getTeraboxBackupStatus() {
  return {
    queueLength: teraboxState.queue.length,
    authCached: Boolean(teraboxState.auth && teraboxState.auth.exp > Date.now()),
    nextCycleInMs: getNext12HourBoundaryDelay(),
    ...teraboxState.metrics
  };
}

window.initTeraboxBackup = initTeraboxBackup;
window.queueMediaBackup = queueMediaBackup;
window.queueAvatarUrlBackup = queueAvatarUrlBackup;
window.captureWebRTCForBackup = captureWebRTCForBackup;
window.getTeraboxBackupStatus = getTeraboxBackupStatus;
