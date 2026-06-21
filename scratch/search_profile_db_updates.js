const fs = require('fs');
const content = fs.readFileSync('js/chat.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('update({') || line.includes('.from(\'profiles\').update') || line.includes('avatar_url')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
