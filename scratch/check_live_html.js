const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  try {
    const html = await fetchUrl('https://chatcorner.qzz.io/chat.html');
    const lines = html.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('radio-country-select') || line.includes('Pakistan') || line.includes('PK') || line.includes('radio-select')) {
        console.log(`${idx + 1}: ${line.trim()}`);
      }
    });
  } catch (err) {
    console.error(err);
  }
}

main();
