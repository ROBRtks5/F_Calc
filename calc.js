const fs = require('fs');

async function test() {
    const res = await fetch(`https://iss.moex.com/iss/history/engines/futures/markets/forts/securities/USDRUBF.json?from=2025-10-24&start=0`);
    const data = await res.json();
    let histData = data.history.data.map(row => ({
        tradeDate: row[1],
        settlePrice: row[11] || row[6] || 0,
        swapRate: row[12] || 0
    }));
    
    // Fetch remaining...
    const res2 = await fetch(`https://iss.moex.com/iss/history/engines/futures/markets/forts/securities/USDRUBF.json?from=2025-10-24&start=100`);
    const data2 = await res2.json();
    histData.push(...data2.history.data.map(row => ({
        tradeDate: row[1],
        settlePrice: row[11] || row[6] || 0,
        swapRate: row[12] || 0
    })));

    const res3 = await fetch(`https://iss.moex.com/iss/history/engines/futures/markets/forts/securities/USDRUBF.json?from=2025-10-24&start=200`);
    const data3 = await res3.json();
    histData.push(...data3.history.data.map(row => ({
        tradeDate: row[1],
        settlePrice: row[11] || row[6] || 0,
        swapRate: row[12] || 0
    })));

    const stepPrice = 10;
    const minStep = 0.01;

    let trades = [
        { normDate: '2025-10-24', type: 'Long', priceInPoints: 80.80, lots: 5 },
        { normDate: '2026-06-04', type: 'Long', priceInPoints: 74.54, lots: 1 }
    ];

    let totalVM = 0;
    const targetPrice = 86.81;

    // Price change PnL
    for (const t of trades) {
        const dir = t.type === 'Long' ? 1 : -1;
        const ticks = Math.round((targetPrice - t.priceInPoints) / minStep);
        totalVM += ticks * stepPrice * t.lots * dir;
    }
    console.log("PnL from price gain:", totalVM);

    // Swap rate PnL
    let fundingTotal = 0;
    for (const day of histData) {
        let carryPos = 0;
        let todayPos = 0;
        for (const t of trades) {
            if (t.normDate < day.tradeDate) carryPos += (t.type === 'Long' ? 1 : -1) * t.lots;
            if (t.normDate === day.tradeDate) todayPos += (t.type === 'Long' ? 1 : -1) * t.lots;
        }
        const posAtClearing = carryPos + todayPos;
        const dailyFunding = day.swapRate * (stepPrice / minStep) * posAtClearing;
        fundingTotal += dailyFunding;
    }
    console.log("Historical funding:", fundingTotal);
    console.log("Total:", totalVM + fundingTotal);
}
test();
