const fromDate = '2025-10-24';
const t = 'USDRUBF';
async function run() {
    let histData = [];
    let start = 0;
    let hasMore = true;
    while (hasMore && start < 600) {
        const res = await fetch(`https://iss.moex.com/iss/history/engines/futures/markets/forts/securities/${t}.json?from=${fromDate}&start=${start}`);
        const data = await res.json();
        const rows = data.history.data;
        if (rows && rows.length > 0) {
            histData.push(...rows);
            if (rows.length < 100) hasMore = false;
            else start += 100;
        } else {
            hasMore = false;
        }
    }
    console.log(histData.length);
}
run();
