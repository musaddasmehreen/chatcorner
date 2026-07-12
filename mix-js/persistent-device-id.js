(function (window, document) {
  'use strict';

  var DEVICE_COOKIE_NAME = 'persistent_client_id';
  var DEVICE_STORAGE_KEY = 'persistent_client_id';
  var COOKIE_MAX_AGE_DAYS = 3650;
  var ENDPOINT_URL = 'https://www.mixchatroom.com/device/ping.php';
  var BOOTSTRAP_SAFE_URL = 'https://www.mixchatroom.com/device/bootstrap-safe.php';
  var WINDOW_NAME_PREFIX = 'mixchatroom_pcid:';

  function generateRandomId() {
    var array = new Uint8Array(16);

    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(array);
    } else {
      for (var i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }

    var hex = '';
    for (var j = 0; j < array.length; j++) {
      var part = array[j].toString(16);
      if (part.length < 2) {
        part = '0' + part;
      }
      hex += part;
    }

    return 'pcid_' + hex;
  }

  function normalizeId(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }

    value = value.trim();

    if (!/^pcid_[a-f0-9]{32}$/i.test(value)) {
      return null;
    }

    return value.toLowerCase();
  }

  function getUrlParam(name) {
    try {
      var url = new URL(window.location.href);
      return url.searchParams.get(name);
    } catch (e) {
      return null;
    }
  }

  function getCookie(name) {
    var escaped = name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1');
    var match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value, days, domainOverride) {
    try {
      var expires = '';
      var secure = window.location.protocol === 'https:' ? '; Secure' : '';
      var domain = domainOverride ? '; domain=' + domainOverride : '';

      if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = '; expires=' + date.toUTCString();
      }

      document.cookie =
        name + '=' + encodeURIComponent(value) +
        expires +
        '; path=/' +
        domain +
        '; SameSite=Lax' +
        secure;

      return true;
    } catch (e) {
      return false;
    }
  }

  function setCookieWithFallbacks(name, value, days) {
    value = normalizeId(value);
    if (!value) {
      return false;
    }

    if (setCookie(name, value, days, '.mixchatroom.com')) {
      if (normalizeId(getCookie(name)) === value) {
        return true;
      }
    }

    if (setCookie(name, value, days, null)) {
      if (normalizeId(getCookie(name)) === value) {
        return true;
      }
    }

    return false;
  }

  function getLocalStorageValue(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function setLocalStorageValue(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function getSessionStorageValue(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function setSessionStorageValue(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function getWindowNameValue() {
    try {
      if (!window.name || typeof window.name !== 'string') {
        return null;
      }

      if (window.name.indexOf(WINDOW_NAME_PREFIX) !== 0) {
        return null;
      }

      return window.name.substring(WINDOW_NAME_PREFIX.length);
    } catch (e) {
      return null;
    }
  }

  function setWindowNameValue(value) {
    try {
      window.name = WINDOW_NAME_PREFIX + value;
      return true;
    } catch (e) {
      return false;
    }
  }

  function getBestLocalId() {
    return (
      normalizeId(getUrlParam('pcid')) ||
      normalizeId(getCookie(DEVICE_COOKIE_NAME)) ||
      normalizeId(getLocalStorageValue(DEVICE_STORAGE_KEY)) ||
      normalizeId(getSessionStorageValue(DEVICE_STORAGE_KEY)) ||
      normalizeId(getWindowNameValue())
    );
  }

  function repairStorageCopies(value) {
    value = normalizeId(value);
    if (!value) {
      return null;
    }

    if (normalizeId(getCookie(DEVICE_COOKIE_NAME)) !== value) {
      setCookieWithFallbacks(DEVICE_COOKIE_NAME, value, COOKIE_MAX_AGE_DAYS);
    }

    if (normalizeId(getLocalStorageValue(DEVICE_STORAGE_KEY)) !== value) {
      setLocalStorageValue(DEVICE_STORAGE_KEY, value);
    }

    if (normalizeId(getSessionStorageValue(DEVICE_STORAGE_KEY)) !== value) {
      setSessionStorageValue(DEVICE_STORAGE_KEY, value);
    }

    if (normalizeId(getWindowNameValue()) !== value) {
      setWindowNameValue(value);
    }

    return value;
  }

  function ensurePersistentClientId() {
    var existing = getBestLocalId();

    if (existing) {
      return repairStorageCopies(existing);
    }

    var newId = generateRandomId();

    setCookieWithFallbacks(DEVICE_COOKIE_NAME, newId, COOKIE_MAX_AGE_DAYS);
    setLocalStorageValue(DEVICE_STORAGE_KEY, newId);
    setSessionStorageValue(DEVICE_STORAGE_KEY, newId);
    setWindowNameValue(newId);

    return (
      normalizeId(getCookie(DEVICE_COOKIE_NAME)) ||
      normalizeId(getLocalStorageValue(DEVICE_STORAGE_KEY)) ||
      normalizeId(getSessionStorageValue(DEVICE_STORAGE_KEY)) ||
      normalizeId(getWindowNameValue()) ||
      newId
    );
  }

  function simpleHash(str) {
    if (!str) {
      return null;
    }

    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }

    return 'h_' + Math.abs(hash);
  }

  function getCanvasHash() {
    try {
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }

      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(10, 10, 100, 30);
      ctx.fillStyle = '#069';
      ctx.fillText('mixchatroom-device-fp', 2, 2);

      return simpleHash(canvas.toDataURL());
    } catch (e) {
      return null;
    }
  }

  function getWebGLInfo() {
    try {
      var canvas = document.createElement('canvas');
      var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        return {
          vendor: null,
          renderer: null,
          hash: null
        };
      }

      var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      var vendor = null;
      var renderer = null;

      if (debugInfo) {
        vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      }

      return {
        vendor: vendor,
        renderer: renderer,
        hash: simpleHash(String(vendor || '') + '|' + String(renderer || ''))
      };
    } catch (e) {
      return {
        vendor: null,
        renderer: null,
        hash: null
      };
    }
  }

  function buildFingerprintData(options) {
    options = options || {};

    var webgl = getWebGLInfo();
    var screenObj = window.screen || {};
    var persistentClientId = ensurePersistentClientId();

    var payload = {
      persistent_client_id: persistentClientId,
      fingerprint_version: 'v105-iphone-safe-bootstrap',
      widget_name: options.widgetName || null,
      widget_host: window.location.hostname || null,
      user_agent: navigator.userAgent || null,
      platform: navigator.platform || null,
      language: navigator.language || null,
      languages: navigator.languages || null,
      timezone: (window.Intl && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : null,
      screen_width: screenObj.width || null,
      screen_height: screenObj.height || null,
      color_depth: screenObj.colorDepth || null,
      hardware_concurrency: navigator.hardwareConcurrency || null,
      device_memory: navigator.deviceMemory || null,
      max_touch_points: navigator.maxTouchPoints || 0,
      canvas_hash: getCanvasHash(),
      webgl_vendor: webgl.vendor,
      webgl_renderer: webgl.renderer,
      webgl_hash: webgl.hash,
      page_url: window.location.href || null,
      referrer: document.referrer || null,
      current_nick: options.currentNick || null,
      timestamp: new Date().toISOString()
    };

    payload.fingerprint_hash = simpleHash([
      payload.platform || '',
      payload.language || '',
      payload.timezone || '',
      payload.canvas_hash || '',
      payload.webgl_hash || '',
      String(payload.hardware_concurrency || ''),
      String(payload.device_memory || ''),
      String(payload.max_touch_points || '')
    ].join('|'));

    return payload;
  }

  function sendFingerprintData(options) {
    var payload = buildFingerprintData(options || {});

    return fetch(ENDPOINT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(payload)
    })
    .then(function (response) {
      return response.json();
    })
    .catch(function (error) {
      console.error('Device ping failed:', error);
      return {
        ok: false,
        error: 'request_failed'
      };
    });
  }

  function repairPersistentClientIdFromServer() {
    var localId = ensurePersistentClientId();

    return fetch(BOOTSTRAP_SAFE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MixChatroom-PCID': localId || ''
      },
      credentials: 'include',
      body: JSON.stringify({
        persistent_client_id: localId,
        page_url: window.location.href || null,
        referrer: document.referrer || null,
        widget_host: window.location.hostname || null
      })
    })
    .then(function (response) {
      return response.json();
    })
    .then(function (data) {
      if (data && data.ok && data.persistent_client_id) {
        var canonical = normalizeId(data.persistent_client_id);
        if (canonical) {
          repairStorageCopies(canonical);
          return canonical;
        }
      }

      return localId;
    })
    .catch(function () {
      return localId;
    });
  }

  window.MixChatroomDeviceId = {
    ensurePersistentClientId: ensurePersistentClientId,
    buildFingerprintData: buildFingerprintData,
    sendFingerprintData: sendFingerprintData,
    repairPersistentClientIdFromServer: repairPersistentClientIdFromServer
  };
})(window, document);