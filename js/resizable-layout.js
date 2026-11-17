/**
 * ChatCorner — Resizable Layout Handler
 * Smart Wide Interface with Draggable Dividers
 */

class ResizableLayout {
  constructor() {
    this.leftSidebar = document.querySelector('.sidebar-left, .sidebar.left');
    this.rightSidebar = document.querySelector('.sidebar-right, .sidebar.right, #sidebar-right');
    this.chatMain = document.querySelector('.chat-main');
    this.layout = document.querySelector('.layout');
    this.inputLeft = document.querySelector('.input-strip-left');
    this.inputRight = document.querySelector('.input-strip-right');

    // Storage keys for persistence
    this.LEFT_WIDTH_KEY = 'chatcorner_left_sidebar_width';
    this.RIGHT_WIDTH_KEY = 'chatcorner_right_sidebar_width';

    // Default widths (in pixels)
    this.DEFAULT_LEFT_WIDTH = 150;
    this.DEFAULT_RIGHT_WIDTH = 250;
    this.MIN_WIDTH = 150;
    this.MAX_WIDTH = 520;

    // Dragging state
    this.isDraggingLeft = false;
    this.isDraggingRight = false;
    this.startX = 0;
    this.startWidth = 0;

    this.init();
  }

  init() {
    if (!this.rightSidebar || !this.layout) return;
    this.loadSavedWidths();
    this.createResizeDividers();
    this.attachEventListeners();
    this.setupTouchSupport();
  }

  /**
   * Load saved sidebar widths from localStorage
   */
  loadSavedWidths() {
    if (window.innerWidth <= 1024) return;

    if (this.leftSidebar) {
      const savedLeftWidth = localStorage.getItem(this.LEFT_WIDTH_KEY);
      if (savedLeftWidth) {
        const width = Math.max(
          this.MIN_WIDTH,
          Math.min(this.MAX_WIDTH, parseInt(savedLeftWidth, 10))
        );
        this.leftSidebar.style.width = `${width}px`;
        if (this.inputLeft) this.inputLeft.style.width = `${width}px`;
      }
    }

    if (this.rightSidebar) {
      const savedRightWidth = localStorage.getItem(this.RIGHT_WIDTH_KEY);
      if (savedRightWidth) {
        const width = Math.max(
          this.MIN_WIDTH,
          Math.min(this.MAX_WIDTH, parseInt(savedRightWidth, 10))
        );
        this.rightSidebar.style.width = `${width}px`;
        this.rightSidebar.style.minWidth = `${width}px`;
        if (this.inputRight) this.inputRight.style.width = `${width}px`;
      }
    }
  }

  /**
   * Create resize dividers between sidebars and chat main
   */
  createResizeDividers() {
    // Left divider (if left sidebar exists)
    if (this.leftSidebar && !document.querySelector('.resize-divider-left')) {
      const leftDivider = document.createElement('div');
      leftDivider.className = 'resize-divider resize-divider-left';
      leftDivider.setAttribute('data-position', 'left');
      this.layout.insertBefore(leftDivider, this.chatMain);
    }

    // Right divider (between chat main and right sidebar)
    if (this.rightSidebar && !document.querySelector('.resize-divider-right')) {
      const rightDivider = document.createElement('div');
      rightDivider.className = 'resize-divider resize-divider-right';
      rightDivider.setAttribute('data-position', 'right');
      rightDivider.setAttribute('title', 'Drag to resize users list');
      this.layout.insertBefore(rightDivider, this.rightSidebar);
    }
  }

  /**
   * Attach event listeners for resizing
   */
  attachEventListeners() {
    const leftDivider = document.querySelector('.resize-divider-left');
    const rightDivider = document.querySelector('.resize-divider-right');

    if (leftDivider) {
      leftDivider.addEventListener('mousedown', (e) => this.startResize(e, 'left'));
      leftDivider.addEventListener('touchstart', (e) => this.startResize(e, 'left'), { passive: false });
    }

    if (rightDivider) {
      rightDivider.addEventListener('mousedown', (e) => this.startResize(e, 'right'));
      rightDivider.addEventListener('touchstart', (e) => this.startResize(e, 'right'), { passive: false });
    }

    document.addEventListener('mousemove', (e) => this.onResize(e));
    document.addEventListener('touchmove', (e) => this.onResize(e), { passive: false });
    document.addEventListener('mouseup', () => this.stopResize());
    document.addEventListener('touchend', () => this.stopResize());
  }

  /**
   * Start resizing sidebar
   */
  startResize(e, position) {
    e.preventDefault();

    this.startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;

    if (position === 'left' && this.leftSidebar) {
      this.isDraggingLeft = true;
      this.startWidth = this.leftSidebar.offsetWidth;
      document.querySelector('.resize-divider-left')?.classList.add('dragging');
    } else if (position === 'right' && this.rightSidebar) {
      this.isDraggingRight = true;
      this.startWidth = this.rightSidebar.offsetWidth;
      document.querySelector('.resize-divider-right')?.classList.add('dragging');
    }

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  /**
   * Handle resizing
   */
  onResize(e) {
    if (!this.isDraggingLeft && !this.isDraggingRight) return;

    e.preventDefault();

    const currentX = e.type.includes('touch')
      ? e.touches[0].clientX
      : e.clientX;
    const diff = currentX - this.startX;

    if (this.isDraggingLeft && this.leftSidebar) {
      const newWidth = Math.max(
        this.MIN_WIDTH,
        Math.min(this.MAX_WIDTH, this.startWidth + diff)
      );
      this.leftSidebar.style.width = `${newWidth}px`;
      if (this.inputLeft) this.inputLeft.style.width = `${newWidth}px`;
    }

    if (this.isDraggingRight && this.rightSidebar) {
      const newWidth = Math.max(
        this.MIN_WIDTH,
        Math.min(this.MAX_WIDTH, this.startWidth - diff)
      );
      this.rightSidebar.style.width = `${newWidth}px`;
      this.rightSidebar.style.minWidth = `${newWidth}px`;
      if (this.inputRight) this.inputRight.style.width = `${newWidth}px`;
    }
  }

  /**
   * Stop resizing and save width
   */
  stopResize() {
    if (this.isDraggingLeft || this.isDraggingRight) {
      document.querySelector('.resize-divider-left')?.classList.remove('dragging');
      document.querySelector('.resize-divider-right')?.classList.remove('dragging');

      document.body.style.userSelect = 'auto';
      document.body.style.cursor = 'auto';

      if (this.isDraggingLeft && this.leftSidebar) {
        localStorage.setItem(
          this.LEFT_WIDTH_KEY,
          this.leftSidebar.offsetWidth.toString()
        );
      }

      if (this.isDraggingRight && this.rightSidebar) {
        localStorage.setItem(
          this.RIGHT_WIDTH_KEY,
          this.rightSidebar.offsetWidth.toString()
        );
      }

      this.isDraggingLeft = false;
      this.isDraggingRight = false;
    }
  }

  /**
   * Setup touch support for mobile devices
   */
  setupTouchSupport() {
    document.addEventListener(
      'touchmove',
      (e) => {
        if (this.isDraggingLeft || this.isDraggingRight) {
          e.preventDefault();
        }
      },
      { passive: false }
    );
  }

  /**
   * Reset sidebar widths to defaults
   */
  resetWidths() {
    if (this.leftSidebar) {
      this.leftSidebar.style.width = `${this.DEFAULT_LEFT_WIDTH}px`;
      if (this.inputLeft) this.inputLeft.style.width = `${this.DEFAULT_LEFT_WIDTH}px`;
    }
    if (this.rightSidebar) {
      this.rightSidebar.style.width = `${this.DEFAULT_RIGHT_WIDTH}px`;
      this.rightSidebar.style.minWidth = `${this.DEFAULT_RIGHT_WIDTH}px`;
      if (this.inputRight) this.inputRight.style.width = `${this.DEFAULT_RIGHT_WIDTH}px`;
    }
    localStorage.removeItem(this.LEFT_WIDTH_KEY);
    localStorage.removeItem(this.RIGHT_WIDTH_KEY);
  }

  /**
   * Set specific sidebar width
   */
  setSidebarWidth(position, width) {
    const clampedWidth = Math.max(
      this.MIN_WIDTH,
      Math.min(this.MAX_WIDTH, width)
    );

    if (position === 'left' && this.leftSidebar) {
      this.leftSidebar.style.width = `${clampedWidth}px`;
      if (this.inputLeft) this.inputLeft.style.width = `${clampedWidth}px`;
      localStorage.setItem(this.LEFT_WIDTH_KEY, clampedWidth.toString());
    } else if (position === 'right' && this.rightSidebar) {
      this.rightSidebar.style.width = `${clampedWidth}px`;
      this.rightSidebar.style.minWidth = `${clampedWidth}px`;
      if (this.inputRight) this.inputRight.style.width = `${clampedWidth}px`;
      localStorage.setItem(this.RIGHT_WIDTH_KEY, clampedWidth.toString());
    }
  }

  /**
   * Get current sidebar widths
   */
  getSidebarWidths() {
    return {
      left: this.leftSidebar ? this.leftSidebar.offsetWidth : 0,
      right: this.rightSidebar ? this.rightSidebar.offsetWidth : 0,
      chatMain: this.chatMain ? this.chatMain.offsetWidth : 0,
    };
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.chat-page')) {
    window.resizableLayout = new ResizableLayout();
  }
});

// Expose global function for resetting widths
window.resetSidebarWidths = () => {
  if (window.resizableLayout) {
    window.resizableLayout.resetWidths();
  }
};

// Expose function to set sidebar width
window.setSidebarWidth = (position, width) => {
  if (window.resizableLayout) {
    window.resizableLayout.setSidebarWidth(position, width);
  }
};

// Expose function to get sidebar widths
window.getSidebarWidths = () => {
  if (window.resizableLayout) {
    return window.resizableLayout.getSidebarWidths();
  }
  return null;
};