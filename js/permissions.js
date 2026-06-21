/**
 * ChatCorner — Permissions Manager
 * Automatically requests all required browser permissions on page load.
 *
 * Priority Order:
 *  1. Notifications  (least friction)
 *  2. Microphone     (voice chat)
 *  3. Camera         (video chat)
 */

const PERMISSION_REQUEST_TIMEOUT_MS = 8000;
let permissionsRequestInFlight = null;

function getAllowButton() {
  return document.querySelector('.btn-allow');
}

function setAllowButtonState(text, disabled) {
  const btn = getAllowButton();
  if (!btn) return;
  btn.textContent = text;
  btn.disabled = disabled;
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} request timed out`)), timeoutMs);
    })
  ]);
}

async function requestMediaPermission(constraints, label) {
  if (!navigator.mediaDevices?.getUserMedia) return;
  const stream = await withTimeout(
    navigator.mediaDevices.getUserMedia(constraints),
    PERMISSION_REQUEST_TIMEOUT_MS,
    label
  );
  stream.getTracks().forEach((track) => track.stop());
}

async function requestNotificationPermission() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  await withTimeout(
    Notification.requestPermission(),
    PERMISSION_REQUEST_TIMEOUT_MS,
    'Notification'
  );
}

async function requestAllPermissions() {
  if (permissionsRequestInFlight) return permissionsRequestInFlight;

  permissionsRequestInFlight = (async () => {
    setAllowButtonState('⏳ Requesting...', true);

    try {
      // ── Priority 1: Notifications ──────────────────────────────────────────
      try {
        await requestNotificationPermission();
      } catch (e) {
        console.warn('Notification permission error:', e);
      }

      // ── Priority 2: Microphone ─────────────────────────────────────────────
      try {
        await requestMediaPermission({ audio: true, video: false }, 'Microphone');
      } catch (e) {
        console.warn('Microphone permission error:', e);
      }

      // ── Priority 3: Camera ─────────────────────────────────────────────────
      try {
        await requestMediaPermission({ audio: false, video: true }, 'Camera');
      } catch (e) {
        console.warn('Camera permission error:', e);
      }

      await updatePermissionIndicators();

      const allGranted = await areCorePermissionsGranted();
      if (allGranted) {
        setAllowButtonState('✅ Done!', false);
        localStorage.removeItem('cc_perms_dismissed');
        setTimeout(() => dismissPermissions(false), 900);
      } else {
        setAllowButtonState('Try Again', false);
      }
    } catch (error) {
      console.warn('Permissions request failed:', error);
      setAllowButtonState('Try Again', false);
    } finally {
      permissionsRequestInFlight = null;
    }
  })();

  return permissionsRequestInFlight;
}

function dismissPermissions(remember = true) {
  const banner = document.getElementById('permissions-banner');
  if (banner) banner.style.display = 'none';
  const backdrop = document.getElementById('permissions-backdrop');
  if (backdrop) backdrop.style.display = 'none';
  if (remember) localStorage.setItem('cc_perms_dismissed', '1');
}

async function updatePermissionIndicators() {
  try {
    const micResult  = await navigator.permissions.query({ name: 'microphone' });
    const camResult  = await navigator.permissions.query({ name: 'camera' });
    const notifState = ('Notification' in window) ? Notification.permission : 'denied';

    setIndicator('perm-notif', notifState);
    setIndicator('perm-mic',   micResult.state);
    setIndicator('perm-cam',   camResult.state);

    // live updates
    micResult.onchange  = () => setIndicator('perm-mic', micResult.state);
    camResult.onchange  = () => setIndicator('perm-cam', camResult.state);
  } catch (e) { /* permissions API not supported */ }
}

async function areCorePermissionsGranted() {
  try {
    const mic = await navigator.permissions.query({ name: 'microphone' });
    const cam = await navigator.permissions.query({ name: 'camera' });
    const notificationsGranted = ('Notification' in window)
      ? Notification.permission === 'granted'
      : true;
    return mic.state === 'granted' && cam.state === 'granted' && notificationsGranted;
  } catch (_) {
    return false;
  }
}

function setIndicator(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'perm-dot perm-' + state;          // granted | prompt | denied
  el.title = { granted: 'Allowed', prompt: 'Not yet allowed', denied: 'Blocked' }[state] || state;
}

async function initPermissionsBanner() {
  if (localStorage.getItem('cc_perms_dismissed') === '1') return;

  try {
    if (await areCorePermissionsGranted()) {
      dismissPermissions(false);
      return;
    }
  } catch (e) { /* permissions API unavailable — proceed to request */ }

  // Show the banner briefly so the user sees what's being requested
  const banner = document.getElementById('permissions-banner');
  if (banner) banner.style.display = 'flex';
  const backdrop = document.getElementById('permissions-backdrop');
  if (backdrop) backdrop.style.display = 'block';

  await updatePermissionIndicators();
  setAllowButtonState('✅ Allow All', false);
}

window.addEventListener('DOMContentLoaded', initPermissionsBanner);
