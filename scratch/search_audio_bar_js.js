const fs = require('fs');
const content = fs.readFileSync('js/chat.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('audio-bar') || line.includes('audioBar') || line.includes('audio-status') || line.includes('btn-join-voice')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
