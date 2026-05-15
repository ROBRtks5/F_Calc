const https = require('https');

https.get('https://iss.moex.com/iss/securities/RIM6.json', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const getVal = (name) => {
       const row = json.description.data.find(r => r[0] === name);
       return row ? row[2] : null;
    }
    console.log(`UNIT:`, getVal('UNIT'));
    console.log(`MULT:`, getVal('MULT'));
    console.log(`All descriptions:`, json.description.data.map(r => r.slice(0,3)));
  });
});
