// Mobile sidebar drawer, input extras, and download modal logic.
(function() {
  const MOBILE_BP = 1024;

  function isMobile() { return window.innerWidth <= MOBILE_BP; }

  function getBackdrop() { return document.getElementById('sidebar-backdrop'); }
  function getLeftSidebar() { return document.getElementById('sidebar-left'); }
  function getRightSidebar() { return document.getElementById('sidebar-right'); }

  // Mobile Tabs Logic
  window.switchMobileTab = function(tabName) {
    const tabs = document.querySelectorAll('.mobile-tab-btn');
    tabs.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('tab-' + tabName);
    if (activeBtn) activeBtn.classList.add('active');

    const shell = document.querySelector('.page-shell');
    if (shell) {
      if (tabName === 'rooms') {
        shell.classList.add('mobile-rooms-active');
        shell.classList.remove('mobile-users-active');
      } else if (tabName === 'users') {
        shell.classList.remove('mobile-rooms-active');
        shell.classList.add('mobile-users-active');
      } else {
        shell.classList.remove('mobile-rooms-active');
        shell.classList.remove('mobile-users-active');
      }
    }
  };

  window.toggleLeftSidebar = function() {
    if (isMobile()) switchMobileTab('rooms');
  };

  window.toggleRightSidebar = function() {
    if (isMobile()) switchMobileTab('users');
  };

  window.closeAllSidebars = function() {
    // Compatibility
  };

  // Input Strip Extras Menu Logic
  window.toggleInputExtrasMenu = function(event) {
    event?.stopPropagation();
    const group = document.getElementById('input-buttons-group');
    if (group) group.classList.toggle('open');
  };

  window.closeInputExtras = function() {
    const group = document.getElementById('input-buttons-group');
    if (group) group.classList.remove('open');
  };

  document.addEventListener('click', (event) => {
    const group = document.getElementById('input-buttons-group');
    const btn = document.getElementById('btn-input-extras');
    if (group && btn && !group.contains(event.target) && event.target !== btn) {
      group.classList.remove('open');
    }
  });

  // Mobile Download App Modal Logic
  window.checkShowDownloadModal = function() {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isCapacitor = window.hasOwnProperty('Capacitor');

    if (isAndroid && !isCapacitor) {
      const modal = document.getElementById('download-app-modal');
      if (modal) modal.classList.remove('hidden');
    }
  };

  window.closeDownloadModal = function() {
    const modal = document.getElementById('download-app-modal');
    if (modal) modal.classList.add('hidden');
  };

  // Call on load instantly
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkShowDownloadModal);
  } else {
    checkShowDownloadModal();
  }

  // Auto-close sidebars when window resizes above mobile breakpoint
  window.addEventListener('resize', function() {
    if (!isMobile()) {
      const shell = document.querySelector('.page-shell');
      if (shell) {
        shell.classList.remove('mobile-rooms-active');
        shell.classList.remove('mobile-users-active');
      }
    }
  });

  // Feature 2 — Rooms sidebar pin/unpin logic
  (function initRoomsPin() {
    const isPinned = localStorage.getItem('cc-rooms-pinned') !== 'false'; // default: pinned
    if (!isPinned) document.body.classList.add('rooms-unpinned');

    const pinBtn = document.getElementById('btn-pin-rooms');
    if (pinBtn) {
      pinBtn.textContent = isPinned ? '📌 Pinned' : '📌 Pin';
      pinBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const nowUnpinned = document.body.classList.toggle('rooms-unpinned');
        localStorage.setItem('cc-rooms-pinned', String(!nowUnpinned));
        pinBtn.textContent = nowUnpinned ? '📌 Pin' : '📌 Pinned';
      });
    }
  })();
})();
