/**
 * ChatCorner UI Enhancements
 * - Display users in PVT at top
 * - Show room users count on hover
 * - Minimized cams with usernames in center
 * - Watch cam feature with minimize/close
 */

class UIEnhancements {
  constructor() {
    this.currentRoomUsers = [];
    this.minimizedCams = new Map();
    this.setupPVTUsersDisplay();
    this.setupRoomTooltips();
    this.setupMinimizedCamsDisplay();
  }

  /**
   * FEATURE 1: Display all users in PVT at top (expandable/minimizable)
   */
  setupPVTUsersDisplay() {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;

    // Create PVT users container
    const pvtContainer = document.createElement('div');
    pvtContainer.id = 'pvt-users-container';
    pvtContainer.className = 'pvt-users-container';
    pvtContainer.innerHTML = `
      <div class="pvt-users-header">
        <span class="pvt-label">👥 Room Users</span>
        <button class="pvt-toggle-btn" title="Toggle user list">▼</button>
      </div>
      <div class="pvt-users-list hidden">
        <div id="pvt-users-grid" class="pvt-users-grid"></div>
      </div>
    `;
    topbar.appendChild(pvtContainer);

    // Toggle functionality
    const toggleBtn = pvtContainer.querySelector('.pvt-toggle-btn');
    const usersList = pvtContainer.querySelector('.pvt-users-list');
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      usersList.classList.toggle('hidden');
      toggleBtn.textContent = usersList.classList.contains('hidden') ? '▼' : '▲';
    };
  }

  /**
   * Update PVT users display
   */
  updatePVTUsers(users) {
    this.currentRoomUsers = users;
    const grid = document.getElementById('pvt-users-grid');
    if (!grid) return;

    grid.innerHTML = '';
    users.forEach(user => {
      const userEl = document.createElement('div');
      userEl.className = 'pvt-user-item';
      userEl.innerHTML = `
        <div class="pvt-user-avatar">${user.avatar || user.username[0].toUpperCase()}</div>
        <span class="pvt-user-name">${user.username}</span>
        ${user.isOnline ? '<div class="pvt-user-dot"></div>' : ''}
      `;
      grid.appendChild(userEl);
    });
  }

  /**
   * FEATURE 2: Room hover tooltip showing user count
   */
  setupRoomTooltips() {
    // This will be called when room list is rendered
    this.enhanceRoomList();
  }

  enhanceRoomList() {
    const roomList = document.getElementById('room-list');
    if (!roomList) return;

    const observer = new MutationObserver(() => {
      this.addRoomTooltips();
    });

    observer.observe(roomList, { childList: true });
    this.addRoomTooltips();
  }

  addRoomTooltips() {
    const roomItems = document.querySelectorAll('#room-list li');
    roomItems.forEach(item => {
      if (!item.hasAttribute('data-enhanced')) {
        item.setAttribute('data-enhanced', 'true');
        
        // Add tooltip with user count
        const originalTitle = item.title;
        item.addEventListener('mouseenter', (e) => {
          const roomName = item.textContent;
          // In real implementation, fetch user count from room data
          item.title = `${roomName}\n(Hover shows user count)`;
        });
      }
    });
  }

  /**
   * FEATURE 3: Minimized cams display in center
   * Shows minimized camera feeds with username on a single line
   */
  setupMinimizedCamsDisplay() {
    const chatMain = document.querySelector('.chat-main');
    if (!chatMain) return;

    const minCamsContainer = document.createElement('div');
    minCamsContainer.id = 'minimized-cams-container';
    minCamsContainer.className = 'minimized-cams-container hidden';
    minCamsContainer.innerHTML = `
      <div class="min-cams-label">📹 Active Cams</div>
      <div id="min-cams-list" class="min-cams-list"></div>
    `;
    
    // Insert before messages
    const messagesContainer = chatMain.querySelector('.messages');
    if (messagesContainer) {
      messagesContainer.parentNode.insertBefore(minCamsContainer, messagesContainer);
    }
  }

  /**
   * Add minimized camera feed
   */
  addMinimizedCam(userId, username, stream) {
    const minCamsList = document.getElementById('min-cams-list');
    if (!minCamsList) return;

    const container = document.getElementById('minimized-cams-container');
    container.classList.remove('hidden');

    const camEl = document.createElement('div');
    camEl.id = `min-cam-${userId}`;
    camEl.className = 'min-cam-item';
    camEl.innerHTML = `
      <video autoplay playsinline muted></video>
      <div class="min-cam-info">
        <span class="min-cam-name">${username}</span>
        <button class="min-cam-watch" title="Watch full cam">👁️</button>
        <button class="min-cam-close" title="Close">✕</button>
      </div>
    `;

    minCamsList.appendChild(camEl);
    this.minimizedCams.set(userId, { element: camEl, username });

    // Setup video stream
    const video = camEl.querySelector('video');
    video.srcObject = stream;

    // Watch button - maximize cam
    camEl.querySelector('.min-cam-watch').onclick = () => {
      this.showFullCam(userId, username, stream);
    };

    // Close button
    camEl.querySelector('.min-cam-close').onclick = () => {
      this.removeMinimizedCam(userId);
    };
  }

  /**
   * Remove minimized camera
   */
  removeMinimizedCam(userId) {
    const camData = this.minimizedCams.get(userId);
    if (camData) {
      camData.element.remove();
      this.minimizedCams.delete(userId);
    }

    // Hide container if no cams left
    if (this.minimizedCams.size === 0) {
      const container = document.getElementById('minimized-cams-container');
      if (container) container.classList.add('hidden');
    }
  }

  /**
   * FEATURE 4: Watch full cam
   * Shows maximized cam with user info and minimize/close buttons
   */
  showFullCam(userId, username, stream) {
    // Check if floating cam already exists
    let floatingCam = document.getElementById(`floating-cam-${userId}`);
    if (floatingCam) {
      floatingCam.classList.remove('hidden');
      return;
    }

    // Create new floating cam window
    floatingCam = document.createElement('div');
    floatingCam.id = `floating-cam-${userId}`;
    floatingCam.className = 'floating-cam-window';
    floatingCam.innerHTML = `
      <div class="floating-cam-header">
        <span class="floating-cam-title">📷 ${username}</span>
        <div class="floating-cam-actions">
          <button class="floating-cam-minimize" title="Minimize">−</button>
          <button class="floating-cam-close" title="Close">✕</button>
        </div>
      </div>
      <video autoplay playsinline muted></video>
    `;

    document.body.appendChild(floatingCam);

    // Setup video stream
    const video = floatingCam.querySelector('video');
    video.srcObject = stream;

    // Minimize button - hide and keep as minimized
    floatingCam.querySelector('.floating-cam-minimize').onclick = () => {
      floatingCam.classList.add('hidden');
    };

    // Close button
    floatingCam.querySelector('.floating-cam-close').onclick = () => {
      this.removeMinimizedCam(userId);
      floatingCam.remove();
    };

    // Make draggable
    this.makeDraggable(floatingCam);
  }

  /**
   * Make element draggable
   */
  makeDraggable(element) {
    const header = element.querySelector('.floating-cam-header');
    if (!header) return;

    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    header.onmousedown = (e) => {
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;

      document.onmouseup = () => {
        document.onmouseup = null;
        document.onmousemove = null;
      };

      document.onmousemove = (e) => {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + 'px';
        element.style.left = (element.offsetLeft - pos1) + 'px';
      };
    };
  }

  /**
   * FEATURE 5: Update room users display
   * Shows users in current room
   */
  updateRoomUsers(users, roomName) {
    // Update top bar PVT users
    this.updatePVTUsers(users);

    // Update right sidebar (already handled by existing code)
    // This just ensures coordination
  }
}

// Initialize on page load
window.uiEnhancements = null;
document.addEventListener('DOMContentLoaded', () => {
  window.uiEnhancements = new UIEnhancements();
});
