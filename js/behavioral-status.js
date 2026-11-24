/**
 * Behavioral Statuses & Profile-Based Gender Matching
 * ChatCorner - Interactive Motion-Moving Status System
 */

(function (window) {
  'use strict';

  // 12 Shared Statuses (available in both Boy & Girl character styles)
  const SHARED_STATUSES = [
    {
      id: 'smoking',
      label: 'is smoking',
      boy:  { emoji: '🚬 🧔‍♂️', motion: 'motion-smoke', desc: 'Smoking a cigarette' },
      girl: { emoji: '🚬 👩',   motion: 'motion-smoke', desc: 'Smoking a cigarette' }
    },
    {
      id: 'working',
      label: 'is working',
      boy:  { emoji: '👨‍💻 ⚡', motion: 'motion-type', desc: 'Busy working hard' },
      girl: { emoji: '👩‍💻 ⚡', motion: 'motion-type', desc: 'Busy working hard' }
    },
    {
      id: 'drugs',
      label: 'is on drugs',
      boy:  { emoji: '😵‍💫 💊', motion: 'motion-dizzy', desc: 'Tripping on drugs' },
      girl: { emoji: '🤪 💊',   motion: 'motion-dizzy', desc: 'Tripping on drugs' }
    },
    {
      id: 'lazy',
      label: 'is lazy',
      boy:  { emoji: '🦥 🥱', motion: 'motion-lazy', desc: 'Chilling out lazy' },
      girl: { emoji: '🦥 🥱', motion: 'motion-lazy', desc: 'Chilling out lazy' }
    },
    {
      id: 'thinking',
      label: 'is thinking',
      boy:  { emoji: '🤔 💭', motion: 'motion-pulse', desc: 'Deep in thought' },
      girl: { emoji: '🤔 💭', motion: 'motion-pulse', desc: 'Deep in thought' }
    },
    {
      id: 'idle',
      label: 'is idle',
      boy:  { emoji: '⏳ 🧍‍♂️', motion: 'motion-sway', desc: 'Away from keyboard / idle' },
      girl: { emoji: '⏳ 🧍‍♀️', motion: 'motion-sway', desc: 'Away from keyboard / idle' }
    },
    {
      id: 'happy',
      label: 'is happy',
      boy:  { emoji: '😄 ✨', motion: 'motion-bounce', desc: 'Feeling cheerful & happy' },
      girl: { emoji: '🥰 ✨', motion: 'motion-bounce', desc: 'Feeling cheerful & happy' }
    },
    {
      id: 'sleeping',
      label: 'is sleeping',
      boy:  { emoji: '😴 💤', motion: 'motion-float', desc: 'Fast asleep' },
      girl: { emoji: '😴 💤', motion: 'motion-float', desc: 'Fast asleep' }
    },
    {
      id: 'hallucinating',
      label: 'is hallucinating',
      boy:  { emoji: '😵 🌀', motion: 'motion-spin', desc: 'Seeing hallucinations' },
      girl: { emoji: '😵 🌀', motion: 'motion-spin', desc: 'Seeing hallucinations' }
    },
    {
      id: 'confused',
      label: 'is confused',
      boy:  { emoji: '🤷‍♂️ ❓', motion: 'motion-tilt', desc: 'Puzzled & confused' },
      girl: { emoji: '🤷‍♀️ ❓', motion: 'motion-tilt', desc: 'Puzzled & confused' }
    },
    {
      id: 'coffee',
      label: 'is grabbing coffee',
      boy:  { emoji: '☕ 🚶‍♂️', motion: 'motion-step', desc: 'Grabbing fresh coffee' },
      girl: { emoji: '☕ 🚶‍♀️', motion: 'motion-step', desc: 'Grabbing fresh coffee' }
    },
    {
      id: 'music',
      label: 'is listening to music',
      boy:  { emoji: '🎧 🕺', motion: 'motion-groove', desc: 'Grooving to the music' },
      girl: { emoji: '🎧 💃', motion: 'motion-groove', desc: 'Grooving to the music' }
    }
  ];

  // Boys Exclusive Statuses (5)
  const BOYS_EXCLUSIVE = [
    {
      id: 'gaming',
      label: 'is gaming',
      boy: { emoji: '🎮 🕹️', motion: 'motion-game', desc: 'In a game match' }
    },
    {
      id: 'gym',
      label: 'is hitting the gym',
      boy: { emoji: '🏋️‍♂️ 💪', motion: 'motion-pump', desc: 'Pumping iron at the gym' }
    },
    {
      id: 'hair',
      label: 'is fixing his hair',
      boy: { emoji: '💇‍♂️ ✨', motion: 'motion-shimmer', desc: 'Styling fresh hair' }
    },
    {
      id: 'match',
      label: 'is watching the match',
      boy: { emoji: '⚽ 📺', motion: 'motion-cheer', desc: 'Cheering for the match' }
    },
    {
      id: 'bike',
      label: 'is on a bike ride',
      boy: { emoji: '🚴‍♂️ 💨', motion: 'motion-ride', desc: 'Cruising on a bike ride' }
    }
  ];

  // Girls Exclusive Statuses (5)
  const GIRLS_EXCLUSIVE = [
    {
      id: 'makeup',
      label: 'is doing makeup',
      girl: { emoji: '💄 ✨', motion: 'motion-shimmer', desc: 'Applying glam makeup' }
    },
    {
      id: 'shopping',
      label: 'is shopping',
      girl: { emoji: '🛍️ 👠', motion: 'motion-swing', desc: 'On a shopping spree' }
    },
    {
      id: 'selfies',
      label: 'is taking selfies',
      girl: { emoji: '🤳 📸', motion: 'motion-flash', desc: 'Snapping cute selfies' }
    },
    {
      id: 'nails',
      label: 'is painting nails',
      girl: { emoji: '💅 ✨', motion: 'motion-glimmer', desc: 'Painting gorgeous nails' }
    },
    {
      id: 'gossiping',
      label: 'is gossiping',
      girl: { emoji: '🗣️ 💅', motion: 'motion-chat', desc: 'Spilling the tea' }
    }
  ];

  // In-memory cache for user statuses { userId -> { id, label, emoji, motion, gender } }
  const userStatusCache = new Map();

  function getUserGender(profile) {
    const prof = profile || window.currentProfile;
    const sex = String(prof?.sex || '').trim().toLowerCase();
    if (sex.includes('f') || sex.includes('girl') || sex.includes('woman')) return 'girl';
    return 'boy';
  }

  function getActiveStatus(userId) {
    if (!userId) return null;
    if (userStatusCache.has(userId)) {
      return userStatusCache.get(userId);
    }
    try {
      const stored = localStorage.getItem('chatcorner_behavioral_status_' + userId);
      if (stored) {
        const parsed = JSON.parse(stored);
        userStatusCache.set(userId, parsed);
        return parsed;
      }
    } catch (_) {}
    return null;
  }

  function restoreStatusFromStorage() {
    try {
      const myId = window.currentUser?.id;
      if (!myId) return;
      const stored = localStorage.getItem('chatcorner_behavioral_status_' + myId);
      if (stored) {
        const parsed = JSON.parse(stored);
        userStatusCache.set(myId, parsed);
        if (window.presenceBaseData) {
          window.presenceBaseData.statusText   = parsed.label || null;
          window.presenceBaseData.statusEmoji  = parsed.emoji || null;
          window.presenceBaseData.statusKey    = parsed.id    || null;
          window.presenceBaseData.statusMotion = parsed.motion || null;
        }
      }
    } catch (_) {}
  }

  async function setUserStatus(statusData) {
    if (!window.currentUser?.id) {
      if (typeof window.showChatToast === 'function') {
        window.showChatToast('Please log in or enter the chatroom to set your status.', 'warning');
      }
      return;
    }

    const myId = window.currentUser.id;

    if (!statusData) {
      // Clear status
      userStatusCache.delete(myId);
      try {
        localStorage.removeItem('chatcorner_behavioral_status_' + myId);
      } catch (_) {}

      if (window.presenceBaseData) {
        window.presenceBaseData.statusText   = null;
        window.presenceBaseData.statusEmoji  = null;
        window.presenceBaseData.statusKey    = null;
        window.presenceBaseData.statusMotion = null;
      }

      if (window.presenceChannel) {
        try {
          window.presenceChannel.send({
            type: 'broadcast',
            event: 'status-cleared',
            payload: { userId: myId }
          });
        } catch (_) {}
      }

      if (typeof window.debouncedPresenceTrack === 'function') {
        window.debouncedPresenceTrack();
      }

      if (typeof window.scheduleRenderUserList === 'function') {
        window.scheduleRenderUserList();
      }

      if (typeof window.showChatToast === 'function') {
        window.showChatToast('Status cleared. You are showing normal online dot.', 'info');
      }
      return;
    }

    const { id, label, emoji, motion } = statusData;
    const finalData = {
      id: id || 'custom',
      label: label || 'is active',
      emoji: emoji || '✨',
      motion: motion || 'motion-bounce',
      updatedAt: Date.now()
    };

    userStatusCache.set(myId, finalData);
    try {
      localStorage.setItem('chatcorner_behavioral_status_' + myId, JSON.stringify(finalData));
    } catch (_) {}

    if (window.presenceBaseData) {
      window.presenceBaseData.statusText   = finalData.label;
      window.presenceBaseData.statusEmoji  = finalData.emoji;
      window.presenceBaseData.statusKey    = finalData.id;
      window.presenceBaseData.statusMotion = finalData.motion;
    }

    if (window.presenceChannel) {
      try {
        window.presenceChannel.send({
          type: 'broadcast',
          event: 'status-updated',
          payload: {
            userId: myId,
            statusKey: finalData.id,
            statusText: finalData.label,
            statusEmoji: finalData.emoji,
            statusMotion: finalData.motion
          }
        });
      } catch (_) {}
    }

    if (typeof window.debouncedPresenceTrack === 'function') {
      window.debouncedPresenceTrack();
    }

    if (typeof window.scheduleRenderUserList === 'function') {
      window.scheduleRenderUserList();
    }

    if (typeof window.showChatToast === 'function') {
      window.showChatToast(`Status updated: ${finalData.emoji} ${finalData.label}`, 'success');
    }
  }

  // Open the Interactive Behavioral Status Picker Modal
  function openStatusPicker(onSelect) {
    document.getElementById('cc-status-picker-overlay')?.remove();

    const myId = window.currentUser?.id;
    const defaultGender = getUserGender();
    let currentGenderTab = defaultGender; // 'boy' or 'girl'
    const activeStatus = myId ? getActiveStatus(myId) : null;

    const overlay = document.createElement('div');
    overlay.id = 'cc-status-picker-overlay';
    overlay.className = 'cc-status-picker-overlay';

    function renderDialog() {
      const isGirl = currentGenderTab === 'girl';

      // 12 Shared Statuses
      const sharedList = SHARED_STATUSES.map(item => {
        const style = isGirl ? item.girl : item.boy;
        const isCurrent = activeStatus && activeStatus.id === item.id;
        return `
          <div class="cc-status-card${isCurrent ? ' active' : ''}" 
               data-id="${escapeHtml(item.id)}" 
               data-label="${escapeHtml(item.label)}" 
               data-emoji="${escapeHtml(style.emoji)}" 
               data-motion="${escapeHtml(style.motion)}"
               title="${escapeHtml(style.desc)}">
            <div class="cc-status-card-icon">
              <span class="status-motion-emoji ${escapeHtml(style.motion)}">${escapeHtml(style.emoji)}</span>
            </div>
            <div class="cc-status-card-info">
              <div class="cc-status-card-label">${escapeHtml(item.label)}</div>
              <div class="cc-status-card-desc">${escapeHtml(style.desc)}</div>
            </div>
            ${isCurrent ? '<span class="cc-status-badge-active">ACTIVE</span>' : ''}
          </div>
        `;
      }).join('');

      // Exclusive Statuses
      const exclusives = isGirl ? GIRLS_EXCLUSIVE : BOYS_EXCLUSIVE;
      const exclusiveList = exclusives.map(item => {
        const style = isGirl ? item.girl : item.boy;
        const isCurrent = activeStatus && activeStatus.id === item.id;
        return `
          <div class="cc-status-card exclusive${isCurrent ? ' active' : ''}" 
               data-id="${escapeHtml(item.id)}" 
               data-label="${escapeHtml(item.label)}" 
               data-emoji="${escapeHtml(style.emoji)}" 
               data-motion="${escapeHtml(style.motion)}"
               title="${escapeHtml(style.desc)}">
            <div class="cc-status-card-icon">
              <span class="status-motion-emoji ${escapeHtml(style.motion)}">${escapeHtml(style.emoji)}</span>
            </div>
            <div class="cc-status-card-info">
              <div class="cc-status-card-label">${escapeHtml(item.label)}</div>
              <div class="cc-status-card-desc">${escapeHtml(style.desc)}</div>
            </div>
            ${isCurrent ? '<span class="cc-status-badge-active">ACTIVE</span>' : ''}
          </div>
        `;
      }).join('');

      overlay.innerHTML = `
        <div class="cc-status-picker-dialog" role="dialog" aria-modal="true" aria-label="Behavioral Status Picker">
          <div class="cc-status-picker-header">
            <div>
              <h3 class="cc-status-picker-title">⚡ What are you doing?</h3>
              <div class="cc-status-picker-sub">Select a motion-moving status to show beside your name in the room</div>
            </div>
            <button type="button" class="cc-status-picker-close" id="cc-status-close-btn" title="Close">&times;</button>
          </div>

          <div class="cc-gender-tab-bar">
            <button type="button" class="cc-gender-tab-btn tab-boy${currentGenderTab === 'boy' ? ' active' : ''}" data-gender="boy">
              👦 Boys Statuses
            </button>
            <button type="button" class="cc-gender-tab-btn tab-girl${currentGenderTab === 'girl' ? ' active' : ''}" data-gender="girl">
              👧 Girls Statuses
            </button>
          </div>

          <div class="cc-status-grid-scroll">
            <div style="grid-column: 1 / -1; font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--muted, #94a3b8); letter-spacing: 0.05em; margin: 4px 0 2px;">
              🌟 Shared Statuses (12)
            </div>
            ${sharedList}

            <div style="grid-column: 1 / -1; font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: ${isGirl ? '#f472b6' : '#38bdf8'}; letter-spacing: 0.05em; margin: 12px 0 2px;">
              ${isGirl ? '💖 Girls Exclusive Statuses (5)' : '⚡ Boys Exclusive Statuses (5)'}
            </div>
            ${exclusiveList}
          </div>

          <div class="cc-status-picker-footer">
            <button type="button" class="cc-profile-btn danger-sm" id="cc-status-clear-btn" style="padding: 6px 14px; font-size: 0.8rem;">
              🔄 Clear Status (Online Dot)
            </button>
            <button type="button" class="cc-profile-btn secondary" id="cc-status-cancel-btn" style="padding: 6px 14px; font-size: 0.8rem;">
              Cancel
            </button>
          </div>
        </div>
      `;

      // Bind events
      overlay.querySelector('#cc-status-close-btn')?.addEventListener('click', close);
      overlay.querySelector('#cc-status-cancel-btn')?.addEventListener('click', close);
      overlay.addEventListener('click', (ev) => {
        if (ev.target === overlay) close();
      });

      // Clear button
      overlay.querySelector('#cc-status-clear-btn')?.addEventListener('click', () => {
        setUserStatus(null);
        close();
        if (typeof onSelect === 'function') onSelect(null);
      });

      // Gender tab switch
      overlay.querySelectorAll('.cc-gender-tab-btn').forEach(btn => {
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          currentGenderTab = btn.dataset.gender;
          renderDialog();
        });
      });

      // Card selection
      overlay.querySelectorAll('.cc-status-card').forEach(card => {
        card.addEventListener('click', () => {
          const statusObj = {
            id: card.dataset.id,
            label: card.dataset.label,
            emoji: card.dataset.emoji,
            motion: card.dataset.motion
          };
          setUserStatus(statusObj);
          close();
          if (typeof onSelect === 'function') onSelect(statusObj);
        });
      });
    }

    function close() {
      overlay.remove();
      document.removeEventListener('keydown', handleKey);
    }

    function handleKey(ev) {
      if (ev.key === 'Escape') close();
    }

    document.addEventListener('keydown', handleKey);
    renderDialog();
    document.body.appendChild(overlay);
  }

  // Hover Tooltip setup for roster motion-moving emoji
  let activeTooltip = null;

  function showStatusTooltip(targetEl, username, statusText, statusEmoji, statusMotion) {
    hideStatusTooltip();
    if (!targetEl || !statusText) return;

    const tip = document.createElement('div');
    tip.className = 'status-hover-card';
    tip.innerHTML = `
      <span class="status-motion-emoji ${statusMotion || 'motion-bounce'}">${statusEmoji || '✨'}</span>
      <span><strong>${escapeHtml(username || 'User')}</strong> ${escapeHtml(statusText)}</span>
    `;

    document.body.appendChild(tip);
    activeTooltip = tip;

    const rect = targetEl.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();

    let top = rect.top - tipRect.height - 8;
    let left = rect.left + (rect.width / 2) - (tipRect.width / 2);

    if (top < 10) top = rect.bottom + 8;
    if (left < 10) left = 10;
    if (left + tipRect.width > window.innerWidth - 10) left = window.innerWidth - tipRect.width - 10;

    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
  }

  function hideStatusTooltip() {
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Export globally
  window.BehavioralStatus = {
    SHARED_STATUSES,
    BOYS_EXCLUSIVE,
    GIRLS_EXCLUSIVE,
    userStatusCache,
    getUserGender,
    getActiveStatus,
    setUserStatus,
    openStatusPicker,
    restoreStatusFromStorage,
    showStatusTooltip,
    hideStatusTooltip
  };

  // Restore on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    restoreStatusFromStorage();
  });

})(window);
