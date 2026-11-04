/* Mix Ludo sound layer. Procedural Web Audio keeps effects local, instant, and asset-free. */
(function () {
  'use strict';

  class SoundManager {
    constructor() {
      this.enabled = false;
      this.voiceEnabled = true;
      this.context = null;
      this.lastTurn = '';
      this.lastStatus = '';
      this.lastDice = '';
      this.warningTimer = 0;
      this.warningPlayed = false;
      this.audioButton = null;
      this.speech = window.speechSynthesis || null;
      this.observer = null;
      this.setup();
    }

    setup() {
      var controls = document.querySelector('.header-buttons');
      if (controls) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'small-btn secondary-btn sound-toggle';
        button.setAttribute('aria-pressed', 'false');
        button.textContent = 'Sound: Off';
        button.title = 'Enable game sound and voice reactions';
        button.addEventListener('click', () => this.toggle());
        controls.appendChild(button);
        this.audioButton = button;
      }

      var turn = document.getElementById('currentTurn');
      var dice = document.getElementById('diceBox');
      var status = document.getElementById('gameStatus');
      var board = document.getElementById('ludoBoard');
      if (!window.MutationObserver) return;

      this.observer = new MutationObserver((records) => this.onMutations(records));
      [turn, dice, status, board].forEach((node) => {
        if (node) this.observer.observe(node, { childList: true, subtree: node === board, characterData: true, attributes: node === dice, attributeFilter: ['class'] });
      });

      document.addEventListener('click', (event) => {
        var token = event.target.closest && event.target.closest('.token');
        if (token) this.resetWarning();
        if (event.target.closest && event.target.closest('#rollBtn')) this.resetWarning();
      }, { passive: true });
      this.resetWarning();
    }

    toggle() {
      this.enabled = !this.enabled;
      if (this.enabled) {
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext && !this.context) this.context = new AudioContext();
        if (this.context && this.context.state === 'suspended') this.context.resume().catch(function () {});
        this.play('turn');
      }
      if (this.audioButton) {
        this.audioButton.textContent = this.enabled ? 'Sound: On' : 'Sound: Off';
        this.audioButton.setAttribute('aria-pressed', String(this.enabled));
      }
    }

    play(kind) {
      if (!this.enabled || !this.context) return;
      var ctx = this.context;
      var now = ctx.currentTime;
      var notes = {
        roll: [150, 210, 280], step: [480], capture: [120, 75], safe: [660, 880],
        win: [523, 659, 784, 1047], turn: [620], alert: [880, 660]
      }[kind] || [440];
      for (var i = 0; i < notes.length; i++) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        var start = now + i * (kind === 'roll' ? 0.045 : 0.09);
        osc.type = kind === 'capture' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(notes[i], start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.12, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + (kind === 'roll' ? 0.07 : 0.16));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.18);
      }
    }

    say(text) {
      if (!this.enabled || !this.voiceEnabled || !this.speech || !text) return;
      this.speech.cancel();
      var utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = 0.75;
      utterance.rate = 1.08;
      this.speech.speak(utterance);
    }

    onMutations(records) {
      var turn = document.getElementById('currentTurn');
      var dice = document.getElementById('diceBox');
      var status = document.getElementById('gameStatus');
      var board = document.getElementById('ludoBoard');
      var turnText = turn ? turn.textContent : '';
      var diceText = dice ? dice.textContent.trim() : '';
      var statusText = status ? status.textContent : '';
      var tokenMoved = false;
      var safeLanding = false;

      for (var i = 0; i < records.length; i++) {
        var record = records[i];
        if (record.type === 'childList' && board && board.contains(record.target)) {
          for (var j = 0; j < record.addedNodes.length; j++) {
            var node = record.addedNodes[j];
            if (node.nodeType === 1 && node.classList.contains('token')) {
              tokenMoved = true;
              if (record.target.classList && record.target.classList.contains('safe')) safeLanding = true;
            }
          }
        }
      }

      if (turnText && this.lastTurn && turnText !== this.lastTurn) this.play('turn');
      if (diceText !== this.lastDice && diceText && /^[1-6]$/.test(diceText)) {
        this.play('roll');
        if (diceText === '6') this.say('Six!');
        this.resetWarning();
      }
      if (tokenMoved) {
        this.play(safeLanding ? 'safe' : 'step');
        if (safeLanding) this.say('Safe zone!');
        this.resetWarning();
      }
      if (statusText && statusText !== this.lastStatus) {
        var lower = statusText.toLowerCase();
        if (lower.indexOf('captured an opponent') !== -1) {
          this.play('capture');
          this.say(['Gotcha!', 'Back to base!'][Math.floor(Math.random() * 2)]);
        } else if (lower.indexOf('wins!') !== -1 || lower.indexOf('game finished') !== -1) {
          this.play('win');
          this.say('Victory! Congratulations!');
        } else if (lower.indexOf('reached home') !== -1) {
          this.play('win');
          this.say('Home safe!');
        }
      }
      this.lastTurn = turnText;
      this.lastDice = diceText;
      this.lastStatus = statusText;
    }

    resetWarning() {
      window.clearTimeout(this.warningTimer);
      this.warningPlayed = false;
      this.warningTimer = window.setTimeout(() => {
        var roll = document.getElementById('rollBtn');
        if (!roll || roll.disabled || document.hidden) return;
        this.warningPlayed = true;
        this.play('alert');
        this.say('Your turn is almost up.');
      }, 15000);
    }
  }

  window.MixLudoSoundManager = new SoundManager();
})();
