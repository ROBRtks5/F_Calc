const https = require('https');

https.get('https://iss.moex.com/iss/engines/futures/markets/forts/securities/SiM6.json', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log("Securities Columns:", json.securities.columns);
    console.log("Securities Data:", json.securities.data[0]);
  });
});
