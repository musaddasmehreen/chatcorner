// Load Supabase credentials from env-config.js if available; otherwise fall back to placeholders.
const ENV = (typeof window !== 'undefined' && window.ENV) || {};

let SUPABASE_URL = ENV.SUPABASE_URL || '';
let SUPABASE_ANON = ENV.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn('[ChatCorner] SUPABASE_URL or SUPABASE_ANON_KEY not found in window.ENV. Using placeholder values; auth will fail. Run `node scripts/build-env-config.js` with the proper environment variables before deploying.');
  SUPABASE_URL = SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT.supabase.co';
  SUPABASE_ANON = SUPABASE_ANON || 'YOUR_SUPABASE_ANON_KEY';
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

window.sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
var sbClient = window.sbClient;

const ADMIN_BOOTSTRAP_SETTING_KEY = 'admin_bootstrap_enabled';

async function getAppSettingValue(key) {
  const { data, error } = await sbClient
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error || !data?.value) return null;
  return data.value;
}

async function isAdminBootstrapEnabled() {
  const value = await getAppSettingValue(ADMIN_BOOTSTRAP_SETTING_KEY);
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

async function canAccessAdminBootstrap() {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session?.user) return false;

  const { data: profile, error } = await sbClient
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !profile?.is_admin) return false;
  return isAdminBootstrapEnabled();
}

async function enforceAdminBootstrapAccess(redirectTo = 'adminup.html?setup=disabled') {
  const allowed = await canAccessAdminBootstrap();
  if (!allowed) {
    window.location.replace(redirectTo);
    return false;
  }
  return true;
}

window.ccSecurity = {
  ADMIN_BOOTSTRAP_SETTING_KEY,
  getAppSettingValue,
  isAdminBootstrapEnabled,
  canAccessAdminBootstrap,
  enforceAdminBootstrapAccess
};

// Global chat state variables shared across scripts
window.currentUser = null;
window.currentProfile = null;
window.currentRoom = null;
window.onlineUsers = {};
window.cameraStates = {};

var POST_LOGIN_REDIRECT_KEY = 'cc_post_login_redirect';
window.POST_LOGIN_REDIRECT_KEY = POST_LOGIN_REDIRECT_KEY;
