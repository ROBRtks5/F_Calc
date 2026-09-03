import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface CacheItem {
  data: any;
  expires: number;
}

const quoteCache = new Map<string, CacheItem>();

const KNOWN_SPECS: Record<string, { stepPrice: number; minStep: number; multiplier: number; isPerp: boolean; shortName: string; fallbackPrice: number }> = {
  'USDRUBF': { stepPrice: 10, minStep: 0.01, multiplier: 1000, isPerp: true, shortName: 'USDRUBF', fallbackPrice: 87.10 },
  'EURRUBF': { stepPrice: 10, minStep: 0.01, multiplier: 1000, isPerp: true, shortName: 'EURRUBF', fallbackPrice: 96.20 },
  'CNYRUBF': { stepPrice: 10, minStep: 0.001, multiplier: 10000, isPerp: true, shortName: 'CNYRUBF', fallbackPrice: 12.10 },
  'IMOEXF': { stepPrice: 1, minStep: 1, multiplier: 1, isPerp: true, shortName: 'IMOEXF', fallbackPrice: 2800 },
  'GLDRUBF': { stepPrice: 10, minStep: 0.1, multiplier: 100, isPerp: true, shortName: 'GLDRUBF', fallbackPrice: 7900 },
  'RGBIF': { stepPrice: 10, minStep: 0.01, multiplier: 1000, isPerp: true, shortName: 'RGBIF', fallbackPrice: 104.50 },
  'SBERF': { stepPrice: 1, minStep: 0.01, multiplier: 100, isPerp: true, shortName: 'SBERF', fallbackPrice: 280.00 },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get('ticker') || 'USDRUBF').toUpperCase().trim();

  // 1. Check in-memory cache (5 sec TTL)
  const cached = quoteCache.get(ticker);
  if (cached && Date.now() < cached.expires) {
    return NextResponse.json(cached.data);
  }

  try {
    const moexUrl = `https://iss.moex.com/iss/engines/futures/markets/forts/securities/${ticker}.json`;
    const res = await fetch(moexUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      next: { revalidate: 5 }
    });

    if (!res.ok) {
      throw new Error(`MOEX HTTP error: ${res.status}`);
    }

    const data = await res.json();
    if (!data?.securities?.data?.[0]) {
      // Return known spec if available
      if (KNOWN_SPECS[ticker]) {
        const spec = KNOWN_SPECS[ticker];
        const fallbackRes = {
          ticker,
          shortName: spec.shortName,
          secName: spec.shortName,
          last: spec.fallbackPrice,
          prevSettlePrice: spec.fallbackPrice,
          settlePrice: spec.fallbackPrice,
          stepPrice: spec.stepPrice,
          minStep: spec.minStep,
          multiplier: spec.multiplier,
          funding: 0,
          isPerp: spec.isPerp,
          source: 'MOEX Specs (Estimated)',
          timestamp: Date.now(),
          updateTime: new Date().toLocaleTimeString('ru-RU')
        };
        return NextResponse.json(fallbackRes);
      }
      return NextResponse.json({ error: `Инструмент ${ticker} не найден на ФОРТС` }, { status: 404 });
    }

    const secCols: string[] = data.securities.columns || [];
    const secRow: any[] = data.securities.data[0] || [];
    const mdCols: string[] = data.marketdata?.columns || [];
    const mdRow: any[] = data.marketdata?.data?.[0] || [];

    const getVal = (cols: string[], row: any[], name: string) => {
      const idx = cols.indexOf(name);
      return idx !== -1 ? row[idx] : undefined;
    };

    const prevSettleRaw = getVal(secCols, secRow, 'PREVSETTLEPRICE') ?? getVal(secCols, secRow, 'LASTSETTLEPRICE');
    const prevSettle = (prevSettleRaw !== null && prevSettleRaw !== undefined && !isNaN(parseFloat(prevSettleRaw))) ? parseFloat(prevSettleRaw) : 0;

    const settleClrRaw = getVal(secCols, secRow, 'SETTLEPRICE_CLR');
    const settleClr = parseFloat(settleClrRaw);

    const mdSettleRaw = getVal(mdCols, mdRow, 'SETTLEPRICE');
    const mdSettle = parseFloat(mdSettleRaw);

    const settle = (!isNaN(settleClr) && settleClr > 0) ? settleClr : ((!isNaN(mdSettle) && mdSettle > 0) ? mdSettle : prevSettle);

    const lastRaw = getVal(mdCols, mdRow, 'LAST') ?? getVal(secCols, secRow, 'PREVPRICE');
    const lastRawParsed = (lastRaw !== null && lastRaw !== undefined && !isNaN(parseFloat(lastRaw))) ? parseFloat(lastRaw) : 0;
    const lastPrice = lastRawParsed > 0 ? lastRawParsed : (settle > 0 ? settle : (prevSettle > 0 ? prevSettle : 0));

    const stepPriceRaw = getVal(secCols, secRow, 'STEPPRICE');
    const defaultStepPrice = KNOWN_SPECS[ticker]?.stepPrice || 10;
    const stepPrice = (stepPriceRaw !== null && stepPriceRaw !== undefined && !isNaN(parseFloat(stepPriceRaw)) && parseFloat(stepPriceRaw) > 0) ? parseFloat(stepPriceRaw) : defaultStepPrice;

    const minStepRaw = getVal(secCols, secRow, 'MINSTEP');
    const defaultMinStep = KNOWN_SPECS[ticker]?.minStep || 0.01;
    const minStep = (minStepRaw !== null && minStepRaw !== undefined && !isNaN(parseFloat(minStepRaw)) && parseFloat(minStepRaw) > 0) ? parseFloat(minStepRaw) : defaultMinStep;

    const swapRateRaw = getVal(mdCols, mdRow, 'SWAPRATE');
    const swapRate = parseFloat(swapRateRaw);

    const fundingRateRaw = getVal(secCols, secRow, 'FUNDINGRATE');
    const fundingRate = parseFloat(fundingRateRaw);

    const funding = !isNaN(swapRate) ? swapRate : (!isNaN(fundingRate) ? fundingRate : 0);

    const shortName = getVal(secCols, secRow, 'SHORTNAME') || ticker;
    const secName = getVal(secCols, secRow, 'SECNAME') || ticker;
    const lastTradeDate = getVal(secCols, secRow, 'LASTTRADEDATE') || '';
    const isPerp = lastTradeDate === '2100-01-01' || ticker.endsWith('F');

    const result = {
      ticker,
      shortName,
      secName,
      last: lastPrice,
      prevSettlePrice: prevSettle > 0 ? prevSettle : lastPrice,
      settlePrice: settle > 0 ? settle : (prevSettle > 0 ? prevSettle : lastPrice),
      stepPrice,
      minStep,
      multiplier: minStep > 0 ? stepPrice / minStep : (KNOWN_SPECS[ticker]?.multiplier || 1000),
      funding,
      isPerp,
      source: 'MOEX ISS (FORTS)',
      timestamp: Date.now(),
      updateTime: new Date().toLocaleTimeString('ru-RU')
    };

    // Store in cache for 5 seconds
    quoteCache.set(ticker, {
      data: result,
      expires: Date.now() + 5000
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Server MOEX API Error:', err);

    // Fallback to cached or default spec
    if (KNOWN_SPECS[ticker]) {
      const spec = KNOWN_SPECS[ticker];
      return NextResponse.json({
        ticker,
        shortName: spec.shortName,
        secName: spec.shortName,
        last: spec.fallbackPrice,
        prevSettlePrice: spec.fallbackPrice,
        settlePrice: spec.fallbackPrice,
        stepPrice: spec.stepPrice,
        minStep: spec.minStep,
        multiplier: spec.multiplier,
        funding: 0,
        isPerp: spec.isPerp,
        source: 'Оффлайн/Резервные спецификации',
        timestamp: Date.now(),
        updateTime: new Date().toLocaleTimeString('ru-RU')
      });
    }

    return NextResponse.json({ error: err.message || 'Ошибка сервера при запросе к MOEX' }, { status: 500 });
  }
}
