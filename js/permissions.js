/**
 * ChatCorner — Permissions Manager
 * Automatically requests all required browser permissions on page load.
 *
 * Priority Order:
 *  1. Notifications  (least friction)
 *  2. Microphone     (voice chat)
 *  3. Camera         (video chat)
 */

async function requestAllPermissions() {
  const btn = document.querySelector('.btn-allow');
  if (btn) { btn.textContent = '⏳ Requesting…'; btn.disabled = true; }

  // ── Priority 1: Notifications ──────────────────────────────────────────────
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch (e) { console.warn('Notification permission error:', e); }

  // ── Priority 2: Microphone ─────────────────────────────────────────────────
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach(t => t.stop());
  } catch (e) { console.warn('Microphone permission error:', e); }

  // ── Priority 3: Camera ─────────────────────────────────────────────────────
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    stream.getTracks().forEach(t => t.stop());
  } catch (e) { console.warn('Camera permission error:', e); }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (btn) { btn.textContent = '✅ Done!'; btn.disabled = false; }
  await updatePermissionIndicators();
  setTimeout(() => dismissPermissions(), 1500);
}

function dismissPermissions() {
  const banner = document.getElementById('permissions-banner');
  if (banner) banner.style.display = 'none';
  localStorage.setItem('cc_perms_dismissed', '1');
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

function setIndicator(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'perm-dot perm-' + state;          // granted | prompt | denied
  el.title = { granted: 'Allowed', prompt: 'Not yet allowed', denied: 'Blocked' }[state] || state;
}

async function initPermissionsBanner() {
  try {
    const mic = await navigator.permissions.query({ name: 'microphone' });
    const cam = await navigator.permissions.query({ name: 'camera' });
    // If both already granted, nothing to do — hide the banner and return
    if (mic.state === 'granted' && cam.state === 'granted' &&
        ('Notification' in window ? Notification.permission !== 'default' : true)) {
      dismissPermissions();
      return;
    }
  } catch (e) { /* permissions API unavailable — proceed to request */ }

  // Show the banner briefly so the user sees what's being requested
  const banner = document.getElementById('permissions-banner');
  if (banner) banner.style.display = 'flex';

  await updatePermissionIndicators();

  // Automatically trigger permission requests without waiting for a button click
  await requestAllPermissions();
}

window.addEventListener('DOMContentLoaded', initPermissionsBanner);
