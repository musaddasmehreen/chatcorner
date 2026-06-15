const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\HP\\.gemini\/\/antigravity\\brain\\c5c415a4-8786-4e96-bca8-34ad18fd7ff2\\.system_generated\\steps\\2402\\content.md', 'utf8');

// Search for any script tag or string containing "stream"
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('stream') && (line.includes('url') || line.includes('src') || line.includes('{') || line.includes('http'))) {
    console.log(`${idx + 1}: ${line.trim().substring(0, 300)}`);
  }
});
