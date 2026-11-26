/**
 * ChatCorner Sound Effects Engine (Procedural Web Audio API)
 * Instant, 100% asset-free, zero-latency audio synthesis for chatroom events.
 * 
 * Supported Events:
 * - 'enter': User enters chatroom (ascending 2-tone chime)
 * - 'exit': User exits chatroom (descending 2-tone chime)
 * - 'message-sent': Outgoing message sent (crisp upward swoosh-pop)
 * - 'message-received': Incoming message received (friendly 2-tone ping)
 * - 'voice-sent': Outgoing voice note sent (3-tone ascending acoustic chime)
 * - 'voice-received': Incoming voice note received (rich harmonic double chime)
 * - 'call-incoming': Incoming voice call ringtone (looping melody until answered/declined)
 * - 'call-calling': Outgoing ringback tone (looping telephonic ring until answered)
 * - 'call-connected': Call answered / voice joined (cheerful ascending chime)
 * - 'call-ended': Call hung up / voice left (soft descending hangup beeps)
 */

(function (window) {
  'use strict';

  class SoundEffectsEngine {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.ringtoneTimer = null;
      this.ringbackTimer = null;
      this.isRinging = false;
      this.isRingback = false;
      this.lastPlayedTimes = {};
      this.activeRingtoneNodes = [];
      this.activeRingbackNodes = [];

      this.initSettings();
      this.bindUserGestureUnlock();
    }

    initSettings() {
      try {
        const stored = localStorage.getItem('cc_sounds_enabled');
        this.enabled = stored !== 'false';
      } catch (_) {
        this.enabled = true;
      }
      this.updateToggleButton();
    }

    isEnabled() {
      return this.enabled;
    }

    toggle(forceState) {
      this.enabled = typeof forceState === 'boolean' ? forceState : !this.enabled;
      try {
        localStorage.setItem('cc_sounds_enabled', this.enabled ? 'true' : 'false');
      } catch (_) {}
      if (!this.enabled) {
        this.stopCallSounds();
      }
      this.updateToggleButton();
      if (this.enabled) {
        this.play('message-sent');
      }
      return this.enabled;
    }

    updateToggleButton() {
      const btn = document.getElementById('btn-sound-effects-toggle');
      if (btn) {
        btn.textContent = this.enabled ? '🔊 Sounds' : '🔇 Sounds Off';
        btn.title = this.enabled ? 'Sound effects enabled (Click to mute)' : 'Sound effects muted (Click to enable)';
        btn.style.opacity = this.enabled ? '1' : '0.65';
      }
    }

    getContext() {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    bindUserGestureUnlock() {
      const unlock = () => {
        const ctx = this.getContext();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      };
      ['pointerdown', 'keydown', 'touchstart'].forEach(evt => {
        window.addEventListener(evt, unlock, { once: true, passive: true });
      });
    }

    /**
     * Synthesize a single tone with an ADSR envelope
     */
    playTone(freq, startTime, duration, type = 'sine', maxGain = 0.12, decayType = 'exponential') {
      const ctx = this.getContext();
      if (!ctx) return null;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(maxGain, startTime + 0.015);

      if (decayType === 'exponential') {
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      } else {
        gain.gain.linearRampToValueAtTime(0.0001, startTime + duration);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);

      return { osc, gain };
    }

    /**
     * Play specific chat event sound
     */
    play(soundName) {
      if (!this.enabled) return;

      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Throttle rapid repeated triggers (e.g. bulk presence events)
      const last = this.lastPlayedTimes[soundName] || 0;
      const minInterval = (soundName === 'enter' || soundName === 'exit') ? 0.35 : 0.12;
      if (now - last < minInterval) return;
      this.lastPlayedTimes[soundName] = now;

      switch (soundName) {
        case 'enter':
          // User enters chatroom: ascending 2-tone melodic chime
          this.playTone(587.33, now, 0.14, 'sine', 0.10); // D5
          this.playTone(880.00, now + 0.11, 0.32, 'sine', 0.12); // A5
          break;

        case 'exit':
          // User exits chatroom: gentle descending 2-tone chime
          this.playTone(783.99, now, 0.12, 'sine', 0.09); // G5
          this.playTone(523.25, now + 0.09, 0.28, 'sine', 0.08); // C5
          break;

        case 'message-sent': {
          // Outgoing message sent: crisp rapid upward swoosh-pop
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(620, now);
          osc.frequency.exponentialRampToValueAtTime(1380, now + 0.06);

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.12, now + 0.008);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.08);
          break;
        }

        case 'message-received':
          // Incoming message: pleasant, friendly 2-tone ping
          this.playTone(659.25, now, 0.08, 'sine', 0.10); // E5
          this.playTone(880.00, now + 0.07, 0.24, 'sine', 0.13); // A5
          break;

        case 'voice-sent':
          // Outgoing voice note sent: 3-tone ascending acoustic chime
          this.playTone(523.25, now, 0.09, 'sine', 0.09); // C5
          this.playTone(659.25, now + 0.08, 0.09, 'sine', 0.10); // E5
          this.playTone(783.99, now + 0.16, 0.26, 'sine', 0.12); // G5
          break;

        case 'voice-received':
          // Incoming voice note: rich harmonic double chime
          this.playTone(440.00, now, 0.12, 'sine', 0.08); // A4
          this.playTone(659.25, now, 0.12, 'triangle', 0.06); // E5
          this.playTone(880.00, now + 0.10, 0.28, 'sine', 0.13); // A5
          break;

        case 'call-connected':
          // Call answered or voice room connected: cheerful ascending 3-tone chime
          this.playTone(523.25, now, 0.08, 'sine', 0.10); // C5
          this.playTone(659.25, now + 0.07, 0.08, 'sine', 0.11); // E5
          this.playTone(1046.50, now + 0.14, 0.24, 'sine', 0.13); // C6
          break;

        case 'call-ended':
          // Call hung up / disconnected: 3 soft downward beeps
          this.playTone(480.00, now, 0.08, 'sine', 0.08);
          this.playTone(420.00, now + 0.09, 0.08, 'sine', 0.08);
          this.playTone(360.00, now + 0.18, 0.18, 'sine', 0.07);
          break;

        default:
          break;
      }
    }

    /**
     * Start incoming call ringtone (melodic repeating bell sequence)
     */
    startRingtone() {
      if (!this.enabled || this.isRinging) return;
      this.isRinging = true;

      const playPattern = () => {
        if (!this.isRinging || !this.enabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        // 4-note melodic bell sequence
        this.playTone(987.77, now, 0.12, 'sine', 0.13); // B5
        this.playTone(830.61, now + 0.14, 0.12, 'sine', 0.12); // G#5
        this.playTone(659.25, now + 0.28, 0.12, 'sine', 0.12); // E5
        this.playTone(987.77, now + 0.42, 0.28, 'sine', 0.14); // B5

        // Second cadence
        this.playTone(830.61, now + 0.78, 0.12, 'sine', 0.12);
        this.playTone(987.77, now + 0.92, 0.32, 'sine', 0.14);
      };

      playPattern();
      this.ringtoneTimer = setInterval(playPattern, 2200);
    }

    stopRingtone() {
      this.isRinging = false;
      if (this.ringtoneTimer) {
        clearInterval(this.ringtoneTimer);
        this.ringtoneTimer = null;
      }
    }

    /**
     * Start outgoing call ringback tone (soft dual-frequency telephonic ring)
     */
    startRingback() {
      if (!this.enabled || this.isRingback) return;
      this.isRingback = true;

      const playRingbackPulse = () => {
        if (!this.isRingback || !this.enabled) return;
        const ctx = this.getContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const duration = 1.15;

        // Dual frequency: 440 Hz + 480 Hz
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.06, now + 0.05);
        gain.gain.setValueAtTime(0.06, now + duration - 0.05);
        gain.gain.linearRampToValueAtTime(0.0001, now + duration);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
      };

      playRingbackPulse();
      this.ringbackTimer = setInterval(playRingbackPulse, 2800);
    }

    stopRingback() {
      this.isRingback = false;
      if (this.ringbackTimer) {
        clearInterval(this.ringbackTimer);
        this.ringbackTimer = null;
      }
    }

    /**
     * Stop all ringing/calling sounds immediately
     */
    stopCallSounds() {
      this.stopRingtone();
      this.stopRingback();
    }
  }

  // Create global instance
  window.ChatSounds = new SoundEffectsEngine();

})(window);
