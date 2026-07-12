/* Mix Ludo Arcade v5.3.1-stable-live | preserved v4.2.8 gameplay + turn/autoplay sync fixes */
(function () {
  window.MIX_LUDO_VERSION = "5.3.8-stable-live";
  var board = document.getElementById('ludoBoard');
  var diceBox = document.getElementById('diceBox');
  var rollBtn = document.getElementById('rollBtn');
  var newGameBtn = document.getElementById('newGameBtn');
  var showSetupBtn = document.getElementById('showSetupBtn');
  var startGameBtn = document.getElementById('startGameBtn');
  var gameStatus = document.getElementById('gameStatus');
  var currentTurn = document.getElementById('currentTurn');
  var gameSummary = document.getElementById('gameSummary');
  var pendingDicePanel = document.getElementById('pendingDicePanel');

  var setupPanel = document.getElementById('setupPanel');
  var teamUpWrap = document.getElementById('teamUpWrap');
  var seatConfigWrap = document.getElementById('seatConfigWrap');
  var teamUpToggle = document.getElementById('teamUpToggle');

  var seatGreen = document.getElementById('seatGreen');
  var seatYellow = document.getElementById('seatYellow');
  var seatBlue = document.getElementById('seatBlue');

  var ludoIdentity = {
    persistentClientId: '',
    nick: '',
    displayNick: '',
    source: ''
  };

  var liveTable = {
    gameCode: '',
    playerColor: '',
    role: '',
    status: '',
    currentTurn: '',
    isHost: false,
    pollTimer: null
  };

  var livePlayersByColor = {};
  var liveLocalGameStartedFor = '';

  var OPEN_TABLES_REFRESH_MS = 30000;
  var lastOpenTablesRefreshAt = 0;
  var openTablesVisible = false;
  var lastAppliedLiveStateSignature = '';
  var lastAppliedLiveStateSavedAt = 0;
  var lastLocalLiveStateSavedAt = 0;
  var lastLocalLiveStateLockUntil = 0;

  /*
    v5.3.5: Date.now() can return the same millisecond for two sequential
    saves, for example: select pending dice, then complete the move and pass
    the turn. If those two requests arrive out of order and have the same
    savedAt value, the older pending-dice state can overwrite the newer
    completed-move state. Keep savedAt strictly increasing in this browser.
  */
  var lastGeneratedLiveSavedAt = 0;


  var COLOR_ORDER = ['yellow', 'blue', 'red', 'green'];

  var COLOR_LABELS = {
    yellow: 'Yellow',
    blue: 'Blue',
    red: 'Red',
    green: 'Green'
  };

  var PARTNER = {
    yellow: 'red',
    red: 'yellow',
    blue: 'green',
    green: 'blue'
  };

  var MAIN_ROUTE_LENGTH = 51;
  var MAIN_PATH_LAST_DISTANCE = 50;
  var LAST_HOME_LANE_DISTANCE = 55;
  var HOME_DISTANCE = 56;

  var AUTO_ROLL_TIMEOUT_MS = 20000;
  var AUTO_MOVE_TIMEOUT_MS = 25000;
  var LIVE_AUTO_ROLL_TIMEOUT_MS = 20000;
  var LIVE_AUTO_MOVE_TIMEOUT_MS = 25000;

  var inactiveRollTimer = null;
  var inactiveMoveTimer = null;

  var mainPath = [
    [7, 2], [7, 3], [7, 4], [7, 5], [7, 6],
    [6, 7], [5, 7], [4, 7], [3, 7], [2, 7], [1, 7],
    [1, 8], [1, 9],
    [2, 9], [3, 9], [4, 9], [5, 9], [6, 9],
    [7, 10], [7, 11], [7, 12], [7, 13], [7, 14], [7, 15],
    [8, 15], [9, 15],
    [9, 14], [9, 13], [9, 12], [9, 11], [9, 10],
    [10, 9], [11, 9], [12, 9], [13, 9], [14, 9], [15, 9],
    [15, 8], [15, 7],
    [14, 7], [13, 7], [12, 7], [11, 7], [10, 7],
    [9, 6], [9, 5], [9, 4], [9, 3], [9, 2], [9, 1],
    [8, 1], [7, 1]
  ];

  var homeLanes = {
    yellow: [[8, 2], [8, 3], [8, 4], [8, 5], [8, 6]],
    blue: [[2, 8], [3, 8], [4, 8], [5, 8], [6, 8]],
    red: [[8, 14], [8, 13], [8, 12], [8, 11], [8, 10]],
    green: [[14, 8], [13, 8], [12, 8], [11, 8], [10, 8]]
  };

  var startMainIndex = {
    yellow: 0,
    blue: 13,
    red: 26,
    green: 39
  };

  var safeMainIndexes = {
    0: true,
    8: true,
    13: true,
    21: true,
    26: true,
    34: true,
    39: true,
    47: true
  };

  var arrowJumpMapByCoord = {
    '2-7': { to: '2-8', color: 'blue', label: 'Blue curved arrow' },
    '7-14': { to: '8-14', color: 'red', label: 'Red curved arrow' },
    '14-9': { to: '14-8', color: 'green', label: 'Green curved arrow' },
    '9-2': { to: '8-2', color: 'yellow', label: 'Yellow curved arrow' },

    '6-9': { to: '7-10', color: null, label: 'Blue-to-Red diagonal arrow' },
    '9-10': { to: '10-9', color: null, label: 'Red-to-Green diagonal arrow' },
    '10-7': { to: '9-6', color: null, label: 'Green-to-Yellow diagonal arrow' },
    '7-6': { to: '6-7', color: null, label: 'Yellow-to-Blue diagonal arrow' }
  };

  var visualArrowClasses = {
    '2-7': 'arrow-home-blue',
    '7-14': 'arrow-home-red',
    '14-9': 'arrow-home-green',
    '9-2': 'arrow-home-yellow',

    '6-9': 'arrow-mark arrow-diag-down-right',
    '9-10': 'arrow-mark arrow-diag-down-left',
    '10-7': 'arrow-mark arrow-diag-up-left',
    '7-6': 'arrow-mark arrow-diag-up-right'
  };

  var colorRoutes = {};
  var cellByKey = {};
  var yardSlots = {};
  var tokens = {};
  var mainIndexByKey = {};
  var centerHomeEl = null;

  var gameStarted = false;
  var rolling = false;
  var waitingForMove = false;
  var lastDice = null;
  var botTimeout = null;

  var setup = {
    mode: 'classic',
    players: 2,
    teamUp: false,
    seats: {
      yellow: 'human',
      blue: 'human',
      red: 'human',
      green: 'human'
    }
  };

  var game = {
    activeColors: ['yellow', 'red'],
    turnOrder: ['yellow', 'red'],
    currentTurnIndex: 0,
    fortifiedCells: {},
    winner: null,
    finishedOrder: [],
    rollQueue: [],
    selectedRollIndex: -1,
    mandatoryBonusRolls: 0,
    consecutiveSixes: 0,
    leaderboardSubmitted: false,
    autoplay: {
      yellow: false,
      blue: false,
      green: false,
      red: false
    },
    stats: {
      captures: {
        yellow: 0,
        blue: 0,
        red: 0,
        green: 0
      }
    }
  };

  function keyOf(r, c) {
    return r + '-' + c;
  }

  function cloneArray(arr) {
    return arr.slice(0);
  }

  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function cleanLudoNick(value) {
    value = String(value || '').trim();

    if (!value) {
      return '';
    }

    value = value.replace(/[\x00-\x1F\x7F]/g, '');
    value = value.substring(0, 64);
    value = value.replace(/[<>"'`\\]/g, '');

    return value;
  }

  function cleanGameCode(value) {
    value = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (value.length < 6 || value.length > 32) {
      return '';
    }

    return value;
  }

  function parseApiResponse(res, url) {
    return res.text().then(function (text) {
      var data = null;

      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('[LUDO API NON-JSON]', url);
        console.error('HTTP status:', res.status);
        console.error('Response text:', text.substring(0, 2000));

        return {
          ok: false,
          error: 'API returned non-JSON response. Check browser Console.',
          http_status: res.status,
          raw_preview: text.substring(0, 300)
        };
      }

      if (!res.ok) {
        console.error('[LUDO API HTTP ERROR]', url, res.status, data);

        if (!data.error) {
          data.error = 'HTTP error ' + res.status;
        }

        data.ok = false;
      }

      return data;
    });
  }

  function apiPost(url, payload) {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload || {})
    }).then(function (res) {
      return parseApiResponse(res, url);
    }).catch(function (err) {
      console.error('[LUDO API POST FAILED]', url, err);

      return {
        ok: false,
        error: 'Network/API request failed'
      };
    });
  }

  function apiGet(url) {
    return fetch(url, {
      method: 'GET',
      credentials: 'same-origin'
    }).then(function (res) {
      return parseApiResponse(res, url);
    }).catch(function (err) {
      console.error('[LUDO API GET FAILED]', url, err);

      return {
        ok: false,
        error: 'Network/API request failed'
      };
    });
  }

  function escapeLobbyHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getNickFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var nick =
        params.get('nick') ||
        params.get('ludo_nick') ||
        params.get('irc_nick') ||
        params.get('nick_name') ||
        params.get('nickname') ||
        params.get('username') ||
        params.get('user') ||
        params.get('name') ||
        '';

      return cleanLudoNick(nick);
    } catch (e) {
      return '';
    }
  }


  function getStoredCurrentNick() {
    /*
      v4.2.8: Do NOT use saved browser nick values as identity source.
      Saved nick values caused stale names such as Test123 to appear for every
      later Ludo popup. Current nick must come from URL or a fresh postMessage
      sent by the chat/main page.
    */
    return '';
  }

  function readNickFromWindow(win) {
    if (!win) {
      return '';
    }

    var candidates = [];
    var names = [
      'mixLudoNick',
      'mixCurrentNick',
      'currentNick',
      'curNick',
      'myNick',
      'my_nick',
      'ircNick',
      'irc_nick',
      'chatNick',
      'userNick',
      'username',
      'user_name',
      'userName',
      'currentUser',
      'curUser',
      'myUser'
    ];

    try {
      for (var i = 0; i < names.length; i++) {
        var raw = win[names[i]];

        if (typeof raw === 'string') {
          candidates.push(raw);
        } else if (raw && typeof raw === 'object') {
          candidates.push(raw.nick || raw.username || raw.user_name || raw.name || raw.userName || '');
        }
      }
    } catch (e) {}

    try {
      if (win.sessionStorage) {
        var storageKeys = [
          'mix_ludo_current_nick',
          'mix_current_nick',
          'current_nick',
          'irc_nick',
          'chat_nick',
          'ludo_nick',
          'user_nick',
          'username',
          'nick'
        ];

        /*
          Read sessionStorage only. Never read opener localStorage for nick,
          because it can contain old test nick values from a previous window.
        */
        for (var s = 0; s < storageKeys.length; s++) {
          candidates.push(win.sessionStorage.getItem(storageKeys[s]) || '');
        }
      }
    } catch (e2) {}

    try {
      if (win.document) {
        var selectors = [
          '#ludoNick',
          '#currentNick',
          '#curNick',
          '#userNick',
          '#user_name',
          '#username',
          'input[name="nick"]',
          'input[name="username"]',
          'input[name="user_name"]',
          '[data-current-nick]',
          '[data-nick]'
        ];

        for (var q = 0; q < selectors.length; q++) {
          var el = win.document.querySelector(selectors[q]);

          if (el) {
            candidates.push(el.value || el.textContent || el.getAttribute('data-current-nick') || el.getAttribute('data-nick') || '');
          }
        }
      }
    } catch (e3) {}

    for (var c = 0; c < candidates.length; c++) {
      var nick = cleanLudoNick(candidates[c]);

      if (nick) {
        return nick;
      }
    }

    return '';
  }

  function getNickFromOpenerOrParent() {
    /*
      v4.2.8: Do not scrape opener/parent DOM or storage for nick.
      The main page may still contain stale testing nick values. Instead, Ludo
      requests a fresh MIX_CHAT_NICK message and accepts only URL/postMessage.
    */
    return '';
  }

  function requestNickFromOpenerOrParent() {
    var msg = {
      type: 'MIX_LUDO_REQUEST_USER',
      source: 'ludo',
      href: window.location.href
    };

    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(msg, '*');
      }
    } catch (e) {}

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, '*');
      }
    } catch (e2) {}
  }

  function setResolvedLudoNick(nick, source) {
    nick = cleanLudoNick(nick);

    if (!nick) {
      return false;
    }

    ludoIdentity.nick = nick;
    ludoIdentity.displayNick = nick;
    ludoIdentity.source = source || 'direct';

    try {
      sessionStorage.setItem('mix_ludo_current_nick', nick);
    } catch (e) {}

    applyLudoIdentityToUI();
    return true;
  }

  function refreshImmediateNickFromPageContext() {
    var urlNick = getNickFromUrl();

    if (urlNick) {
      setResolvedLudoNick(urlNick, 'url_nick');
      return urlNick;
    }

    /*
      No stale browser storage and no device-history lookup here. Ask the
      opener/parent to send a fresh MIX_CHAT_NICK message instead.
    */
    requestNickFromOpenerOrParent();
    return '';
  }

  function getCookieValue(name) {
    var parts = document.cookie ? document.cookie.split(';') : [];

    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();

      if (part.indexOf(name + '=') === 0) {
        return decodeURIComponent(part.substring(name.length + 1));
      }
    }

    return '';
  }

  function findPersistentClientId() {
    var keys = [
      'persistent_client_id',
      'mix_persistent_client_id',
      'mix_pcid',
      'pcid',
      'device_id',
      'mix_device_id',
      'mixchatroom_pcid'
    ];

    for (var i = 0; i < keys.length; i++) {
      try {
        var value = localStorage.getItem(keys[i]);

        if (value && value.indexOf('pcid_') === 0) {
          return value;
        }
      } catch (e) {}
    }

    try {
      for (var j = 0; j < localStorage.length; j++) {
        var k = localStorage.key(j);
        var v = localStorage.getItem(k);

        if (v && typeof v === 'string' && v.indexOf('pcid_') === 0) {
          return v;
        }
      }
    } catch (e2) {}

    for (var c = 0; c < keys.length; c++) {
      var cookieValue = getCookieValue(keys[c]);

      if (cookieValue && cookieValue.indexOf('pcid_') === 0) {
        return cookieValue;
      }
    }

    if (window.mixPersistentClientId && String(window.mixPersistentClientId).indexOf('pcid_') === 0) {
      return String(window.mixPersistentClientId);
    }

    if (window.persistentClientId && String(window.persistentClientId).indexOf('pcid_') === 0) {
      return String(window.persistentClientId);
    }

    if (window.MixChatroomDeviceId && window.MixChatroomDeviceId.ensurePersistentClientId) {
      try {
        var pcid = window.MixChatroomDeviceId.ensurePersistentClientId();

        if (pcid && String(pcid).indexOf('pcid_') === 0) {
          return String(pcid);
        }
      } catch (e3) {}
    }

    return '';
  }

  function getLobbyNick() {
    var freshNick = refreshImmediateNickFromPageContext();

    if (freshNick) {
      return freshNick;
    }

    return cleanLudoNick(ludoIdentity.displayNick || ludoIdentity.nick || 'Guest');
  }

  function getCurrentNickForApi() {
    var nick = cleanLudoNick(ludoIdentity.displayNick || ludoIdentity.nick || '');

    if (nick && nick !== 'Guest') {
      return nick;
    }

    nick = cleanLudoNick(getNickFromUrl() || getStoredCurrentNick() || '');

    if (nick && nick !== 'Guest') {
      return nick;
    }

    return nick || '';
  }

  function setPlayerDisplayName(color, nick) {
    var card = document.getElementById('player-' + color);

    if (!card) {
      return;
    }

    var nameEl = card.querySelector('.player-name');

    if (!nameEl) {
      return;
    }

    var icon = '';

    if (color === 'yellow') icon = '🟡';
    if (color === 'blue') icon = '🔵';
    if (color === 'green') icon = '🟢';
    if (color === 'red') icon = '🔴';

    if (nick && nick !== '') {
      nameEl.textContent = icon + ' ' + COLOR_LABELS[color] + ' - ' + nick;
    } else {
      nameEl.textContent = icon + ' ' + COLOR_LABELS[color];
    }
  }

  function applyLudoIdentityToUI() {
    if (!ludoIdentity.displayNick) {
      return;
    }

    if (!liveTable.gameCode) {
      setPlayerDisplayName('red', ludoIdentity.displayNick);
    } else if (liveTable.playerColor) {
      setPlayerDisplayName(liveTable.playerColor, ludoIdentity.displayNick);
    }

    if (gameStatus && (!gameStarted || gameStatus.textContent.indexOf('Select setup') !== -1)) {
      gameStatus.textContent = 'Welcome ' + ludoIdentity.displayNick + ' to Mix Ludo Arcade.';
    }
  }

  function resolveLudoIdentity() {
    var pcid = findPersistentClientId();
    var urlNick = getNickFromUrl();

    ludoIdentity.persistentClientId = pcid;

    /*
      v4.2.8 identity rule:
      1. URL nick wins: /ludo/index.html?nick=AnOtherNick
      2. Fresh postMessage can update nick after load.
      3. If no fresh nick is passed, show Guest.

      Important: do NOT call https://www.mixchatroom.com/ludo/api/resolve_identity.php here. That API
      reads device nick history and can return old names such as Test123.
    */
    if (urlNick) {
      setResolvedLudoNick(urlNick, 'url_nick');
      return urlNick;
    }

    requestNickFromOpenerOrParent();

    ludoIdentity.nick = '';
    ludoIdentity.displayNick = 'Guest';
    ludoIdentity.source = 'guest_waiting_for_fresh_chat_nick';
    applyLudoIdentityToUI();

    return 'Guest';
  }

  function getLocalLeaderboardNick() {
    return cleanLudoNick(ludoIdentity.displayNick || ludoIdentity.nick || '');
  }

  function getLocalLeaderboardResult() {
    if (!game.winner) {
      return '';
    }

    if (canUseTeamUp()) {
      if (game.winner === 'Team A') {
        return 'team_win';
      }

      return 'loss';
    }

    if (game.winner === COLOR_LABELS.red) {
      return 'win';
    }

    return 'loss';
  }

  function submitLeaderboardResult() {
    if (game.leaderboardSubmitted) {
      return;
    }

    game.leaderboardSubmitted = true;

    var nick = getLocalLeaderboardNick();

    if (!nick) {
      nick = 'Guest';
    }

    var result = getLocalLeaderboardResult();

    if (!result) {
      return;
    }

    var redCaptures = 0;

    if (game.stats && game.stats.captures && typeof game.stats.captures.red === 'number') {
      redCaptures = game.stats.captures.red;
    }

    var payload = {
      nick: nick,
      mode: setup.mode,
      result: result,
      captures: redCaptures,
      tokens_home: getHomeTokenCount('red'),
      player_count: setup.players,
      team_up: canUseTeamUp() ? 1 : 0,
      winner: game.winner || '',
      persistent_client_id: ludoIdentity.persistentClientId || findPersistentClientId() || ''
    };

    fetch('https://www.mixchatroom.com/ludo/api/submit_result.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok) {
          gameStatus.innerHTML += '<br><strong>Leaderboard updated for ' + nick + '.</strong>';
        } else {
          gameStatus.innerHTML += '<br><strong>Leaderboard update failed.</strong>';
        }
      })
      .catch(function () {
        gameStatus.innerHTML += '<br><strong>Leaderboard update failed.</strong>';
      });
  }

  function clearRollInactivityTimer() {
    if (inactiveRollTimer) {
      clearTimeout(inactiveRollTimer);
      inactiveRollTimer = null;
    }
  }

  function clearMoveInactivityTimer() {
    if (inactiveMoveTimer) {
      clearTimeout(inactiveMoveTimer);
      inactiveMoveTimer = null;
    }
  }

  function clearInactivityTimers() {
    clearRollInactivityTimer();
    clearMoveInactivityTimer();
  }

  function isAutoplayOn(color) {
    return game.autoplay && game.autoplay[color] === true;
  }

  function canLocalManageAutoplay(color) {
    if (!liveTable.gameCode) {
      return true;
    }

    if (!isLiveLocalPlayer()) {
      return false;
    }

    return liveTable.playerColor === color;
  }

  function setAutoplay(color, enabled, reason) {
    if (!game.autoplay) {
      game.autoplay = {};
    }

    game.autoplay[color] = enabled === true;

    refreshPlayerCards();
    refreshAutoplayButtons();

    if (liveTable.gameCode && liveTable.status === 'active' && isLiveLocalPlayer() && liveTable.playerColor === color) {
      saveLiveGameStateToServer('active', true);
    }

    if (enabled) {
      clearInactivityTimers();

      if (reason) {
        gameStatus.innerHTML +=
          '<br><strong>' +
          COLOR_LABELS[color] +
          ' autoplay turned ON: ' +
          reason +
          '.</strong>';
      }

      maybeHandleBotTurn();
    } else {
      clearBotTimeout();
      clearInactivityTimers();

      if (liveTable.gameCode && liveTable.status === 'active' && liveTable.playerColor === color) {
        gameStatus.innerHTML += '<br><strong>' + COLOR_LABELS[color] + ' autoplay turned OFF. Please play before the timer expires again.</strong>';
      }

      maybeHandleBotTurn();
      scheduleHumanInactivityTimers();
    }
  }

  function getAutoRollTimeoutMs() {
    return (liveTable.gameCode && liveTable.status === 'active') ? LIVE_AUTO_ROLL_TIMEOUT_MS : AUTO_ROLL_TIMEOUT_MS;
  }

  function getAutoMoveTimeoutMs() {
    return (liveTable.gameCode && liveTable.status === 'active') ? LIVE_AUTO_MOVE_TIMEOUT_MS : AUTO_MOVE_TIMEOUT_MS;
  }

  function getRollBlockReason() {
    if (!gameStarted) return 'game-not-started';
    if (game.winner) return 'game-finished';
    if (rolling) return 'dice-rolling';
    if (!isLocalLiveTurnWithoutStatusSideEffects()) return 'not-your-live-turn';
    if (game.mandatoryBonusRolls > 0) return '';
    if (waitingForMove) return 'waiting-for-token-move';
    if (lastDice !== null) return 'selected-dice-not-consumed';
    if (game.rollQueue && game.rollQueue.length > 0) return 'pending-dice-must-be-played';
    return '';
  }

  function syncLiveControlState() {
    refreshPlayerCards();
    refreshAutoplayButtons();
    updateRollButtonState();

    if (!liveTable.gameCode || liveTable.status !== 'active') {
      return;
    }

    var turnColor = getCurrentTurnColor();

    if (currentTurn && turnColor && COLOR_LABELS[turnColor]) {
      forceLiveTurnDisplay(turnColor);
    }

    if (!isLocalLiveTurnWithoutStatusSideEffects()) {
      if (rollBtn) rollBtn.disabled = true;
      return;
    }

    if (!rolling && !game.winner && game.mandatoryBonusRolls <= 0 && !waitingForMove && lastDice === null && (!game.rollQueue || game.rollQueue.length === 0)) {
      if (rollBtn) rollBtn.disabled = false;
    }
  }

  function scheduleHumanInactivityTimers() {
    clearInactivityTimers();

    if (!gameStarted || game.winner || rolling) {
      return;
    }

    var turnColor = getCurrentTurnColor();

    /*
      v5.3.8: In live games, only the browser that owns the current-turn color
      may start the inactivity timer and enable autoplay. Watchers/opponents must
      not start timers for another player.
    */
    if (liveTable.gameCode && liveTable.status === 'active') {
      if (!isLiveLocalPlayer() || liveTable.playerColor !== turnColor) {
        return;
      }
    }

    if (getSeatType(turnColor) !== 'human') {
      return;
    }

    if (isAutoplayOn(turnColor)) {
      return;
    }

    if (game.mandatoryBonusRolls > 0) {
      inactiveRollTimer = setTimeout(function () {
        setAutoplay(turnColor, true, 'no bonus roll within time');
      }, getAutoRollTimeoutMs());

      return;
    }

    if (waitingForMove || game.rollQueue.length > 0) {
      inactiveMoveTimer = setTimeout(function () {
        setAutoplay(turnColor, true, 'no move within time');
      }, getAutoMoveTimeoutMs());

      return;
    }

    inactiveRollTimer = setTimeout(function () {
      setAutoplay(turnColor, true, 'no dice roll within time');
    }, getAutoRollTimeoutMs());
  }

  function setupAutoplayControls() {
    var checks = document.querySelectorAll('.auto-check');

    for (var i = 0; i < checks.length; i++) {
      checks[i].addEventListener('change', function () {
        var color = this.getAttribute('data-auto-color');

        if (!color) {
          return;
        }

        if (this.checked === true && !isAutoplayOn(color)) {
          this.checked = false;
          return;
        }

        if (this.checked === false && isAutoplayOn(color)) {
          if (!canLocalManageAutoplay(color)) {
            this.checked = true;
            return;
          }

          setAutoplay(color, false, null);
        }
      });
    }

    refreshAutoplayButtons();
  }

  function refreshAutoplayButtons() {
    var colors = ['yellow', 'blue', 'green', 'red'];

    for (var i = 0; i < colors.length; i++) {
      var color = colors[i];
      var check = document.getElementById('auto-' + color);
      var card = document.getElementById('player-' + color);
      var label = check ? check.closest('.player-auto-toggle') : null;

      var canManageThisAuto = isAutoplayOn(color) && canLocalManageAutoplay(color);

      if (check) {
        check.checked = isAutoplayOn(color);
        check.disabled = !canManageThisAuto;
      }

      if (label) {
        if (liveTable.gameCode && liveTable.status === 'active' && liveTable.playerColor !== color) {
          label.title = 'Only the owner of this color can change Auto mode.';
        } else {
          label.title = canManageThisAuto ? 'Turn Auto mode off for your color.' : '';
        }

        if (canManageThisAuto) {
          label.classList.remove('disabled-auto');
        } else {
          label.classList.add('disabled-auto');
        }
      }

      if (card) {
        if (isAutoplayOn(color)) {
          card.classList.add('auto-enabled');
        } else {
          card.classList.remove('auto-enabled');
        }
      }
    }
  }

  function buildMainIndexLookup() {
    mainIndexByKey = {};

    for (var i = 0; i < mainPath.length; i++) {
      mainIndexByKey[keyOf(mainPath[i][0], mainPath[i][1])] = i;
    }
  }

  function buildRoutes() {
    colorRoutes = {};

    for (var i = 0; i < COLOR_ORDER.length; i++) {
      var color = COLOR_ORDER[i];
      var start = startMainIndex[color];
      var rotated = [];

      for (var j = 0; j < MAIN_ROUTE_LENGTH; j++) {
        rotated.push(mainPath[(start + j) % mainPath.length]);
      }

      colorRoutes[color] = rotated.concat(homeLanes[color]);
    }
  }

  function setupUIBindings() {
    var modeButtons = document.querySelectorAll('#modeButtons .pill-btn');
    var playerModeButtons = document.querySelectorAll('#playerModeButtons .pill-btn');

    for (var i = 0; i < modeButtons.length; i++) {
      modeButtons[i].addEventListener('click', function () {
        var btns = document.querySelectorAll('#modeButtons .pill-btn');

        for (var k = 0; k < btns.length; k++) {
          btns[k].classList.remove('active');
        }

        this.classList.add('active');
        setup.mode = this.getAttribute('data-mode');
        refreshSetupVisibility();
      });
    }

    for (var j = 0; j < playerModeButtons.length; j++) {
      playerModeButtons[j].addEventListener('click', function () {
        var btns = document.querySelectorAll('#playerModeButtons .pill-btn');

        for (var k = 0; k < btns.length; k++) {
          btns[k].classList.remove('active');
        }

        this.classList.add('active');
        setup.players = parseInt(this.getAttribute('data-players'), 10);
        refreshSetupVisibility();
      });
    }

    teamUpToggle.addEventListener('change', function () {
      setup.teamUp = !!this.checked;
    });

    seatGreen.addEventListener('change', syncSeatsFromUI);
    seatYellow.addEventListener('change', syncSeatsFromUI);
    seatBlue.addEventListener('change', syncSeatsFromUI);

    showSetupBtn.addEventListener('click', function () {
      setupPanel.classList.toggle('hidden');
    });

    startGameBtn.addEventListener('click', function () {
      syncSeatsFromUI();
      startConfiguredGame();
    });

    newGameBtn.addEventListener('click', function () {
      startConfiguredGame();
    });

    rollBtn.addEventListener('click', rollDice);

    setupAutoplayControls();
  }


  function getOrCreateCurrentTableBox() {
    var box = document.getElementById('currentTableBox');

    if (box) {
      return box;
    }

    var lobbyPanel = document.getElementById('lobbyPanel');
    var openTablesList = document.getElementById('openTablesList');
    var openTablesCard = openTablesList ? openTablesList.parentNode : null;
    var parent = lobbyPanel || (openTablesCard ? openTablesCard.parentNode : null) || document.body;

    box = document.createElement('div');
    box.id = 'currentTableBox';
    box.className = 'current-table-box hidden';
    box.style.margin = '10px 0';
    box.style.padding = '12px';
    box.style.border = '1px solid rgba(255,204,0,0.65)';
    box.style.borderRadius = '12px';
    box.style.background = 'rgba(15,23,42,0.96)';
    box.style.boxShadow = '0 0 0 1px rgba(255,204,0,0.12) inset';

    var title = document.createElement('div');
    title.id = 'currentTableTitle';
    title.className = 'current-table-title';
    title.style.fontWeight = '800';
    title.style.color = '#ffcc00';
    title.style.marginBottom = '6px';
    title.textContent = 'Current Table';

    var meta = document.createElement('div');
    meta.id = 'currentTableMeta';
    meta.className = 'current-table-meta';
    meta.style.fontSize = '12px';
    meta.style.marginBottom = '8px';
    meta.textContent = '';

    var actions = document.createElement('div');
    actions.id = 'currentTableActionBar';
    actions.className = 'current-table-actions';
    actions.style.display = 'flex';
    actions.style.flexWrap = 'wrap';
    actions.style.gap = '8px';
    actions.style.alignItems = 'center';
    actions.style.margin = '10px 0';

    var seats = document.createElement('div');
    seats.id = 'tableSeats';
    seats.className = 'table-seats';

    box.appendChild(title);
    box.appendChild(meta);
    box.appendChild(actions);
    box.appendChild(seats);

    /*
      Put the Current Table panel before the Open Tables card, not inside it.
      This keeps Copy Code / Start Game visible after a host creates a table.
    */
    if (openTablesCard && openTablesCard.parentNode) {
      openTablesCard.parentNode.insertBefore(box, openTablesCard);
    } else if (lobbyPanel) {
      lobbyPanel.appendChild(box);
    } else {
      parent.appendChild(box);
    }

    return box;
  }


  function getOrCreateCurrentTableActionBar() {
    var box = getOrCreateCurrentTableBox();

    if (!box) {
      return null;
    }

    var bar = document.getElementById('currentTableActionBar');

    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'currentTableActionBar';
      bar.className = 'current-table-actions';
      bar.style.display = 'flex';
      bar.style.flexWrap = 'wrap';
      bar.style.gap = '8px';
      bar.style.alignItems = 'center';
      bar.style.margin = '10px 0';

      var seats = document.getElementById('tableSeats');

      if (seats && seats.parentNode) {
        seats.parentNode.insertBefore(bar, seats);
      } else {
        box.appendChild(bar);
      }
    }

    return bar;
  }

  function makeLiveActionButton(id, text, className) {
    var btn = document.getElementById(id);

    if (btn) {
      return btn;
    }

    var bar = getOrCreateCurrentTableActionBar();

    if (!bar) {
      return null;
    }

    btn = document.createElement('button');
    btn.id = id;
    btn.type = 'button';
    btn.textContent = text;
    btn.className = className || 'secondary-btn';
    btn.style.padding = '8px 12px';
    btn.style.borderRadius = '8px';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = '700';

    bar.appendChild(btn);
    return btn;
  }

  function getOrCreateActionButton(id, text, className) {
    var bar = getOrCreateCurrentTableActionBar();

    if (!bar) {
      return null;
    }

    var btn = document.getElementById(id);

    if (!btn) {
      btn = document.createElement('button');
      btn.id = id;
      btn.type = 'button';
      btn.textContent = text;
    }

    if (btn.parentNode !== bar) {
      bar.appendChild(btn);
    }

    btn.type = 'button';
    btn.textContent = text;
    btn.className = className || 'secondary-btn';
    btn.style.padding = '8px 12px';
    btn.style.borderRadius = '8px';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = '700';
    btn.style.margin = '0';

    return btn;
  }

  function ensureLiveTableActionButtons() {
    var copyBtn = getOrCreateActionButton('copyTableCodeBtn', 'Copy Code', 'secondary-btn');
    var startBtn = getOrCreateActionButton('startTableBtn', 'Start Game', 'primary-btn');
    var leaveBtn = getOrCreateActionButton('leaveTableBtn', 'Leave Table', 'danger-btn');

    /* Remove older duplicate live buttons if they exist from previous versions. */
    var oldIds = ['copyTableCodeBtnLive', 'startTableBtnLive', 'leaveTableBtnLive'];
    for (var i = 0; i < oldIds.length; i++) {
      var old = document.getElementById(oldIds[i]);
      if (old && old.parentNode) {
        old.parentNode.removeChild(old);
      }
    }

    if (copyBtn && !copyBtn.__mixLudoBound) {
      copyBtn.addEventListener('click', copyCurrentTableCode);
      copyBtn.__mixLudoBound = true;
    }

    if (startBtn && !startBtn.__mixLudoBound) {
      startBtn.addEventListener('click', startLiveTable);
      startBtn.__mixLudoBound = true;
    }

    if (leaveBtn && !leaveBtn.__mixLudoBound) {
      leaveBtn.addEventListener('click', function () {
        leaveLiveTableManual('manual_leave');
      });
      leaveBtn.__mixLudoBound = true;
    }

    updateLobbyActionButtons();
  }

  function copyCurrentTableCode() {
    if (!liveTable.gameCode) {
      gameStatus.innerHTML = 'No table code to copy yet.';
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(liveTable.gameCode).then(function () {
        gameStatus.innerHTML = 'Table code copied: <strong>' + liveTable.gameCode + '</strong>';
      }).catch(function () {
        gameStatus.innerHTML = 'Table code: <strong>' + liveTable.gameCode + '</strong>';
      });
    } else {
      gameStatus.innerHTML = 'Table code: <strong>' + liveTable.gameCode + '</strong>';
    }
  }

  function isInBlockingLiveTable() {
    return !!(liveTable.gameCode && liveTable.status !== 'finished' && liveTable.status !== 'abandoned');
  }

  function updateLobbyActionButtons() {
    var createTableBtn = document.getElementById('createTableBtn');
    var joinCodeBtn = document.getElementById('joinCodeBtn');
    var copyTableCodeBtn = document.getElementById('copyTableCodeBtn');
    var startTableBtn = document.getElementById('startTableBtn');
    var leaveTableBtn = document.getElementById('leaveTableBtn');

    var currentBox = document.getElementById('currentTableBox');
    if (currentBox) {
      if (liveTable.gameCode) {
        currentBox.classList.remove('hidden');
        currentBox.style.display = '';
      } else {
        currentBox.classList.add('hidden');
        currentBox.style.display = 'none';
      }
    }

    var blocking = isInBlockingLiveTable();

    if (createTableBtn) {
      createTableBtn.disabled = blocking;
      createTableBtn.title = blocking ? 'Leave your current table before creating another table' : 'Create a live table';
    }

    if (joinCodeBtn) {
      joinCodeBtn.disabled = blocking;
      joinCodeBtn.title = blocking ? 'Leave your current table before joining another table' : 'Join a table';
    }

    var hasCode = !!liveTable.gameCode;

    if (copyTableCodeBtn) {
      copyTableCodeBtn.disabled = !hasCode;
      copyTableCodeBtn.style.display = hasCode ? '' : 'none';
    }

    if (leaveTableBtn) {
      leaveTableBtn.disabled = !hasCode;
      leaveTableBtn.style.display = hasCode ? '' : 'none';
    }

    var canStart = false;
    var shouldShowStart = false;

    if (liveTable.gameCode && liveTable.isHost && liveTable.status === 'waiting') {
      shouldShowStart = true;
      var playerCount = setup.players === 4 ? 4 : 2;
      var seated = 0;

      for (var c = 0; c < COLOR_ORDER.length; c++) {
        if (livePlayersByColor[COLOR_ORDER[c]]) {
          seated++;
        }
      }

      canStart = seated >= playerCount;
    }

    if (startTableBtn) {
      startTableBtn.disabled = !canStart;
      startTableBtn.style.display = shouldShowStart ? '' : 'none';
      startTableBtn.textContent = canStart ? 'Start Game' : 'Start Game';
      startTableBtn.title = canStart ? 'Start this live game' : 'Waiting for required players to join';
    }
  }

  function refreshOpenTablesThrottled(force) {
    var now = Date.now();

    if (force || now - lastOpenTablesRefreshAt >= OPEN_TABLES_REFRESH_MS) {
      lastOpenTablesRefreshAt = now;
      refreshOpenTables();
    }
  }

  function showOpenTablesPrompt() {
    var list = document.getElementById('openTablesList');
    if (!list) return;
    openTablesVisible = false;
    list.innerHTML = '<div class="open-table-empty">Click <strong>Refresh / Show Tables</strong> to load open tables.</div>';
  }

  function showOpenTablesNow() {
    openTablesVisible = true;
    refreshOpenTables();
  }

  function setupLobbyBindings() {
    var lobbyToggleBtn = document.getElementById('lobbyToggleBtn');
    var lobbyPanel = document.getElementById('lobbyPanel');
    var createTableBtn = document.getElementById('createTableBtn');
    var joinCodeBtn = document.getElementById('joinCodeBtn');
    var refreshTablesBtn = document.getElementById('refreshTablesBtn');
    var copyTableCodeBtn = document.getElementById('copyTableCodeBtn');
    var startTableBtn = document.getElementById('startTableBtn');
    var watchTableBtn = document.getElementById('watchTableBtn');

    getOrCreateCurrentTableBox();
    ensureLiveTableActionButtons();
    updateLobbyActionButtons();

    if (lobbyToggleBtn && lobbyPanel) {
      lobbyToggleBtn.addEventListener('click', function () {
        lobbyPanel.classList.toggle('hidden');
      });
    }

    if (createTableBtn) {
      createTableBtn.addEventListener('click', function () {
        if (liveTable.gameCode) {
          gameStatus.innerHTML =
            'You are already in table <strong>' + liveTable.gameCode +
            '</strong>. Please use <strong>Leave Table</strong> before creating another table.';
          updateLobbyActionButtons();
          return;
        }

        createLiveTableFromSetup();
      });
    }

    if (joinCodeBtn) {
      joinCodeBtn.addEventListener('click', function () {
        if (liveTable.gameCode) {
          gameStatus.innerHTML =
            'You are already in table <strong>' + liveTable.gameCode +
            '</strong>. Please use <strong>Leave Table</strong> before joining another table.';
          updateLobbyActionButtons();
          return;
        }

        var input = document.getElementById('joinCodeInput');
        joinLiveTableByCode(input ? input.value : '');
      });
    }

    if (refreshTablesBtn) {
      refreshTablesBtn.textContent = 'Show Open Tables';
      refreshTablesBtn.addEventListener('click', function () {
        showOpenTablesNow();
      });
    }

    if (copyTableCodeBtn) {
      copyTableCodeBtn.addEventListener('click', copyCurrentTableCode);
    }

    if (startTableBtn) {
      startTableBtn.addEventListener('click', startLiveTable);
      startTableBtn.textContent = 'Start Game';
    }

    if (watchTableBtn) {
      watchTableBtn.addEventListener('click', function () {
        if (liveTable.gameCode) {
          loadTableState(liveTable.gameCode);
        }
      });
    }

    var params = new URLSearchParams(window.location.search);
    var joinCode = cleanGameCode(params.get('join') || params.get('game') || params.get('code') || '');

    if (joinCode) {
      var inputBox = document.getElementById('joinCodeInput');

      if (inputBox) {
        inputBox.value = joinCode;
      }

      joinLiveTableByCode(joinCode);
    }

    updateLobbyActionButtons();
  }

  function syncSeatsFromUI() {
    setup.seats.red = 'human';
    setup.seats.green = seatGreen.value;
    setup.seats.yellow = seatYellow.value;
    setup.seats.blue = seatBlue.value;
    setup.teamUp = !!teamUpToggle.checked;
  }

  function refreshSetupVisibility() {
    var is4 = setup.players === 4;
    var teamAllowed = is4 && (setup.mode === 'classic' || setup.mode === 'arrow' || setup.mode === 'blitz');

    if (is4) {
      seatConfigWrap.classList.remove('hidden');
    } else {
      seatConfigWrap.classList.add('hidden');
    }

    if (teamAllowed) {
      teamUpWrap.classList.remove('hidden');
    } else {
      teamUpWrap.classList.add('hidden');
      teamUpToggle.checked = false;
      setup.teamUp = false;
    }
  }

  function getActiveColorsFromSetup() {
    if (liveTable.gameCode && livePlayersByColor) {
      var liveColors = [];

      for (var l = 0; l < COLOR_ORDER.length; l++) {
        var liveColor = COLOR_ORDER[l];

        if (livePlayersByColor[liveColor]) {
          liveColors.push(liveColor);
        }
      }

      if (liveColors.length >= 2) {
        return liveColors;
      }
    }

    if (setup.players === 2) {
      return ['yellow', 'red'];
    }

    var result = [];

    for (var i = 0; i < COLOR_ORDER.length; i++) {
      var color = COLOR_ORDER[i];

      if (color === 'red') {
        result.push('red');
        continue;
      }

      if (setup.seats[color] !== 'off') {
        result.push(color);
      }
    }

    return result;
  }

  function isLiveSeatedRole(role) {
    return role === 'host' || role === 'player';
  }

  function isLiveLocalPlayer() {
    return !!(liveTable.gameCode && liveTable.playerColor && isLiveSeatedRole(liveTable.role));
  }

  function canLocalControlColor(color) {
    if (!liveTable.gameCode) {
      return true;
    }

    if (!isLiveLocalPlayer()) {
      return false;
    }

    if (liveTable.status !== 'active') {
      return false;
    }

    if (liveTable.currentTurn && COLOR_LABELS[liveTable.currentTurn]) {
      return liveTable.playerColor === liveTable.currentTurn;
    }

    return liveTable.playerColor === color;
  }


  function setLocalTurnToColor(turnColor) {
    if (!turnColor || !COLOR_LABELS[turnColor]) {
      return;
    }

    if (game.turnOrder && game.turnOrder.length) {
      var idx = game.turnOrder.indexOf(turnColor);
      if (idx >= 0) {
        game.currentTurnIndex = idx;
      }
    }
  }

  function forceLiveTurnDisplay(turnColor) {
    if (!turnColor || !COLOR_LABELS[turnColor]) {
      return;
    }

    setLocalTurnToColor(turnColor);

    if (currentTurn) {
      currentTurn.textContent = COLOR_LABELS[turnColor] + ' Turn';
      currentTurn.className = 'current-turn ' + turnColor + '-text';
    }

    for (var i = 0; i < COLOR_ORDER.length; i++) {
      var color = COLOR_ORDER[i];
      var el = document.getElementById('player-' + color);

      if (!el) continue;

      el.classList.remove('active');

      if (color === turnColor) {
        el.classList.add('active');
      }
    }
  }

  function canThisBrowserPlayLiveTurn() {
    if (!liveTable.gameCode || liveTable.status !== 'active') {
      return true;
    }

    if (!liveTable.playerColor || !isLiveLocalPlayer()) {
      if (gameStatus) {
        gameStatus.innerHTML = 'You are watching this game only.';
      }
      return false;
    }

    if (liveTable.currentTurn && COLOR_LABELS[liveTable.currentTurn]) {
      forceLiveTurnDisplay(liveTable.currentTurn);

      if (liveTable.playerColor !== liveTable.currentTurn) {
        if (gameStatus) {
          gameStatus.innerHTML =
            'Waiting for <strong>' +
            COLOR_LABELS[liveTable.currentTurn] +
            '</strong> player to play.';
        }
        return false;
      }
    }

    return true;
  }

  function getSeatType(color) {
    /*
      v5.1.8: In live games, the local browser must always control its own
      assigned color. Older live state saved by the host may mark this color as
      remote in setup.seats, and polling may temporarily refresh players before
      labels are updated. Trust liveTable.playerColor first.
    */
    if (liveTable.gameCode) {
      if (liveTable.playerColor === color && isLiveSeatedRole(liveTable.role)) {
        return 'human';
      }

      if (livePlayersByColor && livePlayersByColor[color]) {
        if (parseInt(livePlayersByColor[color].is_left || 0, 10) === 1) {
          return 'left';
        }
        return 'remote';
      }

      return 'off';
    }

    if (setup.players === 2) {
      if (color === 'yellow' || color === 'red') {
        return 'human';
      }

      return 'off';
    }

    return setup.seats[color] || 'off';
  }

  function getSeatTypeLabel(color) {
    var seatType = getSeatType(color);

    if (seatType === 'bot') return 'Bot';
    if (seatType === 'remote') return (liveTable.gameCode ? 'Opponent' : 'Remote');
    if (seatType === 'left') return 'Left';
    if (seatType === 'off') return 'Off';
    return 'Human';
  }

  function canUseTeamUp() {
    return (
      setup.players === 4 &&
      (setup.mode === 'classic' || setup.mode === 'arrow' || setup.mode === 'blitz') &&
      game.activeColors.length === 4 &&
      setup.teamUp === true
    );
  }

  function clearBotTimeout() {
    if (botTimeout) {
      clearTimeout(botTimeout);
      botTimeout = null;
    }
  }

  function resetGameState() {
    clearBotTimeout();
    clearInactivityTimers();

    game.activeColors = getActiveColorsFromSetup();
    game.turnOrder = cloneArray(game.activeColors);
    game.currentTurnIndex = 0;
    game.fortifiedCells = {};
    game.winner = null;
    game.finishedOrder = [];
    game.rollQueue = [];
    game.selectedRollIndex = -1;
    game.mandatoryBonusRolls = 0;
    game.consecutiveSixes = 0;
    game.leaderboardSubmitted = false;
    game.stats = {
      captures: {
        yellow: 0,
        blue: 0,
        red: 0,
        green: 0
      }
    };
    game.autoplay = {
      yellow: false,
      blue: false,
      green: false,
      red: false
    };

    rolling = false;
    waitingForMove = false;
    lastDice = null;
    gameStarted = true;
  }

  function clearBoard() {
    board.innerHTML = '';
    cellByKey = {};
    yardSlots = {};
    centerHomeEl = null;
  }

  function isInsideYardArea(r, c) {
    if (r >= 1 && r <= 6 && c >= 1 && c <= 6) return true;
    if (r >= 1 && r <= 6 && c >= 10 && c <= 15) return true;
    if (r >= 10 && r <= 15 && c >= 1 && c <= 6) return true;
    if (r >= 10 && r <= 15 && c >= 10 && c <= 15) return true;
    return false;
  }

  function isInsideCenterArea(r, c) {
    return r >= 7 && r <= 9 && c >= 7 && c <= 9;
  }

  function createBasicCells() {
    for (var r = 1; r <= 15; r++) {
      for (var c = 1; c <= 15; c++) {
        if (isInsideYardArea(r, c) || isInsideCenterArea(r, c)) {
          continue;
        }

        var cell = document.createElement('div');
        cell.className = getCellClass(r, c);
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.style.left = (((c - 1) / 15) * 100) + '%';
        cell.style.top = (((r - 1) / 15) * 100) + '%';

        cellByKey[keyOf(r, c)] = cell;
        board.appendChild(cell);
      }
    }
  }

  function getCellClass(r, c) {
    var cls = 'cell';
    var key = keyOf(r, c);
    var mainIndex = typeof mainIndexByKey[key] === 'number' ? mainIndexByKey[key] : -1;

    if (mainIndex !== -1) cls += ' path';

    if (isCoordInArray([r, c], homeLanes.yellow)) cls += ' yellow-home';
    if (isCoordInArray([r, c], homeLanes.blue)) cls += ' blue-home';
    if (isCoordInArray([r, c], homeLanes.red)) cls += ' red-home';
    if (isCoordInArray([r, c], homeLanes.green)) cls += ' green-home';

    if (mainIndex !== -1 && safeMainIndexes[mainIndex]) cls += ' safe';

    if (mainIndex === startMainIndex.yellow) cls += ' start-safe-yellow';
    if (mainIndex === startMainIndex.blue) cls += ' start-safe-blue';
    if (mainIndex === startMainIndex.red) cls += ' start-safe-red';
    if (mainIndex === startMainIndex.green) cls += ' start-safe-green';

    if (visualArrowClasses[key]) cls += ' ' + visualArrowClasses[key];

    return cls;
  }

  function isCoordInArray(coord, arr) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i][0] === coord[0] && arr[i][1] === coord[1]) return true;
    }

    return false;
  }

  function createYard(color, cssClass) {
    var yard = document.createElement('div');
    yard.className = 'yard ' + cssClass + ' ' + color + '-bg';

    var inner = document.createElement('div');
    inner.className = 'yard-inner';

    yardSlots[color] = [];

    for (var i = 0; i < 4; i++) {
      var slot = document.createElement('div');
      slot.className = 'token-slot';
      slot.dataset.color = color;
      slot.dataset.token = i;

      yardSlots[color].push(slot);
      inner.appendChild(slot);
    }

    yard.appendChild(inner);
    board.appendChild(yard);
  }

  function createCenterHome() {
    var center = document.createElement('div');
    center.className = 'center-home';

    var icon = document.createElement('span');
    icon.textContent = '★';

    center.appendChild(icon);
    board.appendChild(center);
    centerHomeEl = center;
  }

  function createToken(color, tokenIndex) {
    var tokenEl = document.createElement('div');
    tokenEl.className = 'token ' + color + '-token';
    tokenEl.dataset.color = color;
    tokenEl.dataset.token = tokenIndex;

    tokenEl.addEventListener('click', function () {
      handleTokenClick(color, tokenIndex);
    });

    return tokenEl;
  }

  function initTokens() {
    tokens = {};

    for (var i = 0; i < COLOR_ORDER.length; i++) {
      var color = COLOR_ORDER[i];
      tokens[color] = [];

      for (var j = 0; j < 4; j++) {
        tokens[color].push({
          color: color,
          index: j,
          element: createToken(color, j),
          distance: -1,
          homeCounted: false,
          protected: false
        });
      }
    }
  }

  function buildBoard() {
    clearBoard();
    createBasicCells();

    createYard('yellow', 'yellow-yard');
    createYard('blue', 'blue-yard');
    createYard('green', 'green-yard');
    createYard('red', 'red-yard');

    createCenterHome();
  }

  function applyModeOpeningRule() {
    if (setup.mode === 'arrow' || setup.mode === 'blitz') {
      for (var i = 0; i < game.activeColors.length; i++) {
        var color = game.activeColors[i];
        tokens[color][0].distance = 0;
      }
    }
  }

  function renderAllTokens() {
    clearTokenSelections();
    clearTokenProtectionClasses();

    for (var i = 0; i < COLOR_ORDER.length; i++) {
      var color = COLOR_ORDER[i];

      for (var j = 0; j < tokens[color].length; j++) {
        placeSingleToken(tokens[color][j]);
      }
    }

    recalculateFortificationAndProtection();
    refreshCellOccupancyClasses();
    refreshPlayerCards();
    renderPendingDicePanel();
    updateRollButtonState();
    refreshAutoplayButtons();
    restoreLocalMoveSelectionIfNeeded();
    applyLudoIdentityToUI();
  }

  function placeSingleToken(token) {
    if (token.distance === -1) {
      if (yardSlots[token.color] && yardSlots[token.color][token.index]) {
        yardSlots[token.color][token.index].appendChild(token.element);
      }

      return;
    }

    if (token.distance >= 0 && token.distance <= LAST_HOME_LANE_DISTANCE) {
      var coord = colorRoutes[token.color][token.distance];
      var cell = cellByKey[keyOf(coord[0], coord[1])];

      if (cell) cell.appendChild(token.element);
      return;
    }

    if (token.distance === HOME_DISTANCE) {
      if (centerHomeEl) centerHomeEl.appendChild(token.element);
    }
  }

  function clearTokenSelections() {
    var allTokens = board.querySelectorAll('.token');

    for (var i = 0; i < allTokens.length; i++) {
      allTokens[i].classList.remove('selectable');
    }
  }

  function clearTokenProtectionClasses() {
    var allTokens = board.querySelectorAll('.token');

    for (var i = 0; i < allTokens.length; i++) {
      allTokens[i].classList.remove('protected-token');
    }

    var allCells = board.querySelectorAll('.cell');

    for (var j = 0; j < allCells.length; j++) {
      allCells[j].classList.remove('fortified-cell');
    }
  }

  function refreshCellOccupancyClasses() {
    var allCells = board.querySelectorAll('.cell');

    for (var i = 0; i < allCells.length; i++) {
      allCells[i].classList.remove('has-token');
      allCells[i].classList.remove('multi-token');

      var cellTokens = allCells[i].querySelectorAll('.token');

      if (cellTokens.length > 0) allCells[i].classList.add('has-token');
      if (cellTokens.length > 1) allCells[i].classList.add('multi-token');
    }
  }

  function recalculateFortificationAndProtection() {
    var occupants = {};
    var i;
    var j;
    var color;
    var token;
    var key;

    for (i = 0; i < COLOR_ORDER.length; i++) {
      color = COLOR_ORDER[i];

      for (j = 0; j < tokens[color].length; j++) {
        tokens[color][j].protected = false;
      }
    }

    for (i = 0; i < game.activeColors.length; i++) {
      color = game.activeColors[i];

      for (j = 0; j < tokens[color].length; j++) {
        token = tokens[color][j];

        if (token.distance >= 0 && token.distance <= MAIN_PATH_LAST_DISTANCE) {
          key = getTokenCoordKey(token);

          if (!occupants[key]) occupants[key] = [];
          occupants[key].push(token);
        }
      }
    }

    /*
      v5.3.8 fortified-cell rule:
      - A cell becomes fortified when two or more same-color tokens are present.
      - Once fortified, it stays fortified while the cell has two or more total
        tokens of any colors.
      - Fortification ends only when one or zero tokens remain in that cell.
    */
    for (key in game.fortifiedCells) {
      if (!game.fortifiedCells.hasOwnProperty(key)) continue;

      if (!occupants[key] || occupants[key].length <= 1) {
        delete game.fortifiedCells[key];
      }
    }

    for (key in occupants) {
      if (!occupants.hasOwnProperty(key)) continue;

      var colorCount = {};

      for (i = 0; i < occupants[key].length; i++) {
        color = occupants[key][i].color;

        if (!colorCount[color]) colorCount[color] = 0;
        colorCount[color]++;
      }

      for (color in colorCount) {
        if (!colorCount.hasOwnProperty(color)) continue;

        if (colorCount[color] >= 2) game.fortifiedCells[key] = true;
      }
    }

    for (i = 0; i < game.activeColors.length; i++) {
      color = game.activeColors[i];

      for (j = 0; j < tokens[color].length; j++) {
        token = tokens[color][j];

        if (token.distance >= 0 && token.distance <= MAIN_PATH_LAST_DISTANCE) {
          key = getTokenCoordKey(token);
          var mainIndex = getTokenMainIndex(token);

          if (safeMainIndexes[mainIndex]) token.protected = true;
          if (game.fortifiedCells[key]) token.protected = true;

          if (token.protected) token.element.classList.add('protected-token');
        }
      }
    }

    for (key in game.fortifiedCells) {
      if (!game.fortifiedCells.hasOwnProperty(key)) continue;

      var parts = key.split('-');
      var cell = cellByKey[keyOf(parseInt(parts[0], 10), parseInt(parts[1], 10))];

      if (cell) cell.classList.add('fortified-cell');
    }
  }

  function getTokenCoord(token) {
    if (token.distance >= 0 && token.distance <= LAST_HOME_LANE_DISTANCE) {
      return colorRoutes[token.color][token.distance];
    }

    return null;
  }

  function getTokenCoordKey(token) {
    var coord = getTokenCoord(token);
    if (!coord) return null;
    return keyOf(coord[0], coord[1]);
  }

  function getTokenMainIndex(token) {
    var coord = getTokenCoord(token);
    if (!coord) return -1;

    var key = keyOf(coord[0], coord[1]);

    if (typeof mainIndexByKey[key] === 'number') {
      return mainIndexByKey[key];
    }

    return -1;
  }

  function getDistanceForCoordKey(color, coordKey) {
    if (!colorRoutes[color]) return -1;

    for (var i = 0; i < colorRoutes[color].length; i++) {
      if (keyOf(colorRoutes[color][i][0], colorRoutes[color][i][1]) === coordKey) {
        return i;
      }
    }

    return -1;
  }

  function getHomeTokenCount(color) {
    var count = 0;

    for (var i = 0; i < tokens[color].length; i++) {
      if (tokens[color][i].distance === HOME_DISTANCE) count++;
    }

    return count;
  }

  function isColorComplete(color) {
    if (setup.mode === 'blitz') {
      return getHomeTokenCount(color) >= 1;
    }

    return getHomeTokenCount(color) >= 4;
  }

  function getControllableColor(turnColor) {
    if (!canUseTeamUp()) return turnColor;
    if (!isColorComplete(turnColor)) return turnColor;

    var partner = PARTNER[turnColor];

    if (partner && game.activeColors.indexOf(partner) !== -1 && !isColorComplete(partner)) {
      return partner;
    }

    return turnColor;
  }

  function updateTurnDisplay() {
    if (!gameStarted || game.winner) return;

    var turnColor = getCurrentTurnColor();
    var controlColor = getControllableColor(turnColor);
    var displayText = COLOR_LABELS[turnColor] + ' Turn';

    if (controlColor !== turnColor) {
      displayText = COLOR_LABELS[turnColor] + ' Turn (Helping ' + COLOR_LABELS[controlColor] + ')';
    }

    currentTurn.textContent = displayText;
    currentTurn.className = 'current-turn ' + turnColor + '-text';

    for (var i = 0; i < COLOR_ORDER.length; i++) {
      var color = COLOR_ORDER[i];
      var el = document.getElementById('player-' + color);

      if (!el) continue;

      el.classList.remove('active');

      if (color === turnColor) el.classList.add('active');
    }
  }

  function refreshPlayerCards() {
    for (var i = 0; i < COLOR_ORDER.length; i++) {
      var color = COLOR_ORDER[i];
      var card = document.getElementById('player-' + color);
      var meta = document.getElementById('meta-' + color);

      if (!card || !meta) continue;

      var homeCount = getHomeTokenCount(color);
      var seatType = getSeatType(color);
      var active = game.activeColors.indexOf(color) !== -1;

      card.classList.remove('inactive');
      card.classList.remove('finished');

      if (!active) {
        card.classList.add('inactive');
        meta.textContent = 'Off';
      } else {
        var autoText = isAutoplayOn(color) ? ' • Auto ON' : '';

        if (seatType === 'left') {
          autoText = ' • Left';
        }

        meta.textContent =
          getSeatTypeLabel(color) +
          ' • ' +
          homeCount +
          ' Home' +
          autoText;

        if (isColorComplete(color)) card.classList.add('finished');
      }
    }
  }

  function updateGameSummary() {
    var activeSeatText = [];

    for (var i = 0; i < game.activeColors.length; i++) {
      var c = game.activeColors[i];
      activeSeatText.push(COLOR_LABELS[c] + ' (' + getSeatTypeLabel(c) + ')');
    }

    var lines = [];

    lines.push('Mode: ' + capitalize(setup.mode));
    lines.push('Players: ' + setup.players + '-Player');
    lines.push('Seats: ' + activeSeatText.join(', '));

    if (canUseTeamUp()) {
      lines.push('Team-Up: ON');
      lines.push('Team A: Yellow + Red');
      lines.push('Team B: Blue + Green');
    } else {
      lines.push('Team-Up: OFF');
    }

    gameSummary.innerHTML = lines.join('<br>');
  }

  function startConfiguredGame() {
    if (!liveTable.gameCode) {
      syncSeatsFromUI();
    }

    resetGameState();

    if (game.activeColors.length < 2) {
      gameStatus.innerHTML = 'Please keep at least <strong>2 active players</strong> in the match.';
      return;
    }

    if (!canUseTeamUp()) {
      setup.teamUp = false;
      teamUpToggle.checked = false;
    }

    buildBoard();
    initTokens();
    applyModeOpeningRule();
    renderAllTokens();
    applyLudoIdentityToUI();
    refreshAutoplayButtons();
    updateGameSummary();
    updateTurnDisplay();

    setupPanel.classList.add('hidden');

    var lobbyPanel = document.getElementById('lobbyPanel');
    if (lobbyPanel) {
      lobbyPanel.classList.add('hidden');
    }

    updateRollButtonState();
    diceBox.textContent = '🎲';

    if (canUseTeamUp()) {
      gameStatus.innerHTML =
        'Game started. ' +
        COLOR_LABELS[game.turnOrder[0]] +
        ' goes first.<br><strong>Team A:</strong> Yellow + Red. <strong>Team B:</strong> Blue + Green.';
    } else {
      gameStatus.innerHTML = 'Game started. ' + COLOR_LABELS[game.turnOrder[0]] + ' goes first.';
    }

    maybeHandleBotTurn();
    scheduleHumanInactivityTimers();
  }

  function nextTurn() {
    if (game.winner) return;

    waitingForMove = false;
    lastDice = null;
    game.rollQueue = [];
    game.selectedRollIndex = -1;
    game.mandatoryBonusRolls = 0;
    game.consecutiveSixes = 0;
    clearTokenSelections();

    var safety = 0;

    do {
      game.currentTurnIndex++;

      if (game.currentTurnIndex >= game.turnOrder.length) {
        game.currentTurnIndex = 0;
      }

      safety++;

      if (safety > game.turnOrder.length + 2) break;
    } while (shouldSkipTurnColor(game.turnOrder[game.currentTurnIndex]));

    updateTurnDisplay();

    if (liveTable.gameCode && liveTable.status === 'active') {
      /*
        v5.3.3 fix:
        The browser that just completed its own move is the only browser that
        can legally advance the turn. After we change liveTable.currentTurn to
        the next color, a normal write check would think this browser is no
        longer allowed to save, so the next-turn state would never reach the
        server. Save this turn-transfer explicitly with the trusted local-player
        override. This fixes games getting stuck on Yellow after Yellow moves.
      */
      liveTable.currentTurn = getCurrentTurnColor();
      forceLiveTurnDisplay(liveTable.currentTurn);
      saveLiveGameStateToServer('active', true);
    }

    renderPendingDicePanel();
    updateRollButtonState();
    maybeHandleBotTurn();
    scheduleHumanInactivityTimers();
  }

  function shouldSkipTurnColor(color) {
    if (canUseTeamUp()) return false;
    if (game.activeColors.length <= 2) return false;
    return isColorComplete(color);
  }

  function getCurrentTurnColor() {
    return game.turnOrder[game.currentTurnIndex];
  }

  function isHumanTurn() {
    if (liveTable.gameCode && liveTable.status === 'active') {
      return !!(liveTable.playerColor && liveTable.playerColor === getCurrentTurnColor() && isLiveSeatedRole(liveTable.role));
    }

    return getSeatType(getCurrentTurnColor()) === 'human';
  }

  function queueText() {
    if (!game.rollQueue.length) return '';
    return game.rollQueue.join(', ');
  }

  function isLocalLiveTurnWithoutStatusSideEffects() {
    if (!liveTable.gameCode || liveTable.status !== 'active') {
      return true;
    }

    if (!liveTable.playerColor || !isLiveLocalPlayer()) {
      return false;
    }

    if (liveTable.currentTurn && COLOR_LABELS[liveTable.currentTurn]) {
      return liveTable.playerColor === liveTable.currentTurn;
    }

    return liveTable.playerColor === getCurrentTurnColor();
  }


  function canThisBrowserWriteLiveState(statusOverride, allowOwnAutoplayUpdate) {
    if (!liveTable.gameCode || liveTable.status !== 'active' || !isLiveLocalPlayer()) {
      return false;
    }

    if (statusOverride === 'finished') {
      return true;
    }

    if (allowOwnAutoplayUpdate === true) {
      return true;
    }

    return isLocalLiveTurnWithoutStatusSideEffects();
  }

  function isLocalTurnInProgress() {
    return !!(
      liveTable.gameCode &&
      liveTable.status === 'active' &&
      liveTable.playerColor &&
      liveTable.currentTurn === liveTable.playerColor &&
      (rolling || waitingForMove || lastDice !== null || (game.rollQueue && game.rollQueue.length > 0) || game.mandatoryBonusRolls > 0)
    );
  }

  function canRollNow() {
    var reason = getRollBlockReason();
    if (reason) return false;
    return true;
  }

  function updateRollButtonState() {
    if (!rollBtn) {
      return;
    }

    rollBtn.disabled = !canRollNow();
  }

  function renderPendingDicePanel() {
    if (!pendingDicePanel) return;

    pendingDicePanel.innerHTML = '';

    if (!game.rollQueue.length) {
      pendingDicePanel.textContent = 'No pending dice';
      return;
    }

    var disabled = game.mandatoryBonusRolls > 0 || rolling || game.winner;
    var turnColor = getCurrentTurnColor();
    var controlColor = getControllableColor(turnColor);

    for (var i = 0; i < game.rollQueue.length; i++) {
      var value = game.rollQueue[i];
      var btn = document.createElement('button');
      btn.className = 'pending-dice-btn';
      btn.type = 'button';
      btn.textContent = value;
      btn.dataset.index = i;

      if (i === game.selectedRollIndex) btn.classList.add('active');
      if (getMovableTokens(controlColor, value).length === 0) btn.classList.add('no-move');

      if (disabled) {
        btn.disabled = true;
        btn.classList.add('disabled');
      } else {
        btn.addEventListener('click', function () {
          selectPendingRoll(parseInt(this.dataset.index, 10));
        });
      }

      pendingDicePanel.appendChild(btn);
    }
  }

  function rollDice() {
    clearRollInactivityTimer();
    clearMoveInactivityTimer();

    if (!gameStarted || game.winner) return;

    if (!canThisBrowserPlayLiveTurn()) {
      updateRollButtonState();
      return;
    }

    if (!canRollNow()) {
      updateRollButtonState();
      return;
    }

    rolling = true;
    rollBtn.disabled = true;
    renderPendingDicePanel();
    diceBox.classList.remove('rolling');

    setTimeout(function () {
      diceBox.classList.add('rolling');
    }, 20);

    var animationCount = 0;

    var interval = setInterval(function () {
      diceBox.textContent = Math.floor(Math.random() * 6) + 1;
      animationCount++;

      if (animationCount >= 8) {
        clearInterval(interval);

        var value = Math.floor(Math.random() * 6) + 1;
        diceBox.textContent = value;

        finishRoll(value);
      }
    }, 60);
  }

  function finishRoll(value) {
    rolling = false;
    diceBox.classList.remove('rolling');

    if (game.mandatoryBonusRolls > 0) {
      game.mandatoryBonusRolls--;
    }

    game.rollQueue.push(value);
    game.selectedRollIndex = -1;

    if (value === 6) {
      game.consecutiveSixes++;

      if (game.consecutiveSixes >= 3) {
        gameStatus.innerHTML =
          COLOR_LABELS[getCurrentTurnColor()] +
          ' rolled <strong>6, 6, 6</strong>. All three rolls are wasted. Turn goes to next player.';

        game.rollQueue = [];
        game.selectedRollIndex = -1;
        game.mandatoryBonusRolls = 0;
        waitingForMove = false;
        lastDice = null;
        clearTokenSelections();
        renderPendingDicePanel();

        setTimeout(function () {
          nextTurn();
        }, 900);

        return;
      }

      game.mandatoryBonusRolls++;
    } else {
      game.consecutiveSixes = 0;
    }

    waitingForMove = false;
    lastDice = null;
    clearTokenSelections();

    if (game.mandatoryBonusRolls > 0) {
      gameStatus.innerHTML =
        COLOR_LABELS[getCurrentTurnColor()] +
        ' rolled <strong>' + value + '</strong>.<br>' +
        'Mandatory bonus roll pending. Roll again before moving any token.<br>' +
        'Queued rolls: <strong>' + queueText() + '</strong>';

      renderPendingDicePanel();
      updateRollButtonState();
      /* v5.3.7: Do not persist in-progress bonus-roll state. Only stable
         completed move / turn-transfer states are saved to avoid stale pending
         dice blocking the next player. */
      maybeHandleBotTurn();
      scheduleHumanInactivityTimers();
      return;
    }

    activateNextPendingAction();
    /* v5.3.7: Do not save selected/pending move snapshots here. The move
       completion or no-move turn-transfer will save the stable state. */
    maybeHandleBotTurn();
    scheduleHumanInactivityTimers();
  }

  function activateNextPendingAction() {
    clearTokenSelections();

    if (!gameStarted || game.winner) return;

    renderPendingDicePanel();

    if (game.mandatoryBonusRolls > 0) {
      waitingForMove = false;
      lastDice = null;
      updateRollButtonState();
      scheduleHumanInactivityTimers();
      return;
    }

    if (!game.rollQueue.length) {
      waitingForMove = false;
      lastDice = null;
      clearTokenSelections();
      updateRollButtonState();
      nextTurn();
      return;
    }

    var turnColor = getCurrentTurnColor();
    var controlColor = getControllableColor(turnColor);
    var available = getPlayableRollIndexes(controlColor);

    if (available.length === 0) {
      gameStatus.innerHTML =
        COLOR_LABELS[turnColor] +
        ' has no valid moves for queued dice <strong>' + queueText() + '</strong>. Turn goes to next player.';

      game.rollQueue = [];
      game.selectedRollIndex = -1;
      waitingForMove = false;
      lastDice = null;
      clearTokenSelections();
      renderPendingDicePanel();

      setTimeout(function () {
        nextTurn();
      }, 800);

      return;
    }

    if (available.length === 1) {
      selectPendingRoll(available[0]);
      return;
    }

    waitingForMove = false;
    lastDice = null;
    game.selectedRollIndex = -1;
    renderPendingDicePanel();

    gameStatus.innerHTML =
      COLOR_LABELS[turnColor] +
      ', choose which dice number to play first.<br>' +
      'Queued rolls: <strong>' + queueText() + '</strong>';

    updateRollButtonState();
    scheduleHumanInactivityTimers();
  }

  function getPlayableRollIndexes(color) {
    var indexes = [];

    for (var i = 0; i < game.rollQueue.length; i++) {
      if (getMovableTokens(color, game.rollQueue[i]).length > 0) {
        indexes.push(i);
      }
    }

    return indexes;
  }

  function selectPendingRoll(index) {
    if (game.mandatoryBonusRolls > 0 || rolling || game.winner) return;
    if (index < 0 || index >= game.rollQueue.length) return;

    var turnColor = getCurrentTurnColor();
    var controlColor = getControllableColor(turnColor);
    var value = game.rollQueue[index];
    var movable = getMovableTokens(controlColor, value);

    if (movable.length === 0) {
      gameStatus.innerHTML = 'No valid move for dice <strong>' + value + '</strong>. Choose another pending number.';
      return;
    }

    game.selectedRollIndex = index;
    waitingForMove = true;
    lastDice = value;
    markSelectableTokens(movable);
    renderPendingDicePanel();

    var msg =
      COLOR_LABELS[turnColor] +
      ' selected dice <strong>' + value + '</strong>. Select a token.';

    if (controlColor !== turnColor) {
      msg =
        COLOR_LABELS[turnColor] +
        ' selected dice <strong>' + value + '</strong>. Use ' +
        COLOR_LABELS[controlColor] + ' tokens.';
    }

    gameStatus.innerHTML = msg;
    updateRollButtonState();

    /* v5.3.7: selection is local-only. Persisting waitingForMove snapshots
       caused stale pending dice to overwrite completed moves on opponents. */
    maybeHandleBotTurn();
    scheduleHumanInactivityTimers();
  }

  function getMovableTokens(color, diceValue) {
    var list = [];

    for (var i = 0; i < tokens[color].length; i++) {
      var token = tokens[color][i];

      if (canTokenMove(token, diceValue)) {
        list.push(token);
      }
    }

    return list;
  }

  function canTokenMove(token, diceValue) {
    if (token.distance === HOME_DISTANCE) return false;
    if (token.distance === -1) return diceValue === 6;

    if (token.distance >= 0 && token.distance < HOME_DISTANCE) {
      return token.distance + diceValue <= HOME_DISTANCE;
    }

    return false;
  }

  function markSelectableTokens(list) {
    clearTokenSelections();

    for (var i = 0; i < list.length; i++) {
      list[i].element.classList.add('selectable');
    }
  }

  function restoreLocalMoveSelectionIfNeeded() {
    if (!waitingForMove || lastDice === null || game.winner) {
      return;
    }

    if (!canLocalControlColor(getCurrentTurnColor())) {
      return;
    }

    var controlColor = getControllableColor(getCurrentTurnColor());
    markSelectableTokens(getMovableTokens(controlColor, lastDice));

    if (rollBtn) {
      rollBtn.disabled = true;
    }
  }

  function handleTokenClick(color, index) {
    if (!waitingForMove || lastDice === null || game.winner) return;

    if (liveTable.gameCode && !canLocalControlColor(getCurrentTurnColor())) {
      return;
    }

    if (!isHumanTurn()) return;
    if (game.mandatoryBonusRolls > 0) return;

    var turnColor = getCurrentTurnColor();
    var controlColor = getControllableColor(turnColor);

    if (color !== controlColor) return;

    var token = tokens[color][index];

    /*
      v5.1.8: Do not rely only on the CSS selectable class in live play.
      Polling/re-rendering can clear the class between dice selection and click.
      If it is the local player's turn and the token can legally move with the
      selected dice, allow the move.
    */
    if (!token.element.classList.contains('selectable') && !canTokenMove(token, lastDice)) {
      return;
    }

    executeMove(token, lastDice);
  }

  function executeMove(token, diceValue) {
    clearBotTimeout();
    clearInactivityTimers();
    clearTokenSelections();

    var moveResult = {
      captured: false,
      arrowBonus: false,
      reachedHome: false
    };

    if (token.distance === -1) {
      token.distance = 0;
      gameStatus.innerHTML = COLOR_LABELS[getCurrentTurnColor()] + ' opened a token.';
    } else {
      token.distance += diceValue;
      gameStatus.innerHTML =
        COLOR_LABELS[getCurrentTurnColor()] +
        ' moved <strong>' + diceValue + '</strong> step(s).';
    }

    if (token.distance === HOME_DISTANCE) {
      moveResult.reachedHome = true;
      token.homeCounted = true;
      gameStatus.innerHTML += '<br>' + COLOR_LABELS[token.color] + ' token reached home!';
    }

    if (token.distance >= 0 && token.distance <= LAST_HOME_LANE_DISTANCE) {
      if (token.distance <= MAIN_PATH_LAST_DISTANCE && handleCapture(token)) {
        moveResult.captured = true;
      }

      if ((setup.mode === 'arrow' || setup.mode === 'blitz') && handleArrowJumpAndBonus(token)) {
        moveResult.arrowBonus = true;

        if (token.distance >= 0 && token.distance <= MAIN_PATH_LAST_DISTANCE) {
          if (handleCapture(token)) moveResult.captured = true;
        }
      }
    }

    if (game.selectedRollIndex >= 0 && game.selectedRollIndex < game.rollQueue.length) {
      game.rollQueue.splice(game.selectedRollIndex, 1);
    } else if (game.rollQueue.length > 0) {
      game.rollQueue.shift();
    }

    game.selectedRollIndex = -1;

    if (moveResult.captured) {
      game.mandatoryBonusRolls++;
      gameStatus.innerHTML += '<br><strong>Extra roll granted for capture.</strong>';
    }

    if (moveResult.arrowBonus) {
      game.mandatoryBonusRolls++;
      gameStatus.innerHTML += '<br><strong>Arrow used: extra roll granted.</strong>';
    }

    renderAllTokens();
    checkGameWinner(token.color);

    waitingForMove = false;
    lastDice = null;

    if (game.winner) {
      updateRollButtonState();
      updateTurnDisplay();
      saveLiveGameStateToServer('finished');
      renderPendingDicePanel();
      return;
    }

    if (game.mandatoryBonusRolls > 0) {
      gameStatus.innerHTML += '<br><strong>Roll again before moving any token.</strong>';
      renderPendingDicePanel();
      updateRollButtonState();
      saveLiveGameStateToServer('active');
      maybeHandleBotTurn();
      scheduleHumanInactivityTimers();
      return;
    }

    /*
      v5.3.7: Do not save an intermediate post-move/pre-turn-transfer snapshot.
      If no pending dice remain, activateNextPendingAction() calls nextTurn(),
      and nextTurn() saves one final stable state containing moved token,
      consumed dice, cleared pending state, and the new turn.
    */
    activateNextPendingAction();
    maybeHandleBotTurn();
    scheduleHumanInactivityTimers();
  }

  function handleCapture(movedToken) {
    if (movedToken.distance < 0 || movedToken.distance > MAIN_PATH_LAST_DISTANCE) return false;

    var targetKey = getTokenCoordKey(movedToken);
    var movedMainIndex = getTokenMainIndex(movedToken);

    if (safeMainIndexes[movedMainIndex]) return false;

    if (game.fortifiedCells[targetKey]) {
      gameStatus.innerHTML += '<br>Fortified cell: no token was captured. Fortification remains until only one token is left in this cell.';
      return false;
    }

    var capturedAnything = false;

    for (var i = 0; i < game.activeColors.length; i++) {
      var enemyColor = game.activeColors[i];

      if (enemyColor === movedToken.color) continue;

      for (var j = 0; j < tokens[enemyColor].length; j++) {
        var enemyToken = tokens[enemyColor][j];

        if (enemyToken.distance >= 0 && enemyToken.distance <= MAIN_PATH_LAST_DISTANCE) {
          var enemyKey = getTokenCoordKey(enemyToken);

          if (enemyKey === targetKey) {
            if (enemyToken.protected) continue;

            enemyToken.distance = -1;
            enemyToken.homeCounted = false;
            capturedAnything = true;
          }
        }
      }
    }

    if (capturedAnything) {
      if (game.stats && game.stats.captures && typeof game.stats.captures[movedToken.color] === 'number') {
        game.stats.captures[movedToken.color]++;
      }

      gameStatus.innerHTML += '<br>' + COLOR_LABELS[movedToken.color] + ' captured an opponent token!';
    }

    return capturedAnything;
  }

  function handleArrowJumpAndBonus(token) {
    if (setup.mode !== 'arrow' && setup.mode !== 'blitz') return false;
    if (token.distance < 0 || token.distance > LAST_HOME_LANE_DISTANCE) return false;

    var coord = getTokenCoord(token);
    if (!coord) return false;

    var startKey = keyOf(coord[0], coord[1]);
    var arrow = arrowJumpMapByCoord[startKey];

    if (!arrow) return false;

    if (arrow.color && arrow.color !== token.color) return false;

    var newDistance = getDistanceForCoordKey(token.color, arrow.to);

    if (newDistance < 0) return false;

    token.distance = newDistance;

    gameStatus.innerHTML +=
      '<br>' +
      COLOR_LABELS[token.color] +
      ' used ' +
      arrow.label +
      ' and moved to the arrow head.';

    return true;
  }

  function checkGameWinner(lastMovedColor) {
    if (!isColorComplete(lastMovedColor)) return;

    if (canUseTeamUp()) {
      if (setup.mode === 'blitz') {
        if (lastMovedColor === 'yellow' || lastMovedColor === 'red') {
          game.winner = 'Team A';
          gameStatus.innerHTML += '<br><strong>Team A wins! A team token reached home in Blitz.</strong>';
          submitLeaderboardResult();
          return;
        }

        game.winner = 'Team B';
        gameStatus.innerHTML += '<br><strong>Team B wins! A team token reached home in Blitz.</strong>';
        submitLeaderboardResult();
        return;
      }

      var teamAComplete = isColorComplete('yellow') && isColorComplete('red');
      var teamBComplete = isColorComplete('blue') && isColorComplete('green');

      if (teamAComplete) {
        game.winner = 'Team A';
        gameStatus.innerHTML += '<br><strong>Team A wins! Yellow + Red have all tokens home.</strong>';
        submitLeaderboardResult();
        return;
      }

      if (teamBComplete) {
        game.winner = 'Team B';
        gameStatus.innerHTML += '<br><strong>Team B wins! Blue + Green have all tokens home.</strong>';
        submitLeaderboardResult();
        return;
      }

      return;
    }

    if (game.activeColors.length === 2) {
      game.winner = COLOR_LABELS[lastMovedColor];
      gameStatus.innerHTML +=
        '<br><strong>' +
        COLOR_LABELS[lastMovedColor] +
        ' wins! All tokens reached home.</strong>';
      submitLeaderboardResult();
      return;
    }

    addFinishedColor(lastMovedColor);

    if (game.finishedOrder.length >= game.activeColors.length - 1) {
      var lastRemaining = getLastRemainingColor();

      if (lastRemaining) game.finishedOrder.push(lastRemaining);

      game.winner = COLOR_LABELS[game.finishedOrder[0]];
      gameStatus.innerHTML += buildFinalStandingsMessage();
      submitLeaderboardResult();
      return;
    }

    gameStatus.innerHTML +=
      '<br><strong>' +
      COLOR_LABELS[lastMovedColor] +
      ' has finished. Game continues for remaining players.</strong>';
  }

  function addFinishedColor(color) {
    if (game.finishedOrder.indexOf(color) === -1) {
      game.finishedOrder.push(color);
    }
  }

  function getLastRemainingColor() {
    for (var i = 0; i < game.activeColors.length; i++) {
      var color = game.activeColors[i];

      if (game.finishedOrder.indexOf(color) === -1) return color;
    }

    return null;
  }

  function buildFinalStandingsMessage() {
    var html = '<br><strong>Game finished!</strong><br>';

    for (var i = 0; i < game.finishedOrder.length; i++) {
      var label = '';

      if (i === 0) label = 'Winner';
      else if (i === 1) label = 'Runner-up';
      else label = 'Position ' + (i + 1);

      html +=
        '<strong>' +
        label +
        ':</strong> ' +
        COLOR_LABELS[game.finishedOrder[i]] +
        '<br>';
    }

    return html;
  }

  function botChooseAndMove(movable, diceValue) {
    if (!waitingForMove || game.winner) return;

    var best = movable[0];
    var bestScore = -9999;

    for (var i = 0; i < movable.length; i++) {
      var score = scoreBotMove(movable[i], diceValue);

      if (score > bestScore) {
        bestScore = score;
        best = movable[i];
      }
    }

    executeMove(best, diceValue);
  }

  function chooseBestRollIndexForBot(color) {
    var bestIndex = -1;
    var bestScore = -999999;

    for (var i = 0; i < game.rollQueue.length; i++) {
      var value = game.rollQueue[i];
      var movable = getMovableTokens(color, value);

      for (var j = 0; j < movable.length; j++) {
        var score = scoreBotMove(movable[j], value);

        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
    }

    return bestIndex;
  }

  function scoreBotMove(token, diceValue) {
    var score = 0;
    var testDistance;

    if (token.distance === -1) {
      testDistance = 0;
      score += 20;
    } else {
      testDistance = token.distance + diceValue;
      score += testDistance;
    }

    if (testDistance === HOME_DISTANCE) score += 1000;

    if (testDistance >= 0 && testDistance <= LAST_HOME_LANE_DISTANCE) {
      var coord = colorRoutes[token.color][testDistance];
      var targetKey = keyOf(coord[0], coord[1]);

      for (var i = 0; i < game.activeColors.length; i++) {
        var enemyColor = game.activeColors[i];

        if (enemyColor === token.color) continue;

        for (var j = 0; j < tokens[enemyColor].length; j++) {
          var enemy = tokens[enemyColor][j];

          if (
            enemy.distance >= 0 &&
            enemy.distance <= MAIN_PATH_LAST_DISTANCE &&
            getTokenCoordKey(enemy) === targetKey &&
            !enemy.protected &&
            !game.fortifiedCells[targetKey]
          ) {
            score += 150;
          }
        }
      }

      var physicalMainIndex = mainIndexByKey[targetKey];

      if (safeMainIndexes[physicalMainIndex]) score += 18;

      if ((setup.mode === 'arrow' || setup.mode === 'blitz') && arrowJumpMapByCoord[targetKey]) {
        var arrow = arrowJumpMapByCoord[targetKey];

        if (!arrow.color || arrow.color === token.color) score += 90;
      }
    }

    return score;
  }

  function maybeHandleBotTurn() {
    clearBotTimeout();

    if (!gameStarted || game.winner || rolling) return;

    var turnColor = getCurrentTurnColor();

    /*
      In live games, only the browser seated as the current-turn color may run
      autoplay for that color. Other browsers must only display the state. This
      prevents a remote player/viewer from driving another player's turn or
      changing local-only state.
    */
    if (liveTable.gameCode && liveTable.status === 'active' && liveTable.playerColor !== turnColor) {
      syncLiveControlState();
      return;
    }

    var seatType = getSeatType(turnColor);
    var autoControlled = seatType === 'bot' || isAutoplayOn(turnColor);

    if (!autoControlled) {
      scheduleHumanInactivityTimers();
      return;
    }

    clearInactivityTimers();

    if (game.mandatoryBonusRolls > 0) {
      botTimeout = setTimeout(function () {
        rollDice();
      }, 650);
      return;
    }

    if (waitingForMove) {
      var controlColor = getControllableColor(turnColor);
      var pending = lastDice;
      var movable = getMovableTokens(controlColor, pending);

      if (movable.length > 0) {
        botTimeout = setTimeout(function () {
          botChooseAndMove(movable, pending);
        }, 700);
      } else {
        botTimeout = setTimeout(function () {
          activateNextPendingAction();
        }, 400);
      }

      return;
    }

    if (game.rollQueue.length > 0) {
      var botControlColor = getControllableColor(turnColor);
      var index = chooseBestRollIndexForBot(botControlColor);

      if (index >= 0) {
        botTimeout = setTimeout(function () {
          selectPendingRoll(index);
          maybeHandleBotTurn();
        }, 650);
      } else {
        botTimeout = setTimeout(function () {
          activateNextPendingAction();
        }, 400);
      }

      return;
    }

    botTimeout = setTimeout(function () {
      rollDice();
    }, 900);
  }

  function createLiveTableFromSetup() {
    if (liveTable.gameCode) {
      gameStatus.innerHTML =
        'You are already in table <strong>' + liveTable.gameCode +
        '</strong>. Please use <strong>Leave Table</strong> before creating another table.';
      updateLobbyActionButtons();
      return;
    }

    syncSeatsFromUI();

    var nick = getLobbyNick();
    var pcid = findPersistentClientId();

    apiPost('https://www.mixchatroom.com/ludo/api/create_table.php', {
      nick: nick,
      persistent_client_id: pcid,
      mode: setup.mode,
      player_count: setup.players,
      team_up: setup.teamUp ? 1 : 0
    }).then(function (data) {
      if (!data || !data.ok) {
        gameStatus.innerHTML = 'Could not create table: <strong>' + (data && data.error ? data.error : 'Unknown error') + '</strong>';
        return;
      }

      liveTable.gameCode = data.game_code;
      liveTable.playerColor = data.host_color || 'red';
      liveTable.role = 'host';
      liveTable.status = data.status || 'waiting';
      liveTable.isHost = true;

      getOrCreateCurrentTableBox();
      ensureLiveTableActionButtons();
      updateLobbyActionButtons();

      gameStatus.innerHTML = 'Live table created: <strong>' + liveTable.gameCode + '</strong>. Share this code with players.';
      loadTableState(liveTable.gameCode);
      refreshOpenTables();
      startTablePolling();
      ensureLiveTableActionButtons();
      updateLobbyActionButtons();
    }).catch(function () {
      gameStatus.innerHTML = 'Could not create table due to a network/server error.';
    });
  }

  function joinLiveTableByCode(rawCode) {
    if (liveTable.gameCode) {
      gameStatus.innerHTML =
        'You are already in table <strong>' + liveTable.gameCode +
        '</strong>. Please use <strong>Leave Table</strong> before joining another table.';
      updateLobbyActionButtons();
      return;
    }

    var gameCode = cleanGameCode(rawCode);

    if (!gameCode) {
      gameStatus.innerHTML = 'Please enter a valid table code.';
      return;
    }

    apiPost('https://www.mixchatroom.com/ludo/api/join_table.php', {
      game_code: gameCode,
      nick: getLobbyNick(),
      persistent_client_id: findPersistentClientId()
    }).then(function (data) {
      if (!data || !data.ok) {
        gameStatus.innerHTML = 'Could not join table: <strong>' + (data && data.error ? data.error : 'Unknown error') + '</strong>';

        if (data && data.status && data.status !== 'waiting') {
          liveTable.gameCode = gameCode;
          liveTable.role = 'viewer';
          liveTable.status = data.status;
          liveTable.isHost = false;
          loadTableState(gameCode);
          startTablePolling();
        }

        return;
      }

      liveTable.gameCode = data.game_code;
      liveTable.playerColor = data.color || '';
      liveTable.role = data.role || 'player';
      liveTable.status = data.status || 'waiting';
      liveTable.isHost = data.role === 'host';

      getOrCreateCurrentTableBox();
      ensureLiveTableActionButtons();
      updateLobbyActionButtons();

      gameStatus.innerHTML = 'Joined table <strong>' + liveTable.gameCode + '</strong> as <strong>' + COLOR_LABELS[liveTable.playerColor] + '</strong>.';
      loadTableState(liveTable.gameCode);
      refreshOpenTables();
      startTablePolling();
      ensureLiveTableActionButtons();
      updateLobbyActionButtons();
    }).catch(function () {
      gameStatus.innerHTML = 'Could not join table due to a network/server error.';
    });
  }

  function refreshOpenTables() {
    var list = document.getElementById('openTablesList');

    if (!list) return;

    if (!openTablesVisible) {
      showOpenTablesPrompt();
      return;
    }

    list.innerHTML = '<div class="open-table-empty">Loading open tables...</div>';

    apiGet('https://www.mixchatroom.com/ludo/api/list_tables.php?limit=20').then(function (data) {
      if (!data || !data.ok) {
        list.innerHTML = '<div class="open-table-empty">Could not load open tables.</div>';
        return;
      }

      renderOpenTables(data.tables || []);
    }).catch(function () {
      list.innerHTML = '<div class="open-table-empty">Could not load open tables.</div>';
    });
  }

  function renderOpenTables(tables) {
    var list = document.getElementById('openTablesList');

    if (!list) return;

    if (!tables.length) {
      list.innerHTML = '<div class="open-table-empty">No open tables yet.</div>';
      return;
    }

    var html = '';
    var thisPcidForRows = findPersistentClientId();

    for (var i = 0; i < tables.length; i++) {
      var t = tables[i];
      var actionLabel = t.status === 'waiting' ? 'Join' : 'Watch';
      var seatsText = (t.seated_players || 0) + '/' + t.player_count;
      var rowIsHost = t.host_persistent_client_id && thisPcidForRows && String(t.host_persistent_client_id) === String(thisPcidForRows);
      var rowIsCurrent = liveTable.gameCode && liveTable.gameCode === t.game_code;

      html += '<div class="open-table-row">';
      html += '<div class="open-table-main">';
      html += '<div class="open-table-code">' + escapeLobbyHtml(t.game_code) + '</div>';
      html += '<div class="open-table-info">' +
        escapeLobbyHtml(t.mode) + ' • ' +
        escapeLobbyHtml(t.player_count + 'P') + ' • ' +
        escapeLobbyHtml(t.status) + ' • Host: ' +
        escapeLobbyHtml(t.created_by || '-') + ' • Seats: ' +
        escapeLobbyHtml(seatsText) +
        '</div>';
      html += '</div>';
      html += '<div class="open-table-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">';

      if (!rowIsCurrent) {
        html += '<button class="open-table-btn" type="button" data-code="' + escapeLobbyHtml(t.game_code) + '" data-status="' + escapeLobbyHtml(t.status) + '">' + actionLabel + '</button>';
      } else {
        html += '<button class="open-table-btn" type="button" data-code="' + escapeLobbyHtml(t.game_code) + '" data-status="' + escapeLobbyHtml(t.status) + '">Sync</button>';
      }

      if (t.status === 'waiting' && rowIsHost && parseInt(t.seated_players || 0, 10) >= parseInt(t.player_count || 2, 10)) {
        html += '<button class="open-table-start-btn" type="button" data-code="' + escapeLobbyHtml(t.game_code) + '">Start Game</button>';
      }

      html += '</div>';
      html += '</div>';
    }

    list.innerHTML = html;

    var rowActionButtons = list.querySelectorAll('.open-table-start-btn');
    for (var rb = 0; rb < rowActionButtons.length; rb++) {
      rowActionButtons[rb].style.padding = '8px 12px';
      rowActionButtons[rb].style.borderRadius = '999px';
      rowActionButtons[rb].style.fontWeight = '800';
      rowActionButtons[rb].style.cursor = 'pointer';
      rowActionButtons[rb].style.background = '#ffcc00';
      rowActionButtons[rb].style.color = '#111827';
    }

    var startButtons = list.querySelectorAll('.open-table-start-btn');
    for (var sb = 0; sb < startButtons.length; sb++) {
      startButtons[sb].addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var code = this.getAttribute('data-code') || '';
        if (!code) return;

        if (liveTable.gameCode && liveTable.gameCode !== code && isInBlockingLiveTable()) {
          gameStatus.innerHTML =
            'You are already in table <strong>' + liveTable.gameCode +
            '</strong>. Please leave it before starting another table.';
          updateLobbyActionButtons();
          return;
        }

        liveTable.gameCode = code;
        loadTableState(code);
        setTimeout(function () {
          startLiveTable();
        }, 350);
      });
    }

    var buttons = list.querySelectorAll('.open-table-btn');

    for (var b = 0; b < buttons.length; b++) {
      buttons[b].addEventListener('click', function () {
        var code = this.getAttribute('data-code');
        var status = this.getAttribute('data-status');

        if (liveTable.gameCode && liveTable.gameCode !== code && isInBlockingLiveTable()) {
          gameStatus.innerHTML =
            'You are already in table <strong>' + liveTable.gameCode +
            '</strong>. Please leave it before opening another table.';
          updateLobbyActionButtons();
          return;
        }

        if (status === 'waiting') {
          joinLiveTableByCode(code);
        } else {
          liveTable.gameCode = code;
          liveTable.role = 'viewer';
          liveTable.status = status;
          liveTable.isHost = false;
          loadTableState(code);
          startTablePolling();
        }
      });
    }
  }

  function loadTableState(gameCode) {
    gameCode = cleanGameCode(gameCode);

    if (!gameCode) return;

    apiGet(
      'https://www.mixchatroom.com/ludo/api/get_table.php?game_code=' +
      encodeURIComponent(gameCode) +
      '&persistent_client_id=' +
      encodeURIComponent(findPersistentClientId()) +
      '&nick=' +
      encodeURIComponent(getCurrentNickForApi())
    ).then(function (data) {
      if (!data || !data.ok) {
        gameStatus.innerHTML = 'Could not load table.';
        return;
      }

      renderCurrentTable(data.game, data.players || []);

      /*
        v5.3.4: DB current_turn is the authority for whose turn it is.
        Because browser saves are asynchronous, an older state_json snapshot
        can arrive after a newer turn-transfer update. If that older snapshot
        still says Yellow has pending dice while the table column says Red,
        applying it will block Red with "waiting-for-token-move".
        So set liveTable.currentTurn first, then apply state only when the
        state's currentTurn agrees with the authoritative table turn.
      */
      if (data.game && data.game.current_turn) {
        liveTable.currentTurn = data.game.current_turn;
        forceLiveTurnDisplay(liveTable.currentTurn);
      }

      if (data.state && data.game && data.game.status === 'active' && liveLocalGameStartedFor === data.game.game_code) {
        if (!data.state.currentTurn || !data.game.current_turn || data.state.currentTurn === data.game.current_turn) {
          applyLiveStateFromServer(data.state, data.game.status);
        } else {
          console.warn('[LUDO] Ignored stale state_json turn mismatch', {
            tableTurn: data.game.current_turn,
            stateTurn: data.state.currentTurn,
            savedAt: data.state.savedAt || 0
          });

          /*
            v5.3.7: When DB current_turn has already advanced but state_json is
            an older pending-dice snapshot, never keep the old local
            waitingForMove/rollQueue state. It is safer to clear the in-progress
            dice window and let the authoritative table current_turn decide who
            rolls next. This prevents the next player from being blocked by the
            previous player's stale pending dice.
          */
          game.rollQueue = [];
          game.selectedRollIndex = -1;
          game.mandatoryBonusRolls = 0;
          waitingForMove = false;
          lastDice = null;
          clearTokenSelections();
          renderPendingDicePanel();
          updateRollButtonState();
          syncLiveControlState();
        }
      }

      if (data.game && data.game.status === 'active') {
        if (liveTable.playerColor && liveTable.currentTurn === liveTable.playerColor) {
          if (!isLocalTurnInProgress()) {
            gameStatus.innerHTML =
              'Live game <strong>' + data.game.game_code + '</strong> is active. It is your turn.';
          }
        } else if (liveTable.currentTurn && COLOR_LABELS[liveTable.currentTurn]) {
          gameStatus.innerHTML =
            'Live game <strong>' + data.game.game_code + '</strong> is active. Waiting for <strong>' +
            COLOR_LABELS[liveTable.currentTurn] +
            '</strong> player.';
        } else {
          gameStatus.innerHTML = 'Live game <strong>' + data.game.game_code + '</strong> is active.';
        }
      } else if (data.game && data.game.status === 'finished') {
        gameStatus.innerHTML = 'Game finished.' + (data.game.winner_text ? ' <strong>' + escapeLobbyHtml(data.game.winner_text) + '</strong>' : '');
        if (rollBtn) rollBtn.disabled = true;
      }

      syncLiveControlState();
    }).catch(function () {
      gameStatus.innerHTML = 'Could not load table due to network/server error.';
    });
  }

  function renderCurrentTable(table, players) {
    getOrCreateCurrentTableBox();

    var box = document.getElementById('currentTableBox');
    var title = document.getElementById('currentTableTitle');
    var meta = document.getElementById('currentTableMeta');
    var seats = document.getElementById('tableSeats');
    var startBtn = document.getElementById('startTableBtn');
    var liveStartBtn = document.getElementById('startTableBtnLive');


    if (!box || !title || !meta || !seats || !table) return;

    box.classList.remove('hidden');
    ensureLiveTableActionButtons();

    liveTable.gameCode = table.game_code;
    liveTable.status = table.status;
    liveTable.currentTurn = table.current_turn || liveTable.currentTurn || '';

    var tablePlayerCount = parseInt(table.player_count, 10) === 4 ? 4 : 2;
    var tableTeamUp = parseInt(table.team_up, 10) === 1;
    var seatedCount = 0;

    setup.mode = table.mode || setup.mode;
    setup.players = tablePlayerCount;
    setup.teamUp = tableTeamUp;

    if (teamUpToggle) {
      teamUpToggle.checked = tableTeamUp;
    }

    refreshSetupVisibility();

    title.textContent = 'Table: ' + table.game_code;
    meta.textContent =
      'Status: ' + table.status +
      ' • Mode: ' + table.mode +
      ' • Players: ' + tablePlayerCount + 'P' +
      (tableTeamUp ? ' • Team-Up' : '');

    var playerByColor = {};
    var thisPcid = findPersistentClientId();
    var foundThisPlayer = false;

    for (var i = 0; i < players.length; i++) {
      if (players[i].role === 'host' || players[i].role === 'player') {
        seatedCount++;
        playerByColor[players[i].color] = players[i];
      }

      if (
        thisPcid &&
        players[i].persistent_client_id &&
        String(players[i].persistent_client_id) === String(thisPcid)
      ) {
        liveTable.playerColor = players[i].color;
        liveTable.role = players[i].role;
        liveTable.isHost = players[i].role === 'host';
        foundThisPlayer = true;
      }
    }

    livePlayersByColor = playerByColor;

    for (var nameColor in playerByColor) {
      if (playerByColor.hasOwnProperty(nameColor)) {
        setPlayerDisplayName(nameColor, playerByColor[nameColor].nick || '');
      }
    }

    var colors = tablePlayerCount === 4 ? ['red', 'yellow', 'blue', 'green'] : ['red', 'yellow'];
    var html = '';

    for (var c = 0; c < colors.length; c++) {
      var color = colors[c];
      var p = playerByColor[color];
      var cls = p ? color : 'waiting';
      var nick = p ? p.nick + (p.role === 'host' ? ' (Host)' : '') + (parseInt(p.is_left || 0, 10) === 1 ? ' (Left)' : '') : 'Waiting';

      html += '<div class="table-seat ' + cls + '">';
      html += '<div class="seat-name">' + COLOR_LABELS[color] + '</div>';
      html += '<div class="seat-nick">' + escapeLobbyHtml(nick) + '</div>';
      html += '</div>';
    }

    seats.innerHTML = html;

    if (!foundThisPlayer && liveTable.status === 'active') {
      liveTable.role = 'viewer';
      liveTable.isHost = false;
    }

    if (liveTable.currentTurn) {
      forceLiveTurnDisplay(liveTable.currentTurn);
    }

    updateLobbyActionButtons();

    if (table.status === 'active') {
      if (setupPanel) setupPanel.classList.add('hidden');

      var lobbyPanel = document.getElementById('lobbyPanel');
      if (lobbyPanel) lobbyPanel.classList.add('hidden');

      if (liveLocalGameStartedFor !== table.game_code) {
        startLocalGameFromLiveTable(table, players);
      }
    }
  }

  function startLocalGameFromLiveTable(table, players) {
    if (!table || table.status !== 'active') {
      return;
    }

    var tablePlayerCount = parseInt(table.player_count, 10) === 4 ? 4 : 2;

    setup.mode = table.mode || setup.mode;
    setup.players = tablePlayerCount;
    setup.teamUp = parseInt(table.team_up, 10) === 1;

    if (teamUpToggle) {
      teamUpToggle.checked = setup.teamUp;
    }

    setup.seats = {
      yellow: 'off',
      blue: 'off',
      red: 'off',
      green: 'off'
    };

    livePlayersByColor = {};

    for (var i = 0; i < players.length; i++) {
      if (isLiveSeatedRole(players[i].role)) {
        livePlayersByColor[players[i].color] = players[i];
        setup.seats[players[i].color] = players[i].color === liveTable.playerColor ? 'human' : 'remote';
        setPlayerDisplayName(players[i].color, players[i].nick || '');
      }
    }

    liveLocalGameStartedFor = table.game_code;
    startConfiguredGame();

    liveTable.status = 'active';
    liveTable.currentTurn = table.current_turn || liveTable.currentTurn || 'yellow';
    forceLiveTurnDisplay(liveTable.currentTurn);
    refreshPlayerCards();
    refreshAutoplayButtons();
    updateGameSummary();
    updateTurnDisplay();

    if (gameStatus) {
      gameStatus.innerHTML = 'Live game <strong>' + table.game_code + '</strong> is active.';
    }

    if (!canLocalControlColor(getCurrentTurnColor())) {
      updateRollButtonState();
    } else {
      updateRollButtonState();
    }
  }

  function getNextLiveSavedAt() {
    var now = Date.now();

    if (now <= lastGeneratedLiveSavedAt) {
      now = lastGeneratedLiveSavedAt + 1;
    }

    lastGeneratedLiveSavedAt = now;
    return now;
  }

  function buildLiveInitialState() {
    var liveSavedAt = getNextLiveSavedAt();

    return {
      version: window.MIX_LUDO_VERSION || '5.3.8-stable-live',
      savedAt: liveSavedAt,
      savedByPcid: findPersistentClientId(),
      savedByColor: liveTable.playerColor || '',
      setup: JSON.parse(JSON.stringify(setup)),
      activeColors: cloneArray(game.activeColors),
      turnOrder: cloneArray(game.turnOrder),
      currentTurnIndex: game.currentTurnIndex,
      currentTurn: getCurrentTurnColor(),
      tokens: serializeTokens(),
      fortifiedCells: JSON.parse(JSON.stringify(game.fortifiedCells || {})),
      rollQueue: cloneArray(game.rollQueue || []),
      selectedRollIndex: game.selectedRollIndex,
      mandatoryBonusRolls: game.mandatoryBonusRolls,
      consecutiveSixes: game.consecutiveSixes,
      waitingForMove: waitingForMove === true,
      lastDice: lastDice,
      autoplay: JSON.parse(JSON.stringify(game.autoplay || {})),
      stats: JSON.parse(JSON.stringify(game.stats || {})),
      winner: game.winner,
      finishedOrder: cloneArray(game.finishedOrder || []),
      statusText: gameStatus ? gameStatus.innerHTML : ''
    };
  }

  function serializeTokens() {
    var out = {};

    for (var i = 0; i < COLOR_ORDER.length; i++) {
      var color = COLOR_ORDER[i];
      out[color] = [];

      if (!tokens[color]) continue;

      for (var j = 0; j < tokens[color].length; j++) {
        out[color].push({
          index: tokens[color][j].index,
          distance: tokens[color][j].distance,
          homeCounted: tokens[color][j].homeCounted === true
        });
      }
    }

    return out;
  }

  function applyLiveStateFromServer(state, tableStatus) {
    if (!state || typeof state !== 'object') {
      return;
    }

    if (rolling) {
      return;
    }

    var incomingSavedAt = parseInt(state.savedAt || 0, 10) || 0;
    var ownPcidForState = findPersistentClientId();

    /* Never apply an older server echo over a newer local roll/move. */
    if (incomingSavedAt && lastLocalLiveStateSavedAt && incomingSavedAt < lastLocalLiveStateSavedAt) {
      return;
    }

    /* During the short save window after a local action, ignore stale/unsaved polls. */
    if (Date.now() < lastLocalLiveStateLockUntil && incomingSavedAt < lastLocalLiveStateSavedAt) {
      return;
    }

    if (incomingSavedAt && incomingSavedAt < lastAppliedLiveStateSavedAt) {
      return;
    }

    /*
      Do not overwrite the current player's local roll/move window with a stale
      poll. This is the main fix for repeated dice, disabled Roll, and lost
      selectable-token state. The current-turn browser keeps its local state
      until it saves or completes the move.
    */
    if (isLocalTurnInProgress() && state.savedByPcid && state.savedByPcid !== ownPcidForState) {
      return;
    }

    var signature = JSON.stringify({
      savedAt: state.savedAt || 0,
      turn: state.currentTurn || '',
      tokens: state.tokens || {},
      rollQueue: state.rollQueue || [],
      selectedRollIndex: state.selectedRollIndex,
      mandatoryBonusRolls: state.mandatoryBonusRolls,
      waitingForMove: state.waitingForMove,
      lastDice: state.lastDice,
      winner: state.winner || ''
    });

    if (signature === lastAppliedLiveStateSignature) {
      return;
    }

    lastAppliedLiveStateSignature = signature;
    if (incomingSavedAt) {
      lastAppliedLiveStateSavedAt = incomingSavedAt;
    }

    if (state.setup && typeof state.setup === 'object') {
      setup.mode = state.setup.mode || setup.mode;
      setup.players = parseInt(state.setup.players, 10) === 4 ? 4 : 2;
      setup.teamUp = state.setup.teamUp === true || parseInt(state.setup.teamUp, 10) === 1;
      if (state.setup.seats) {
        setup.seats = state.setup.seats;
      }
      if (teamUpToggle) {
        teamUpToggle.checked = setup.teamUp;
      }
    }

    if (state.activeColors && state.activeColors.length) {
      game.activeColors = cloneArray(state.activeColors);
    }

    if (state.turnOrder && state.turnOrder.length) {
      game.turnOrder = cloneArray(state.turnOrder);
    }

    if (typeof state.currentTurnIndex === 'number') {
      game.currentTurnIndex = state.currentTurnIndex;
    }

    if (state.currentTurn && COLOR_LABELS[state.currentTurn]) {
      setLocalTurnToColor(state.currentTurn);
      liveTable.currentTurn = state.currentTurn;
    }

    if (state.fortifiedCells && typeof state.fortifiedCells === 'object') {
      game.fortifiedCells = state.fortifiedCells;
    }

    game.rollQueue = state.rollQueue && state.rollQueue.length ? cloneArray(state.rollQueue) : [];
    game.selectedRollIndex = typeof state.selectedRollIndex === 'number' ? state.selectedRollIndex : -1;
    game.mandatoryBonusRolls = typeof state.mandatoryBonusRolls === 'number' ? state.mandatoryBonusRolls : 0;
    game.consecutiveSixes = typeof state.consecutiveSixes === 'number' ? state.consecutiveSixes : 0;
    game.winner = state.winner || null;
    game.finishedOrder = state.finishedOrder && state.finishedOrder.length ? cloneArray(state.finishedOrder) : [];

    if (state.autoplay && typeof state.autoplay === 'object') {
      game.autoplay = state.autoplay;
    }

    if (state.stats && typeof state.stats === 'object') {
      game.stats = state.stats;
    }

    waitingForMove = state.waitingForMove === true;
    lastDice = (typeof state.lastDice === 'number') ? state.lastDice : null;

    /* v5.3.7 safety: if a received state says another color saved a
       waitingForMove/pending dice window but the authoritative table turn is
       now this browser's color, clear that stale pending window locally. */
    if (liveTable.currentTurn && state.savedByColor && state.savedByColor !== liveTable.currentTurn && waitingForMove) {
      game.rollQueue = [];
      game.selectedRollIndex = -1;
      game.mandatoryBonusRolls = 0;
      waitingForMove = false;
      lastDice = null;
    }

    if (state.tokens && typeof state.tokens === 'object') {
      for (var color in state.tokens) {
        if (!state.tokens.hasOwnProperty(color) || !tokens[color]) continue;

        for (var i = 0; i < state.tokens[color].length; i++) {
          var src = state.tokens[color][i];
          var idx = typeof src.index === 'number' ? src.index : i;

          if (tokens[color][idx]) {
            tokens[color][idx].distance = typeof src.distance === 'number' ? src.distance : -1;
            tokens[color][idx].homeCounted = src.homeCounted === true;
          }
        }
      }
    }

    renderAllTokens();
    updateGameSummary();
    updateTurnDisplay();

    if (state.statusText && gameStatus && tableStatus !== 'finished') {
      gameStatus.innerHTML = state.statusText;
    }

    if (waitingForMove && lastDice !== null && canLocalControlColor(getCurrentTurnColor())) {
      var controlColor = getControllableColor(getCurrentTurnColor());
      markSelectableTokens(getMovableTokens(controlColor, lastDice));
    }

    renderPendingDicePanel();
    syncLiveControlState();
    maybeHandleBotTurn();
    scheduleHumanInactivityTimers();
  }

  function saveLiveGameStateToServer(statusOverride, allowOwnAutoplayUpdate) {
    if (!canThisBrowserWriteLiveState(statusOverride, allowOwnAutoplayUpdate)) {
      return;
    }

    var status = statusOverride || (game.winner ? 'finished' : 'active');
    var current = getCurrentTurnColor();

    if (current && COLOR_LABELS[current]) {
      liveTable.currentTurn = current;
    }

    var stateToSave = buildLiveInitialState();
    lastLocalLiveStateSavedAt = stateToSave.savedAt || Date.now();
    lastLocalLiveStateLockUntil = Date.now() + 5000;

    apiPost('https://www.mixchatroom.com/ludo/api/update_game.php', {
      game_code: liveTable.gameCode,
      persistent_client_id: findPersistentClientId(),
      player_color: liveTable.playerColor,
      current_turn: liveTable.currentTurn || current || '',
      winner_text: game.winner || '',
      status: status,
      state: stateToSave
    }).then(function (data) {
      if (!data || !data.ok) {
        console.error('[LUDO LIVE SAVE FAILED]', data);
      }
    });
  }

  function startLiveTable() {
    if (!liveTable.gameCode || !liveTable.isHost) {
      gameStatus.innerHTML = 'Only the host can start this table.';
      return;
    }

    apiGet(
      'https://www.mixchatroom.com/ludo/api/get_table.php?game_code=' +
      encodeURIComponent(liveTable.gameCode) +
      '&persistent_client_id=' +
      encodeURIComponent(findPersistentClientId()) +
      '&nick=' +
      encodeURIComponent(getCurrentNickForApi())
    ).then(function (tableData) {
      if (!tableData || !tableData.ok) {
        gameStatus.innerHTML = 'Could not verify table before start: <strong>' + (tableData && tableData.error ? tableData.error : 'Unknown error') + '</strong>';
        return;
      }

      var requiredPlayers = tableData.game && parseInt(tableData.game.player_count, 10) === 4 ? 4 : 2;
      var seatedPlayers = 0;
      var players = tableData.players || [];

      for (var i = 0; i < players.length; i++) {
        if (players[i].role === 'host' || players[i].role === 'player') {
          seatedPlayers++;
        }
      }

      renderCurrentTable(tableData.game, players);

      if (!tableData.game || tableData.game.status !== 'waiting') {
        gameStatus.innerHTML = 'This table is not waiting anymore.';
        loadTableState(liveTable.gameCode);
        return;
      }

      if (seatedPlayers < requiredPlayers) {
        gameStatus.innerHTML =
          'Cannot start yet. This table needs <strong>' + requiredPlayers +
          '</strong> seated players. Current seats: <strong>' + seatedPlayers +
          '</strong>.';
        return;
      }

      setup.mode = tableData.game.mode || setup.mode;
      setup.players = requiredPlayers;
      setup.teamUp = parseInt(tableData.game.team_up, 10) === 1;

      if (teamUpToggle) {
        teamUpToggle.checked = setup.teamUp;
      }

      setup.seats = {
        yellow: 'off',
        blue: 'off',
        red: 'off',
        green: 'off'
      };

      livePlayersByColor = {};

      for (var p = 0; p < players.length; p++) {
        if (isLiveSeatedRole(players[p].role)) {
          livePlayersByColor[players[p].color] = players[p];
          setup.seats[players[p].color] = players[p].color === liveTable.playerColor ? 'human' : 'remote';
          setPlayerDisplayName(players[p].color, players[p].nick || '');
        }
      }

      liveTable.status = 'active';
      liveTable.currentTurn = 'yellow';
      liveLocalGameStartedFor = liveTable.gameCode;
      startConfiguredGame();
      forceLiveTurnDisplay('yellow');

      var initialState = buildLiveInitialState();
      initialState.savedByPcid = findPersistentClientId();
      initialState.savedByColor = liveTable.playerColor || '';
      initialState.currentTurn = 'yellow';
      initialState.savedAt = Date.now();

      apiPost('https://www.mixchatroom.com/ludo/api/start_table.php', {
        game_code: liveTable.gameCode,
        persistent_client_id: findPersistentClientId(),
        current_turn: 'yellow',
        state: initialState
      }).then(function (data) {
        if (!data || !data.ok) {
          gameStatus.innerHTML = '<strong>Could not start live table:</strong> ' + (data && data.error ? data.error : 'Unknown error');
          liveTable.status = 'waiting';
          loadTableState(liveTable.gameCode);
          return;
        }

        var lobbyPanel = document.getElementById('lobbyPanel');
        if (lobbyPanel) lobbyPanel.classList.add('hidden');
        if (setupPanel) setupPanel.classList.add('hidden');

        gameStatus.innerHTML += '<br><strong>Live table started: ' + liveTable.gameCode + '</strong>';
        lastLocalLiveStateSavedAt = initialState.savedAt;
        lastLocalLiveStateLockUntil = Date.now() + 2500;
        refreshOpenTablesThrottled(true);
        startTablePolling();
      });
    });
  }


  function leaveLiveTable(reason) {
    if (!liveTable.gameCode) {
      return;
    }

    var payload = {
      game_code: liveTable.gameCode,
      persistent_client_id: findPersistentClientId(),
      nick: getLobbyNick(),
      reason: reason || 'leave'
    };

    var url = 'https://www.mixchatroom.com/ludo/api/leave_table.php';

    stopTablePolling();

    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(payload)], {
          type: 'application/json'
        });

        navigator.sendBeacon(url, blob);
      } else {
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'same-origin',
          keepalive: true,
          body: JSON.stringify(payload)
        });
      }
    } catch (e) {
      try {
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'same-origin',
          body: JSON.stringify(payload)
        });
      } catch (e2) {}
    }
  }

  function leaveLiveTableManual(reason) {
    if (!liveTable.gameCode) {
      updateLobbyActionButtons();
      return;
    }

    var oldCode = liveTable.gameCode;
    leaveLiveTable(reason || 'manual_leave');
    resetLiveTableLocalState();

    var box = document.getElementById('currentTableBox');
    if (box) {
      box.classList.add('hidden');
    }

    if (gameStatus) {
      gameStatus.innerHTML = 'You left table <strong>' + oldCode + '</strong>.';
    }

    refreshOpenTablesThrottled(true);
  }

  function resetLiveTableLocalState() {
    liveTable.gameCode = '';
    liveTable.playerColor = '';
    liveTable.role = '';
    liveTable.status = '';
    liveTable.isHost = false;
    livePlayersByColor = {};
    liveLocalGameStartedFor = '';
    stopTablePolling();
    updateLobbyActionButtons();
  }

  function startTablePolling() {
    stopTablePolling();

    if (!liveTable.gameCode) return;

    loadTableState(liveTable.gameCode);
    updateLobbyActionButtons();

    liveTable.pollTimer = setInterval(function () {
      if (!liveTable.gameCode) {
        stopTablePolling();
        return;
      }

      loadTableState(liveTable.gameCode);
      updateLobbyActionButtons();
    }, 1500);
  }


  function stopTablePolling() {
    if (liveTable.pollTimer) {
      clearInterval(liveTable.pollTimer);
      liveTable.pollTimer = null;
    }
  }

  window.addEventListener('pagehide', function () {
    leaveLiveTable('pagehide');
  });

  window.addEventListener('beforeunload', function () {
    leaveLiveTable('beforeunload');
  });

  window.addEventListener('message', function (event) {
    var allowedOrigins = [
      'https://mixchatroom.com',
      'https://www.mixchatroom.com',
      'https://irc1.mixchatroom.com',
      'https://irc2.mixchatroom.com',
      'https://irc3.mixchatroom.com',
      'https://qwebirc.mixchatroom.com',
      'https://mibbit.mixchatroom.com',
      'https://mibbitchat.mixchatroom.com'
    ];

    if (allowedOrigins.indexOf(event.origin) === -1) return;

    if (!event.data) return;

    if (
      (event.data.type === 'MIX_LUDO_USER' ||
       event.data.type === 'MIX_LUDO_SET_NICK' ||
       event.data.type === 'MIX_CHAT_NICK' ||
       event.data.type === 'CURRENT_NICK' ||
       event.data.type === 'CHAT_NICK') &&
      event.data.nick
    ) {
      setResolvedLudoNick(event.data.nick, 'postMessage');

      if (liveTable.gameCode) {
        loadTableState(liveTable.gameCode);
      }

      return;
    }
  });

  buildMainIndexLookup();
  buildRoutes();
  setupUIBindings();
  setupLobbyBindings();
  refreshAutoplayButtons();
  refreshSetupVisibility();
  buildBoard();
  initTokens();
  renderAllTokens();
  updateGameSummary();
  resolveLudoIdentity();
  requestNickFromOpenerOrParent();
  showOpenTablesPrompt();

  rollBtn.disabled = true;

  function dumpDebugState() {
    return {
      version: window.MIX_LUDO_VERSION,
      liveTable: JSON.parse(JSON.stringify(liveTable)),
      identity: JSON.parse(JSON.stringify(ludoIdentity)),
      gameStarted: gameStarted,
      rolling: rolling,
      waitingForMove: waitingForMove,
      lastDice: lastDice,
      rollQueue: cloneArray(game.rollQueue || []),
      selectedRollIndex: game.selectedRollIndex,
      mandatoryBonusRolls: game.mandatoryBonusRolls,
      consecutiveSixes: game.consecutiveSixes,
      currentTurn: getCurrentTurnColor(),
      canRollNow: canRollNow(),
      rollBlockReason: getRollBlockReason(),
      rollButtonDisabled: rollBtn ? rollBtn.disabled : null,
      autoRollTimeoutMs: getAutoRollTimeoutMs(),
      autoMoveTimeoutMs: getAutoMoveTimeoutMs(),
      fortifiedCells: JSON.parse(JSON.stringify(game.fortifiedCells || {})),
      isLocalTurnInProgress: isLocalTurnInProgress(),
      isLocalLiveTurn: isLocalLiveTurnWithoutStatusSideEffects(),
      autoplay: JSON.parse(JSON.stringify(game.autoplay || {})),
      seatTypes: {
        yellow: getSeatType('yellow'),
        blue: getSeatType('blue'),
        red: getSeatType('red'),
        green: getSeatType('green')
      },
      tokens: serializeTokens()
    };
  }

  window.ludoDebug = {
    liveTable: liveTable,
    dumpState: dumpDebugState,
    canRollNow: canRollNow,
    getRollBlockReason: getRollBlockReason,
    syncLiveControlState: syncLiveControlState,
    updateRollButtonState: updateRollButtonState,
    refreshAutoplayButtons: refreshAutoplayButtons,
    canLocalManageAutoplay: canLocalManageAutoplay,
    refreshOpenTables: refreshOpenTables,
    refreshOpenTablesThrottled: refreshOpenTablesThrottled,
    showOpenTablesNow: showOpenTablesNow,
    showOpenTablesPrompt: showOpenTablesPrompt,
    updateLobbyActionButtons: updateLobbyActionButtons,
    getOrCreateCurrentTableBox: getOrCreateCurrentTableBox,
    createLiveTableFromSetup: createLiveTableFromSetup,
    joinLiveTableByCode: joinLiveTableByCode,
    loadTableState: loadTableState,
    startTablePolling: startTablePolling,
    stopTablePolling: stopTablePolling,
    leaveLiveTable: leaveLiveTable,
    getCurrentTurnColor: getCurrentTurnColor,
    findPersistentClientId: findPersistentClientId,
    livePlayersByColor: livePlayersByColor,
    canLocalControlColor: canLocalControlColor,
    canThisBrowserPlayLiveTurn: canThisBrowserPlayLiveTurn,
    forceLiveTurnDisplay: forceLiveTurnDisplay,
    saveLiveGameStateToServer: saveLiveGameStateToServer,
    updateLobbyActionButtons: updateLobbyActionButtons,
    refreshOpenTablesThrottled: refreshOpenTablesThrottled,
    showOpenTablesNow: showOpenTablesNow,
    showOpenTablesPrompt: showOpenTablesPrompt,
    getOrCreateCurrentTableBox: getOrCreateCurrentTableBox,
    ensureLiveTableActionButtons: ensureLiveTableActionButtons,
    identity: ludoIdentity,
    getNickFromUrl: getNickFromUrl,
    getStoredCurrentNick: getStoredCurrentNick,
    refreshLudoNick: refreshImmediateNickFromPageContext,
    getCurrentNickForApi: getCurrentNickForApi
  };

  window.setLudoNick = function (nick) {
    var ok = setResolvedLudoNick(nick, 'manual');

    if (ok && liveTable.gameCode) {
      loadTableState(liveTable.gameCode);
    }

    return ok;
  };
  window.refreshLudoNick = refreshImmediateNickFromPageContext;

  window.findPersistentClientId = findPersistentClientId;
  window.resolveLudoIdentity = resolveLudoIdentity;
  window.getNickFromUrl = getNickFromUrl;
})();