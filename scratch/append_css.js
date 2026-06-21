const fs = require('fs');
const cssPath = 'C:\\Users\\HP\\.gemini\\antigravity\\scratch\\chatcorner\\css\\chat-extras-v3.css';
const content = fs.readFileSync(cssPath, 'utf8');

const bannerCSS = `
/* ── CONNECTION ERROR BANNER ─────────────────────────────────── */
.connection-error-banner {
  position: fixed;
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  background: rgba(239, 68, 68, 0.95);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  gap: 15px;
  font-family: 'Exo 2', sans-serif;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid rgba(255,255,255,0.2);
  transition: all 0.3s ease;
  animation: slideDown 0.3s ease-out;
}
.connection-error-banner.hidden {
  display: none !important;
}
.connection-error-banner .banner-close {
  background: none;
  border: none;
  color: rgba(255,255,255,0.8);
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  padding: 0;
  margin: 0;
}
.connection-error-banner .banner-close:hover {
  color: white;
}
@keyframes slideDown {
  from { transform: translate(-50%, -40px); opacity: 0; }
  to { transform: translate(-50%, 0); opacity: 1; }
}
`;

fs.writeFileSync(cssPath, content + bannerCSS, 'utf8');
console.log('Successfully appended banner CSS to chat-extras-v3.css');
