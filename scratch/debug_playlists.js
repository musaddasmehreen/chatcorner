const fs = require('fs');
const jsCode = fs.readFileSync('js/chat.js', 'utf8');

// We can evaluate jsCode in a sandbox or search for RADIO_PLAYLISTS object using regex to see what it actually contains.
console.log('--- Checking RADIO_PLAYLISTS definition in js/chat.js ---');
const match = jsCode.match(/const RADIO_PLAYLISTS = \{[\s\S]*?\};/);
if (match) {
  console.log(match[0]);
} else {
  console.log('Not found');
}
