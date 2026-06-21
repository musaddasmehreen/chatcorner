const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== '.git' && file !== 'node_modules') {
        searchDir(fullPath);
      }
    } else if (file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('onRadioCountryChange') || content.includes('RADIO_PLAYLISTS')) {
        console.log(`Found match in ${fullPath}:`);
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('onRadioCountryChange') || line.includes('RADIO_PLAYLISTS')) {
            console.log(`  Line ${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  });
}

searchDir('.');
