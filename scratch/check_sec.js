const fs = require('fs');
const path = require('path');
const cssDir = 'C:\\Users\\HP\\.gemini\\antigravity\\scratch\\chatcorner\\css';
const files = fs.readdirSync(cssDir);

files.forEach(file => {
  if (file.endsWith('.css')) {
    const content = fs.readFileSync(path.join(cssDir, file), 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('msg-local-delete')) {
        console.log(`${file}:${idx + 1}: ${line.trim()}`);
      }
    });
  }
});
