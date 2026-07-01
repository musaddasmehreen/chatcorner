/**
 * Admin Login Page Logic
 * Simple authentication: username + password → verify owner → redirect to admin
 */

const loginMsgEl = document.getElementById('admin-login-msg');
const loginForm = document.getElementById('admin-login-form');
const loginBtn = document.getElementById('admin-login-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAdminLogin();
  });

  checkIfAlreadyLoggedIn();
});

// If already logged in as owner, redirect to admin
async function checkIfAlreadyLoggedIn() {
  try {
    const { data: { session } } = await sbClient.auth.getSession();
    if (!session?.user) return;

    const { data: profile } = await sbClient
      .from('profiles')
      .select('id,is_owner')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.is_owner) {
      // Mark session as admin-authenticated
      sessionStorage.setItem('admin_authenticated', 'true');
      window.location.href = 'admin.html';
    }
  } catch (e) {
    // Silently fail - user can still log in manually
  }
}

// Main login handler
async function handleAdminLogin() {
  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value;

  if (!username || !password) {
    setLoginMsg('Please fill in both username and password.', 'error');
    return;
  }

  loginBtn.disabled = true;
  setLoginMsg('Logging in…', '');

  try {
    // Lookup user by username to get their email
    const { data: profile, error: lookupErr } = await sbClient
      .from('profiles')
      .select('id,email,is_owner')
      .eq('username', username)
      .maybeSingle();

    if (lookupErr || !profile) {
      setLoginMsg('Invalid username or password.', 'error');
      loginBtn.disabled = false;
      return;
    }

    if (!profile.email) {
      setLoginMsg('Invalid username or password.', 'error');
      loginBtn.disabled = false;
      return;
    }

    // Authenticate with Supabase
    const { data, error } = await sbClient.auth.signInWithPassword({ 
      email: profile.email, 
      password 
    });

    if (error || !data?.user) {
      setLoginMsg('Invalid username or password.', 'error');
      loginBtn.disabled = false;
      return;
    }

    // Verify owner/admin status
    const { data: freshProfile, error: profileErr } = await sbClient
      .from('profiles')
      .select('id,is_admin,is_owner')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileErr || !freshProfile?.is_owner) {
      await sbClient.auth.signOut();
      setLoginMsg('Access denied. Admin privileges required.', 'error');
      loginBtn.disabled = false;
      return;
    }

    // Success - mark session and redirect
    sessionStorage.setItem('admin_authenticated', 'true');
    setLoginMsg('✅ Login successful! Redirecting…', 'success');
    
    setTimeout(() => {
      window.location.href = 'admin.html';
    }, 500);

  } catch (err) {
    setLoginMsg('Login failed. Please try again.', 'error');
    loginBtn.disabled = false;
  }
}

// Set login message
function setLoginMsg(text, type) {
  loginMsgEl.textContent = text;
  loginMsgEl.className = 'msg ' + (type || '');
}
