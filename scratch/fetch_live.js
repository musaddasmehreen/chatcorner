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
    console.log('Fetching live chat.html...');
    const html = await fetchUrl('https://chatcorner.qzz.io/chat.html');
    console.log('chat.html size:', html.length);
    
    // Find script tags
    const scripts = html.match(/<script[^>]*src="[^"]+"[^>]*>/g);
    console.log('Script imports in live chat.html:', scripts);
    
    console.log('\nFetching live js/chat.js?v=1.7...');
    const js = await fetchUrl('https://chatcorner.qzz.io/js/chat.js?v=1.7');
    console.log('js/chat.js size:', js.length);
    
    // Search for RADIO_PLAYLISTS and onRadioCountryChange in live JS
    const lines = js.split('\n');
    console.log('\nRADIO_PLAYLISTS matches in live JS:');
    lines.forEach((line, idx) => {
      if (line.includes('RADIO_PLAYLISTS') || line.includes('onRadioCountryChange')) {
        console.log(`${idx + 1}: ${line.trim()}`);
      }
    });
  } catch (err) {
    console.error('Error fetching:', err);
  }
}

main();
