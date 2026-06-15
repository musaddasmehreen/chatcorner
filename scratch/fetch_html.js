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
    console.log('PWA Cache Buster present in live chat.html:', html.includes('PWA Cache Buster'));
  } catch (err) {
    console.error(err);
  }
}

main();
