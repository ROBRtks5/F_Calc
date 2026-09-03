import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface HistoryCacheItem {
  data: any;
  expires: number;
}

const historyCache = new Map<string, HistoryCacheItem>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get('ticker') || 'USDRUBF').toUpperCase().trim();
  const fromDate = searchParams.get('from') || '2023-01-01';
  const cacheKey = `v4_${ticker}_${fromDate}`;

  // Check cache (15 min TTL)
  const cached = historyCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    return NextResponse.json(cached.data);
  }

  try {
    const history: Array<{
      tradeDate: string;
      settlePrice: number;
      openPrice: number;
      highPrice: number;
      lowPrice: number;
      closePrice: number;
      swapRate: number;
      volume: number;
    }> = [];

    const fetchPage = async (start: number) => {
      const url = `https://iss.moex.com/iss/history/engines/futures/markets/forts/securities/${ticker}.json?from=${fromDate}&start=${start}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        next: { revalidate: 60 }
      });
      if (!res.ok) return null;
      return res.json();
    };

    // First fetch page 0 to know total count
    const firstPageData = await fetchPage(0);
    const pagesToFetch = [0];

    if (firstPageData?.['history.cursor']?.data?.[0]) {
      const total = firstPageData['history.cursor'].data[0][1] || 100;
      const pageSize = firstPageData['history.cursor'].data[0][2] || 100;
      for (let offset = pageSize; offset < total && offset < 5000; offset += pageSize) {
        pagesToFetch.push(offset);
      }
    } else {
      // Fallback to initial 10 batches
      pagesToFetch.push(100, 200, 300, 400, 500, 600, 700, 800, 900);
    }

    const otherPages = pagesToFetch.filter(p => p !== 0);
    const otherResults = await Promise.all(otherPages.map(start => fetchPage(start)));
    const allResults = [firstPageData, ...otherResults];

    for (const data of allResults) {
      if (!data?.history?.data || !data?.history?.columns) continue;
      const cols: string[] = data.history.columns;
      const rows: any[][] = data.history.data;
      if (rows.length === 0) continue;

      const getCol = (row: any[], name: string) => {
        const idx = cols.indexOf(name);
        return idx !== -1 ? row[idx] : undefined;
      };

      for (const row of rows) {
        const tradeDate = getCol(row, 'TRADEDATE');
        if (!tradeDate) continue;

        const settlePriceRaw = getCol(row, 'SETTLEPRICE');
        const closePriceRaw = getCol(row, 'CLOSE');
        const openPriceRaw = getCol(row, 'OPEN');
        const highPriceRaw = getCol(row, 'HIGH');
        const lowPriceRaw = getCol(row, 'LOW');
        const swapRateRaw = getCol(row, 'SWAPRATE');
        const volumeRaw = getCol(row, 'VOLUME');

        const settlePrice = parseFloat(settlePriceRaw) || parseFloat(closePriceRaw) || 0;
        const closePrice = parseFloat(closePriceRaw) || settlePrice;
        const openPrice = parseFloat(openPriceRaw) || settlePrice;
        const highPrice = parseFloat(highPriceRaw) || settlePrice;
        const lowPrice = parseFloat(lowPriceRaw) || settlePrice;
        const swapRate = parseFloat(swapRateRaw) || 0;
        const volume = parseFloat(volumeRaw) || 0;

        history.push({
          tradeDate: String(tradeDate).split('T')[0],
          settlePrice,
          openPrice,
          highPrice,
          lowPrice,
          closePrice,
          swapRate,
          volume
        });
      }
    }

    // Deduplicate by tradeDate and sort ascending
    const uniqueMap = new Map<string, typeof history[0]>();
    for (const item of history) {
      uniqueMap.set(item.tradeDate, item);
    }

    const sortedHistory = Array.from(uniqueMap.values()).sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));

    const resultPayload = {
      ticker,
      fromDate,
      count: sortedHistory.length,
      history: sortedHistory
    };

    historyCache.set(cacheKey, {
      data: resultPayload,
      expires: Date.now() + 5 * 60 * 1000
    });

    return NextResponse.json(resultPayload);
  } catch (err: any) {
    console.error('Server MOEX History API Error:', err);
    return NextResponse.json({ error: err.message || 'Ошибка загрузки истории MOEX' }, { status: 500 });
  }
}
