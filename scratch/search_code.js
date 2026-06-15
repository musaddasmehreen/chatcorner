const fs = require('fs');

const file = 'js/chat.js';
if (!fs.existsSync(file)) {
  console.log('File does not exist: ' + file);
  process.exit(1);
}

const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

console.log('--- Matches for "ProfileCard" or similar ---');
lines.forEach((line, idx) => {
  if (line.includes('profileCard') || line.includes('ProfileCard') || line.includes('showProfileCard') || line.includes('pc-')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});

console.log('\n--- Matches for "updatePresence" ---');
lines.forEach((line, idx) => {
  if (line.includes('updatePresence')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});

console.log('\n--- Matches for "renderUserList" ---');
lines.forEach((line, idx) => {
  if (line.includes('renderUserList')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
