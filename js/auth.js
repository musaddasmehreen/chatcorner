const LOGIN_PAGE_URL = 'login.html';
const POST_LOGIN_REDIRECT_KEY = 'cc_post_login_redirect';

function markPendingChatRedirect() {
  sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, String(Date.now()));
}

function showTab(tab) {
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tab + '-tab').classList.add('active');
  event.currentTarget.classList.add('active');
}

async function loginUser() {
  const loginId  = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const msg      = document.getElementById('login-msg');

  if (!loginId || !password) { showMsg(msg, 'Fill in all fields.', 'error'); return; }

  showMsg(msg, 'Logging in…', '');

  let email = '';

  // 1) Try username lookup in profiles (may be blocked by RLS when unauthenticated)
  const { data: byUsername } = await sbClient
    .from('profiles')
    .select('email')
    .ilike('username', loginId)
    .maybeSingle();
  if (byUsername?.email) email = byUsername.email;

  // 2) Try email lookup in profiles
  if (!email) {
    const { data: byEmail } = await sbClient
      .from('profiles')
      .select('email')
      .ilike('email', loginId)
      .maybeSingle();
    if (byEmail?.email) email = byEmail.email;
  }

  // 3) Direct email field
  if (!email && loginId.includes('@')) email = loginId;

  // 4) Fallback: use cc_pending_email saved at registration time.
  //    This handles the case where RLS blocks the profiles lookup for
  //    unauthenticated users (common when email confirmation is required).
  if (!email) {
    const pendingUsername = localStorage.getItem('cc_pending_username') || '';
    const pendingEmail    = localStorage.getItem('cc_pending_email')    || '';
    if (pendingEmail && (pendingUsername.toLowerCase() === loginId.toLowerCase() || pendingEmail.toLowerCase() === loginId.toLowerCase())) {
      email = pendingEmail;
    }
  }

  if (!email) {
    showMsg(msg, 'Incorrect username/email or password.', 'error');
    return;
  }

  const { data, error } = await sbClient.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes('Email not confirmed')) {
      showMsg(msg, '📧 Please confirm your email first, then try logging in again.', 'error');
    } else if (error.message.includes('Invalid login credentials')) {
      showMsg(msg, 'Incorrect username/email or password.', 'error');
    } else {
      showMsg(msg, error.message, 'error');
    }
    return;
  }

  // Clear logout flag on successful login
  sessionStorage.removeItem('cc_logout_flag');

  // After a successful login we are authenticated — safe to read/write profiles.
  const { data: existingProf } = await sbClient
    .from('profiles').select('id,email,username,is_registered').eq('id', data.user.id).maybeSingle();

  if (!existingProf) {
    // Profile was never saved (RLS blocked the upsert at registration time).
    // Restore it now using the locally-stored pending values.
    const pendingUsername = localStorage.getItem('cc_pending_username')
      || 'User_' + data.user.id.substr(0, 5);
    await sbClient.from('profiles').upsert({
      id: data.user.id,
      username: pendingUsername,
      email: data.user.email,
      avatar_color: randomColor(),
      is_registered: true
    });
    localStorage.removeItem('cc_pending_username');
    localStorage.removeItem('cc_pending_email');
  } else {
    // Profile exists — patch missing email, upgrade to registered if it was a guest profile, and clear pending keys.
    const updatePayload = {};
    if (!existingProf.is_registered) {
      updatePayload.is_registered = true;
      const pendingUsername = localStorage.getItem('cc_pending_username');
      if (pendingUsername) {
        updatePayload.username = pendingUsername;
      }
    }
    if (!existingProf.email && data.user.email) {
      updatePayload.email = data.user.email;
    }
    if (Object.keys(updatePayload).length > 0) {
      await sbClient.from('profiles').update(updatePayload).eq('id', data.user.id);
    }
    localStorage.removeItem('cc_pending_username');
    localStorage.removeItem('cc_pending_email');
  }

  markPendingChatRedirect();
  window.location.href = 'chat.html';
}

// ------------------------------------------------------------------
// Client-side registration cooldown (60 s) to protect Supabase's
// free-tier email rate limit (≈ 2–3 confirmation emails / hour).
// ------------------------------------------------------------------
const REG_COOLDOWN_MS  = 60_000; // 60 seconds
const REG_TS_KEY       = 'cc_reg_last_ts';

function getRegCooldownRemaining() {
  const last = parseInt(localStorage.getItem(REG_TS_KEY) || '0', 10);
  const remaining = REG_COOLDOWN_MS - (Date.now() - last);
  return remaining > 0 ? remaining : 0;
}

function startRegCooldown(btn, msg) {
  localStorage.setItem(REG_TS_KEY, String(Date.now()));
  let remaining = REG_COOLDOWN_MS;
  btn.disabled = true;
  const tick = setInterval(() => {
    remaining -= 1000;
    if (remaining <= 0) {
      clearInterval(tick);
      btn.disabled = false;
      btn.textContent = 'Create Account';
      showMsg(msg, '', '');
    } else {
      const secs = Math.ceil(remaining / 1000);
      btn.textContent = `Wait ${secs}s…`;
    }
  }, 1000);
}

async function registerUser() {
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const msg      = document.getElementById('reg-msg');
  const btn      = document.querySelector('#register-tab .btn-primary');

  if (!username || !email || !password) { showMsg(msg, 'Fill in all fields.', 'error'); return; }
  if (password.length < 6)  { showMsg(msg, 'Password must be at least 6 characters.', 'error'); return; }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    showMsg(msg, 'Username: letters, numbers, _ only (3–20 chars).', 'error'); return;
  }

  // Enforce client-side cooldown to protect the Supabase email quota
  const cooldownLeft = getRegCooldownRemaining();
  if (cooldownLeft > 0) {
    const secs = Math.ceil(cooldownLeft / 1000);
    showMsg(msg, `⏳ Please wait ${secs} more second(s) before registering again.`, 'error');
    return;
  }

  // Check username uniqueness before creating the auth account
  showMsg(msg, 'Checking username…', '');
  const { data: taken } = await sbClient
    .from('profiles').select('id').eq('username', username).maybeSingle();
  if (taken) { showMsg(msg, 'Username already taken — choose another.', 'error'); return; }

  showMsg(msg, 'Creating account…', '');

  const { data, error } = await sbClient.auth.signUp({ email, password });

  if (error) {
    const isRateLimit =
      error.message.toLowerCase().includes('rate limit') ||
      error.message.toLowerCase().includes('too many') ||
      error.status === 429;

    if (isRateLimit) {
      // Still save the pending credentials so the user can log in once
      // the quota resets and they confirm their email manually.
      localStorage.setItem('cc_pending_username', username);
      localStorage.setItem('cc_pending_email', email);
      showMsg(msg,
        '⚠️ Too many sign-up emails sent. Please wait a few minutes and try again, ' +
        'or check your inbox — a previous confirmation email may already be there.',
        'error');
    } else {
      showMsg(msg, error.message, 'error');
    }
    return;
  }

  if (data.user) {
    const { error: profErr } = await sbClient.from('profiles').upsert({
      id: data.user.id,
      username,
      email,
      avatar_color: randomColor(),
      is_registered: true
    });

    if (profErr) {
      // Non-fatal: RLS may block this before email confirmation.
      // Both username and email are saved below so loginUser() can recover.
      console.warn('Profile save error (will retry on login):', profErr.message);
    }
  }

  // Always persist both so loginUser() can resolve username → email
  // even when RLS prevents unauthenticated profile reads.
  localStorage.setItem('cc_pending_username', username);
  localStorage.setItem('cc_pending_email', email);

  // Start cooldown timer on the button
  if (btn) startRegCooldown(btn, msg);

  // Supabase returns a session immediately when email confirmation is disabled
  if (data.session) {
    // Clear logout flag on successful registration with immediate session
    sessionStorage.removeItem('cc_logout_flag');
    markPendingChatRedirect();
    showMsg(msg, '✅ Account created! Taking you to chat…', 'success');
    setTimeout(() => { window.location.href = 'chat.html'; }, 1200);
  } else {
    showMsg(msg,
      '✅ Account created! Check your email → click the confirmation link → then come back and login.',
      'success');
  }
}

async function guestLogin() {
  const btn = document.querySelector('.tab-btn:last-child');
  if (btn) btn.textContent = 'Joining…';

  const { data, error } = await sbClient.auth.signInAnonymously();

  if (error) {
    if (btn) {
      btn.textContent = 'Failed — Retry';
      btn.title = error.message;
      setTimeout(() => { btn.textContent = 'Guest'; btn.title = ''; }, 4000);
    }
    let errEl = document.getElementById('guest-error-msg');
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.id = 'guest-error-msg';
      errEl.style.cssText = 'color:#f87171;font-size:0.82rem;text-align:center;margin-top:8px';
      btn?.closest('form, .auth-form, .tab-content, div')?.appendChild(errEl);
    }
    errEl.textContent = 'Guest login failed: ' + error.message;
    setTimeout(() => { if (errEl) errEl.textContent = ''; }, 5000);
    return;
  }

  const guestName = 'Guest_' + Math.random().toString(36).substr(2, 5).toUpperCase();

  // Clear logout flag on successful guest login
  sessionStorage.removeItem('cc_logout_flag');

  await sbClient.from('profiles').upsert({
    id: data.user.id,
    username: guestName,
    avatar_color: randomColor(),
    is_registered: false
  });

  window.location.href = 'chat.html';
}

async function logout() {
  try {
    if (typeof window.prepareForLogout === 'function') {
      void window.prepareForLogout();
    }
  } catch (error) {
    console.warn('Pre-logout cleanup failed:', error);
  }

  // Comprehensive cleanup of all authentication state
  clearAllAuthState();

  // Force clear Supabase session
  try {
    // Clear any cached session data
    localStorage.removeItem('sb-' + sbClient.supabaseUrl + '-auth-token');
    sessionStorage.removeItem('sb-' + sbClient.supabaseUrl + '-auth-token');
    
    // Sign out from Supabase
    await sbClient.auth.signOut();
    
    // Additional cleanup for Supabase client
    await sbClient.auth.setSession(null);
  } catch (error) {
    console.warn('Error during sign out:', error);
  }
  
  // Set a flag to prevent automatic guest login after logout
  // Do this AFTER clearAllAuthState() to ensure it persists
  sessionStorage.setItem('cc_logout_flag', 'true');
  
  // Use replace to prevent back button navigation to logged-in state
  window.location.replace(LOGIN_PAGE_URL);
}

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = 'msg ' + type;
}

function randomColor() {
  const colors = ['#7c3aed','#0891b2','#059669','#d97706','#dc2626','#db2777','#2563eb','#0d9488'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Comprehensive authentication state cleanup
function clearAllAuthState() {
  // Save the logout flag before clearing sessionStorage
  const logoutFlag = sessionStorage.getItem('cc_logout_flag');
  
  // Clear localStorage items with common auth prefixes
  const prefixes = [
    'sb-', 'supabase.', 'cc_', 'chatcorner_', 
    'auth_', 'session_', 'user_', 'profile_'
  ];
  
  prefixes.forEach(prefix => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    });
  });
  
  // Clear all sessionStorage
  sessionStorage.clear();
  
  // Restore the logout flag if it was set
  if (logoutFlag === 'true') {
    sessionStorage.setItem('cc_logout_flag', 'true');
  }
  
  // Clear security data if security manager exists
  if (window.securityManager && typeof window.securityManager.clearSecurityData === 'function') {
    window.securityManager.clearSecurityData();
  }
  
  // Clear any cookies that might be set (optional, for completeness)
  document.cookie.split(';').forEach(cookie => {
    const eqPos = cookie.indexOf('=');
    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
    if (name.includes('auth') || name.includes('session') || name.includes('token')) {
      document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    }
  });
}

const currentPage = window.location.pathname.split('/').pop() || '';
const isLoginPage = currentPage === 'login.html';

if (isLoginPage) {
  // Check if we're coming from a logout action or restore failure (stored in sessionStorage to keep URL clean)
  const isLogoutRedirect = sessionStorage.getItem('cc_logout_flag') === 'true';
  const isRestoreFailure = sessionStorage.getItem('cc_session_restore_failed') === 'true';
  if (isRestoreFailure) {
    sessionStorage.removeItem('cc_session_restore_failed');
  }
  
  // Re-apply cooldown state on page load (e.g. after a page refresh)
  const cooldownLeft = getRegCooldownRemaining();
  if (cooldownLeft > 0) {
    window.addEventListener('DOMContentLoaded', () => {
      const btn = document.querySelector('#register-tab .btn-primary');
      const msg = document.getElementById('reg-msg');
      if (btn) {
        btn.disabled = true;
        const remaining = { ms: cooldownLeft };
        const tick = setInterval(() => {
          remaining.ms -= 1000;
          if (remaining.ms <= 0) {
            clearInterval(tick);
            btn.disabled = false;
            btn.textContent = 'Create Account';
          } else {
            btn.textContent = `Wait ${Math.ceil(remaining.ms / 1000)}s…`;
          }
        }, 1000);
        btn.textContent = `Wait ${Math.ceil(cooldownLeft / 1000)}s…`;
      }
    });
  }

  // Only redirect to chat if we have a session AND we're not coming from logout
  if (!isLogoutRedirect) {
    sbClient.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = 'chat.html';
    });
  }

  if (isRestoreFailure) {
    window.addEventListener('DOMContentLoaded', () => {
      const msg = document.getElementById('login-msg');
      if (!msg) return;
      showMsg(msg, 'Session restore took too long. Please log in again.', 'error');
    });
  }
}
