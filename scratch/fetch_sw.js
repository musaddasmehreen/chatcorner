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
    console.log('Fetching live sw.js...');
    const sw = await fetchUrl('https://chatcorner.qzz.io/sw.js');
    console.log('sw.js first line:', sw.split('\n')[0]);
    console.log('sw.js total length:', sw.length);

    console.log('\nFetching live js/chat.js...');
    const js = await fetchUrl('https://chatcorner.qzz.io/js/chat.js');
    console.log('js/chat.js total length:', js.length);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
