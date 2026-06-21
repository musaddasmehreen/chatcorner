const fs = require('fs');
const content = fs.readFileSync('css/chat-extras.css', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('.pc-') || line.includes('.profile-card')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
