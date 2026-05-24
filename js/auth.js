function showTab(tab) {
  document.querySelectorAll('.auth-form').forEach((f) => f.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById(tab + '-tab')?.classList.add('active');
  event?.currentTarget?.classList.add('active');
}

async function loginUser() {
  const email = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  const msg = document.getElementById('login-msg');

  if (!email || !password) return showMsg(msg, 'Fill in all fields.', 'error');

  showMsg(msg, 'Logging in…', '');
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.token) {
    showMsg(msg, payload?.error || 'Incorrect email or password.', 'error');
    return;
  }

  setToken(payload.token);
  window.location.href = 'chat.html';
}

async function registerUser() {
  const username = document.getElementById('reg-username')?.value.trim();
  const email = document.getElementById('reg-email')?.value.trim();
  const password = document.getElementById('reg-password')?.value;
  const msg = document.getElementById('reg-msg');

  if (!username || !email || !password) return showMsg(msg, 'Fill in all fields.', 'error');
  if (password.length < 6) return showMsg(msg, 'Password must be at least 6 characters.', 'error');
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return showMsg(msg, 'Username: letters, numbers, _ only (3–20 chars).', 'error');

  showMsg(msg, 'Creating account…', '');
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password })
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) return showMsg(msg, payload?.error || 'Registration failed.', 'error');

  if (payload.email_confirmation) {
    showMsg(msg, '✅ Account created! Check email for confirmation.', 'success');
    return;
  }

  if (payload.token) {
    setToken(payload.token);
    showMsg(msg, '✅ Account created! Taking you to chat…', 'success');
    setTimeout(() => { window.location.href = 'chat.html'; }, 900);
  } else {
    showMsg(msg, '✅ Account created! Please login.', 'success');
  }
}

async function guestLogin() {
  const btn = document.querySelector('.tab-btn:last-child');
  if (btn) btn.textContent = 'Joining…';

  const res = await apiFetch('/api/auth/guest', { method: 'POST', body: '{}' });
  const payload = await res.json().catch(() => ({}));

  if (!res.ok || !payload?.token) {
    alert(payload?.error || 'Guest login failed.');
    if (btn) btn.textContent = 'Guest';
    return;
  }

  setToken(payload.token);
  window.location.href = 'chat.html';
}

async function logout() {
  await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => null);
  clearToken();
  window.location.href = 'index.html';
}

function showMsg(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = 'msg ' + type;
}

async function checkSessionAndRedirect() {
  const onIndex = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
  if (!onIndex) return;
  const res = await apiFetch('/api/auth/session', { method: 'GET' }).catch(() => null);
  if (res?.ok) window.location.href = 'chat.html';
}

checkSessionAndRedirect();
