(function () {
  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function esc(v) {
    return String(v || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function mountPanel() {
    var app = document.querySelector('.mix-ludo-app');
    if (!app) return null;

    var dock = el('aside', 'ludo-room-dock collapsed');
    dock.id = 'ludoRoomDock';
    dock.innerHTML = [
      '<button id="roomDockToggle" class="room-dock-toggle" type="button">Room</button>',
      '<div class="room-dock-content">',
      '  <section class="room-card seat-card">',
      '    <div class="room-card-title">Room Seats</div>',
      '    <div id="roomSeatList" class="room-seat-list"></div>',
      '  </section>',
      '  <section class="room-card">',
      '    <div class="room-card-title">Room Chat</div>',
      '    <div id="roomChatFeed" class="room-chat-feed"></div>',
      '    <form id="roomChatForm" class="room-chat-form">',
      '      <input id="roomChatInput" type="text" maxlength="240" placeholder="Say hi..." autocomplete="off" />',
      '      <button type="submit">Send</button>',
      '    </form>',
      '  </section>',
      '  <section class="room-card">',
      '    <div class="room-card-title">Voice</div>',
      '    <div class="room-voice-actions">',
      '      <button id="roomJoinVoiceBtn" type="button">Join Voice</button>',
      '      <button id="roomMuteBtn" type="button" disabled>Mute</button>',
      '    </div>',
      '    <div id="roomVoiceList" class="room-voice-list"></div>',
      '  </section>',
      '</div>'
    ].join('');

    app.appendChild(dock);

    var modal = el('div', 'ludo-entry-modal visible');
    modal.id = 'ludoEntryModal';
    modal.innerHTML = [
      '<div class="ludo-entry-card">',
      '  <h2>Join Ludo Room</h2>',
      '  <p>Select how you want to enter this room.</p>',
      '  <div class="ludo-entry-actions">',
      '    <button id="ludoEntryPlay" type="button">Play</button>',
      '    <button id="ludoEntryWatch" type="button" class="secondary">Watch</button>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    var sidePanel = document.querySelector('.side-panel');
    if (sidePanel && !document.getElementById('sidePanelToggle')) {
      var sideToggle = el('button', 'side-panel-toggle');
      sideToggle.id = 'sidePanelToggle';
      sideToggle.type = 'button';
      sideToggle.textContent = 'Controls';
      sidePanel.insertBefore(sideToggle, sidePanel.firstChild);
    }

    return dock;
  }

  function bindUi(session) {
    var dock = document.getElementById('ludoRoomDock');
    var toggleBtn = document.getElementById('roomDockToggle');
    var sidePanel = document.querySelector('.side-panel');
    var sideToggle = document.getElementById('sidePanelToggle');

    if (toggleBtn && dock) {
      toggleBtn.addEventListener('click', function () {
        dock.classList.toggle('collapsed');
      });
    }

    if (sideToggle && sidePanel) {
      sideToggle.addEventListener('click', function () {
        sidePanel.classList.toggle('is-collapsed');
      });
    }

    var entryPlay = document.getElementById('ludoEntryPlay');
    var entryWatch = document.getElementById('ludoEntryWatch');
    var entryModal = document.getElementById('ludoEntryModal');

    if (entryPlay) {
      entryPlay.addEventListener('click', function () {
        var res = session.setMode('play');
        if (res && res.ok && entryModal) entryModal.classList.remove('visible');
      });
    }

    if (entryWatch) {
      entryWatch.addEventListener('click', function () {
        session.setMode('watch');
        if (entryModal) entryModal.classList.remove('visible');
      });
    }

    var chatForm = document.getElementById('roomChatForm');
    var chatInput = document.getElementById('roomChatInput');
    if (chatForm && chatInput) {
      chatForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (session.sendChat(chatInput.value)) chatInput.value = '';
      });
    }

    var joinVoiceBtn = document.getElementById('roomJoinVoiceBtn');
    var muteBtn = document.getElementById('roomMuteBtn');
    if (joinVoiceBtn) {
      joinVoiceBtn.addEventListener('click', function () {
        session.joinVoice();
      });
    }
    if (muteBtn) {
      muteBtn.addEventListener('click', function () {
        session.toggleMute();
      });
    }
  }

  function render(state, session) {
    var playBtn = document.getElementById('ludoEntryPlay');
    var watchBtn = document.getElementById('ludoEntryWatch');
    var modal = document.getElementById('ludoEntryModal');

    var full = state.activeSeatCount >= 4 && !state.seatColor;
    if (playBtn) {
      playBtn.disabled = full;
      playBtn.textContent = full ? 'Full (4/4)' : 'Play';
    }

    if (watchBtn) {
      watchBtn.disabled = false;
      watchBtn.textContent = state.mode === 'watch' ? 'Watching' : 'Watch';
    }

    if (modal && state.mode === 'play' && state.seatColor) {
      modal.classList.remove('visible');
    }

    var seatList = document.getElementById('roomSeatList');
    if (seatList) {
      var html = '';
      for (var i = 0; i < session.colors.length; i++) {
        var color = session.colors[i];
        var seat = state.seats[color];
        html += '<div class="room-seat-row ' + color + '">';
        html += '<div><strong>' + color.charAt(0).toUpperCase() + color.slice(1) + '</strong><span>' + (seat ? esc(seat.nick) : 'Open') + '</span></div>';
        if (state.user.isAdmin && seat && seat.id !== state.user.id) {
          html += '<div class="room-seat-actions">';
          html += '<button type="button" data-action="kick" data-color="' + color + '">Kick</button>';
          html += '<button type="button" data-action="take" data-color="' + color + '">Kick &amp; Take Over Seat</button>';
          html += '</div>';
        }
        html += '</div>';
      }
      seatList.innerHTML = html;

      var actionButtons = seatList.querySelectorAll('button[data-action]');
      for (var b = 0; b < actionButtons.length; b++) {
        actionButtons[b].addEventListener('click', function () {
          var color = this.getAttribute('data-color');
          var action = this.getAttribute('data-action');
          session.adminKick(color, action === 'take');
        });
      }
    }

    var feed = document.getElementById('roomChatFeed');
    if (feed) {
      var chatHtml = '';
      for (var c = Math.max(0, state.chat.length - 40); c < state.chat.length; c++) {
        var m = state.chat[c];
        chatHtml += '<div class="room-chat-msg' + (m.system ? ' system' : '') + '"><b>' + esc(m.nick) + ':</b> ' + esc(m.text) + '</div>';
      }
      feed.innerHTML = chatHtml;
      feed.scrollTop = feed.scrollHeight;
    }

    var joinVoiceBtn = document.getElementById('roomJoinVoiceBtn');
    var muteBtn = document.getElementById('roomMuteBtn');
    if (joinVoiceBtn) {
      joinVoiceBtn.disabled = state.voice.joined;
      joinVoiceBtn.textContent = state.voice.joined ? 'In Voice' : 'Join Voice';
    }
    if (muteBtn) {
      muteBtn.disabled = !state.voice.joined;
      muteBtn.textContent = state.voice.muted ? 'Unmute' : 'Mute';
    }

    var voiceList = document.getElementById('roomVoiceList');
    if (voiceList) {
      var users = Object.keys(state.voiceUsers).map(function (id) { return state.voiceUsers[id]; });
      users.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
      if (!users.length) {
        voiceList.innerHTML = '<div class="room-voice-empty">No one in voice.</div>';
      } else {
        var vh = '';
        for (var u = 0; u < users.length; u++) {
          var vu = users[u];
          vh += '<div class="room-voice-user' + (vu.speaking ? ' speaking' : '') + '">';
          vh += '<span class="dot"></span>';
          vh += '<span>' + esc(vu.nick) + (vu.muted ? ' (muted)' : '') + '</span>';
          vh += '</div>';
        }
        voiceList.innerHTML = vh;
      }
    }
  }

  function start() {
    var session = window.LudoRoomSession;
    if (!session) return;
    mountPanel();
    bindUi(session);
    session.subscribe(function (state) {
      render(state, session);
    });
    session.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
