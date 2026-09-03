import usdrubfHistory from '../data/usdrubfHistory.json';
import cnyrubfHistory from '../data/cnyrubfHistory.json';
import gldrubfHistory from '../data/gldrubfHistory.json';

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

export const PRELOADED_HISTORIES: Record<string, MoexHistoryRecord[]> = {
  'USDRUBF': usdrubfHistory as MoexHistoryRecord[],
  'CNYRUBF': cnyrubfHistory as MoexHistoryRecord[],
  'GLDRUBF': gldrubfHistory as MoexHistoryRecord[],
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
