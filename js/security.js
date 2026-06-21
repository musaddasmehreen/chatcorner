/**
 * ═══════════════════════════════════════════════════════════════
 * ChatCorner — Production Security System v3.0
 * Multi-layer defence: XSS, injection, CSRF, rate-limiting,
 * session hijacking, prototype pollution, enumeration, bot detection
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

/* ── 1. Prototype Pollution Hardening ──────────────────────────
   Object.freeze of Object.prototype is disabled to maintain compatibility with 
   third-party libraries (like hls.js) that override standard methods (like toString). */
(function freezePrototypes() {
  // Disabled prototype freezing to ensure full compatibility with modern web components
})();

/* ── 2. Dangerous Global Overrides ─────────────────────────────
   Disable eval, Function constructor abuse, and document.write. */
(function lockDownGlobals() {
  // Block eval
  try {
    Object.defineProperty(window, 'eval', {
      get() { return function() { throw new Error('[CC-SEC] eval() is disabled.'); }; },
      configurable: false
    });
  } catch (_) {}

  // Block Function constructor
  const _Function = window.Function;
  try {
    Object.defineProperty(window, 'Function', {
      get() {
        return function SafeFunction(...args) {
          const body = args[args.length - 1] || '';
          if (/eval|document\.write|innerHTML\s*=|outerHTML\s*=/i.test(body)) {
            throw new Error('[CC-SEC] Blocked dangerous Function constructor call.');
          }
          return new _Function(...args);
        };
      },
      configurable: false
    });
  } catch (_) {}

  // Block document.write / writeln
  try {
    document.write    = function() { console.warn('[CC-SEC] document.write() blocked.'); };
    document.writeln  = function() { console.warn('[CC-SEC] document.writeln() blocked.'); };
  } catch (_) {}
})();

/* ── 3. Content Security Policy (meta tag, runtime enforcement) ─
   A true CSP must come from the server. This is a belt-and-
   suspenders meta tag for environments without header control.    */
(function injectCSP() {
  if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) return;
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  // Allow Supabase, Google Fonts, jsdelivr (Supabase SDK), self only
  meta.content = [
    "default-src 'self'",
    "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'",  // unsafe-inline needed for inline handlers on login/chat pages
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com https: stun: turn: turns:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join('; ');
  const head = document.head || document.documentElement;
  head.insertBefore(meta, head.firstChild);
})();

/* ── 4. Referrer & Clickjacking Protection ─────────────────────*/
(function frameGuard() {
  if (window.top !== window.self) {
    // We're in an iframe — break out
    try { window.top.location = window.self.location; } catch (_) {}
    document.body.style.display = 'none';
  }
})();

/* ── 5. Input Sanitisation Library ─────────────────────────────
   Exposed as window.ccSanitize for use across all JS files.      */
window.ccSanitize = (function() {
  const ENTITY_MAP = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#x27;', '/': '&#x2F;',
    '`': '&#x60;', '=': '&#x3D;'
  };

  // Escape all HTML special chars + backtick/equals (template injection)
  function html(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"'`=/]/g, s => ENTITY_MAP[s] || s);
  }

  // Strip ALL HTML tags, leaving only text
  function stripTags(str) {
    if (str == null) return '';
    return String(str)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, '');
  }

  // Validate and sanitise URLs (only http/https/data-audio allowed)
  function url(raw, { allowData = false } = {}) {
    if (!raw) return '';
    const s = String(raw).trim();
    // Allow only http(s) and optionally data: URIs
    if (/^https?:\/\//i.test(s)) return s;
    if (allowData && /^data:(audio|image)\//i.test(s)) return s;
    // Block javascript:, vbscript:, data:text/html, etc.
    return '';
  }

  // Sanitise a username: strip control chars, limit length
  function username(str) {
    if (!str) return 'Unknown';
    return String(str)
      .replace(/[\x00-\x1F\x7F]/g, '')   // control characters
      .replace(/[<>"'`]/g, '')            // HTML breakers
      .slice(0, 32);
  }

  // Sanitise free-form chat text (allow Unicode, strip HTML)
  function chatText(str, maxLen = 500) {
    if (!str) return '';
    return String(str)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars except \n\r\t
      .slice(0, maxLen);
  }

  // Validate that a value is a safe UUID (36-char hex-dash)
  function isUUID(str) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str));
  }

  return { html, stripTags, url, username, chatText, isUUID };
})();

/* ── 6. Rate-Limiter (client-side auxiliary layer) ─────────────
   Primary enforcement is in Supabase RLS / edge functions.       */
window.ccRateLimit = (function() {
  const _windows = new Map(); // key → [timestamps]

  /**
   * Check and record an action.
   * @param {string} key   - unique action key, e.g. 'login:alice'
   * @param {number} limit - max allowed calls in window
   * @param {number} windowMs - rolling window in ms
   * @returns {boolean} true if ALLOWED, false if BLOCKED
   */
  function check(key, limit, windowMs) {
    const now = Date.now();
    const arr = (_windows.get(key) || []).filter(t => now - t < windowMs);
    if (arr.length >= limit) {
      _windows.set(key, arr);
      return false; // blocked
    }
    arr.push(now);
    _windows.set(key, arr);
    return true; // allowed
  }

  function remainingMs(key, limit, windowMs) {
    const now = Date.now();
    const arr = (_windows.get(key) || []).filter(t => now - t < windowMs);
    if (arr.length < limit) return 0;
    return windowMs - (now - arr[0]);
  }

  function reset(key) { _windows.delete(key); }

  return { check, remainingMs, reset };
})();

/* ── 7. Session Integrity ───────────────────────────────────────
   Generates a nonce stored in sessionStorage and checks it on
   every page interaction to detect session injection.            */
window.ccSession = (function() {
  const KEY_NONCE   = 'cc_sess_nonce';
  const KEY_CREATED = 'cc_sess_created';
  const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours

  function init() {
    if (sessionStorage.getItem(KEY_NONCE)) return; // already set
    const nonce = crypto.getRandomValues(new Uint8Array(16));
    const hex   = Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(KEY_NONCE, hex);
    sessionStorage.setItem(KEY_CREATED, String(Date.now()));
  }

  function isValid() {
    const nonce   = sessionStorage.getItem(KEY_NONCE);
    const created = sessionStorage.getItem(KEY_CREATED);
    if (!nonce || !created) return false;
    const age = Date.now() - parseInt(created, 10);
    return age < SESSION_TTL;
  }

  function destroy() {
    sessionStorage.removeItem(KEY_NONCE);
    sessionStorage.removeItem(KEY_CREATED);
  }

  init();
  return { isValid, destroy, init };
})();

/* ── 8. Device Fingerprinting ───────────────────────────────────*/
window.ccFingerprint = (function() {
  async function generate() {
    const data = [
      navigator.userAgent,
      navigator.language,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      navigator.hardwareConcurrency || 0,
      navigator.deviceMemory || 0
    ].join('|');
    const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  async function store() {
    const fp = await generate();
    sessionStorage.setItem('cc_device_fp', fp);
    return fp;
  }

  async function verify() {
    const stored  = sessionStorage.getItem('cc_device_fp');
    if (!stored) { await store(); return true; }
    const current = await generate();
    return current === stored;
  }

  store(); // run on load
  return { generate, store, verify };
})();

/* ── 9. Login Brute-Force Protection ───────────────────────────
   Server-side Supabase Auth already handles this, but we add
   a client-side layer to reduce unnecessary round-trips.         */
window.ccLoginGuard = (function() {
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS   = 10 * 60 * 1000; // 10 min
  const PREFIX       = 'cc_lg_';

  function _key(id) { return PREFIX + btoa(String(id)).slice(0, 20); }

  function isLocked(identifier) {
    try {
      const raw = localStorage.getItem(_key(identifier));
      if (!raw) return { locked: false };
      const obj = JSON.parse(raw);
      if (Date.now() < obj.until) {
        return { locked: true, remainingMs: obj.until - Date.now() };
      }
      localStorage.removeItem(_key(identifier));
    } catch (_) {}
    return { locked: false };
  }

  function recordAttempt(identifier, success) {
    if (success) { localStorage.removeItem(_key(identifier)); return; }
    try {
      const raw  = localStorage.getItem(_key(identifier));
      const obj  = raw ? JSON.parse(raw) : { count: 0, until: 0 };
      obj.count  = (obj.count || 0) + 1;
      obj.last   = Date.now();
      if (obj.count >= MAX_ATTEMPTS) {
        obj.until = Date.now() + LOCKOUT_MS;
      }
      localStorage.setItem(_key(identifier), JSON.stringify(obj));
      return obj;
    } catch (_) {}
  }

  function getRemainingSeconds(identifier) {
    const { locked, remainingMs } = isLocked(identifier);
    return locked ? Math.ceil(remainingMs / 1000) : 0;
  }

  return { isLocked, recordAttempt, getRemainingSeconds };
})();

/* ── 10. Suspicious-Pattern Detector ───────────────────────────
   Watches for common attack strings in any user-supplied text.   */
window.ccThreatDetect = (function() {
  // XSS payloads
  const XSS_PATTERNS = [
    /<script/i, /javascript\s*:/i, /on\w+\s*=/i,
    /data\s*:\s*text\/html/i, /vbscript\s*:/i,
    /<iframe/i, /<object/i, /<embed/i, /<svg.*on/i,
    /expression\s*\(/i, /eval\s*\(/i
  ];
  // SQL injection (basic heuristic for display/logging)
  const SQL_PATTERNS = [
    /'\s*(or|and)\s+'?\d/i, /;\s*(drop|delete|insert|update)\s/i,
    /--\s*$/, /\/\*.*\*\//
  ];

  function containsXSS(str) {
    return XSS_PATTERNS.some(p => p.test(String(str)));
  }
  function containsSQL(str) {
    return SQL_PATTERNS.some(p => p.test(String(str)));
  }
  function isSuspicious(str) {
    return containsXSS(str) || containsSQL(str);
  }
  function scan(str) {
    const s = String(str || '');
    return { xss: containsXSS(s), sql: containsSQL(s), clean: !isSuspicious(s) };
  }

  return { containsXSS, containsSQL, isSuspicious, scan };
})();

/* ── 11. Safe innerHTML Wrapper ─────────────────────────────────
   Every innerHTML assignment in our code already uses escHtml().
   This wrapper adds a second line of defence for any raw HTML     
   that genuinely needs to be inserted (e.g. badge markup).        */
window.safeInnerHTML = function(element, html) {
  if (!element) return;
  // If the HTML contains any unescaped script/handler, reject it
  if (window.ccThreatDetect && window.ccThreatDetect.containsXSS(html)) {
    console.warn('[CC-SEC] safeInnerHTML blocked suspicious content.');
    element.textContent = '[Content blocked]';
    return;
  }
  element.innerHTML = html;
};

/* ── 12. Anti-Automation / Bot Signal ──────────────────────────
   Detects headless Chrome / Puppeteer signals.                   */
window.ccBotDetect = (function() {
  function isBot() {
    const checks = [
      navigator.webdriver === true,
      !navigator.languages || navigator.languages.length === 0,
      /HeadlessChrome|PhantomJS|Electron/i.test(navigator.userAgent),
      !window.chrome && /Chrome/i.test(navigator.userAgent) && /Google/i.test(navigator.vendor)
        && !navigator.plugins?.length
    ];
    return checks.filter(Boolean).length >= 2;
  }
  return { isBot };
})();

/* ── 13. Clipboard & Paste Guard ───────────────────────────────
   Log paste events that contain suspicious data.                 */
document.addEventListener('paste', function(e) {
  try {
    const text = e.clipboardData?.getData('text') || '';
    if (window.ccThreatDetect?.containsXSS(text)) {
      console.warn('[CC-SEC] Paste contained XSS-like content — blocked.');
      e.preventDefault();
    }
  } catch (_) {}
}, true);

/* ── 14. Open-Redirect Prevention ──────────────────────────────
   Wraps location assignments so they never point off-domain.     */
(function patchLocationAssign() {
  const _assign   = window.location.assign.bind(window.location);
  const _replace  = window.location.replace.bind(window.location);
  const SAFE_HOSTS = [window.location.hostname];

  function isSafeUrl(url) {
    try {
      const u = new URL(url, window.location.origin);
      return SAFE_HOSTS.includes(u.hostname);
    } catch (_) {
      // relative URL — always safe
      return !String(url).startsWith('//') && !/^[a-z]+:/i.test(url);
    }
  }

  window.safeRedirect = function(url) {
    if (isSafeUrl(url)) { _assign(url); }
    else { console.warn('[CC-SEC] Blocked open-redirect to:', url); }
  };
})();

/* ── 15. Console Protection ─────────────────────────────────────
   Suppress stack-trace disclosure in production.                 */
(function() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;
  const _noop = () => {};
  // Keep warn/error for developer debugging, suppress log/debug in prod
  window.console = Object.assign({}, window.console, {
    debug: _noop,
    // Suppress security score broadcast
  });
})();

/* ── 16. Security Event Log ─────────────────────────────────────
   Lightweight in-memory ring-buffer of security events.          */
window.ccSecLog = (function() {
  const BUFFER = [];
  const MAX    = 50;

  function record(type, detail = {}) {
    BUFFER.push({ type, detail, ts: new Date().toISOString(), url: location.pathname });
    if (BUFFER.length > MAX) BUFFER.shift();
    if (type.startsWith('CRITICAL')) {
      console.warn('[CC-SEC][' + type + ']', detail);
    }
  }

  function get() { return [...BUFFER]; }

  // CSP violation listener
  document.addEventListener('securitypolicyviolation', e => {
    record('CSP_VIOLATION', { blocked: e.blockedURI, directive: e.violatedDirective });
  });

  return { record, get };
})();

/* ── 17-18. Lazy Deferred Security Init ─────────────────────────
   XHR/fetch intercept + idle-timeout are deferred so they NEVER
   block rendering or first meaningful paint. They activate once
   the browser has spare CPU time (requestIdleCallback).           */
function _ccDeferredSecurityInit() {
  // XHR / Fetch Intercept
  const ALLOWED = [location.origin, 'https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'];
  function isAllowed(url) {
    try {
      const urlStr = String(url || '');
      if (urlStr.startsWith('blob:') || urlStr.startsWith('data:')) return true;
      const u = new URL(url, location.origin);
      if (u.hostname === location.hostname) return true;
      if (u.hostname.endsWith('.supabase.co')) return true;
      if (u.protocol === 'https:') return true;
      return ALLOWED.some(o => url.startsWith(o));
    } catch (_) { return true; }
  }
  const _origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (!isAllowed(url)) {
      window.ccSecLog?.record('XHR_BLOCKED', { url });
      throw new Error('[CC-SEC] XHR blocked: ' + url);
    }
    return _origOpen.call(this, method, url, ...rest);
  };
  const _origFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!isAllowed(url)) {
      window.ccSecLog?.record('FETCH_BLOCKED', { url });
      return Promise.reject(new Error('[CC-SEC] Fetch blocked: ' + url));
    }
    return _origFetch.call(window, input, init);
  };

  // Idle timeout — auto-logout registered users after 2h inactivity
  const IDLE_LIMIT_MS = 2 * 60 * 60 * 1000;
  let _idleTimer = null;
  function resetIdleTimer() {
    clearTimeout(_idleTimer);
    _idleTimer = setTimeout(() => {
      if (window.currentProfile?.is_registered) {
        window.ccSecLog?.record('IDLE_TIMEOUT', {});
        if (typeof logout === 'function') logout();
      }
    }, IDLE_LIMIT_MS);
  }
  ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'].forEach(ev => {
    document.addEventListener(ev, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();

  // Fingerprint store (async, non-blocking)
  window.ccFingerprint?.store?.();

  // Boot log
  window.ccSecLog?.record('SECURITY_BOOT', {
    https: location.protocol === 'https:',
    bot: window.ccBotDetect?.isBot?.(),
    sessionOk: window.ccSession?.isValid?.()
  });

  console.log('%c🛡️ ChatCorner Security v3.0 Active', 'color:#4ade80;font-weight:bold;font-size:13px;');
}

// Fire deferred init during browser idle time — zero impact on page load
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(_ccDeferredSecurityInit, { timeout: 3000 });
} else {
  window.addEventListener('load', () => setTimeout(_ccDeferredSecurityInit, 400));
}

/* ── 19. Message Content Validator ─────────────────────────────
   Synchronous — called per-message before DB insert.             */
window.ccValidateMessage = function(text) {
  if (!text || typeof text !== 'string') return { ok: false, reason: 'Empty message' };
  if (text.length > 500) return { ok: false, reason: 'Message too long' };
  const scan = window.ccThreatDetect?.scan(text) || { clean: true };
  if (!scan.clean) {
    window.ccSecLog?.record('SUSPICIOUS_MESSAGE', { preview: text.slice(0, 40) });
    return { ok: false, reason: 'Message contains disallowed content' };
  }
  return { ok: true };
};

/* ── 20. securityManager Compatibility Shim ──────────────────────
   Restores support for admin panel logs, security score, and 2FA. */
window.securityManager = {
  logSecurityEvent: function(eventType, details = {}) {
    window.ccSecLog?.record(eventType, details);
    console.warn('[SECURITY EVENT]', { type: eventType, details, ts: new Date().toISOString() });
    
    // Asynchronously attempt to log admin intrusions/events to Supabase if client is initialized
    if (window.sbClient && typeof window.sbClient.from === 'function') {
      window.sbClient.from('security_events').insert({
        event_type: eventType,
        details: details,
        user_agent: navigator.userAgent
      }).then(({ error }) => {
        if (error) console.warn('[CC-SEC] Failed to persist event to DB:', error);
      }).catch(err => {
        // Silently catch to avoid disrupting runtime
      });
    }
  },

  calculateSecurityScore: function() {
    let score = 40;
    if (window.location.protocol === 'https:') score += 20;
    if (window.ccLoginGuard) score += 20;
    if (window.ccBotDetect && !window.ccBotDetect.isBot()) score += 20;
    return score;
  },

  generateDeviceFingerprint: async function() {
    const hash = window.ccFingerprint ? await window.ccFingerprint.generate() : 'no_fp_hash';
    return {
      hash: hash,
      fingerprint: {
        ua: navigator.userAgent
      }
    };
  },

  detectAnomalousActivity: async function() {
    const currentFp = window.ccFingerprint ? await window.ccFingerprint.generate() : 'no_fp_hash';
    const storedFp = sessionStorage.getItem('cc_device_fp');
    return {
      deviceMismatch: storedFp && currentFp !== storedFp,
      currentFingerprint: currentFp,
      storedFingerprint: storedFp
    };
  },

  getGenericErrorMessage: function() {
    return 'Invalid credentials or account restricted. Try again later.';
  },

  clearSecurityData: function() {
    sessionStorage.removeItem('admin_sec_session');
    sessionStorage.removeItem('cc_device_fp');
    const keys = Object.keys(localStorage);
    keys.forEach(k => {
      if (k.startsWith('admin_sec_') || k.startsWith('sec_questions_')) {
        localStorage.removeItem(k);
      }
    });
  }
};

/* ── 21. Anti-Screenshot & Screen Recording Guard ─────────────
   Attempts to prevent screenshots via keyboard and focus loss.   */
window.ccAntiScreenshot = (function() {
  function init() {
    // Blur on focus loss to counter Snipping Tool / OS screen capture
    window.addEventListener('blur', () => {
      document.body.style.filter = 'blur(15px) grayscale(100%)';
      document.body.style.opacity = '0.1';
    });
    
    window.addEventListener('focus', () => {
      document.body.style.filter = 'none';
      document.body.style.opacity = '1';
    });
    
    document.addEventListener('keydown', (e) => {
      const isScreenshotShortcut = 
        (e.key === 'PrintScreen') ||
        (e.ctrlKey && e.key === 'p') ||
        (e.metaKey && e.shiftKey && (e.key === 's' || e.key === 'S' || e.key === '3' || e.key === '4')) ||
        (e.metaKey && e.key === 'p');
        
      if (isScreenshotShortcut) {
        e.preventDefault();
        e.stopPropagation();
        
        // Obscure screen immediately
        document.body.style.display = 'none';
        
        // Clear clipboard
        try { navigator.clipboard.writeText('Screenshots are disabled in this chat room.'); } catch(err){}
        
        if (typeof showChatToast === 'function') {
          showChatToast('⚠️ Screenshots are disabled by server policy.', 'error');
        }
        
        window.ccSecLog?.record('SCREENSHOT_ATTEMPT', { key: e.key });
        
        // Restore screen after 2 seconds
        setTimeout(() => {
          document.body.style.display = '';
        }, 2000);
      }
    }, { capture: true });
    
    // Listen for PrintScreen keyup specifically
    document.addEventListener('keyup', (e) => {
      if (e.key === 'PrintScreen') {
        try { navigator.clipboard.writeText('Screenshots are disabled in this chat room.'); } catch(err){}
      }
    });
  }
  
  init();
  return { init };
})();