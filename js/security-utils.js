(() => {
  const CSRF_KEY = 'cc_csrf_token';
  const SESSION_KEY = 'cc_session_state';
  const LOGIN_STATE_KEY = 'cc_login_security_state';
  const MUTATION_WINDOW_MS = 10 * 60 * 1000;
  const LOGIN_WINDOW_MS = 60 * 1000;
  const LOGIN_MAX_ATTEMPTS = 3;
  const MESSAGE_WINDOW_MS = 10 * 1000;
  const MESSAGE_MAX_ATTEMPTS = 5;

  function now() {
    return Date.now();
  }

  function randomToken() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  function safeParse(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function escHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeText(value) {
    return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  }

  function ensureCsrfToken() {
    let token = sessionStorage.getItem(CSRF_KEY);
    if (!token) {
      token = randomToken();
      sessionStorage.setItem(CSRF_KEY, token);
    }
    return token;
  }

  function applyCsrfTokenToDom() {
    const token = ensureCsrfToken();
    document.querySelectorAll('input[data-csrf-token="true"]').forEach((input) => {
      input.value = token;
    });
  }

  function validateCsrfToken(token) {
    return Boolean(token) && token === sessionStorage.getItem(CSRF_KEY);
  }

  function validatePassword(password) {
    const value = String(password || '');
    if (value.length < 8) return { valid: false, message: 'Password must be at least 8 characters.' };
    if (!/[A-Z]/.test(value)) return { valid: false, message: 'Password must include at least one uppercase letter.' };
    if (!/[a-z]/.test(value)) return { valid: false, message: 'Password must include at least one lowercase letter.' };
    if (!/[0-9]/.test(value)) return { valid: false, message: 'Password must include at least one number.' };
    if (!/[^A-Za-z0-9]/.test(value)) return { valid: false, message: 'Password must include at least one special character.' };
    return { valid: true, message: '' };
  }

  function loadLoginState() {
    return safeParse(localStorage.getItem(LOGIN_STATE_KEY), { attempts: [] });
  }

  function saveLoginState(state) {
    localStorage.setItem(LOGIN_STATE_KEY, JSON.stringify(state));
  }

  function getLoginLock(loginId) {
    const key = String(loginId || '').toLowerCase();
    const state = loadLoginState();
    const recent = (state.attempts || []).filter((attempt) =>
      attempt.id === key && now() - attempt.ts < LOGIN_WINDOW_MS
    );
    if (recent.length < LOGIN_MAX_ATTEMPTS) return { locked: false, retryAfterMs: 0 };
    const excess = recent.length - LOGIN_MAX_ATTEMPTS + 1;
    const retryAfterMs = Math.min(5 * 60 * 1000, 10_000 * (2 ** excess));
    const lockStart = recent[LOGIN_MAX_ATTEMPTS - 1]?.ts || now();
    const remaining = Math.max(0, retryAfterMs - (now() - lockStart));
    return { locked: remaining > 0, retryAfterMs: remaining };
  }

  function recordLoginAttempt(loginId, ok) {
    const key = String(loginId || '').toLowerCase();
    const state = loadLoginState();
    const attempts = (state.attempts || []).filter((attempt) => now() - attempt.ts < 24 * 60 * 60 * 1000);
    if (ok) {
      state.attempts = attempts.filter((attempt) => attempt.id !== key);
      saveLoginState(state);
      return;
    }
    attempts.push({ id: key, ts: now() });
    state.attempts = attempts;
    saveLoginState(state);
  }

  function checkMessageRate(userId) {
    const key = `cc_msg_rate_${String(userId || 'anon')}`;
    const entries = safeParse(sessionStorage.getItem(key), []).filter((ts) => now() - ts < MESSAGE_WINDOW_MS);
    if (entries.length >= MESSAGE_MAX_ATTEMPTS) {
      return {
        allowed: false,
        retryAfterMs: Math.max(0, MESSAGE_WINDOW_MS - (now() - entries[0]))
      };
    }
    entries.push(now());
    sessionStorage.setItem(key, JSON.stringify(entries));
    return { allowed: true, retryAfterMs: 0 };
  }

  function validateMessage(value) {
    const raw = String(value ?? '');
    const trimmed = raw.trim();
    if (!trimmed) return { valid: false, message: 'Message cannot be empty.' };
    if (trimmed.length > 500) return { valid: false, message: 'Message must be 500 characters or less.' };
    return { valid: true, message: '', sanitized: sanitizeText(trimmed) };
  }

  function validateFileUpload(file, options = {}) {
    if (!file) return { valid: false, message: 'No file selected.' };
    const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
    const allowedMime = options.allowedMime ?? ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (file.size > maxBytes) return { valid: false, message: `File must be ${Math.floor(maxBytes / 1024 / 1024)}MB or smaller.` };
    if (!allowedMime.includes(file.type)) return { valid: false, message: 'Unsupported file type.' };
    return { valid: true, message: '' };
  }

  async function signRequest(payload) {
    const body = JSON.stringify(payload || {});
    const raw = body;
    if (window.crypto?.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return btoa(unescape(encodeURIComponent(raw))).slice(0, 128);
  }

  async function verifySignature(payload, signature) {
    if (!signature) return false;
    const expected = await signRequest(payload);
    return expected === signature;
  }

  function initSessionState() {
    const current = safeParse(sessionStorage.getItem(SESSION_KEY), null);
    if (current?.token && current?.lastActivity) return current;
    const state = { token: randomToken(), createdAt: now(), lastActivity: now(), expiresAt: now() + 30 * 60 * 1000 };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    return state;
  }

  function touchSession() {
    const state = initSessionState();
    state.lastActivity = now();
    state.expiresAt = now() + 30 * 60 * 1000;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    return state;
  }

  function isSessionExpired() {
    const state = safeParse(sessionStorage.getItem(SESSION_KEY), null);
    if (!state?.expiresAt) return false;
    return now() > state.expiresAt;
  }

  function clearSecuritySession() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(CSRF_KEY);
  }

  function isBotTrapped(value) {
    return String(value || '').trim().length > 0;
  }

  function validateMutationCsrf(token) {
    if (!validateCsrfToken(token)) {
      return { valid: false, message: 'Security token invalid. Refresh and try again.' };
    }
    if (isSessionExpired()) {
      return { valid: false, message: 'Session expired due to inactivity. Please log in again.' };
    }
    touchSession();
    return { valid: true, message: '' };
  }

  window.ChatSecurity = {
    ensureCsrfToken,
    applyCsrfTokenToDom,
    validateCsrfToken,
    validateMutationCsrf,
    sanitizeText,
    escapeHtml: escHtml,
    validatePassword,
    getLoginLock,
    recordLoginAttempt,
    checkMessageRate,
    validateMessage,
    validateFileUpload,
    signRequest,
    verifySignature,
    initSessionState,
    touchSession,
    isSessionExpired,
    clearSecuritySession,
    isBotTrapped,
    limits: {
      LOGIN_MAX_ATTEMPTS,
      LOGIN_WINDOW_MS,
      MESSAGE_MAX_ATTEMPTS,
      MESSAGE_WINDOW_MS,
      MUTATION_WINDOW_MS
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    ensureCsrfToken();
    applyCsrfTokenToDom();
    initSessionState();
    ['click', 'keydown', 'touchstart', 'input'].forEach((eventName) =>
      document.addEventListener(eventName, () => touchSession(), { passive: true })
    );
  });
})();
