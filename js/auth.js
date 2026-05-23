function showTab(tab) {
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tab + '-tab').classList.add('active');
  event.currentTarget.classList.add('active');
}

async function loginUser() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const msg      = document.getElementById('login-msg');

  if (!email || !password) { showMsg(msg, 'Fill in all fields.', 'error'); return; }

  showMsg(msg, 'Logging in…', '');

  const { data, error } = await sbClient.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes('Email not confirmed')) {
      showMsg(msg, '📧 Please confirm your email first, then try again.', 'error');
    } else if (error.message.includes('Invalid login credentials')) {
      showMsg(msg, 'Incorrect email or password.', 'error');
    } else {
      showMsg(msg, error.message, 'error');
    }
    return;
  }

  // If profile is missing (e.g. upsert failed at register time), recreate it now
  const { data: existingProf } = await sbClient
    .from('profiles').select('id').eq('id', data.user.id).maybeSingle();

  if (!existingProf) {
    const pendingUsername = localStorage.getItem('cc_pending_username')
      || 'User_' + data.user.id.substr(0, 5);
    await sbClient.from('profiles').upsert({
      id: data.user.id,
      username: pendingUsername,
      avatar_color: randomColor(),
      is_registered: true
    });
    localStorage.removeItem('cc_pending_username');
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
      avatar_color: randomColor(),
      is_registered: true
    });

    if (profErr) {
      // Non-fatal: store username so login can recover the profile
      console.warn('Profile save error (will retry on login):', profErr.message);
    }
  }

  localStorage.setItem('cc_pending_username', username);

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
