const fs = require('fs');
const cssPath = 'C:\\Users\\HP\\.gemini\\antigravity\\scratch\\chatcorner\\css\\chat-extras-v3.css';
const content = fs.readFileSync(cssPath, 'utf8');

const reportCSS = `
/* ── MSG LOCAL REPORT BUTTON ─────────────────────────────────── */
.msg-local-report {
  display: none;
  position: absolute;
  top: .35rem;
  right: .35rem;
  border: 1px solid rgba(245,158,11,.35);
  background: rgba(245,158,11,.12);
  color: #fcd34d;
  border-radius: 6px;
  cursor: pointer;
  padding: .1rem .28rem;
  font-size: .75rem;
  line-height: 1;
  align-items: center;
  justify-content: center;
}
.msg-local-delete ~ .msg-local-report {
  right: 1.9rem;
}
.msg-row:hover .msg-local-report,
.msg-row:focus-within .msg-local-report {
  display: inline-flex;
}
.msg-local-report:hover {
  background: rgba(245,158,11,.25);
}
`;

fs.writeFileSync(cssPath, content + reportCSS, 'utf8');
console.log('Successfully appended report button CSS to chat-extras-v3.css');
