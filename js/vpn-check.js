const CC_VPN_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchIpMetadata() {
  const response = await fetch('https://ipapi.co/json/', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('IP lookup failed');
  const data = await response.json();
  return {
    ip: data.ip || '',
    country: data.country_name || data.country || '',
    countryCode: data.country_code || '',
    city: data.city || ''
  };
}

async function fetchVpnStatus(ipAddress) {
  if (!ipAddress) return { vpnDetected: false, proxyDetected: false, provider: '' };
  const response = await fetch(`https://proxycheck.io/v2/${encodeURIComponent(ipAddress)}?vpn=1&asn=1&risk=1`, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error('VPN lookup failed');
  const data = await response.json();
  const result = data?.[ipAddress] || {};
  return {
    vpnDetected: String(result.proxy || result.vpn || 'no').toLowerCase() === 'yes',
    proxyDetected: String(result.proxy || 'no').toLowerCase() === 'yes',
    provider: result.provider || result.organisation || result.asn || ''
  };
}

function getBrowserInfo() {
  return navigator.userAgent || 'Unknown browser';
}

function getVpnCacheKey(userId) {
  return `cc-vpn-check:${userId || 'guest'}`;
}

function readCachedVpnCheck(userId) {
  try {
    const raw = localStorage.getItem(getVpnCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.checkedAt || Date.now() - parsed.checkedAt > CC_VPN_CACHE_TTL_MS) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function writeCachedVpnCheck(userId, payload) {
  try {
    localStorage.setItem(getVpnCacheKey(userId), JSON.stringify({
      ...payload,
      checkedAt: Date.now()
    }));
  } catch (_) {}
}

async function runVpnGateCheck(userId) {
  const cached = readCachedVpnCheck(userId);
  if (cached) return cached;

  const meta = await fetchIpMetadata();
  const vpn = await fetchVpnStatus(meta.ip);
  const result = {
    ipAddress: meta.ip || '',
    country: meta.country || meta.countryCode || '',
    browserInfo: getBrowserInfo(),
    vpnDetected: !!vpn.vpnDetected,
    vpnProvider: vpn.provider || ''
  };
  writeCachedVpnCheck(userId, result);
  return result;
}

window.ccVpn = {
  runVpnGateCheck,
  getBrowserInfo
};
