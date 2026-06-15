const fs = require('fs');
const content = fs.readFileSync('js/chat.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('presenceBaseData')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
