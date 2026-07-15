const fs = require('fs');
const path = require('path');

function searchInDir(dir, query) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'scratch') {
        searchInDir(fullPath, query);
      }
    } else {
      if (file !== 'search_error.js') {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(query)) {
          console.log(`Found in: ${fullPath}`);
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(query)) {
              console.log(`${i + 1}: ${lines[i].trim()}`);
            }
          }
        }
      }
    }
  }
}

searchInDir(__dirname, 'Could not load page');
