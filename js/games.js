/**
 * ChatCorner In-Chat Mini-Game System
 * Tic-Tac-Toe, Chess, and simplified 2-Player Ludo
 * 
 * Aesthetics: Frosted Glassmorphism, Neon Accents, Neo-Brutalist details
 * Zero external dependencies.
 */

(function () {
  // Global score storage per session
  // Key: opponent userId -> { winsUser1, winsUser2, ties, hardClosed }
  const gameScores = {};

  // Active game window state
  // Key: opponent userId -> { el, gameType, role ('inviter'|'acceptor'), activeGameInstance }
  const activeGameWindows = {};

  // Track the mouse drag state for game windows
  let gameDragState = null;

  // Resolve alphabetical user order to maintain a consistent User1/User2 schema
  function getScoreSchemaRoles(opponentId) {
    const myId = currentUser?.id || 'me';
    const isUser1 = myId < opponentId;
    return {
      user1: isUser1 ? myId : opponentId,
      user2: isUser1 ? opponentId : myId,
      isMeUser1: isUser1
    };
  }

  // Get or initialize scores
  function getScores(opponentId) {
    if (!gameScores[opponentId]) {
      gameScores[opponentId] = {
        winsUser1: 0,
        winsUser2: 0,
        ties: 0,
        hardClosed: 0
      };
    }
    return gameScores[opponentId];
  }

  // Broadcast score sync packet
  function broadcastScoreSync(opponentId) {
    const scores = getScores(opponentId);
    sendPmBroadcast({
      to: opponentId,
      type: 'game_score_sync',
      scores
    });
  }

  // Helper to send game packets over standard PM channel
  function sendGamePacket(opponentId, eventType, payload) {
    sendPmBroadcast({
      to: opponentId,
      type: eventType,
      ...payload
    });
  }

  // ==========================================================================
  // GAME PICKER & INVITATION FLOW
  // ==========================================================================

  // Toggle the game picker popover attached to the 🎮 button
  function toggleGamePicker(userId, btn) {
    const toolbar = btn.closest('.pm-toolbar');
    let popover = toolbar ? toolbar.querySelector('.pm-game-picker-popover') : btn.querySelector('.pm-game-picker-popover');
    if (popover) {
      popover.remove();
      return;
    }

    // Close any other open pickers
    document.querySelectorAll('.pm-game-picker-popover').forEach(p => p.remove());

    popover = document.createElement('div');
    popover.className = 'pm-game-picker-popover';
    popover.style.position = 'absolute';
    popover.style.bottom = '40px';
    popover.style.right = '10px';
    popover.style.background = 'var(--game-bg-frosted)';
    popover.style.border = '2px solid var(--game-border-neon-blue)';
    popover.style.boxShadow = 'var(--game-neon-glow-blue)';
    popover.style.borderRadius = '8px';
    popover.style.padding = '12px';
    popover.style.zIndex = '1000';
    popover.style.display = 'flex';
    popover.style.flexDirection = 'column';
    popover.style.gap = '8px';
    popover.style.fontFamily = 'var(--game-font-title)';

    popover.innerHTML = `
      <div style="font-weight: 700; font-size: 0.85rem; color: #fff; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; display: flex; align-items: center; gap: 6px;">
        🎮 Choose a Game
      </div>
      <button type="button" class="btn-primary btn-sm" style="background:#00f0ff; color:#000; font-weight:700; border:none; padding: 6px 12px; border-radius:4px; cursor:pointer;" data-game="tictactoe">Tic-Tac-Toe</button>
      <button type="button" class="btn-primary btn-sm" style="background:#8b6ded; color:#fff; font-weight:700; border:none; padding: 6px 12px; border-radius:4px; cursor:pointer;" data-game="chess">Chess</button>
      <button type="button" class="btn-primary btn-sm" style="background:#ff007f; color:#fff; font-weight:700; border:none; padding: 6px 12px; border-radius:4px; cursor:pointer;" data-game="ludo">Streamlined Ludo</button>
    `;

    // Click handler to select and send invitation
    popover.addEventListener('click', (e) => {
      const target = e.target.closest('button');
      if (!target) return;
      const gameType = target.dataset.game;
      if (gameType) {
        sendGameInvitation(userId, gameType);
        popover.remove();
      }
    });

    (toolbar || btn).appendChild(popover);

    // Close game picker on outside click
    setTimeout(() => {
      const closeHandler = (e) => {
        if (!popover.contains(e.target) && !btn.contains(e.target)) {
          popover.remove();
          document.removeEventListener('click', closeHandler);
        }
      };
      document.addEventListener('click', closeHandler);
    }, 0);
  }

  // Send an invitation to another player
  function sendGameInvitation(opponentId, gameType) {
    sendGamePacket(opponentId, 'game_invite', { gameType });
    
    // Add local notice to current chat
    const inviteName = gameType === 'tictactoe' ? 'Tic-Tac-Toe' : gameType === 'chess' ? 'Chess' : 'Ludo';
    const box = getPmMessagesBox(opponentId);
    if (box) {
      const row = document.createElement('div');
      row.className = 'pm-msg self';
      row.innerHTML = `
        <div class="pm-msg-bubble" style="background: rgba(0, 240, 255, 0.1); border: 1px dashed var(--game-border-neon-blue);">
          🎮 You invited them to play <strong>${inviteName}</strong>. Waiting for acceptance...
        </div>
        <div class="pm-msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      `;
      box.appendChild(row);
      box.scrollTop = box.scrollHeight;
    }
  }

  // Handle incoming game payload packets
  function handleIncomingGameEvent(payload) {
    const fromUserId = payload.from;
    const type = payload.type; // game_invite, game_accept, game_decline, game_move, game_score_sync, game_quit, game_restart
    
    if (type === 'game_invite') {
      const gameType = payload.gameType;
      const gameName = gameType === 'tictactoe' ? 'Tic-Tac-Toe' : gameType === 'chess' ? 'Chess' : 'Ludo';
      const box = getPmMessagesBox(fromUserId);
      if (box) {
        const safeFromUserId = escHtml(fromUserId);
        const safeGameType = escHtml(gameType);
        // Prevent duplicate invitation UI
        if (box.querySelector(`[data-invite-from="${safeFromUserId}"][data-game="${safeGameType}"]`)) return;

        const row = document.createElement('div');
        row.className = 'pm-msg';
        row.innerHTML = `
          <div class="pm-game-invite-bubble" data-invite-from="${safeFromUserId}" data-game="${safeGameType}">
            <div class="pm-game-invite-title">
              <span>🎮</span>
              <span><strong>${escHtml(payload.username || 'Opponent')}</strong> invited you to play <strong>${gameName}</strong>!</span>
            </div>
            <div class="pm-game-invite-actions">
              <button class="game-btn-accept" type="button">Accept</button>
              <button class="game-btn-decline" type="button">Decline</button>
            </div>
          </div>
          <div class="pm-msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        `;

        const acceptBtn = row.querySelector('.game-btn-accept');
        const declineBtn = row.querySelector('.game-btn-decline');

        acceptBtn.onclick = () => {
          row.querySelector('.pm-game-invite-actions').innerHTML = `<span style="color:#39ff14; font-size:0.8rem; font-weight:700;">Accepted ✅</span>`;
          sendGamePacket(fromUserId, 'game_accept', { gameType });
          // Launch game window as acceptor
          launchGame(fromUserId, gameType, 'acceptor');
        };

        declineBtn.onclick = () => {
          row.querySelector('.pm-game-invite-actions').innerHTML = `<span style="color:#ff073a; font-size:0.8rem; font-weight:700;">Declined ✕</span>`;
          sendGamePacket(fromUserId, 'game_decline', { gameType });
        };

        box.appendChild(row);
        box.scrollTop = box.scrollHeight;
        playPmNotification(fromUserId);
      }
    } 
    else if (type === 'game_accept') {
      const gameType = payload.gameType;
      // Remove any waiting banners if applicable
      // Launch game window as inviter
      launchGame(fromUserId, gameType, 'inviter');
      // Sync score across session
      broadcastScoreSync(fromUserId);
    } 
    else if (type === 'game_decline') {
      const gameName = payload.gameType === 'tictactoe' ? 'Tic-Tac-Toe' : payload.gameType === 'chess' ? 'Chess' : 'Ludo';
      const box = getPmMessagesBox(fromUserId);
      if (box) {
        const row = document.createElement('div');
        row.className = 'pm-msg';
        row.innerHTML = `
          <div class="pm-msg-bubble" style="background: rgba(255, 7, 58, 0.15); border: 1px dashed #ff073a;">
            ❌ <strong>${escHtml(payload.username || 'Opponent')}</strong> declined your invitation to play ${gameName}.
          </div>
          <div class="pm-msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        `;
        box.appendChild(row);
        box.scrollTop = box.scrollHeight;
      }
    } 
    else if (type === 'game_move') {
      const gw = activeGameWindows[fromUserId];
      if (gw && gw.activeGameInstance) {
        gw.activeGameInstance.onOpponentMove(payload.move);
      }
    } 
    else if (type === 'game_score_sync') {
      const scores = payload.scores;
      if (scores) {
        gameScores[fromUserId] = scores;
        updateScoreboardUI(fromUserId);
      }
    } 
    else if (type === 'game_quit') {
      const gw = activeGameWindows[fromUserId];
      if (gw) {
        // Opponent closed the window mid-match
        if (gw.activeGameInstance && !gw.activeGameInstance.isGameOver) {
          const scores = getScores(fromUserId);
          scores.hardClosed++;
          updateScoreboardUI(fromUserId);
          gw.activeGameInstance.isGameOver = true;
          gw.activeGameInstance.showGameOverScreen("Opponent Abandoned", "Match ended due to dropout.");
        }
      }
    }
    else if (type === 'game_restart') {
      const gw = activeGameWindows[fromUserId];
      if (gw && gw.activeGameInstance) {
        gw.activeGameInstance.reset(false);
      }
    }
  }

  // ==========================================================================
  // GAME WINDOW MANAGER (Draggable, Resizable, Minimizable)
  // ==========================================================================

  function launchGame(opponentId, gameType, role) {
    // If game window already exists, clean it up first
    if (activeGameWindows[opponentId]) {
      closeGameWindow(opponentId, false);
    }

    createGameWindow(opponentId, gameType, role);
    initializeGameInstance(opponentId, gameType, role);
  }

  function createGameWindow(opponentId, gameType, role) {
    const stage = document.getElementById('pm-popup-stage');
    if (!stage) return;

    const gameName = gameType === 'tictactoe' ? 'Tic-Tac-Toe' : gameType === 'chess' ? 'Chess' : 'Ludo';
    const gwEl = document.createElement('div');
    gwEl.className = 'game-window';
    gwEl.dataset.userId = opponentId;

    gwEl.innerHTML = `
      <div class="game-header">
        <div class="game-title-wrap">
          <span class="game-logo">🎮</span>
          <span class="game-title">${gameName} vs ${escHtml(getUsernameById(opponentId))}</span>
        </div>
        <div class="game-header-actions">
          <button type="button" class="game-minimize-btn" title="Minimize game">_</button>
          <button type="button" class="game-close-btn" title="Close & forfeit match">✕</button>
        </div>
      </div>
      <div class="game-scoreboard">
        <div class="score-pill">
          <span>You:</span>
          <span class="score-val score-me">0</span>
        </div>
        <div class="score-divider">|</div>
        <div class="score-pill">
          <span>Ties:</span>
          <span class="score-val score-ties">0</span>
        </div>
        <div class="score-divider">|</div>
        <div class="score-pill">
          <span>Them:</span>
          <span class="score-val score-them">0</span>
        </div>
        <div class="score-divider">|</div>
        <div class="score-pill">
          <span>Closed:</span>
          <span class="score-val score-closed">0</span>
        </div>
      </div>
      <div class="game-body">
        <div class="game-info-bar">
          <span class="turn-indicator"></span>
          <span class="game-status-text">Setting up...</span>
        </div>
        <div class="game-stage"></div>
      </div>
    `;

    stage.appendChild(gwEl);

    // Draggable Handle
    const header = gwEl.querySelector('.game-header');
    header.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      const rect = gwEl.getBoundingClientRect();
      const bounds = stage.getBoundingClientRect();
      gameDragState = {
        userId: opponentId,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top
      };
      gwEl.setPointerCapture?.(e.pointerId);
      header.classList.add('dragging');
      e.preventDefault();
    });

    // Minimize & Close
    gwEl.querySelector('.game-minimize-btn').onclick = () => {
      // Sync with PM window state: minimizing game window minimizes both
      const pmWin = pmWindows[opponentId];
      if (pmWin) {
        minimizePrivateChat(opponentId);
      } else {
        gwEl.classList.toggle('minimized');
      }
    };

    gwEl.querySelector('.game-close-btn').onclick = () => {
      // Prompt user if match is active
      const state = activeGameWindows[opponentId];
      if (state && state.activeGameInstance && !state.activeGameInstance.isGameOver) {
        if (!confirm("Are you sure you want to close this match? This counts as a dropout (hardClosed).")) return;
        
        // Log a hardClosed metric
        const scores = getScores(opponentId);
        scores.hardClosed++;
        broadcastScoreSync(opponentId);
        
        // Notify opponent
        sendGamePacket(opponentId, 'game_quit', { reason: 'close' });
      }
      closeGameWindow(opponentId, true);
    };

    activeGameWindows[opponentId] = {
      el: gwEl,
      gameType,
      role,
      activeGameInstance: null
    };

    // Style and position
    updateScoreboardUI(opponentId);
    positionGameWindowAdjacent(opponentId);
  }

  // Smooth drag event routing
  document.addEventListener('pointermove', (e) => {
    if (!gameDragState) return;
    const gw = activeGameWindows[gameDragState.userId];
    if (!gw) return;

    const stage = document.getElementById('pm-popup-stage');
    const bounds = stage?.getBoundingClientRect() || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const rect = gw.el.getBoundingClientRect();

    let left = e.clientX - bounds.left - gameDragState.offsetX;
    let top = e.clientY - bounds.top - gameDragState.offsetY;

    // Boundary constraint
    const maxLeft = Math.max(12, bounds.width - rect.width - 12);
    const maxTop = Math.max(12, bounds.height - rect.height - 12);
    left = Math.min(Math.max(12, left), maxLeft);
    top = Math.min(Math.max(12, top), maxTop);

    gw.el.style.left = `${left}px`;
    gw.el.style.top = `${top}px`;
  });

  document.addEventListener('pointerup', (e) => {
    if (!gameDragState) return;
    const gw = activeGameWindows[gameDragState.userId];
    gw?.el.querySelector('.game-header')?.classList.remove('dragging');
    gameDragState = null;
  });

  // Position game window immediately to the left of the PM window
  function positionGameWindowAdjacent(opponentId) {
    const gw = activeGameWindows[opponentId];
    const pm = pmWindows[opponentId];
    if (!gw || !pm) return;

    // Anchor next to PM window on the left side
    const pmRect = pm.el.getBoundingClientRect();
    const bounds = document.getElementById('pm-popup-stage')?.getBoundingClientRect() || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    
    // Attempt to position to the left. If no space, stack on right or overlay.
    let left = (pm.left || 0) - 390;
    if (left < 12) {
      left = (pm.left || 0) + 330; // Float on the right instead
    }
    
    gw.el.style.left = `${Math.max(12, left)}px`;
    gw.el.style.top = `${pm.top || 110}px`;
  }

  // Hook triggered when pm.js repositions or toggles active state
  function syncGameWindowPosition(userId, pmLeft, pmTop, active) {
    const gw = activeGameWindows[userId];
    if (!gw) return;

    // Coordinate state visibility
    gw.el.classList.toggle('active', active);
    gw.el.classList.toggle('hidden', !active);

    if (active) {
      positionGameWindowAdjacent(userId);
    }
  }

  // Hook triggered when PM minimizing occurs
  function handlePmMinimize(userId) {
    const gw = activeGameWindows[userId];
    if (gw) gw.el.classList.add('minimized');
  }

  // Hook triggered when PM restoring occurs
  function handlePmRestore(userId) {
    const gw = activeGameWindows[userId];
    if (gw) gw.el.classList.remove('minimized');
  }

  // Hook triggered when PM closing occurs
  function handlePmClose(userId) {
    const gw = activeGameWindows[userId];
    if (gw) {
      // If closing active match, register dropout
      if (gw.activeGameInstance && !gw.activeGameInstance.isGameOver) {
        const scores = getScores(userId);
        scores.hardClosed++;
        broadcastScoreSync(userId);
        sendGamePacket(userId, 'game_quit', { reason: 'dropout' });
      }
      closeGameWindow(userId, false);
    }
  }

  function closeGameWindow(opponentId, updatePmBar = true) {
    const gw = activeGameWindows[opponentId];
    if (!gw) return;
    gw.el.remove();
    delete activeGameWindows[opponentId];
  }

  // Update Scoreboard HTML panel
  function updateScoreboardUI(opponentId) {
    const gw = activeGameWindows[opponentId];
    if (!gw) return;

    const scores = getScores(opponentId);
    const roles = getScoreSchemaRoles(opponentId);

    const myScore = roles.isMeUser1 ? scores.winsUser1 : scores.winsUser2;
    const opponentScore = roles.isMeUser1 ? scores.winsUser2 : scores.winsUser1;

    gw.el.querySelector('.score-me').textContent = myScore;
    gw.el.querySelector('.score-ties').textContent = scores.ties;
    gw.el.querySelector('.score-them').textContent = opponentScore;
    gw.el.querySelector('.score-closed').textContent = scores.hardClosed;
  }

  // Close active games when window closes
  window.addEventListener('beforeunload', () => {
    Object.keys(activeGameWindows).forEach(opponentId => {
      const gw = activeGameWindows[opponentId];
      if (gw && gw.activeGameInstance && !gw.activeGameInstance.isGameOver) {
        sendGamePacket(opponentId, 'game_quit', { reason: 'dropout' });
      }
    });
  });

  // ==========================================================================
  // INITIALIZE GAME INSTANCE ROUTER
  // ==========================================================================
  function initializeGameInstance(opponentId, gameType, role) {
    const gw = activeGameWindows[opponentId];
    if (!gw) return;

    const canvas = gw.el.querySelector('.game-stage');
    canvas.innerHTML = ''; // clear

    if (gameType === 'tictactoe') {
      gw.activeGameInstance = new TicTacToeGame(opponentId, canvas, role);
    } else if (gameType === 'chess') {
      gw.activeGameInstance = new ChessGame(opponentId, canvas, role);
    } else if (gameType === 'ludo') {
      gw.activeGameInstance = new LudoGame(opponentId, canvas, role);
    }
  }


  // ==========================================================================
  // GAME 1: TIC-TAC-TOE IMPLEMENTATION
  // ==========================================================================
  class TicTacToeGame {
    constructor(opponentId, container, role) {
      this.opponentId = opponentId;
      this.container = container;
      this.role = role; // inviter or acceptor
      this.isGameOver = false;

      // Inviter is X and moves first, Acceptor is O and waits
      this.mySymbol = role === 'inviter' ? 'X' : 'O';
      this.currentTurn = 'X'; // X starts
      this.board = Array(9).fill(null);

      this.initUI();
      this.updateStatus();
    }

    initUI() {
      const grid = document.createElement('div');
      grid.className = 'ttt-grid';

      for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.className = 'ttt-cell';
        cell.dataset.index = i;
        cell.onclick = () => this.makeMove(i);
        grid.appendChild(cell);
      }

      this.container.appendChild(grid);
      this.cells = grid.querySelectorAll('.ttt-cell');
    }

    updateStatus() {
      const parent = this.container.closest('.game-window');
      if (!parent) return;

      const indicator = parent.querySelector('.turn-indicator');
      const text = parent.querySelector('.game-status-text');

      if (this.isGameOver) {
        indicator.className = 'turn-indicator';
        return;
      }

      const isMyTurn = this.mySymbol === this.currentTurn;
      indicator.className = 'turn-indicator ' + (isMyTurn ? 'active' : 'opponent');
      text.textContent = isMyTurn ? "Your Turn (Click space)" : "Opponent's Turn...";
    }

    makeMove(index) {
      if (this.isGameOver || this.currentTurn !== this.mySymbol || this.board[index] !== null) return;

      this.board[index] = this.mySymbol;
      this.drawPiece(index, this.mySymbol);
      
      // Send move packet
      sendGamePacket(this.opponentId, 'game_move', { cell: index });

      this.checkGameState();
      if (!this.isGameOver) {
        this.currentTurn = this.mySymbol === 'X' ? 'O' : 'X';
        this.updateStatus();
      }
    }

    onOpponentMove(move) {
      const cellIndex = move.cell;
      const opponentSymbol = this.mySymbol === 'X' ? 'O' : 'X';

      if (this.board[cellIndex] === null) {
        this.board[cellIndex] = opponentSymbol;
        this.drawPiece(cellIndex, opponentSymbol);
        this.checkGameState();

        if (!this.isGameOver) {
          this.currentTurn = this.mySymbol;
          this.updateStatus();
        }
      }
    }

    drawPiece(index, symbol) {
      const cell = this.cells[index];
      if (!cell) return;

      if (symbol === 'X') {
        cell.innerHTML = `
          <svg viewBox="0 0 40 40">
            <line x1="8" y1="8" x2="32" y2="32" class="ttt-x-path" />
            <line x1="32" y1="8" x2="8" y2="32" class="ttt-x-path" />
          </svg>
        `;
      } else {
        cell.innerHTML = `
          <svg viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="12" class="ttt-o-path" />
          </svg>
        `;
      }
    }

    checkGameState() {
      const winPatterns = [
        [0,1,2], [3,4,5], [6,7,8], // rows
        [0,3,6], [1,4,7], [2,5,8], // cols
        [0,4,8], [2,4,6]           // diagonals
      ];

      for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
          this.endGame(this.board[a]);
          return;
        }
      }

      if (this.board.every(cell => cell !== null)) {
        this.endGame('tie');
      }
    }

    endGame(result) {
      this.isGameOver = true;
      const scores = getScores(this.opponentId);
      const roles = getScoreSchemaRoles(this.opponentId);

      let title = "Game Over";
      let subtitle = "";

      if (result === 'tie') {
        title = "It's a Tie!";
        subtitle = "A well fought duel.";
        scores.ties++;
      } else if (result === this.mySymbol) {
        title = "You Win! 🏆";
        subtitle = "Great tactical movements.";
        if (roles.isMeUser1) scores.winsUser1++;
        else scores.winsUser2++;
      } else {
        title = "You Lose 😢";
        subtitle = "Better luck next match.";
        if (roles.isMeUser1) scores.winsUser2++;
        else scores.winsUser1++;
      }

      broadcastScoreSync(this.opponentId);
      updateScoreboardUI(this.opponentId);
      this.showGameOverScreen(title, subtitle);
    }

    showGameOverScreen(title, subtitle) {
      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      overlay.innerHTML = `
        <div class="game-over-title">${title}</div>
        <div class="game-over-subtitle">${subtitle}</div>
        <button type="button" class="game-restart-btn">Play Again</button>
      `;

      overlay.querySelector('.game-restart-btn').onclick = () => {
        this.reset(true);
      };

      this.container.appendChild(overlay);
    }

    reset(sendRestart) {
      this.isGameOver = false;
      this.board = Array(9).fill(null);
      this.currentTurn = 'X';
      
      const overlay = this.container.querySelector('.game-over-overlay');
      if (overlay) overlay.remove();

      this.cells.forEach(cell => cell.innerHTML = '');
      this.updateStatus();

      if (sendRestart) {
        sendGamePacket(this.opponentId, 'game_restart', {});
      }
    }
  }


  // ==========================================================================
  // GAME 2: LIGHTWEIGHT CHESS ENGINE & VALIDATOR
  // ==========================================================================
  class ChessGame {
    constructor(opponentId, container, role) {
      this.opponentId = opponentId;
      this.container = container;
      this.role = role; // inviter or acceptor
      this.isGameOver = false;

      // Inviter plays White, Acceptor plays Black
      this.myColor = role === 'inviter' ? 'w' : 'b';
      this.currentTurn = 'w'; // White goes first
      this.selectedSquare = null;
      this.legalDestinations = [];

      this.initBoard();
      this.initUI();
      this.updateStatus();
    }

    initBoard() {
      // Standard board representation
      // White is UPPERCASE, Black is lowercase
      // P: Pawn, N: Knight, B: Bishop, R: Rook, Q: Queen, K: King
      this.board = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
      ];
    }

    initUI() {
      const wrapper = document.createElement('div');
      wrapper.className = 'chess-container';

      const boardEl = document.createElement('div');
      boardEl.className = 'chess-board';

      // Always orient board with current player at bottom
      // White: Row 7 at bottom. Black: Row 0 at bottom.
      for (let rIndex = 0; rIndex < 8; rIndex++) {
        const r = this.myColor === 'w' ? rIndex : 7 - rIndex;
        for (let cIndex = 0; cIndex < 8; cIndex++) {
          const c = this.myColor === 'w' ? cIndex : 7 - cIndex;

          const sq = document.createElement('div');
          const isLight = (r + c) % 2 === 0;
          sq.className = `chess-square ${isLight ? 'light' : 'dark'}`;
          sq.dataset.row = r;
          sq.dataset.col = c;
          sq.onclick = () => this.onSquareClick(r, c);

          boardEl.appendChild(sq);
        }
      }

      wrapper.appendChild(boardEl);
      this.container.appendChild(wrapper);
      this.boardEl = boardEl;
      this.renderPieces();
    }

    getSquareEl(r, c) {
      // Map back grid elements based on board orientation
      const rowTarget = this.myColor === 'w' ? r : 7 - r;
      const colTarget = this.myColor === 'w' ? c : 7 - c;
      const index = rowTarget * 8 + colTarget;
      return this.boardEl.children[index];
    }

    renderPieces() {
      // Clear all squares
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const sqEl = this.getSquareEl(r, c);
          sqEl.innerHTML = '';
          sqEl.classList.remove('selected', 'legal-move', 'legal-capture', 'in-check');

          const piece = this.board[r][c];
          if (piece) {
            const img = document.createElement('div');
            img.className = `chess-piece ${this.getPieceColor(piece) === 'w' ? 'white' : 'black'}`;
            img.innerHTML = this.getPieceSvg(piece);
            sqEl.appendChild(img);
          }
        }
      }

      // Highlight checked King if check is active
      const checkedColor = this.currentTurn;
      if (this.isKingInCheck(this.board, checkedColor)) {
        const kingPos = this.findKing(this.board, checkedColor);
        if (kingPos) {
          const kingSq = this.getSquareEl(kingPos.r, kingPos.c);
          kingSq.classList.add('in-check');
        }
      }
    }

    updateStatus() {
      const parent = this.container.closest('.game-window');
      if (!parent) return;

      const indicator = parent.querySelector('.turn-indicator');
      const text = parent.querySelector('.game-status-text');

      if (this.isGameOver) {
        indicator.className = 'turn-indicator';
        return;
      }

      const isMyTurn = this.myColor === this.currentTurn;
      indicator.className = 'turn-indicator ' + (isMyTurn ? 'active' : 'opponent');
      
      const checkText = this.isKingInCheck(this.board, this.currentTurn) ? " (Check!)" : "";
      const colorName = this.myColor === 'w' ? 'White' : 'Black';
      text.textContent = isMyTurn 
        ? `Your Turn (${colorName})${checkText}` 
        : `Opponent Moving...${checkText}`;
    }

    getPieceColor(piece) {
      if (!piece) return null;
      return piece === piece.toUpperCase() ? 'w' : 'b';
    }

    onSquareClick(r, c) {
      if (this.isGameOver || this.currentTurn !== this.myColor) return;

      const piece = this.board[r][c];
      const clickedColor = this.getPieceColor(piece);

      // If we click legal move target square
      if (this.selectedSquare && this.legalDestinations.some(d => d.r === r && d.c === c)) {
        this.executeMove(this.selectedSquare.r, this.selectedSquare.c, r, c);
        return;
      }

      // Select piece of current player's color
      if (piece && clickedColor === this.myColor) {
        this.selectedSquare = { r, c };
        this.legalDestinations = this.getValidMoves(r, c);
        
        // Render highlights
        this.renderPieces();
        const sqEl = this.getSquareEl(r, c);
        sqEl.classList.add('selected');

        this.legalDestinations.forEach(dest => {
          const destEl = this.getSquareEl(dest.r, dest.c);
          if (this.board[dest.r][dest.c]) {
            destEl.classList.add('legal-capture');
          } else {
            destEl.classList.add('legal-move');
          }
        });
      } else {
        // Clear selection
        this.selectedSquare = null;
        this.legalDestinations = [];
        this.renderPieces();
      }
    }

    executeMove(fromR, fromC, toR, toC) {
      const piece = this.board[fromR][fromC];
      this.board[fromR][fromC] = null;
      this.board[toR][toC] = piece;

      // Basic Pawn Promotion to Queen
      if (piece === 'P' && toR === 0) this.board[toR][toC] = 'Q';
      if (piece === 'p' && toR === 7) this.board[toR][toC] = 'q';

      this.selectedSquare = null;
      this.legalDestinations = [];

      // Broadcast move
      sendGamePacket(this.opponentId, 'game_move', { fromR, fromC, toR, toC });

      // Change turn
      this.currentTurn = this.currentTurn === 'w' ? 'b' : 'w';
      this.renderPieces();
      this.updateStatus();
      this.evaluateGameEnd();
    }

    onOpponentMove(move) {
      const { fromR, fromC, toR, toC } = move;
      const piece = this.board[fromR][fromC];
      
      this.board[fromR][fromC] = null;
      this.board[toR][toC] = piece;

      // Basic Pawn Promotion to Queen
      if (piece === 'P' && toR === 0) this.board[toR][toC] = 'Q';
      if (piece === 'p' && toR === 7) this.board[toR][toC] = 'q';

      this.currentTurn = this.myColor;
      this.renderPieces();
      this.updateStatus();
      this.evaluateGameEnd();
    }

    evaluateGameEnd() {
      const color = this.currentTurn;
      const check = this.isKingInCheck(this.board, color);
      const hasMoves = this.hasAnyLegalMoves(color);

      if (!hasMoves) {
        if (check) {
          this.endGame(color === 'w' ? 'black' : 'white'); // Opposing color wins
        } else {
          this.endGame('stalemate');
        }
      }
    }

    endGame(winner) {
      this.isGameOver = true;
      const scores = getScores(this.opponentId);
      const roles = getScoreSchemaRoles(this.opponentId);

      let title = "";
      let subtitle = "";

      if (winner === 'stalemate') {
        title = "Draw by Stalemate";
        subtitle = "No moves remaining.";
        scores.ties++;
      } else if ((winner === 'white' && this.myColor === 'w') || (winner === 'black' && this.myColor === 'b')) {
        title = "Checkmate! You Win 🏆";
        subtitle = "An absolute strategic masterpiece.";
        if (roles.isMeUser1) scores.winsUser1++;
        else scores.winsUser2++;
      } else {
        title = "Checkmate! Defeat 😢";
        subtitle = "Your king has fallen.";
        if (roles.isMeUser1) scores.winsUser2++;
        else scores.winsUser1++;
      }

      broadcastScoreSync(this.opponentId);
      updateScoreboardUI(this.opponentId);
      this.showGameOverScreen(title, subtitle);
    }

    showGameOverScreen(title, subtitle) {
      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      overlay.innerHTML = `
        <div class="game-over-title">${title}</div>
        <div class="game-over-subtitle">${subtitle}</div>
        <button type="button" class="game-restart-btn">New Match</button>
      `;

      overlay.querySelector('.game-restart-btn').onclick = () => {
        this.reset(true);
      };

      this.container.appendChild(overlay);
    }

    reset(sendRestart) {
      this.isGameOver = false;
      this.selectedSquare = null;
      this.legalDestinations = [];
      this.currentTurn = 'w';
      this.initBoard();
      
      const overlay = this.container.querySelector('.game-over-overlay');
      if (overlay) overlay.remove();

      this.renderPieces();
      this.updateStatus();

      if (sendRestart) {
        sendGamePacket(this.opponentId, 'game_restart', {});
      }
    }

    // ==========================================================================
    // CHESS MOVE VALIDATION ENGINE (LIGHTWEIGHT)
    // ==========================================================================

    // Get strictly valid moves that don't violate check rules
    getValidMoves(r, c) {
      const pseudo = this.getPseudoMoves(this.board, r, c);
      return pseudo.filter(dest => {
        // Simulate board copy
        const tempBoard = this.board.map(row => [...row]);
        tempBoard[dest.r][dest.c] = tempBoard[r][c];
        tempBoard[r][c] = null;
        return !this.isKingInCheck(tempBoard, this.myColor);
      });
    }

    hasAnyLegalMoves(color) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (this.getPieceColor(this.board[r][c]) === color) {
            const valid = this.getPseudoMoves(this.board, r, c).filter(dest => {
              const tempBoard = this.board.map(row => [...row]);
              tempBoard[dest.r][dest.c] = tempBoard[r][c];
              tempBoard[r][c] = null;
              return !this.isKingInCheck(tempBoard, color);
            });
            if (valid.length > 0) return true;
          }
        }
      }
      return false;
    }

    getPseudoMoves(board, r, c) {
      const piece = board[r][c];
      if (!piece) return [];

      const color = this.getPieceColor(piece);
      const moves = [];
      const type = piece.toLowerCase();

      if (type === 'p') {
        const dir = color === 'w' ? -1 : 1;
        const startRow = color === 'w' ? 6 : 1;

        // Forward steps
        if (r + dir >= 0 && r + dir < 8 && !board[r + dir][c]) {
          moves.push({ r: r + dir, c });
          if (r === startRow && !board[r + 2 * dir][c]) {
            moves.push({ r: r + 2 * dir, c });
          }
        }

        // Diagonals
        for (const dc of [-1, 1]) {
          const tr = r + dir;
          const tc = c + dc;
          if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            const targetPiece = board[tr][tc];
            if (targetPiece && this.getPieceColor(targetPiece) !== color) {
              moves.push({ r: tr, c: tc });
            }
          }
        }
      }

      else if (type === 'n') {
        const jumps = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2],
          [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (const [dr, dc] of jumps) {
          const tr = r + dr;
          const tc = c + dc;
          if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            const targetPiece = board[tr][tc];
            if (!targetPiece || this.getPieceColor(targetPiece) !== color) {
              moves.push({ r: tr, c: tc });
            }
          }
        }
      }

      else if (type === 'b' || type === 'q') {
        const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        this.addSlideMoves(board, r, c, dirs, color, moves);
      }

      if (type === 'r' || type === 'q') {
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        this.addSlideMoves(board, r, c, dirs, color, moves);
      }

      else if (type === 'k') {
        const dirs = [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1],          [0, 1],
          [1, -1],  [1, 0],  [1, 1]
        ];
        for (const [dr, dc] of dirs) {
          const tr = r + dr;
          const tc = c + dc;
          if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            const targetPiece = board[tr][tc];
            if (!targetPiece || this.getPieceColor(targetPiece) !== color) {
              moves.push({ r: tr, c: tc });
            }
          }
        }
      }

      return moves;
    }

    addSlideMoves(board, r, c, dirs, color, moves) {
      for (const [dr, dc] of dirs) {
        let tr = r + dr;
        let tc = c + dc;
        while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
          const targetPiece = board[tr][tc];
          if (!targetPiece) {
            moves.push({ r: tr, c: tc });
          } else {
            if (this.getPieceColor(targetPiece) !== color) {
              moves.push({ r: tr, c: tc });
            }
            break; // path blocked
          }
          tr += dr;
          tc += dc;
        }
      }
    }

    findKing(board, color) {
      const kingChar = color === 'w' ? 'K' : 'k';
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (board[r][c] === kingChar) return { r, c };
        }
      }
      return null;
    }

    isKingInCheck(board, color) {
      const kingPos = this.findKing(board, color);
      if (!kingPos) return false;

      const oppColor = color === 'w' ? 'b' : 'w';

      // Iterate opponent pieces to see if any attack king Pos
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (piece && this.getPieceColor(piece) === oppColor) {
            const moves = this.getPseudoMoves(board, r, c);
            if (moves.some(m => m.r === kingPos.r && m.c === kingPos.c)) {
              return true;
            }
          }
        }
      }
      return false;
    }

    // Return SVGs representation for pieces
    getPieceSvg(piece) {
      const type = piece.toLowerCase();
      
      // Geometric neo-brutalist paths for Chess pieces
      if (type === 'p') {
        return `<svg class="chess-piece" viewBox="0 0 45 45">
          <path d="M22.5,9 C24.2,9 25.5,7.7 25.5,6 C25.5,4.3 24.2,3 22.5,3 C20.8,3 19.5,4.3 19.5,6 C19.5,7.7 20.8,9 22.5,9 z M29,40 L16,40 L16,36 C20,34 21,30 21,24 L19,24 C17,24 16,21 16,19 C16,16 19,13 22.5,13 C26,13 29,16 29,19 C29,21 28,24 26,24 L24,24 C24,30 25,34 29,36 L29,40 z" />
        </svg>`;
      }
      if (type === 'r') {
        return `<svg class="chess-piece" viewBox="0 0 45 45">
          <path d="M9,39 L36,39 L36,35 L9,35 L9,39 z M12,32 L33,32 L30,17 L15,17 L12,32 z M9,14 L13,14 L13,9 L19,9 L19,14 L26,14 L26,9 L32,9 L32,14 L36,14 L36,5 L9,5 L9,14 z" />
        </svg>`;
      }
      if (type === 'n') {
        return `<svg class="chess-piece" viewBox="0 0 45 45">
          <path d="M33,39 L12,39 C12,30 14,26 17,23 C15,22 11,20 9,14 C8,11 11,9 13,9 C15,9 18,11 20,13 C22,10 26,8 31,10 C34,11 36,14 36,19 C36,25 34,31 33,39 z M25,15 A2,2 0 1,0 25,19 A2,2 0 1,0 25,15" />
        </svg>`;
      }
      if (type === 'b') {
        return `<svg class="chess-piece" viewBox="0 0 45 45">
          <path d="M9,39 L36,39 L36,36 L9,36 L9,39 z M22.5,4 C20.5,4 15,10 15,19 C15,26 18,31 22.5,33 C27,31 30,26 30,19 C30,10 24.5,4 22.5,4 z M22.5,1 A1.5,1.5 0 1,0 22.5,4 A1.5,1.5 0 1,0 22.5,1" />
        </svg>`;
      }
      if (type === 'q') {
        return `<svg class="chess-piece" viewBox="0 0 45 45">
          <path d="M9,39 L36,39 L36,36 L9,36 L9,39 z M9,18 L15,31 L30,31 L36,18 L28,26 L22.5,12 L17,26 L9,18 z M22.5,3 A2.5,2.5 0 1,0 22.5,8 A2.5,2.5 0 1,0 22.5,3" />
        </svg>`;
      }
      if (type === 'k') {
        return `<svg class="chess-piece" viewBox="0 0 45 45">
          <path d="M9,39 L36,39 L36,36 L9,36 L9,39 z M12,32 L33,32 C33,24 29,20 22.5,20 C16,20 12,24 12,32 z M22.5,5 L22.5,15 M17.5,10 L27.5,10 M22.5,10 C26,10 29,13 29,17 C29,20 26,22 22.5,22 C19,22 16,20 16,17 C16,13 19,10 22.5,10 z" />
        </svg>`;
      }
    }
  }


  // ==========================================================================
  // GAME 3: STREAMLINED 2-PLAYER LUDO
  // ==========================================================================
  class LudoGame {
    constructor(opponentId, container, role) {
      this.opponentId = opponentId;
      this.container = container;
      this.role = role;
      this.isGameOver = false;

      // Player roles and colors
      // Inviter is Blue, Acceptor is Pink
      this.myColor = role === 'inviter' ? 'blue' : 'pink';
      this.currentTurn = 'blue'; // Blue goes first

      // 2 tokens each. 
      // State representation: 
      // - 'yard': at home base
      // - number (0 to 23): on the main track circle
      // - 'h0', 'h1', 'h2': in home stretch (3 steps)
      // - 'goal': reached the end!
      this.tokens = {
        blue: [ { pos: 'yard' }, { pos: 'yard' } ],
        pink: [ { pos: 'yard' }, { pos: 'yard' } ]
      };

      this.diceValue = 1;
      this.hasRolledThisTurn = false;
      this.movableTokenIndices = [];

      this.initUI();
      this.drawBoard();
      this.updateStatus();
    }

    initUI() {
      const wrapper = document.createElement('div');
      wrapper.className = 'ludo-container';

      // SVG Board
      const boardWrap = document.createElement('div');
      boardWrap.className = 'ludo-board-wrapper';
      boardWrap.innerHTML = `
        <svg class="ludo-board-svg" viewBox="-20 -20 240 240">
          <defs>
            <radialGradient id="ludo-goal-gradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#fff" />
              <stop offset="60%" stop-color="#7c3aed" />
              <stop offset="100%" stop-color="#111" />
            </radialGradient>
          </defs>
          <g id="ludo-board-cells"></g>
          <g id="ludo-tokens-layer"></g>
        </svg>
      `;

      // Dice panel
      const dicePanel = document.createElement('div');
      dicePanel.className = 'ludo-dice-area';
      dicePanel.innerHTML = `
        <div class="ludo-dice-label">Dice:</div>
        <div class="ludo-dice-box" id="ludo-dice">
          <svg class="dice-svg" viewBox="0 0 100 100">
            <rect x="5" y="5" width="90" height="90" rx="15" fill="none" />
            <g id="dice-dots"></g>
          </svg>
        </div>
      `;

      wrapper.appendChild(boardWrap);
      wrapper.appendChild(dicePanel);
      this.container.appendChild(wrapper);

      this.diceBox = dicePanel.querySelector('#ludo-dice');
      this.diceBox.onclick = () => this.rollDice();
      this.drawDiceDots(1);

      this.boardCellsGroup = boardWrap.querySelector('#ludo-board-cells');
      this.tokensGroup = boardWrap.querySelector('#ludo-tokens-layer');
    }

    // Layout cells coordinates in SVG space
    // Standard ring circle of 24 spaces
    // Blue Yard, Pink Yard, Goal Center
    getCellCoords(pos, color) {
      const cx = 100, cy = 100;
      const radius = 80;

      // Main Loop positions: 24 steps
      if (typeof pos === 'number') {
        const angle = (pos * (360 / 24) - 90) * (Math.PI / 180);
        return {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle)
        };
      }

      // Home stretches
      if (pos.startsWith('h')) {
        const step = parseInt(pos.charAt(1));
        const rStretch = 60 - step * 15;
        // Blue home stretch goes downwards (from top index 23/0 towards center)
        // Pink home stretch goes upwards (from bottom index 12 towards center)
        const angle = (color === 'blue' ? -90 : 90) * (Math.PI / 180);
        return {
          x: cx + rStretch * Math.cos(angle),
          y: cy + rStretch * Math.sin(angle)
        };
      }

      // Goal Center
      if (pos === 'goal') {
        return { x: cx, y: cy };
      }

      // Yards (Yard index for token placement)
      if (pos.startsWith('yard_')) {
        const tokenIdx = parseInt(pos.split('_')[1]);
        const offset = tokenIdx === 0 ? -15 : 15;
        if (color === 'blue') {
          return { x: 30 + offset, y: 30 };
        } else {
          return { x: 170 + offset, y: 170 };
        }
      }

      return { x: cx, y: cy };
    }

    drawBoard() {
      this.boardCellsGroup.innerHTML = '';
      
      // Draw Yards Background
      this.boardCellsGroup.innerHTML += `
        <rect x="5" y="5" width="50" height="50" rx="6" fill="rgba(0, 240, 255, 0.08)" stroke="var(--game-border-neon-blue)" stroke-width="1.5" />
        <text x="30" y="22" fill="var(--game-border-neon-blue)" font-size="8" text-anchor="middle" font-weight="700">BLUE</text>
        
        <rect x="145" y="145" width="50" height="50" rx="6" fill="rgba(255, 0, 127, 0.08)" stroke="var(--game-border-neon-pink)" stroke-width="1.5" />
        <text x="170" y="162" fill="var(--game-border-neon-pink)" font-size="8" text-anchor="middle" font-weight="700">PINK</text>

        <!-- Center Goal -->
        <circle cx="100" cy="100" r="14" class="ludo-cell goal" />
      `;

      // Draw Main Track: 24 cells
      for (let i = 0; i < 24; i++) {
        const coords = this.getCellCoords(i);
        let cellClass = 'ludo-cell';
        if (i === 0) cellClass += ' red-start'; // Blue start
        if (i === 12) cellClass += ' green-start'; // Pink start
        
        this.boardCellsGroup.innerHTML += `
          <circle cx="${coords.x}" cy="${coords.y}" r="8" class="${cellClass}" data-step="${i}" />
          <text x="${coords.x}" y="${coords.y + 2.5}" fill="rgba(255,255,255,0.3)" font-size="7" font-weight="600" text-anchor="middle">${i}</text>
        `;
      }

      // Draw Home Stretches
      for (let s = 0; s < 3; s++) {
        // Blue home path
        const bCoords = this.getCellCoords(`h${s}`, 'blue');
        this.boardCellsGroup.innerHTML += `
          <circle cx="${bCoords.x}" cy="${bCoords.y}" r="7" fill="rgba(0, 240, 255, 0.2)" stroke="var(--game-border-neon-blue)" stroke-width="1" />
        `;
        // Pink home path
        const pCoords = this.getCellCoords(`h${s}`, 'pink');
        this.boardCellsGroup.innerHTML += `
          <circle cx="${pCoords.x}" cy="${pCoords.y}" r="7" fill="rgba(255, 0, 127, 0.2)" stroke="var(--game-border-neon-pink)" stroke-width="1" />
        `;
      }

      this.renderTokens();
    }

    renderTokens() {
      this.tokensGroup.innerHTML = '';

      // Draw Blue Tokens
      this.tokens.blue.forEach((tok, idx) => {
        const pos = tok.pos === 'yard' ? `yard_${idx}` : tok.pos;
        const coords = this.getCellCoords(pos, 'blue');
        const movable = this.currentTurn === this.myColor && this.movableTokenIndices.includes(idx) && this.myColor === 'blue';
        
        this.tokensGroup.innerHTML += `
          <g class="ludo-token color-blue ${movable ? 'movable' : ''}" data-color="blue" data-index="${idx}" transform="translate(${coords.x}, ${coords.y})" onclick="window.handleLudoTokenClick('${this.opponentId}', 'blue', ${idx})">
            <circle cx="0" cy="0" r="6" fill="#00f0ff" stroke="#000" stroke-width="1.5" />
            <circle cx="0" cy="0" r="3" fill="#fff" opacity="0.8" />
          </g>
        `;
      });

      // Draw Pink Tokens
      this.tokens.pink.forEach((tok, idx) => {
        const pos = tok.pos === 'yard' ? `yard_${idx}` : tok.pos;
        const coords = this.getCellCoords(pos, 'pink');
        const movable = this.currentTurn === this.myColor && this.movableTokenIndices.includes(idx) && this.myColor === 'pink';

        this.tokensGroup.innerHTML += `
          <g class="ludo-token color-pink ${movable ? 'movable' : ''}" data-color="pink" data-index="${idx}" transform="translate(${coords.x}, ${coords.y})" onclick="window.handleLudoTokenClick('${this.opponentId}', 'pink', ${idx})">
            <circle cx="0" cy="0" r="6" fill="#ff007f" stroke="#000" stroke-width="1.5" />
            <circle cx="0" cy="0" r="3" fill="#fff" opacity="0.8" />
          </g>
        `;
      });

      // Expose globally so inline SVG onclicks can route to this instance
      window.handleLudoTokenClick = (opponentId, color, index) => {
        const gw = activeGameWindows[opponentId];
        if (gw && gw.activeGameInstance && gw.activeGameInstance instanceof LudoGame) {
          gw.activeGameInstance.onTokenClick(color, index);
        }
      };
    }

    drawDiceDots(val) {
      const dotsGroup = this.diceBox.querySelector('#dice-dots');
      dotsGroup.innerHTML = '';

      const dotCoords = {
        1: [[50, 50]],
        2: [[25, 25], [75, 75]],
        3: [[25, 25], [50, 50], [75, 75]],
        4: [[25, 25], [25, 75], [75, 25], [75, 75]],
        5: [[25, 25], [25, 75], [50, 50], [75, 25], [75, 75]],
        6: [[25, 25], [25, 50], [25, 75], [75, 25], [75, 50], [75, 75]]
      };

      const coords = dotCoords[val] || [];
      coords.forEach(([cx, cy]) => {
        dotsGroup.innerHTML += `<circle cx="${cx}" cy="${cy}" r="7" class="dice-dot" />`;
      });
    }

    updateStatus() {
      const parent = this.container.closest('.game-window');
      if (!parent) return;

      const indicator = parent.querySelector('.turn-indicator');
      const text = parent.querySelector('.game-status-text');

      if (this.isGameOver) {
        indicator.className = 'turn-indicator';
        return;
      }

      const isMyTurn = this.myColor === this.currentTurn;
      indicator.className = 'turn-indicator ' + (isMyTurn ? 'active' : 'opponent');

      if (isMyTurn) {
        if (!this.hasRolledThisTurn) {
          text.textContent = "Your Turn: ROLL THE DICE!";
          this.diceBox.classList.remove('disabled');
        } else if (this.movableTokenIndices.length > 0) {
          text.textContent = "Click a glowing token to move!";
          this.diceBox.classList.add('disabled');
        } else {
          text.textContent = "No legal moves! Skipping turn...";
          this.diceBox.classList.add('disabled');
        }
      } else {
        text.textContent = "Opponent rolling...";
        this.diceBox.classList.add('disabled');
      }
    }

    rollDice() {
      if (this.currentTurn !== this.myColor || this.hasRolledThisTurn || this.isGameOver) return;

      this.diceBox.classList.add('rolling');
      
      // Roll calculation
      const roll = Math.floor(Math.random() * 6) + 1;
      
      setTimeout(() => {
        this.diceBox.classList.remove('rolling');
        this.diceValue = roll;
        this.drawDiceDots(roll);
        this.hasRolledThisTurn = true;

        this.calculateMovableTokens(roll);

        // Send roll packet to opponent
        sendGamePacket(this.opponentId, 'game_move', { action: 'roll', roll });

        this.updateStatus();
        this.renderTokens();

        // If no moves, advance turn automatically
        if (this.movableTokenIndices.length === 0) {
          setTimeout(() => this.passTurn(), 1500);
        }
      }, 600);
    }

    calculateMovableTokens(roll) {
      this.movableTokenIndices = [];
      const myTokens = this.tokens[this.myColor];

      myTokens.forEach((tok, idx) => {
        // Goal tokens cannot move
        if (tok.pos === 'goal') return;

        // In yard: requires roll of 6 to deploy (or any roll if we want fast gameplay)
        // Let's require 6 to deploy from Yard to start space, standard rules!
        if (tok.pos === 'yard') {
          if (roll === 6) this.movableTokenIndices.push(idx);
          return;
        }

        // On track: check path constraints
        if (typeof tok.pos === 'number') {
          // Check if moving exceeds home stretch bounds
          const currentProgress = this.getTokenProgress(tok.pos, this.myColor);
          if (currentProgress + roll <= 27) { // 24 cells on track + 3 in home stretch = goal at 27
            this.movableTokenIndices.push(idx);
          }
          return;
        }

        // In home stretch: must land exactly
        if (tok.pos.startsWith('h')) {
          const step = parseInt(tok.pos.charAt(1));
          if (step + roll <= 3) { // h0 (step 0), h1 (1), h2 (2), goal at index 3
            this.movableTokenIndices.push(idx);
          }
        }
      });
    }

    // Get track distance progress for user color
    getTokenProgress(trackIndex, color) {
      if (color === 'blue') {
        // Blue starts at index 0, circles up to index 22, then exits
        return trackIndex;
      } else {
        // Pink starts at 12, loops around index 23 -> 0 -> index 10, then exits
        if (trackIndex >= 12) return trackIndex - 12;
        return trackIndex + 12;
      }
    }

    // Reverse progress distance back to track coordinate index
    getProgressToTrackIndex(progress, color) {
      if (color === 'blue') {
        return progress;
      } else {
        const val = progress + 12;
        return val >= 24 ? val - 24 : val;
      }
    }

    onTokenClick(color, index) {
      if (this.currentTurn !== this.myColor || color !== this.myColor || !this.movableTokenIndices.includes(index)) return;

      this.moveToken(this.myColor, index, this.diceValue);
    }

    moveToken(color, index, roll) {
      const tok = this.tokens[color][index];
      let newPos = tok.pos;

      if (tok.pos === 'yard') {
        newPos = color === 'blue' ? 0 : 12; // deploy
      } 
      else if (typeof tok.pos === 'number') {
        const progress = this.getTokenProgress(tok.pos, color);
        const nextProgress = progress + roll;
        if (nextProgress >= 24) {
          const homeIdx = nextProgress - 24;
          newPos = homeIdx === 3 ? 'goal' : `h${homeIdx}`;
        } else {
          newPos = this.getProgressToTrackIndex(nextProgress, color);
        }
      } 
      else if (tok.pos.startsWith('h')) {
        const step = parseInt(tok.pos.charAt(1));
        const nextStep = step + roll;
        newPos = nextStep === 3 ? 'goal' : `h${nextStep}`;
      }

      tok.pos = newPos;

      // Handle Captures (if landing on opponent's token on track)
      if (typeof newPos === 'number') {
        const oppColor = color === 'blue' ? 'pink' : 'blue';
        const oppTokens = this.tokens[oppColor];
        oppTokens.forEach(ot => {
          if (ot.pos === newPos) {
            ot.pos = 'yard'; // Send captured token back to base!
          }
        });
      }

      // Send move packet
      if (color === this.myColor) {
        sendGamePacket(this.opponentId, 'game_move', { action: 'move', index, roll });
      }

      this.movableTokenIndices = [];
      this.hasRolledThisTurn = false;
      this.renderTokens();

      // Check win condition
      if (this.tokens[color].every(t => t.pos === 'goal')) {
        this.endGame(color);
        return;
      }

      // Standard Ludo Rule: rolling a 6 awards an extra turn!
      if (roll === 6) {
        this.updateStatus();
      } else {
        this.passTurn();
      }
    }

    passTurn() {
      this.currentTurn = this.currentTurn === 'blue' ? 'pink' : 'blue';
      this.hasRolledThisTurn = false;
      this.movableTokenIndices = [];
      this.updateStatus();
      this.renderTokens();
    }

    onOpponentMove(move) {
      if (move.action === 'roll') {
        this.diceValue = move.roll;
        this.drawDiceDots(move.roll);
        this.hasRolledThisTurn = true;
        this.updateStatus();
      } 
      else if (move.action === 'move') {
        const oppColor = this.myColor === 'blue' ? 'pink' : 'blue';
        this.moveToken(oppColor, move.index, move.roll);
      }
    }

    endGame(winnerColor) {
      this.isGameOver = true;
      const scores = getScores(this.opponentId);
      const roles = getScoreSchemaRoles(this.opponentId);

      let title = "";
      let subtitle = "";

      if (winnerColor === this.myColor) {
        title = "Victory! 🏆";
        subtitle = "Both tokens successfully made it home.";
        if (roles.isMeUser1) scores.winsUser1++;
        else scores.winsUser2++;
      } else {
        title = "Defeat 😢";
        subtitle = "Opponent got their tokens home first.";
        if (roles.isMeUser1) scores.winsUser2++;
        else scores.winsUser1++;
      }

      broadcastScoreSync(this.opponentId);
      updateScoreboardUI(this.opponentId);
      this.showGameOverScreen(title, subtitle);
    }

    showGameOverScreen(title, subtitle) {
      const overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      overlay.innerHTML = `
        <div class="game-over-title">${title}</div>
        <div class="game-over-subtitle">${subtitle}</div>
        <button type="button" class="game-restart-btn">Play Again</button>
      `;

      overlay.querySelector('.game-restart-btn').onclick = () => {
        this.reset(true);
      };

      this.container.appendChild(overlay);
    }

    reset(sendRestart) {
      this.isGameOver = false;
      this.tokens = {
        blue: [ { pos: 'yard' }, { pos: 'yard' } ],
        pink: [ { pos: 'yard' }, { pos: 'yard' } ]
      };
      this.currentTurn = 'blue';
      this.hasRolledThisTurn = false;
      this.movableTokenIndices = [];

      const overlay = this.container.querySelector('.game-over-overlay');
      if (overlay) overlay.remove();

      this.drawBoard();
      this.updateStatus();

      if (sendRestart) {
        sendGamePacket(this.opponentId, 'game_restart', {});
      }
    }
  }

  // ==========================================================================
  // EXPOSE GLOBAL API HOOKS
  // ==========================================================================
  window.toggleGamePicker = toggleGamePicker;
  window.handleIncomingGameEvent = handleIncomingGameEvent;
  window.syncGameWindowPosition = syncGameWindowPosition;
  window.handlePmMinimize = handlePmMinimize;
  window.handlePmRestore = handlePmRestore;
  window.handlePmClose = handlePmClose;

})();
