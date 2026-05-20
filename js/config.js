const SUPABASE_URL  = 'https://zefcqrnhaeounzdmjscc.supabase.co';
const SUPABASE_ANON = 'sb_publishable_eK7zh_aQUiFstC0xwqg3JQ_wWSt4S8M';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ]
};

window.sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
const sbClient = window.sbClient;
