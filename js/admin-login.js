/**
 * Admin Login Page Logic
 * Handles authentication flow: login → security question → 2FA → redirect
 */

let currentUsername = '';
let currentUserId = '';
let currentAdminSession = null;
let currentSecurityQuestion = null;

const loginMsgEl = document.getElementById('admin-login-msg');
const loginForm = document.getElementById('admin-login-form');
const securityQuestionForm = document.getElementById('security-question-form');
const securityQuestionMsgEl = document.getElementById('security-question-msg');
const twofaForm = document.getElementById('twofa-form');
const twofaMsgEl = document.getElementById('twofa-msg');
const attemptInfoEl = document.getElementById('attempt-info');
const lockoutWarningEl = document.getElementById('lockout-warning');
const deviceTypeEl = document.getElementById('device-type');
const securityScoreEl = document.getElementById('security-score');
const loginBtn = document.getElementById('admin-login-btn');

// Initialize UI
document.addEventListener('DOMContentLoaded', async () => {
  // Attach form submit handlers
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAdminLogin();
  });
  securityQuestionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    verifySecurityQuestion();
  });
  twofaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    verifyTwoFA();
  });

  // Attach cancel button handlers
  const cancelSecQBtn = document.getElementById('cancel-security-question-btn');
  if (cancelSecQBtn) cancelSecQBtn.addEventListener('click', cancelSecurityQuestion);
  const cancelTwofaBtn = document.getElementById('cancel-twofa-btn');
  if (cancelTwofaBtn) cancelTwofaBtn.addEventListener('click', cancelTwoFA);

  updateSecurityDisplay();
  checkIfAlreadyLoggedIn();
  setupInputValidation();
  checkHoneypotExpired();
});

// Check if coming from expired honeypot
function checkHoneypotExpired() {
  if (new URLSearchParams(window.location.search).get('honeypot_expired') === '1') {
    setLoginMsg('⚠️ Previous session expired. Please log in again.', 'error');
    window.history.replaceState({}, document.title, 'adminup.html');
  }
}

// Display security information
async function updateSecurityDisplay() {
  const score = window.securityManager.calculateSecurityScore();
  const fp = await window.securityManager.generateDeviceFingerprint();
  
  const deviceName = fp.fingerprint.ua.includes('Windows') ? 'Windows' :
                     fp.fingerprint.ua.includes('Mac') ? 'macOS' :
                     fp.fingerprint.ua.includes('Linux') ? 'Linux' :
                     fp.fingerprint.ua.includes('Android') ? 'Android' :
                     fp.fingerprint.ua.includes('iPhone') ? 'iOS' : 'Unknown';
  
  deviceTypeEl.textContent = deviceName;
  securityScoreEl.textContent = score + '/100';
}

// Setup input validation
function setupInputValidation() {
  const codeInput = document.getElementById('twofa-code');
  codeInput?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
    if (e.target.value.length === 6) {
      verifyTwoFA();
    }
  });
}

// Check if already logged in as admin
async function checkIfAlreadyLoggedIn() {
  const { data: { session } } = await sbClient.auth.getSession();
  if (!session?.user) return;

  const { data: profile } = await sbClient
    .from('profiles')
    .select('id,is_owner')
    .eq('id', session.user.id)
    .maybeSingle();

  if (profile?.is_owner) {
    const isSessionValid = window.adminSecurityManager.validateAdminSession();
    if (isSessionValid) {
      window.location.href = 'admin.html';
    }
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

  // Validate rate limiting
  try {
    await window.adminSecurityManager.validateLoginAttempt(username);
  } catch (e) {
    if (e.locked) {
      showLockoutWarning(e.remainingTime);
    }
    setLoginMsg(e.message, 'error');
    loginBtn.disabled = true;
    setTimeout(() => { loginBtn.disabled = false; }, 1000);
    return;
  }

  currentUsername = username;
  loginBtn.disabled = true;
  setLoginMsg('Verifying credentials…', '');

  try {
    // Lookup user by username
    const { data: profile, error: lookupErr } = await sbClient
      .from('profiles')
      .select('id,email,is_admin,is_owner,has_2fa_enabled,two_fa_secret')
      .eq('username', username)
      .maybeSingle();

    if (lookupErr || !profile) {
      window.adminSecurityManager.recordLoginAttempt(username, false, { reason: 'USERNAME_NOT_FOUND' });
      updateAttemptInfo(username);
      setLoginMsg(window.securityManager.getGenericErrorMessage(), 'error');
      loginBtn.disabled = false;
      return;
    }

    if (!profile.email) {
      window.adminSecurityManager.recordLoginAttempt(username, false, { reason: 'NO_EMAIL' });
      setLoginMsg(window.securityManager.getGenericErrorMessage(), 'error');
      loginBtn.disabled = false;
      return;
    }

    // Attempt authentication
    setLoginMsg('Authenticating…', '');
    const { data, error } = await sbClient.auth.signInWithPassword({ 
      email: profile.email, 
      password 
    });

    if (error || !data?.user) {
      window.adminSecurityManager.recordLoginAttempt(username, false, { reason: 'INVALID_PASSWORD' });
      updateAttemptInfo(username);
      setLoginMsg(window.securityManager.getGenericErrorMessage(), 'error');
      loginBtn.disabled = false;
      return;
    }

    // Verify owner status - only owner-level users can access admin
    const { data: freshProfile, error: profileErr } = await sbClient
      .from('profiles')
      .select('id,is_admin,is_owner')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileErr || !freshProfile?.is_owner) {
      await sbClient.auth.signOut();
      window.adminSecurityManager.recordLoginAttempt(username, false, { reason: 'NOT_OWNER' });
      window.securityManager.logSecurityEvent('UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT', { username });
      setLoginMsg(window.securityManager.getGenericErrorMessage(), 'error');
      loginBtn.disabled = false;
      return;
    }

    // Password correct - now show security question
    currentUserId = data.user.id;
    showSecurityQuestion(username);
    loginBtn.disabled = false;

  } catch (err) {
    window.securityManager.logSecurityEvent('LOGIN_EXCEPTION', { error: err.message });
    setLoginMsg(window.securityManager.getGenericErrorMessage(), 'error');
    loginBtn.disabled = false;
  }
}

// Show security question form
function showSecurityQuestion(username) {
  currentSecurityQuestion = window.securityQuestionsManager.getRandomQuestion();
  
  document.getElementById('question-text').textContent = currentSecurityQuestion.question;
  document.getElementById('question-hint').textContent = 'Hint: ' + currentSecurityQuestion.hint;
  document.getElementById('security-answer').value = '';
  
  loginForm.classList.add('hidden');
  securityQuestionForm.classList.remove('hidden');
  setLoginMsg('');
  
  document.getElementById('security-answer').focus();
}

// Verify security question answer
async function verifySecurityQuestion() {
  const answer = document.getElementById('security-answer').value.trim();
  const verifyBtn = document.querySelector('#security-question-form button[type="submit"]');

  if (!answer) {
    securityQuestionMsgEl.textContent = 'Please enter an answer.';
    securityQuestionMsgEl.className = 'msg error';
    return;
  }

  verifyBtn.disabled = true;
  securityQuestionMsgEl.textContent = 'Verifying...';
  securityQuestionMsgEl.className = 'msg';

  try {
    const isCorrect = window.securityQuestionsManager.verifyAnswer(currentSecurityQuestion.key, answer);

    if (!isCorrect) {
      const wrongCount = window.securityQuestionsManager.recordWrongAnswer(currentUsername, currentSecurityQuestion.key);
      const remaining = window.securityQuestionsManager.maxWrongAnswers - wrongCount;

      if (remaining > 0) {
        securityQuestionMsgEl.textContent = '❌ Incorrect. ' + remaining + ' attempt' + (remaining !== 1 ? 's' : '') + ' remaining.';
        securityQuestionMsgEl.className = 'msg error';
        document.getElementById('security-answer').value = '';
        verifyBtn.disabled = false;
      } else {
        // Failed security question - redirect to honeypot
        securityQuestionMsgEl.textContent = '❌ Too many incorrect answers. Session redirected.';
        securityQuestionMsgEl.className = 'msg error';
        
        setTimeout(() => {
          window.securityQuestionsManager.createHoneypotSession(currentUsername);
          window.location.href = 'honeypot-admin.html';
        }, 1500);
      }
      return;
    }

    // Security question correct - proceed
    window.adminSecurityManager.recordLoginAttempt(currentUsername, false, { reason: 'PENDING_2FA_OR_SUCCESS' });
    securityQuestionMsgEl.textContent = '✅ Verified! Proceeding...';
    securityQuestionMsgEl.className = 'msg success';
    
    // Create real session
    const fp = await window.securityManager.generateDeviceFingerprint();
    currentAdminSession = window.adminSecurityManager.createAdminSession(currentUserId, fp.hash);

    window.adminSecurityManager.recordLoginAttempt(currentUsername, true);
    
    setTimeout(() => {
      window.location.href = 'admin.html';
    }, 500);

  } catch (err) {
    window.securityManager.logSecurityEvent('SECURITY_QUESTION_EXCEPTION', { error: err.message });
    securityQuestionMsgEl.textContent = window.securityManager.getGenericErrorMessage();
    securityQuestionMsgEl.className = 'msg error';
    verifyBtn.disabled = false;
  }
}

// Cancel security question
function cancelSecurityQuestion() {
  securityQuestionForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
  document.getElementById('security-answer').value = '';
  securityQuestionMsgEl.textContent = '';
  document.getElementById('admin-login-btn').disabled = false;
}

// Verify 2FA code
async function verifyTwoFA() {
  const code = document.getElementById('twofa-code').value;
  const verifyBtn = document.querySelector('#twofa-form button[type="submit"]');

  if (code.length !== 6) return;

  verifyBtn.disabled = true;
  twofaMsgEl.textContent = 'Verifying code…';
  twofaMsgEl.className = 'msg';

  try {
    const isValid = window.adminSecurityManager.verify2FACode('test_secret', code);

    if (!isValid) {
      window.adminSecurityManager.recordLoginAttempt(currentUsername, false, { reason: 'INVALID_2FA' });
      twofaMsgEl.textContent = 'Invalid authentication code. Try again.';
      twofaMsgEl.className = 'msg error';
      verifyBtn.disabled = false;
      return;
    }

    window.adminSecurityManager.recordLoginAttempt(currentUsername, true, { '2fa': 'verified' });
    twofaMsgEl.textContent = 'Code verified! Redirecting…';
    twofaMsgEl.className = 'msg success';

    setTimeout(() => {
      window.location.href = 'admin.html';
    }, 500);

  } catch (err) {
    window.securityManager.logSecurityEvent('2FA_VERIFICATION_ERROR', { error: err.message });
    twofaMsgEl.textContent = window.securityManager.getGenericErrorMessage();
    twofaMsgEl.className = 'msg error';
    verifyBtn.disabled = false;
  }
}

// Cancel 2FA
function cancelTwoFA() {
  twofaForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
  document.getElementById('twofa-code').value = '';
  twofaMsgEl.textContent = '';
  document.getElementById('admin-login-btn').disabled = false;
}

// Update attempt counter display
function updateAttemptInfo(username) {
  const remaining = window.adminSecurityManager.maxAttempts - window.adminSecurityManager.getStorageData('admin_sec_attempts_' + username, []).filter(a => !a.success).length;
  if (remaining > 0 && remaining < 3) {
    attemptInfoEl.textContent = '⚠️ ' + remaining + ' attempt' + (remaining !== 1 ? 's' : '') + ' remaining before lockout';
    attemptInfoEl.className = 'attempt-counter error-state';
  }
}

// Show lockout warning
function showLockoutWarning(remainingSeconds) {
  const mins = Math.ceil(remainingSeconds / 60);
  lockoutWarningEl.textContent = '🔒 Account temporarily locked. Try again in ' + mins + ' minute' + (mins !== 1 ? 's' : '') + '.';
  lockoutWarningEl.classList.remove('hidden');
  setTimeout(() => {
    lockoutWarningEl.classList.add('hidden');
  }, 5000);
}

// Set login message
function setLoginMsg(text, type) {
  loginMsgEl.textContent = text;
  loginMsgEl.className = 'msg ' + (type || '');
}

// Check for URL parameters
if (new URLSearchParams(window.location.search).get('denied') === '1') {
  setLoginMsg('❌ Access Denied. Admin credentials required.', 'error');
  window.securityManager.logSecurityEvent('UNAUTHORIZED_ADMIN_ACCESS', {});
}

// Monitor for intrusion attempts
let suspiciousActivityCount = 0;
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'j' || e.ctrlKey && e.shiftKey && e.key === 'I') {
    suspiciousActivityCount++;
    if (suspiciousActivityCount > 2) {
      window.securityManager.logSecurityEvent('DEVELOPER_TOOLS_DETECTED', {});
      console.warn('%c🚨 This page is protected. Attempting to inspect or modify will be logged.', 'color: #ff0000; font-weight: bold;');
    }
  }
});
