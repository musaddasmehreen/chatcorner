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

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes('Email not confirmed')) {
      showMsg(msg, '📧 Please check your email and confirm your account first, then login.', 'error');
    } else {
      showMsg(msg, error.message, 'error');
    }
    return;
  }

  window.location.href = 'chat.html';
}

async function registerUser() {
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const msg      = document.getElementById('reg-msg');

  if (!username || !email || !password) { showMsg(msg, 'Fill in all fields.', 'error'); return; }
  if (password.length < 6) { showMsg(msg, 'Password must be at least 6 characters.', 'error'); return; }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    showMsg(msg, 'Username: letters, numbers, _ only (3–20 chars).', 'error'); return;
  }

  showMsg(msg, 'Creating account…', '');

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) { showMsg(msg, error.message, 'error'); return; }

  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      username,
      avatar_color: randomColor(),
      is_registered: true
    });
  }

  localStorage.setItem('cc_pending_username', username);

  showMsg(msg,
    '✅ Account created! Check your email → click the confirmation link → then come back and Login.',
    'success');
}

async function guestLogin() {
  const btn = document.querySelector('.tab-btn:last-child');
  if (btn) btn.textContent = 'Joining…';

  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    alert('Guest login failed: ' + error.message);
    if (btn) btn.textContent = 'Guest';
    return;
  }

  const guestName = 'Guest_' + Math.random().toString(36).substr(2, 5).toUpperCase();

  await supabase.from('profiles').upsert({
    id: data.user.id,
    username: guestName,
    avatar_color: randomColor(),
    is_registered: false
  });

  window.location.href = 'chat.html';
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = 'msg ' + type;
}

function randomColor() {
  const colors = ['#7c3aed','#06b6d4','#f59e0b','#10b981','#ef4444','#ec4899','#6366f1'];
  return colors[Math.floor(Math.random() * colors.length)];
}

if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) window.location.href = 'chat.html';
  });
}