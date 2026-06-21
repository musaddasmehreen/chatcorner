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
    const js = await fetchUrl('https://chatcorner.qzz.io/js/chat-v2.js');
    console.log('Samaa FM URL present in live js/chat-v2.js:', js.includes('samaapew107-itelservices.radioca.st'));
    console.log('crossOrigin = "anonymous" present in live js/chat-v2.js:', js.includes('crossOrigin = "anonymous"') || js.includes('crossOrigin="anonymous"'));
  } catch (err) {
    console.error(err);
  }
}

main();
