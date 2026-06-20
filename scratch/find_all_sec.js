const fs = require('fs');
const path = require('path');

const rootDir = 'C:\\Users\\HP\\.gemini\\antigravity\\scratch\\chatcorner';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== '.git' && file !== 'node_modules') {
        results = results.concat(walk(fullPath));
      }
    } else if (file.endsWith('.js') || file.endsWith('.html')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk(rootDir);

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('securityManager')) {
      const relPath = path.relative(rootDir, file);
      console.log(`${relPath}:${idx + 1}: ${line.trim()}`);
    }
  });
});
