import usdrubfHistory from '../data/usdrubfHistory.json';
import cnyrubfHistory from '../data/cnyrubfHistory.json';
import gldrubfHistory from '../data/gldrubfHistory.json';
import fortsSecuritiesData from '../data/fortsSecurities.json';

export interface MoexHistoryRecord {
  tradeDate: string;
  settlePrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  swapRate: number;
  volume: number;
}

export interface FortsSecurityItem {
  ticker: string;
  name: string;
  shortName?: string;
  secName?: string;
  prevSettlePrice?: number;
  minStep?: number;
  stepPrice?: number;
  isPerp?: boolean;
  type?: string;
  source?: string;
}

export const PRELOADED_HISTORIES: Record<string, MoexHistoryRecord[]> = {
  'USDRUBF': usdrubfHistory as MoexHistoryRecord[],
  'CNYRUBF': cnyrubfHistory as MoexHistoryRecord[],
  'GLDRUBF': gldrubfHistory as MoexHistoryRecord[],
};

export const FORTS_PRELOADED_SECURITIES: FortsSecurityItem[] = fortsSecuritiesData as FortsSecurityItem[];

export const DEFAULT_KNOWN_SPECS: Record<string, { 
  ticker: string;
  shortName: string;
  secName: string;
  last: number; 
  prevSettlePrice: number; 
  settlePrice: number; 
  stepPrice: number; 
  minStep: number;
  multiplier: number;
  funding: number;
  isPerp: boolean;
  source: string;
}> = {
  'USDRUBF': { ticker: 'USDRUBF', shortName: 'USDRUBF', secName: 'Бессрочный фьючерс USD/RUB', last: 87.10, prevSettlePrice: 86.75, settlePrice: 86.75, stepPrice: 10, minStep: 0.01, multiplier: 1000, funding: 0, isPerp: true, source: 'MOEX FORTS' },
  'EURRUBF': { ticker: 'EURRUBF', shortName: 'EURRUBF', secName: 'Бессрочный фьючерс EUR/RUB', last: 96.20, prevSettlePrice: 95.80, settlePrice: 95.80, stepPrice: 10, minStep: 0.01, multiplier: 1000, funding: 0, isPerp: true, source: 'MOEX FORTS' },
  'CNYRUBF': { ticker: 'CNYRUBF', shortName: 'CNYRUBF', secName: 'Бессрочный фьючерс CNY/RUB', last: 12.10, prevSettlePrice: 12.05, settlePrice: 12.05, stepPrice: 10, minStep: 0.001, multiplier: 10000, funding: 0, isPerp: true, source: 'MOEX FORTS' },
  'IMOEXF': { ticker: 'IMOEXF', shortName: 'IMOEXF', secName: 'Бессрочный фьючерс на Индекс Мосбиржи', last: 2800, prevSettlePrice: 2795, settlePrice: 2795, stepPrice: 1, minStep: 1, multiplier: 1, funding: 0, isPerp: true, source: 'MOEX FORTS' },
  'GLDRUBF': { ticker: 'GLDRUBF', shortName: 'GLDRUBF', secName: 'Бессрочный фьючерс на Золото в рублях', last: 7900, prevSettlePrice: 7850, settlePrice: 7850, stepPrice: 10, minStep: 0.1, multiplier: 100, funding: 0, isPerp: true, source: 'MOEX FORTS' },
  'RGBIF': { ticker: 'RGBIF', shortName: 'RGBIF', secName: 'Бессрочный фьючерс на Индекс Гособлигаций RGBI', last: 104.50, prevSettlePrice: 104.20, settlePrice: 104.20, stepPrice: 10, minStep: 0.01, multiplier: 1000, funding: 0, isPerp: true, source: 'MOEX FORTS' },
  'SBERF': { ticker: 'SBERF', shortName: 'SBERF', secName: 'Бессрочный фьючерс на Акции Сбербанка', last: 280.00, prevSettlePrice: 278.50, settlePrice: 278.50, stepPrice: 1, minStep: 0.01, multiplier: 100, funding: 0, isPerp: true, source: 'MOEX FORTS' },
};

/**
 * Normalizes any date format (YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY, etc.) to ISO YYYY-MM-DD
 */
export function normalizeDateToISO(dateStr?: string): string {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // If DD.MM.YYYY or DD/MM/YYYY
  const ruMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (ruMatch) {
    const day = ruMatch[1].padStart(2, '0');
    const month = ruMatch[2].padStart(2, '0');
    const year = ruMatch[3];
    return `${year}-${month}-${day}`;
  }

  // If YYYY.MM.DD or YYYY/MM/DD
  const isoAltMatch = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (isoAltMatch) {
    const year = isoAltMatch[1];
    const month = isoAltMatch[2].padStart(2, '0');
    const day = isoAltMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fallback try Date parse
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch {}

  return trimmed;
}

/**
 * Returns preloaded fallback history for a ticker if available
 */
export function getPreloadedHistory(ticker: string): MoexHistoryRecord[] {
  const sym = ticker.toUpperCase().trim();
  return PRELOADED_HISTORIES[sym] || [];
}

/**
 * Directly fetches live quote & specs from MOEX ISS (works client-side in APK / browser, with API route fallback)
 */
export async function fetchMoexQuote(ticker: string): Promise<any> {
  const sym = (ticker || 'USDRUBF').toUpperCase().trim();
  
  // Try direct MOEX ISS first (CORS allowed on MOEX ISS)
  try {
    const moexUrl = `https://iss.moex.com/iss/engines/futures/markets/forts/securities/${sym}.json`;
    const res = await fetch(moexUrl);
    if (res.ok) {
      const data = await res.json();
      if (data?.securities?.data?.[0]) {
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
        const defaultStepPrice = DEFAULT_KNOWN_SPECS[sym]?.stepPrice || 10;
        const stepPrice = (stepPriceRaw !== null && stepPriceRaw !== undefined && !isNaN(parseFloat(stepPriceRaw)) && parseFloat(stepPriceRaw) > 0) ? parseFloat(stepPriceRaw) : defaultStepPrice;

        const minStepRaw = getVal(secCols, secRow, 'MINSTEP');
        const defaultMinStep = DEFAULT_KNOWN_SPECS[sym]?.minStep || 0.01;
        const minStep = (minStepRaw !== null && minStepRaw !== undefined && !isNaN(parseFloat(minStepRaw)) && parseFloat(minStepRaw) > 0) ? parseFloat(minStepRaw) : defaultMinStep;

        const swapRateRaw = getVal(mdCols, mdRow, 'SWAPRATE');
        const swapRate = parseFloat(swapRateRaw);

        const fundingRateRaw = getVal(secCols, secRow, 'FUNDINGRATE');
        const fundingRate = parseFloat(fundingRateRaw);

        const funding = !isNaN(swapRate) ? swapRate : (!isNaN(fundingRate) ? fundingRate : 0);

        const shortName = getVal(secCols, secRow, 'SHORTNAME') || sym;
        const secName = getVal(secCols, secRow, 'SECNAME') || sym;
        const lastTradeDate = getVal(secCols, secRow, 'LASTTRADEDATE') || '';
        const isPerp = lastTradeDate === '2100-01-01' || sym.endsWith('F');

        return {
          ticker: sym,
          shortName,
          secName,
          last: lastPrice,
          prevSettlePrice: prevSettle > 0 ? prevSettle : lastPrice,
          settlePrice: settle > 0 ? settle : (prevSettle > 0 ? prevSettle : lastPrice),
          stepPrice,
          minStep,
          multiplier: minStep > 0 ? stepPrice / minStep : (DEFAULT_KNOWN_SPECS[sym]?.multiplier || 1000),
          funding,
          isPerp,
          source: 'MOEX ISS (FORTS)',
          timestamp: Date.now(),
          updateTime: new Date().toLocaleTimeString('ru-RU')
        };
      }
    }
  } catch (directErr) {
    console.warn('Direct MOEX ISS fetch failed, trying local API / fallback:', directErr);
  }

  // Fallback to internal API route if running in Next server
  try {
    const apiRes = await fetch(`/api/moex?ticker=${sym}`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && !data.error) return data;
    }
  } catch {}

  // Fallback to known specs
  if (DEFAULT_KNOWN_SPECS[sym]) {
    return {
      ...DEFAULT_KNOWN_SPECS[sym],
      timestamp: Date.now(),
      updateTime: new Date().toLocaleTimeString('ru-RU')
    };
  }

  // Search in preloaded list
  const found = FORTS_PRELOADED_SECURITIES.find(s => s.ticker.toUpperCase() === sym);
  if (found) {
    const price = found.prevSettlePrice || 100;
    return {
      ticker: sym,
      shortName: found.shortName || sym,
      secName: found.secName || found.name || sym,
      last: price,
      prevSettlePrice: price,
      settlePrice: price,
      stepPrice: found.stepPrice || 10,
      minStep: found.minStep || 0.01,
      multiplier: (found.minStep && found.stepPrice) ? (found.stepPrice / found.minStep) : 1000,
      funding: 0,
      isPerp: found.isPerp || sym.endsWith('F'),
      source: 'База ФОРТС (Резерв)',
      timestamp: Date.now(),
      updateTime: new Date().toLocaleTimeString('ru-RU')
    };
  }

  throw new Error(`Инструмент ${sym} не найден`);
}

/**
 * Directly fetches historical clearings from MOEX ISS (works in APK / browser)
 */
export async function fetchMoexHistory(ticker: string, fromDate: string = '2023-01-01'): Promise<MoexHistoryRecord[]> {
  const sym = (ticker || 'USDRUBF').toUpperCase().trim();

  // Try direct MOEX ISS history
  try {
    const history: MoexHistoryRecord[] = [];
    const fetchPage = async (start: number) => {
      const url = `https://iss.moex.com/iss/history/engines/futures/markets/forts/securities/${sym}.json?from=${fromDate}&start=${start}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return res.json();
    };

    const firstPage = await fetchPage(0);
    if (firstPage) {
      const parsePageData = (pageData: any) => {
        if (!pageData?.history?.data || !pageData?.history?.columns) return;
        const cols: string[] = pageData.history.columns;
        const rows: any[][] = pageData.history.data;

        const dateIdx = cols.indexOf('TRADEDATE');
        const settleIdx = cols.indexOf('SETTLEPRICE');
        const openIdx = cols.indexOf('OPEN');
        const highIdx = cols.indexOf('HIGH');
        const lowIdx = cols.indexOf('LOW');
        const closeIdx = cols.indexOf('CLOSE');
        const swapIdx = cols.indexOf('SWAPRATE');
        const volIdx = cols.indexOf('VOLCURRENCY') !== -1 ? cols.indexOf('VOLCURRENCY') : cols.indexOf('VOLUME');

        for (const r of rows) {
          const tradeDate = r[dateIdx];
          const settlePrice = parseFloat(r[settleIdx]) || 0;
          const openPrice = parseFloat(r[openIdx]) || settlePrice;
          const highPrice = parseFloat(r[highIdx]) || settlePrice;
          const lowPrice = parseFloat(r[lowIdx]) || settlePrice;
          const closePrice = parseFloat(r[closeIdx]) || settlePrice;
          const swapRate = parseFloat(r[swapIdx]) || 0;
          const volume = parseFloat(r[volIdx]) || 0;

          if (tradeDate && (settlePrice > 0 || closePrice > 0)) {
            history.push({
              tradeDate,
              settlePrice: settlePrice > 0 ? settlePrice : closePrice,
              openPrice,
              highPrice,
              lowPrice,
              closePrice: closePrice > 0 ? closePrice : settlePrice,
              swapRate,
              volume
            });
          }
        }
      };

      parsePageData(firstPage);

      const cursorData = firstPage?.['history.cursor']?.data?.[0];
      if (cursorData) {
        const total = cursorData[1] || 100;
        const pageSize = cursorData[2] || 100;
        const pages: number[] = [];
        for (let offset = pageSize; offset < total && offset < 4000; offset += pageSize) {
          pages.push(offset);
        }

        if (pages.length > 0) {
          const nextPages = await Promise.allSettled(pages.map(fetchPage));
          for (const np of nextPages) {
            if (np.status === 'fulfilled' && np.value) {
              parsePageData(np.value);
            }
          }
        }
      }

      if (history.length > 0) {
        // Sort ascending by date & deduplicate
        history.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
        const deduped: MoexHistoryRecord[] = [];
        const seen = new Set<string>();
        for (const item of history) {
          if (!seen.has(item.tradeDate)) {
            seen.add(item.tradeDate);
            deduped.push(item);
          }
        }
        return deduped;
      }
    }
  } catch (e) {
    console.warn('Direct MOEX history fetch failed, trying local API / fallback:', e);
  }

  // Fallback to internal API route
  try {
    const apiRes = await fetch(`/api/moex/history?ticker=${sym}&from=${fromDate}`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data?.history && data.history.length > 0) return data.history;
    }
  } catch {}

  // Fallback to preloaded history
  const preloaded = getPreloadedHistory(sym);
  if (preloaded.length > 0) {
    return preloaded;
  }

  return [];
}

/**
 * Directly fetches full securities list from MOEX ISS
 */
export async function fetchMoexSecurities(): Promise<FortsSecurityItem[]> {
  try {
    const url = 'https://iss.moex.com/iss/engines/futures/markets/forts/securities.json?iss.only=securities&iss.meta=off&securities.columns=SECID,SHORTNAME,LATNAME,SECNAME,PREVSETTLEPRICE,MINSTEP,STEPPRICE,LASTTRADEDATE';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const rows = data.securities?.data || [];
      if (rows.length > 0) {
        return rows.map((r: any[]) => ({
          ticker: r[0],
          name: (r[1] || r[3] || r[2] || '').slice(0, 70),
          shortName: r[1] || r[0],
          secName: r[3] || r[1] || r[0],
          prevSettlePrice: parseFloat(r[4]) || 0,
          minStep: parseFloat(r[5]) || 0.01,
          stepPrice: parseFloat(r[6]) || 1,
          isPerp: r[7] === '2100-01-01' || r[0].endsWith('F'),
          type: 'ФОРТС',
          source: 'moex'
        }));
      }
    }
  } catch (e) {
    console.warn('Direct MOEX securities fetch failed, using preloaded:', e);
  }

  // Fallback to internal API route
  try {
    const res = await fetch('/api/moex/securities');
    if (res.ok) {
      const data = await res.json();
      if (data?.list && data.list.length > 0) return data.list;
    }
  } catch {}

  // Preloaded fallback
  return FORTS_PRELOADED_SECURITIES;
}

