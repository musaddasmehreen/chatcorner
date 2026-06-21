const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\HP\\.gemini\\antigravity\\brain\\c5c415a4-8786-4e96-bca8-34ad18fd7ff2\\.system_generated\\steps\\2402\\content.md', 'utf8');

const regex = /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;
const match = content.match(regex);
if (match) {
  const jsonText = match[1].trim();
  try {
    const data = JSON.parse(jsonText);
    console.log('Successfully parsed Nuxt data.');
    
    // Nuxt data usually has flat arrays of values. Let's find all string values that contain 'stream' or 'zeno' or are URLs.
    const strings = [];
    const traverse = (val) => {
      if (typeof val === 'string') {
        if (val.includes('stream') || val.includes('zeno') || val.includes('http') || val.includes('samaa')) {
          strings.push(val);
        }
      } else if (Array.isArray(val)) {
        val.forEach(traverse);
      } else if (val && typeof val === 'object') {
        Object.values(val).forEach(traverse);
      }
    };
    traverse(data);
    
    console.log('Found matching strings:');
    const unique = [...new Set(strings)];
    unique.forEach(s => console.log('  -', s));
  } catch (err) {
    console.error('Failed to parse JSON:', err.message);
  }
} else {
  console.log('No Nuxt data script tag found.');
}
