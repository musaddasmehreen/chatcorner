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
      girl: { emoji: '🗣️ 💅', motion: 'motion-chatter', desc: 'Spilling the tea' }
    }
  ];

  // Cache of statuses by userId
  const userStatusCache = new Map();

  function getUserGender(profile) {
    const prof = profile || window.currentProfile;
    const sex = String(prof?.sex || '').trim().toLowerCase();
    if (['female', 'girl', 'woman', 'f'].includes(sex)) return 'girl';
    if (['male', 'boy', 'man', 'm'].includes(sex)) return 'boy';
    return 'boy'; // default
  }

  function getActiveStatus(userId) {
    if (!userId) return null;
    if (userId === window.currentUser?.id && window.currentProfile?.status_text) {
      return {
        id: window.currentProfile.status_key || 'custom',
        label: window.currentProfile.status_text,
        emoji: window.currentProfile.status_emoji || '✨',
        motion: window.currentProfile.status_motion || 'motion-bounce'
      };
    }
    return userStatusCache.get(userId) || null;
  }

  function restoreStatusFromStorage() {
    if (!window.currentUser?.id) return;
    try {
      const saved = localStorage.getItem('cc_user_status_' + window.currentUser.id);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.statusText) {
          if (!window.currentProfile) window.currentProfile = {};
          window.currentProfile.status_text = parsed.statusText;
          window.currentProfile.status_emoji = parsed.statusEmoji;
          window.currentProfile.status_key = parsed.statusKey;
          window.currentProfile.status_motion = parsed.statusMotion;
          userStatusCache.set(window.currentUser.id, {
            id: parsed.statusKey,
            label: parsed.statusText,
            emoji: parsed.statusEmoji,
            motion: parsed.statusMotion
          });
        }
      }
    } catch (_) {}
  }

  async function setUserStatus(statusData) {
    if (!window.currentUser?.id) return;

    const myId = window.currentUser.id;
    if (!window.currentProfile) window.currentProfile = {};

    if (!statusData) {
      // Clear status
      window.currentProfile.status_text = null;
      window.currentProfile.status_emoji = null;
      window.currentProfile.status_key = null;
      window.currentProfile.status_motion = null;
      userStatusCache.delete(myId);
      localStorage.removeItem('cc_user_status_' + myId);

      // Presence
      if (typeof window.presenceBaseData === 'object' && window.presenceBaseData) {
        window.presenceBaseData.statusText = null;
        window.presenceBaseData.statusEmoji = null;
        window.presenceBaseData.statusKey = null;
        window.presenceBaseData.statusMotion = null;
        if (typeof window.debouncedPresenceTrack === 'function') window.debouncedPresenceTrack();
      }

      // Broadcast update
      if (window.messageChannel && window.currentRoom?.id) {
        window.messageChannel.send({
          type: 'broadcast',
          event: 'status-cleared',
          payload: { userId: myId, roomId: window.currentRoom.id }
        }).catch(() => {});
      }

      // Update Supabase profiles
      try {
        await window.sbClient?.from('profiles').update({
          status_text: null,
          status_emoji: null,
          status_key: null,
          status_motion: null
        }).eq('id', myId);
      } catch (_) {}

      if (typeof window.renderUserList === 'function') window.renderUserList();
      if (typeof window.showChatToast === 'function') window.showChatToast('Status cleared to Online.', 'info');
      return;
    }

    const { id, label, emoji, motion } = statusData;
    window.currentProfile.status_text = label;
    window.currentProfile.status_emoji = emoji;
    window.currentProfile.status_key = id;
    window.currentProfile.status_motion = motion;

    userStatusCache.set(myId, { id, label, emoji, motion });
    try {
      localStorage.setItem('cc_user_status_' + myId, JSON.stringify({
        statusText: label,
        statusEmoji: emoji,
        statusKey: id,
        statusMotion: motion
      }));
    } catch (_) {}

    // Presence update
    if (typeof window.presenceBaseData === 'object' && window.presenceBaseData) {
      window.presenceBaseData.statusText = label;
      window.presenceBaseData.statusEmoji = emoji;
      window.presenceBaseData.statusKey = id;
      window.presenceBaseData.statusMotion = motion;
      if (typeof window.debouncedPresenceTrack === 'function') window.debouncedPresenceTrack();
    }

    // Broadcast update
    if (window.messageChannel && window.currentRoom?.id) {
      window.messageChannel.send({
        type: 'broadcast',
        event: 'status-updated',
        payload: {
          userId: myId,
          roomId: window.currentRoom.id,
          statusText: label,
          statusEmoji: emoji,
          statusKey: id,
          statusMotion: motion
        }
      }).catch(() => {});
    }

    // Update Supabase profiles
    try {
      await window.sbClient?.from('profiles').update({
        status_text: label,
        status_emoji: emoji,
        status_key: id,
        status_motion: motion
      }).eq('id', myId);
    } catch (_) {}

    if (typeof window.renderUserList === 'function') window.renderUserList();
    if (typeof window.showChatToast === 'function') window.showChatToast(`Status updated: ${label} ${emoji}`, 'success');
  }

  // Open the Status Picker Modal
  function openStatusPicker(onSelect) {
    document.getElementById('cc-status-picker-modal')?.remove();

    // Auto-match profile gender
    const defaultGender = getUserGender();
    let currentGenderTab = defaultGender;

    const overlay = document.createElement('div');
    overlay.id = 'cc-status-picker-modal';
    overlay.className = 'cc-status-picker-overlay';

    function renderDialog() {
      const activeStatusKey = window.currentProfile?.status_key || '';
      const isGirl = currentGenderTab === 'girl';

      // 12 Shared Statuses
      const sharedList = SHARED_STATUSES.map(item => {
        const info = isGirl ? item.girl : item.boy;
        const isSelected = activeStatusKey === item.id;
        return `
          <div class="cc-status-card${isSelected ? ' selected' : ''}" data-id="${item.id}" data-label="${item.label}" data-emoji="${info.emoji}" data-motion="${info.motion}">
            <div class="cc-status-card-emoji-wrap">
              <span class="status-motion-emoji ${info.motion}">${info.emoji}</span>
            </div>
            <div class="cc-status-card-info">
              <div class="cc-status-card-label">${item.label}</div>
              <div class="cc-status-card-tag">${info.desc}</div>
            </div>
          </div>
        `;
      }).join('');

      // Exclusive Statuses
      const exclusiveArray = isGirl ? GIRLS_EXCLUSIVE : BOYS_EXCLUSIVE;
      const exclusiveList = exclusiveArray.map(item => {
        const info = isGirl ? item.girl : item.boy;
        const isSelected = activeStatusKey === item.id;
        return `
          <div class="cc-status-card exclusive${isSelected ? ' selected' : ''}" data-id="${item.id}" data-label="${item.label}" data-emoji="${info.emoji}" data-motion="${info.motion}">
            <div class="cc-status-card-emoji-wrap">
              <span class="status-motion-emoji ${info.motion}">${info.emoji}</span>
            </div>
            <div class="cc-status-card-info">
              <div class="cc-status-card-label">${item.label}</div>
              <div class="cc-status-card-tag">${info.desc} • ${isGirl ? 'Girls Exclusive' : 'Boys Exclusive'}</div>
            </div>
          </div>
        `;
      }).join('');

      overlay.innerHTML = `
        <div class="cc-status-picker-dialog" role="dialog" aria-modal="true">
          <div class="cc-status-picker-header">
            <div>
              <h3 class="cc-status-picker-title">✨ What are you doing?</h3>
              <div class="cc-status-picker-sub">Select your behavioral status to display motion-moving emoji in the chatroom</div>
            </div>
            <button type="button" class="cc-profile-ctrl-btn close-btn" id="cc-status-close-btn" style="background:transparent;border:none;color:#aaa;font-size:1.2rem;cursor:pointer;">✕</button>
          </div>

          <div class="cc-status-gender-tabs">
            <button type="button" class="cc-gender-tab-btn tab-boy${currentGenderTab === 'boy' ? ' active' : ''}" data-gender="boy">
              👦 Boys Statuses
            </button>
            <button type="button" class="cc-gender-tab-btn tab-girl${currentGenderTab === 'girl' ? ' active' : ''}" data-gender="girl">
              👧 Girls Statuses
            </button>
          </div>

          <div class="cc-status-grid-scroll">
            <div style="grid-column: 1 / -1; font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--muted); letter-spacing: 0.05em; margin: 4px 0 2px;">
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
