const https = require('https');

https.get('https://iss.moex.com/iss/engines/futures/markets/forts/securities/USDRUBF.json', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const data = JSON.parse(body);
    console.log("Keys in securities:", data.securities.columns);
    console.log("Data in securities:");
    console.log(data.securities.data[0]);
    console.log("Keys in marketdata:", data.marketdata.columns);
    console.log("Data in marketdata:");
    console.log(data.marketdata.data[0]);
  });
});
