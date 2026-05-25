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

  // After a successful login we are authenticated — safe to read/write profiles.
  const { data: existingProf } = await sbClient
    .from('profiles').select('id,email,username').eq('id', data.user.id).maybeSingle();

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
    // Profile exists — patch missing email if needed, then clear pending keys.
    if (!existingProf.email && data.user.email) {
      await sbClient.from('profiles').update({ email: data.user.email }).eq('id', data.user.id);
    }
    localStorage.removeItem('cc_pending_username');
    localStorage.removeItem('cc_pending_email');
  }

  window.location.href = 'chat.html';
}

async function registerUser() {
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const msg      = document.getElementById('reg-msg');

  if (!username || !email || !password) { showMsg(msg, 'Fill in all fields.', 'error'); return; }
  if (password.length < 6)  { showMsg(msg, 'Password must be at least 6 characters.', 'error'); return; }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    showMsg(msg, 'Username: letters, numbers, _ only (3–20 chars).', 'error'); return;
  }

  // Check username uniqueness before creating the auth account
  showMsg(msg, 'Checking username…', '');
  const { data: taken } = await sbClient
    .from('profiles').select('id').eq('username', username).maybeSingle();
  if (taken) { showMsg(msg, 'Username already taken — choose another.', 'error'); return; }

  showMsg(msg, 'Creating account…', '');

  const { data, error } = await sbClient.auth.signUp({ email, password });

  if (error) { showMsg(msg, error.message, 'error'); return; }

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

  // Supabase returns a session immediately when email confirmation is disabled
  if (data.session) {
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
    alert('Guest login failed: ' + error.message);
    if (btn) btn.textContent = 'Guest';
    return;
  }

  const guestName = 'Guest_' + Math.random().toString(36).substr(2, 5).toUpperCase();

  await sbClient.from('profiles').upsert({
    id: data.user.id,
    username: guestName,
    avatar_color: randomColor(),
    is_registered: false
  });

  window.location.href = 'chat.html';
}

async function logout() {
  await sbClient.auth.signOut();
  window.location.href = 'index.html';
}

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = 'msg ' + type;
}

function randomColor() {
  const colors = ['#7c3aed','#0891b2','#059669','#d97706','#dc2626','#db2777','#2563eb','#0d9488'];
  return colors[Math.floor(Math.random() * colors.length)];
}

if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
  sbClient.auth.getSession().then(({ data }) => {
    if (data.session) window.location.href = 'chat.html';
  });
}
