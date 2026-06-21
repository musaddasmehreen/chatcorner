const fs = require('fs');

function searchFile(filename) {
  if (!fs.existsSync(filename)) return;
  const content = fs.readFileSync(filename, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('user-item') || line.includes('user-list')) {
      console.log(`${filename}:${idx + 1}: ${line.trim()}`);
    }
  });
}

searchFile('css/style.css');
searchFile('css/chat-extras.css');
