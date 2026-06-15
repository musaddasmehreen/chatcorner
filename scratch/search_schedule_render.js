const fs = require('fs');
const content = fs.readFileSync('js/chat.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('scheduleRenderUserList') || line.includes('_renderTimer')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
