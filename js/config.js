const SUPABASE_URL  = 'https://zefcqrnhaeounzdmjscc.supabase.co';
const SUPABASE_ANON = 'sb_publishable_eK7zh_aQUiFstC0xwqg3JQ_wWSt4S8M';

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
const sbClient = window.sbClient;

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
