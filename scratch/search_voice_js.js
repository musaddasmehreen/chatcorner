const fs = require('fs');

function searchFile(filename) {
  if (!fs.existsSync(filename)) return;
  const content = fs.readFileSync(filename, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('function joinVoice') || line.includes('joinVoice(') || line.includes('leaveVoice(') || line.includes('function leaveVoice')) {
      console.log(`${filename}:${idx + 1}: ${line.trim()}`);
    }
  });
}

searchFile('js/chat.js');
searchFile('js/audio.js');
