const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ChatCornerRadioFetcher/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('Fetching Pakistani stations from Radio Browser API...');
    const pkStations = await fetchJson('https://de1.api.radio-browser.info/json/stations/bycountry/pakistan');
    console.log(`Found ${pkStations.length} Pakistani stations.`);
    
    console.log('\n--- Top HTTPS Pakistani Streams ---');
    pkStations.forEach(s => {
      if (s.url_resolved.startsWith('https://')) {
        console.log(`Name: ${s.name} | Tags: ${s.tags} | URL: ${s.url_resolved}`);
      }
    });

    console.log('\nFetching Indian stations from Radio Browser API...');
    const inStations = await fetchJson('https://de1.api.radio-browser.info/json/stations/bycountry/india');
    console.log(`Found ${inStations.length} Indian stations.`);
    
    console.log('\n--- Top HTTPS Indian Streams ---');
    inStations.forEach(s => {
      if (s.url_resolved.startsWith('https://')) {
        console.log(`Name: ${s.name} | Tags: ${s.tags} | URL: ${s.url_resolved}`);
      }
    });
  } catch (err) {
    console.error('Error fetching from API:', err.message);
  }
}

main();
