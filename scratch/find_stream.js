const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\HP\\.gemini\\antigravity\\brain\\c5c415a4-8786-4e96-bca8-34ad18fd7ff2\\.system_generated\\steps\\2402\\content.md', 'utf8');

const regex = /stream\.zeno\.fm\/[a-zA-Z0-9]+/g;
const matches = content.match(regex);
console.log('Matches for stream.zeno.fm:', matches);

console.log('--- Other URLs ---');
const urls = content.match(/https?:\/\/[^\s"'><]+/g);
if (urls) {
  urls.forEach(url => {
    if (url.includes('stream') || url.includes('zeno') || url.includes('mp3') || url.includes('radio')) {
      console.log(url);
    }
  });
}
