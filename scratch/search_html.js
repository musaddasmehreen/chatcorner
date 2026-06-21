const fs = require('fs');

const content = fs.readFileSync('chat.html', 'utf8');
const lines = content.split('\n');

console.log('--- Matches for "radio-channel-select" in chat.html ---');
lines.forEach((line, idx) => {
  if (line.includes('radio-channel-select')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});

console.log('--- Matches for "radio-country-select" in chat.html ---');
lines.forEach((line, idx) => {
  if (line.includes('radio-country-select')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
