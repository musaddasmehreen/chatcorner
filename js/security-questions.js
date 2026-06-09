/**
 * Security Questions System
 * - Challenge-response authentication
 * - Honeypot/Dummy panel for failed verification
 * - Auto-logout fake sessions
 */

class SecurityQuestionsManager {
  constructor() {
    this.prefix = 'sec_questions_';
    this.securityQuestions = {
      'child_name': {
        question: "What is your child's name?",
        answer: 'baqir',
        hint: 'First name only'
      }
    };
    this.maxWrongAnswers = 2;
    this.honeypotSessionTimeout = 20 * 1000; // 20 seconds
  }

  // Get random security question
  getRandomQuestion() {
    const keys = Object.keys(this.securityQuestions);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    return {
      key: randomKey,
      question: this.securityQuestions[randomKey].question,
      hint: this.securityQuestions[randomKey].hint
    };
  }

  // Verify security question answer
  verifyAnswer(questionKey, userAnswer) {
    const correctAnswer = this.securityQuestions[questionKey]?.answer || '';
    const normalized = userAnswer.trim().toLowerCase();
    const correct = correctAnswer.toLowerCase();

    const isValid = normalized === correct;
    
    if (!isValid) {
      window.securityManager.logSecurityEvent('SECURITY_QUESTION_WRONG_ANSWER', {
        questionKey,
        attempt: userAnswer
      });
    }

    return isValid;
  }

  // Track wrong answers
  recordWrongAnswer(username, questionKey) {
    const key = `${this.prefix}wrong_${username}_${questionKey}`;
    const count = this.getStorageData(key, 0);
    const newCount = count + 1;
    
    localStorage.setItem(key, JSON.stringify(newCount));
    
    window.securityManager.logSecurityEvent('SECURITY_QUESTION_WRONG', {
      username,
      questionKey,
      attemptNumber: newCount
    });

    return newCount;
  }

  // Check if user should be redirected to honeypot
  shouldUsedHoneypot(username, questionKey) {
    const key = `${this.prefix}wrong_${username}_${questionKey}`;
    const wrongCount = this.getStorageData(key, 0);
    return wrongCount >= this.maxWrongAnswers;
  }

  // Create honeypot session
  createHoneypotSession(username) {
    const honeypotData = {
      isHoneypot: true,
      username,
      createdAt: Date.now(),
      realAdminId: null // Don't store real admin ID
    };

    sessionStorage.setItem('admin_sec_session', JSON.stringify(honeypotData));
    localStorage.setItem(`${this.prefix}honeypot_${username}`, JSON.stringify({
      createdAt: Date.now(),
      ip: 'honeypot_trapped'
    }));

    window.securityManager.logSecurityEvent('HONEYPOT_SESSION_CREATED', {
      username,
      timestamp: new Date().toISOString()
    });

    return honeypotData;
  }

  // Setup honeypot auto-logout
  setupHoneypotAutoLogout() {
    const session = this.getStorageData('admin_sec_session', null);
    
    if (session?.isHoneypot) {
      const timeRemaining = (session.createdAt + this.honeypotSessionTimeout) - Date.now();
      
      if (timeRemaining <= 0) {
        // Logout immediately
        this.triggerHoneypotLogout();
        return;
      }

      // Setup timeout for logout
      setTimeout(() => {
        this.triggerHoneypotLogout();
      }, timeRemaining);
    }
  }

  // Force logout from honeypot
  triggerHoneypotLogout() {
    window.securityManager.logSecurityEvent('HONEYPOT_AUTO_LOGOUT', {});
    sessionStorage.removeItem('admin_sec_session');
    window.location.href = 'adminup.html?honeypot_expired=1';
  }

  // Check if current session is honeypot
  isCurrentSessionHoneypot() {
    const session = this.getStorageData('admin_sec_session', null);
    return session?.isHoneypot === true;
  }

  // Safe storage access
  getStorageData(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(key) || sessionStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  // Get honeypot stats for monitoring
  getHoneypotStats() {
    const allKeys = Object.keys(localStorage).filter(k => k.includes(`${this.prefix}honeypot_`));
    const honeypots = allKeys.map(k => {
      try {
        return JSON.parse(localStorage.getItem(k));
      } catch {
        return null;
      }
    }).filter(Boolean);

    return {
      activeHoneypots: honeypots.length,
      honeypotSessions: honeypots
    };
  }
}

// Initialize security questions globally
window.securityQuestionsManager = new SecurityQuestionsManager();

console.log('%c🎭 Security Questions System Loaded', 'color: #ff00ff; font-weight: bold; font-size: 16px;');