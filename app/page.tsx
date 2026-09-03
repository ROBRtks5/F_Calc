'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Search, Copy, Check, TrendingUp, RefreshCw, AlertTriangle, Info, Plus, Trash2, HelpCircle, X, ChevronDown, ChevronUp, Sparkles, Layers, Database, Calendar, Filter, ArrowUpDown, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { Tooltip } from './components/Tooltip';
import { TradeCard } from './components/TradeCard';
import { Trade } from './components/types';
import { SplashScreen } from './components/SplashScreen';
import { InstructionsModal } from './components/InstructionsModal';
import { DetailedBreakdownModal } from './components/DetailedBreakdownModal';
import { generateVMReport } from './lib/reportGenerator';
import { 
  getPreloadedHistory, 
  normalizeDateToISO, 
  MoexHistoryRecord, 
  fetchMoexQuote, 
  fetchMoexHistory, 
  fetchMoexSecurities, 
  FORTS_PRELOADED_SECURITIES,
  DEFAULT_KNOWN_SPECS
} from './lib/moexData';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const formatMoney = (val: number) => {
  return (+val).toLocaleString('ru-RU', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

const getMoexSessionDateStr = (): string => {
  const now = new Date();
  const mskMs = now.getTime() + (3 * 3600 * 1000) + (now.getTimezoneOffset() * 60 * 1000);
  const mskNow = new Date(mskMs);
  const sessionDate = new Date(mskNow);
  if (mskNow.getHours() >= 19) sessionDate.setDate(sessionDate.getDate() + 1);
  if (sessionDate.getDay() === 6) sessionDate.setDate(sessionDate.getDate() + 2);
  else if (sessionDate.getDay() === 0) sessionDate.setDate(sessionDate.getDate() + 1);
  const year = sessionDate.getFullYear();
  const month = String(sessionDate.getMonth() + 1).padStart(2, '0');
  const day = String(sessionDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DEFAULT_SPECS: Record<string, { 
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

export default function Home() {
  const [ticker, setTicker] = useState<string>('USDRUBF');
  const [allInstruments, setAllInstruments] = useState<{ list: { ticker: string, name: string, uid?: string, type?: string, source?: string }[], synced: boolean }>({ list: [], synced: false });
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [trades, setTrades] = useState<Trade[]>([
    {
      id: '1',
      date: '2025-10-24',
      type: 'Long',
      price: '80.97',
      lots: 5
    },
    {
      id: '2',
      date: '2026-06-04',
      type: 'Long',
      price: '74.54',
      lots: 1
    }
  ]);
  
  const [funding, setFunding] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  
  const [marketData, setMarketData] = useState<{ 
    ticker?: string,
    shortName?: string,
    secName?: string,
    last: number, 
    prevSettlePrice: number, 
    settlePrice: number, 
    stepPrice: number, 
    minStep: number,
    funding?: number,
    isPerp?: boolean,
    multiplier?: number,
    historyCount?: number,
    source?: string
  } | null>(DEFAULT_SPECS['USDRUBF']);

  const [historyStatus, setHistoryStatus] = useState<'idle' | 'loading' | 'success' | 'partial' | 'error'>('success');
  const [historyData, setHistoryData] = useState<MoexHistoryRecord[] | null>(() => getPreloadedHistory('USDRUBF'));

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState<number | null>(null);
  const [now, setNow] = useState<number>(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isDetailedBreakdownOpen, setIsDetailedBreakdownOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingVisibleCount, setClearingVisibleCount] = useState(20);
  const [clearingFilter, setClearingFilter] = useState<'all' | 'swap' | 'profit' | 'loss'>('all');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const hapticFeedback = useCallback(async (strength: 'light' | 'medium' | 'heavy' = 'light') => {
    try {
      if (typeof window !== 'undefined') {
        const style = strength === 'heavy' ? ImpactStyle.Heavy : strength === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
        await Haptics.impact({ style });
      }
    } catch {
      if (typeof window !== 'undefined' && navigator.vibrate) {
        const pattern = strength === 'heavy' ? [50, 30, 50] : strength === 'medium' ? [30] : [10];
        navigator.vibrate(pattern);
      }
    }
  }, []);

  // Quick ticker history settlement map for auto-lookup in trades
  const historyMap = useMemo(() => {
    const map = new Map<string, number>();
    if (historyData) {
      for (const h of historyData) {
        const d = normalizeDateToISO(h.tradeDate);
        if (d && h.settlePrice > 0) {
          map.set(d, h.settlePrice);
        }
      }
    }
    return map;
  }, [historyData]);

  // Sync instruments list
  const syncInstruments = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const list = await fetchMoexSecurities();
      if (list && list.length > 0) {
        setAllInstruments({ list, synced: true });
        localStorage.setItem('moex_instruments', JSON.stringify(list));
        showToast(`База ФОРТС обновлена: ${list.length} инструментов`);
      }
    } catch (err: any) {
      console.error('Failed to sync securities:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [showToast]);

  // Save trades to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('moex_trades_v2', JSON.stringify(trades));
    } catch {}
  }, [trades]);

  // Periodic clock for market session status
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  const marketPhase = useMemo(() => {
    const timestamp = now || Date.now();
    const d = new Date(timestamp);
    const mskMs = d.getTime() + (3 * 3600 * 1000) + (d.getTimezoneOffset() * 60 * 1000);
    const msk = new Date(mskMs);
    const day = msk.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = day === 0 || day === 6;
    const hours = msk.getHours();
    const mins = msk.getMinutes();
    const totalMinutes = hours * 60 + mins;

    // Weekend schedule (ДСВД)
    if (isWeekend) {
      if (totalMinutes >= 590 && totalMinutes < 600) {
        return { id: 'weekend_auction', name: 'Аукцион открытия ДСВД (09:50 - 10:00)', isTrading: false };
      }
      if (totalMinutes >= 600 && totalMinutes < 1140) {
        return { id: 'weekend_session', name: 'Сессия выходного дня (10:00 - 19:00)', isTrading: true };
      }
      return { id: 'weekend_closed', name: 'Выходной день (Торги закрыты)', isTrading: false };
    }

    // Weekday schedule (Пн - Пт)
    if (totalMinutes >= 410 && totalMinutes < 420) {
      return { id: 'morning_auction', name: 'Аукцион открытия (06:50 - 07:00)', isTrading: false };
    }
    if (totalMinutes >= 420 && totalMinutes < 600) {
      return { id: 'morning_session', name: 'Утренняя сессия (07:00 - 10:00)', isTrading: true };
    }
    if (totalMinutes >= 600 && totalMinutes < 1140) {
      return { id: 'main_session', name: 'Основная дневная сессия (10:00 - 19:00)', isTrading: true };
    }
    if (totalMinutes >= 1140 && totalMinutes < 1430) {
      return { id: 'evening_session', name: 'Вечерняя сессия (19:00 - 23:50)', isTrading: true };
    }
    if (totalMinutes >= 1430 || totalMinutes < 30) {
      return { id: 'clearing', name: 'Единственный клиринг (23:50 - 00:30)', isTrading: false };
    }
    return { id: 'night_break', name: 'Ночной перерыв (00:30 - 06:50)', isTrading: false };
  }, [now]);

  const isStale = useMemo(() => {
    if (!lastUpdateTimestamp || !now) return false;
    return now - lastUpdateTimestamp > 5 * 60 * 1000;
  }, [lastUpdateTimestamp, now]);

  const filteredInstruments = useMemo(() => {
    const t = ticker.toLowerCase().trim();
    if (!t) return allInstruments.list.slice(0, 8);
    return allInstruments.list.filter(i => 
      i.ticker.toLowerCase().includes(t) || (i.name && i.name.toLowerCase().includes(t))
    ).slice(0, 8);
  }, [allInstruments.list, ticker]);

  // History fetcher with caching and preloaded fallbacks
  const fetchHistoryOnly = useCallback(async (targetTicker: string, fromOverride?: string) => {
    const sym = (targetTicker || 'USDRUBF').toUpperCase().trim();
    if (!sym) return;

    setHistoryLoading(true);
    setHistoryStatus('loading');

    try {
      const fromDate = fromOverride || '2023-01-01';
      const history = await fetchMoexHistory(sym, fromDate);
      if (history && history.length > 0) {
        setHistoryData(history);
        setHistoryStatus('success');
        try {
          localStorage.setItem(`moex_history_v4_${sym}`, JSON.stringify(history));
        } catch {}
        const swapCount = history.filter((x: any) => x.swapRate !== 0).length;
        showToast(`MOEX ISS: загружено ${history.length} клирингов (свопов: ${swapCount})`);
        return history;
      }
    } catch (err: any) {
      console.error('History fetch error:', err);
    } finally {
      setHistoryLoading(false);
    }

    // Fallback to preloaded dataset if fetch didn't succeed
    const preloaded = getPreloadedHistory(sym);
    if (preloaded.length > 0) {
      setHistoryData(preloaded);
      setHistoryStatus('success');
      showToast(`Использована встроенная база MOEX: ${preloaded.length} клирингов`);
    } else {
      setHistoryStatus('partial');
    }
    return null;
  }, [showToast]);

  // Main fetch function using direct MOEX ISS calls with server proxy fallback
  const fetchMarketData = useCallback(async (targetTicker: string, overrideTrades?: Trade[]) => {
    const sym = (targetTicker || 'USDRUBF').toUpperCase().trim();
    if (!sym) return;

    setLoading(true);
    setError(null);

    // 1. Immediately provide preloaded history if available
    const preloaded = getPreloadedHistory(sym);
    if (preloaded.length > 0) {
      setHistoryData(prev => (prev && prev.length > 0 ? prev : preloaded));
      setHistoryStatus('success');
    }

    try {
      // 2. Determine earliest trade date to fetch sufficient history
      const currentTrades = overrideTrades || trades;
      const validCurrent = currentTrades.filter(t => t.date);
      const earliestTradeDate = validCurrent.reduce((min, tr) => {
        const iso = normalizeDateToISO(tr.date);
        return (iso && iso < min) ? iso : min;
      }, '2023-01-01');
      const fromDate = earliestTradeDate < '2023-01-01' ? earliestTradeDate : '2023-01-01';

      // 3. Parallel fetch of live quotes and historical records
      const [quoteData, historyDataRes] = await Promise.all([
        fetchMoexQuote(sym),
        fetchMoexHistory(sym, fromDate)
      ]);

      if (quoteData) {
        setMarketData(quoteData);
        try {
          localStorage.setItem(`moex_market_data_${sym}`, JSON.stringify(quoteData));
        } catch {}
        setLastUpdateTime(quoteData.updateTime || new Date().toLocaleTimeString('ru-RU'));
        setLastUpdateTimestamp(Date.now());
        if (quoteData.funding !== undefined && quoteData.funding !== 0) {
          setFunding(String(quoteData.funding));
        }
      }

      if (historyDataRes && historyDataRes.length > 0) {
        setHistoryData(historyDataRes);
        setHistoryStatus('success');
        try {
          localStorage.setItem(`moex_history_v4_${sym}`, JSON.stringify(historyDataRes));
        } catch {}
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Ошибка соединения с Мосбиржей');
    } finally {
      setLoading(false);
    }
  }, [trades]);

  // Initial restore from localStorage & fetch on mount
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      let targetTicker = 'USDRUBF';
      let parsedTrades: Trade[] | undefined;
      
      try {
        const savedTicker = localStorage.getItem('moex_last_ticker');
        if (savedTicker !== null) {
          targetTicker = savedTicker;
          if (mounted) setTicker(savedTicker);
          if (!savedTicker) {
            if (mounted) {
              setMarketData(null);
              setHistoryData(null);
            }
          } else {
            const cached = localStorage.getItem(`moex_market_data_${savedTicker}`);
            if (cached && mounted) {
              try { setMarketData(JSON.parse(cached)); } catch {}
            } else if (DEFAULT_SPECS[savedTicker] && mounted) {
              setMarketData(DEFAULT_SPECS[savedTicker]);
            }
          }
        }

        if (targetTicker) {
          // Guarantee preloaded baseline if targetTicker exists
          const pre = getPreloadedHistory(targetTicker);
          if (pre.length > 0 && mounted) {
            setHistoryData(pre);
            setHistoryStatus('success');
          }
        }

        const savedInstStr = localStorage.getItem('moex_instruments');
        if (savedInstStr) {
          const inst = JSON.parse(savedInstStr);
          if (Array.isArray(inst) && inst.length > 0 && mounted) {
            setAllInstruments({ list: inst, synced: true });
          }
        } else if (mounted) {
          setAllInstruments({ list: FORTS_PRELOADED_SECURITIES, synced: false });
        }
        const savedTradesStr = localStorage.getItem('moex_trades_v2');
        if (savedTradesStr !== null) {
          try {
            const parsed = JSON.parse(savedTradesStr);
            if (Array.isArray(parsed)) {
              parsedTrades = parsed;
              if (mounted) setTrades(parsed);
            }
          } catch {}
        }
      } catch (e) {
        console.error('Failed to load local storage:', e);
      }

      if (mounted) {
        setNow(Date.now());
        if (targetTicker) {
          fetchMarketData(targetTicker, parsedTrades);
        }
      }
    };
    load();
    return () => { mounted = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Full Universal Reset Function
  const performFullReset = useCallback(() => {
    hapticFeedback('heavy');
    setTicker('');
    setMarketData(null);
    setHistoryData(null);
    setTrades([]);
    setFunding('');
    setCustomPrice('');
    setError(null);
    setShowSuggestions(false);
    try {
      localStorage.setItem('moex_last_ticker', '');
      localStorage.setItem('moex_trades_v2', JSON.stringify([]));
    } catch {}
    showToast('Все данные, тикер и сделки полностью сброшены');
  }, [hapticFeedback, showToast]);

  // Auto-extend history if trades go further back than current loaded history
  useEffect(() => {
    const validTrades = trades.filter(t => t.date);
    if (validTrades.length === 0) return;
    const earliestTradeDate = validTrades.reduce((min, tr) => {
      const iso = normalizeDateToISO(tr.date);
      return (iso && iso < min) ? iso : min;
    }, '9999-12-31');
    if (!earliestTradeDate || earliestTradeDate === '9999-12-31') return;

    const earliestLoaded = historyData && historyData.length > 0 ? historyData[0].tradeDate : '';
    const needsFetch = !earliestLoaded || earliestTradeDate < earliestLoaded;

    if (needsFetch && !historyLoading) {
      const fromDate = earliestTradeDate < '2023-01-01' ? earliestTradeDate : '2023-01-01';
      const timer = setTimeout(() => {
        fetchHistoryOnly(ticker, fromDate);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [trades, historyData, historyLoading, ticker, fetchHistoryOnly]);

  const selectInstrument = (inst: any) => {
    hapticFeedback('light');
    const sym = inst.ticker.toUpperCase();
    setTicker(sym);
    localStorage.setItem('moex_last_ticker', sym);
    setShowSuggestions(false);

    // Instant preloaded history switch
    const preloaded = getPreloadedHistory(sym);
    if (preloaded.length > 0) {
      setHistoryData(preloaded);
      setHistoryStatus('success');
    }

    const cached = localStorage.getItem(`moex_market_data_${sym}`);
    if (cached) {
      try { setMarketData(JSON.parse(cached)); } catch {}
    } else if (DEFAULT_SPECS[sym]) {
      setMarketData(DEFAULT_SPECS[sym]);
    }

    fetchMarketData(sym);
  };

  const addTrade = () => {
    hapticFeedback('light');
    const today = getMoexSessionDateStr();
    const defaultPrice = marketData?.last || historyMap.get(today) || '';
    setTrades([
      ...trades,
      {
        id: Date.now().toString() + Math.random().toString().slice(2, 6),
        date: today,
        type: 'Long',
        price: defaultPrice ? String(defaultPrice) : '',
        lots: 1
      }
    ]);
  };

  const removeTrade = (id: string) => {
    hapticFeedback('medium');
    setTrades(trades.filter(t => t.id !== id));
  };

  const updateTrade = (id: string, field: keyof Trade, value: any) => {
    setTrades(trades.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const performClearAll = () => {
    hapticFeedback('heavy');
    setTrades([]);
    try {
      localStorage.setItem('moex_trades_v2', JSON.stringify([]));
    } catch {}
    setShowClearConfirm(false);
    showToast('Реестр сделок полностью очищен');
  };

  const isPerp = useMemo(() => {
    const t = ticker.toUpperCase();
    return t.endsWith('F') || marketData?.isPerp === true;
  }, [ticker, marketData]);

  // Map and validate trades with normalized ISO dates
  const validTradesMapped = useMemo(() => {
    return trades
      .map(t => {
        const cleanDate = normalizeDateToISO(t.date);
        const pStr = String(t.price ?? '').replace(',', '.').trim();
        let parsedPrice = parseFloat(pStr);
        
        // Auto fallback to date's settlement price from history if user left price empty
        if ((isNaN(parsedPrice) || parsedPrice <= 0) && cleanDate && historyMap.has(cleanDate)) {
          parsedPrice = historyMap.get(cleanDate)!;
        }

        const lots = Math.max(1, t.lots || 1);
        const validPrice = !isNaN(parsedPrice) && parsedPrice > 0;

        return {
          ...t,
          date: cleanDate,
          lots,
          priceInPoints: validPrice ? parsedPrice : (marketData?.last || marketData?.prevSettlePrice || 0),
          isValid: validPrice || (marketData?.last !== undefined && marketData.last > 0)
        };
      })
      .filter(t => t.isValid && t.lots > 0);
  }, [trades, historyMap, marketData]);

  // Core Financial & Margin Calculation Engine
  const calculations = useMemo(() => {
    const defaultSpec = DEFAULT_SPECS[ticker.toUpperCase()];
    const netPosFallback = validTradesMapped.reduce((acc, t) => acc + (t.type === 'Long' ? 1 : -1) * t.lots, 0);

    if (validTradesMapped.length === 0) {
      return { 
        total: 0, 
        totalVM: 0,
        totalFunding: 0,
        pending: 0, 
        settled: 0, 
        settledUnpaid: 0, 
        netPosition: 0, 
        hasValidTargetPrice: true,
        details: null, 
        timeline: [] 
      };
    }

    const stepPrice = marketData?.stepPrice || defaultSpec?.stepPrice || 10;
    const minStep = marketData?.minStep || defaultSpec?.minStep || 0.01;
    const multiplier = minStep > 0 ? (stepPrice / minStep) : (defaultSpec?.multiplier || 1000);
    
    const prevSettlePrice = marketData?.prevSettlePrice || defaultSpec?.prevSettlePrice || 0;
    const settlePrice = marketData?.settlePrice || prevSettlePrice || defaultSpec?.settlePrice || 0;
    const lastPrice = marketData?.last || settlePrice || prevSettlePrice || defaultSpec?.last || 0;

    // Target price (user custom override or live quote)
    const customPriceParsed = customPrice !== '' ? parseFloat(customPrice.replace(',', '.')) : NaN;
    const hasCustomPrice = !isNaN(customPriceParsed) && customPriceParsed > 0;
    
    let referencePrice = 0;
    if (hasCustomPrice) {
      referencePrice = customPriceParsed;
    } else if (lastPrice > 0) {
      referencePrice = lastPrice;
    } else if (settlePrice > 0) {
      referencePrice = settlePrice;
    } else if (prevSettlePrice > 0) {
      referencePrice = prevSettlePrice;
    } else if (historyData && historyData.length > 0) {
      const sortedHistory = [...historyData].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
      const lastHist = sortedHistory[sortedHistory.length - 1];
      if (lastHist && lastHist.settlePrice > 0) {
        referencePrice = lastHist.settlePrice;
      }
    } else if (defaultSpec?.last > 0) {
      referencePrice = defaultSpec.last;
    }

    const hasValidTargetPrice = referencePrice > 0;
    const targetPrice = hasValidTargetPrice ? referencePrice : 0;

    if (!hasValidTargetPrice) {
      return { 
        total: 0, 
        totalVM: 0,
        totalFunding: 0,
        pending: 0, 
        settled: 0, 
        settledUnpaid: 0, 
        netPosition: netPosFallback, 
        hasValidTargetPrice: false,
        details: null, 
        timeline: [] 
      };
    }

    let netPosition = 0;
    for (const t of validTradesMapped) {
      const dir = t.type === 'Long' ? 1 : -1;
      netPosition += dir * t.lots;
    }

    // Direct variation margin from entry prices to target price
    let directVM = 0;
    for (const t of validTradesMapped) {
      const dir = t.type === 'Long' ? 1 : -1;
      const ticks = (targetPrice - t.priceInPoints) / minStep;
      const pnl = ticks * stepPrice * t.lots * dir;
      directVM += pnl;
    }

    // Process Timeline from Historical Clearing Days
    const timeline: Array<{
      date: string;
      settlePrice: number;
      swapRate: number;
      dailyFunding: number;
      dailyVM: number;
      dailyTotal: number;
      netPos: number;
      isDebited: boolean;
    }> = [];

    let totalHistoricalFunding = 0;
    let totalSettledDailyVM = 0;
    let latestHistoryDate = "1970-01-01";
    let latestHistorySettle = prevSettlePrice > 0 ? prevSettlePrice : targetPrice;

    if (historyData && historyData.length > 0) {
      const sortedHistory = [...historyData].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
      const sortedTrades = [...validTradesMapped].sort((a, b) => a.date.localeCompare(b.date));
      const earliestTradeDate = sortedTrades[0]?.date;

      latestHistoryDate = sortedHistory[sortedHistory.length - 1].tradeDate;
      latestHistorySettle = sortedHistory[sortedHistory.length - 1].settlePrice;

      if (earliestTradeDate) {
        const relevantHistory = sortedHistory.filter(h => h.tradeDate >= earliestTradeDate);
        
        let isFirstHistory = true;
        let lastProcessedHistoryDate = "";
        let lastProcessedHistorySettle = 0;

        relevantHistory.forEach((day) => {
          // Net position at the time of THIS historical clearing
          let posAtClearing = 0;
          sortedTrades.forEach(t => {
            if (t.date <= day.tradeDate) {
              posAtClearing += (t.type === 'Long' ? 1 : -1) * t.lots;
            }
          });

          // Daily Funding
          let dailyFunding = 0;
          if (isPerp && day.swapRate !== undefined) {
            dailyFunding = -1 * day.swapRate * multiplier * posAtClearing;
          }

          // Daily VM breakdown: Carried vs New (handles weekend gaps flawlessly)
          let carriedPosFromLastClearing = 0;
          let newTradesVM = 0;

          sortedTrades.forEach(t => {
            if (t.date <= day.tradeDate) {
              const dir = t.type === 'Long' ? 1 : -1;
              if (!isFirstHistory && t.date <= lastProcessedHistoryDate) {
                carriedPosFromLastClearing += dir * t.lots;
              } else {
                newTradesVM += (day.settlePrice - t.priceInPoints) * multiplier * dir * t.lots;
              }
            }
          });

          let carryVM = 0;
          if (!isFirstHistory) {
            carryVM = (day.settlePrice - lastProcessedHistorySettle) * multiplier * carriedPosFromLastClearing;
          }

          let dailyVM = carryVM + newTradesVM;
          let dailyTotal = dailyVM + dailyFunding;

          totalHistoricalFunding += dailyFunding;
          totalSettledDailyVM += dailyVM;

          timeline.push({
            date: day.tradeDate,
            settlePrice: day.settlePrice,
            swapRate: day.swapRate || 0,
            dailyFunding,
            dailyVM,
            dailyTotal,
            netPos: posAtClearing,
            isDebited: true
          });

          lastProcessedHistoryDate = day.tradeDate;
          lastProcessedHistorySettle = day.settlePrice;
          isFirstHistory = false;
        });
      }
    }

    // Active/Pending Session Calculations
    const sortedTrades = [...validTradesMapped].sort((a, b) => a.date.localeCompare(b.date));

    // Carried position from latest historical clearing to current live session
    let netPosCarriedOver = 0;
    let intradayTradesPnL = 0;
    const currentTradesDetails: any[] = [];

    sortedTrades.forEach(t => {
      const dir = t.type === 'Long' ? 1 : -1;
      if (t.date > latestHistoryDate) {
        // New trade since the last available clearing (e.g. today or weekend)
        const pnl = (targetPrice - t.priceInPoints) * multiplier * t.lots * dir;
        intradayTradesPnL += pnl;
        currentTradesDetails.push({ ...t, pnl });
      } else {
        netPosCarriedOver += dir * t.lots;
      }
    });

    const pendingFromCarry = (targetPrice - latestHistorySettle) * multiplier * netPosCarriedOver;
    const pendingFromNew = intradayTradesPnL;
    let pendingVM = pendingFromCarry + pendingFromNew;

    // Pending Funding for live session
    let pendingFunding = 0;
    if (isPerp && funding) {
      const liveSwapRate = parseFloat(funding.replace(',', '.'));
      if (!isNaN(liveSwapRate) && liveSwapRate !== 0) {
        pendingFunding = -1 * liveSwapRate * multiplier * netPosition;
      }
    }

    const totalFunding = totalHistoricalFunding + pendingFunding;
    const totalVM = directVM;
    const grandTotal = totalVM + totalFunding;
    const totalPending = pendingVM + pendingFunding;
    const totalSettled = totalSettledDailyVM + totalHistoricalFunding;

    return {
      total: Number(grandTotal.toFixed(2)),
      totalVM: Number(totalVM.toFixed(2)),
      totalFunding: Number(totalFunding.toFixed(2)),
      pending: Number(totalPending.toFixed(2)),
      settled: Number(totalSettled.toFixed(2)),
      settledUnpaid: 0,
      netPosition,
      hasValidTargetPrice: true,
      details: {
        targetPrice,
        netPosCarriedOver,
        currentTradesPnL: intradayTradesPnL,
        prevSettlePrice: latestHistorySettle,
        pendingFromCarry,
        pendingFromNew,
        currentTradesDetails,
        minStep,
        stepPrice,
        multiplier,
        fundingTotal: totalFunding,
        historicalFunding: totalHistoricalFunding,
        pendingFunding
      },
      timeline
    };
  }, [marketData, validTradesMapped, isPerp, funding, historyData, customPrice, ticker]);

  const { total, totalVM, totalFunding, pending, settled, netPosition, details, timeline } = calculations;

  // Filtered & Paginated Clearing Timeline (Newest first)
  const filteredTimeline = useMemo(() => {
    let list = [...timeline].reverse();
    if (clearingFilter === 'swap') {
      list = list.filter(item => (item.swapRate !== undefined && item.swapRate !== 0) || (item.dailyFunding !== undefined && item.dailyFunding !== 0));
    } else if (clearingFilter === 'profit') {
      list = list.filter(item => item.dailyTotal > 0);
    } else if (clearingFilter === 'loss') {
      list = list.filter(item => item.dailyTotal < 0);
    }
    return list;
  }, [timeline, clearingFilter]);

  const displayedTimeline = useMemo(() => {
    return filteredTimeline.slice(0, clearingVisibleCount);
  }, [filteredTimeline, clearingVisibleCount]);

  const swapDaysCount = useMemo(() => {
    return timeline.filter(item => (item.swapRate !== undefined && item.swapRate !== 0) || (item.dailyFunding !== undefined && item.dailyFunding !== 0)).length;
  }, [timeline]);

  const getDayOfWeekStr = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      return days[d.getDay()] || '';
    } catch {
      return '';
    }
  };

  // Average entry price
  const netLots = validTradesMapped.reduce((acc, t) => acc + (t.type === 'Long' ? t.lots : -t.lots), 0);
  let avgEntry = '—';
  if (netLots !== 0) {
    const totalSpent = validTradesMapped.reduce((acc, t) => acc + (t.priceInPoints * t.lots * (t.type === 'Long' ? 1 : -1)), 0);
    avgEntry = (Math.abs(totalSpent / netLots)).toFixed(2);
  } else if (validTradesMapped.length > 0) {
    avgEntry = 'Сделки закрыты (0)';
  }

  // Difference in points
  const pointsDiff = details && details.multiplier > 0 
    ? (totalVM / details.multiplier).toFixed(2) 
    : '0.00';

  const handleCopy = () => {
    if (!marketData || !details) return;
    const reportText = generateVMReport(ticker, isPerp, marketData, calculations, marketPhase, validTradesMapped);
    
    if (navigator.share) {
      hapticFeedback('medium');
      navigator.share({
        title: `Отчет по ВМ: ${ticker}`,
        text: reportText.trim()
      }).catch(() => {});
    } else {
      hapticFeedback('medium');
      navigator.clipboard.writeText(reportText.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getNextClearingTimeText = () => {
    return 'Сегодня 23:50 (Единственный клиринг дня)';
  };

  return (
    <main className="max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8 space-y-5 text-zinc-100 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-4 sm:right-8 z-[110] bg-zinc-900/95 border border-blue-500/40 text-blue-300 text-xs font-mono font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 backdrop-blur-md"
          >
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Bar */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-3.5 px-5 bg-zinc-900/90 border border-zinc-800 rounded-2xl backdrop-blur-md sticky top-4 z-[50] shadow-2xl">
        <div className="flex items-center justify-between w-full md:w-auto md:justify-start gap-4">
          <div className="flex flex-col">
            <h1 className="text-sm font-black uppercase tracking-widest text-zinc-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full animate-pulse bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
              VM.MOEX <span className="text-[10px] text-zinc-400 font-normal">v2026</span>
            </h1>
            <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-tight">Калькулятор маржи и фандинга</p>
          </div>
          
          <div className="h-8 w-[1px] bg-zinc-800 hidden md:block" />

          {/* Quick Select Buttons */}
          <div className="hidden xl:flex items-center gap-1.5 overflow-x-auto py-1">
            {['USDRUBF', 'IMOEXF', 'GLDRUBF', 'CNYRUBF', 'RGBIF', 'SBERF', 'EURRUBF'].map(t => (
              <button 
                key={t}
                onClick={() => { 
                  setTicker(t);
                  localStorage.setItem('moex_last_ticker', t);
                  const cached = localStorage.getItem(`moex_market_data_${t}`);
                  if (cached) {
                    try { setMarketData(JSON.parse(cached)); } catch {}
                  } else if (DEFAULT_SPECS[t]) {
                    setMarketData(DEFAULT_SPECS[t]);
                  }
                  fetchMarketData(t); 
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all shrink-0 font-mono",
                  ticker.toUpperCase() === t ? "bg-blue-600/30 text-blue-300 border border-blue-500/50" : "bg-zinc-950/70 text-zinc-400 hover:text-white border border-zinc-800"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Action Controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-1 max-w-2xl justify-end">
          <div className="relative flex-1 group">
            <input 
              type="text" 
              value={ticker}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setTicker(val);
                if (!val.trim()) {
                  setMarketData(null);
                  setHistoryData(null);
                  setTrades([]);
                  try {
                    localStorage.setItem('moex_last_ticker', '');
                    localStorage.setItem('moex_trades_v2', JSON.stringify([]));
                  } catch {}
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchMarketData(ticker); }}
              placeholder="ПОИСК ТИКЕРА..."
              className="bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-10 py-2.5 w-full text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono uppercase transition-all h-11"
            />
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
            {ticker && (
              <button 
                onClick={performFullReset} 
                title="Очистить и сбросить все параметры"
                className="absolute right-3.5 top-3.5 text-zinc-500 hover:text-rose-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            
            <AnimatePresence>
              {showSuggestions && filteredInstruments.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.96, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 5 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl z-[100] backdrop-blur-md max-h-60 overflow-y-auto"
                >
                  {filteredInstruments.map((inst) => (
                    <button
                      key={inst.ticker}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectInstrument(inst);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-zinc-800 flex items-center justify-between border-b border-zinc-800/50 last:border-0"
                    >
                      <span className="text-xs font-bold text-white font-mono">{inst.ticker}</span>
                      <span className="text-[10px] text-zinc-400 truncate max-w-[200px]">{inst.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Refresh Quotes */}
          <button 
            id="fetch-btn"
            onClick={() => fetchMarketData(ticker)}
            disabled={loading || !ticker}
            title="Обновить котировки с Мосбиржи"
            className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl h-11 px-3.5 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 shrink-0 text-xs font-bold"
          >
            <RefreshCw className={cn("w-4 h-4 text-blue-400", loading && "animate-spin")} />
            <span className="hidden sm:inline">Обновить</span>
          </button>

          {/* Universal Full Reset Button */}
          <button 
            onClick={performFullReset}
            title="Сбросить выбранный тикер и все сделки"
            className="bg-zinc-950 hover:bg-rose-950/40 border border-zinc-800 hover:border-rose-800/60 text-zinc-400 hover:text-rose-300 rounded-xl h-11 px-3.5 flex items-center gap-1.5 transition-all active:scale-95 shrink-0 text-xs font-bold"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Сбросить всё</span>
          </button>

          {/* Instruments Sync / DB Button */}
          <button 
            onClick={syncInstruments}
            disabled={isSyncing}
            title="Синхронизировать полный список фьючерсов Мосбиржи"
            className={cn(
              "flex items-center gap-1.5 text-xs font-bold transition-all px-3.5 h-11 rounded-xl border shrink-0",
              allInstruments.synced 
                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20" 
                : "text-zinc-300 bg-zinc-950 border-zinc-800 hover:bg-zinc-900"
            )}
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
            ) : allInstruments.synced ? (
              <Database className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Database className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <span className="hidden lg:inline">{allInstruments.synced ? `ФОРТС (${allInstruments.list.length})` : 'База ФОРТС'}</span>
          </button>

          {/* Help Button */}
          <button 
            onClick={() => setIsInstructionsOpen(true)}
            title="Справка и формула расчета"
            className="h-11 w-11 flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all shrink-0"
          >
            <HelpCircle className="w-4 h-4 text-zinc-400 hover:text-blue-400 transition-colors" />
          </button>
        </div>
      </header>

      {/* Error banner if network/API failed */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 px-4 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error} (используются кэшированные/резервные спецификации)</span>
          </div>
          <button 
            onClick={() => fetchMarketData(ticker)} 
            className="bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/40 text-white text-[11px] font-bold px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ml-2"
          >
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
            Повторить
          </button>
        </div>
      )}

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        
        {/* Left Column: Financial Outcome */}
        <section className="xl:col-span-4 space-y-5">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
            <div className={cn(
              "absolute inset-0 opacity-15 blur-3xl transition-all duration-1000",
              !calculations.hasValidTargetPrice ? "bg-zinc-700" : total > 0 ? "bg-emerald-500" : total < 0 ? "bg-rose-500" : "bg-blue-500"
            )} />
            
            <div className="relative z-10 flex flex-col space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Итоговый финансовый результат</p>
                  <h2 className="text-base font-black text-white uppercase mt-0.5 flex items-center gap-2">
                    {ticker || "ТИКЕР НЕ ВЫБРАН"}
                    {isPerp && ticker && (
                      <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[9px] font-black rounded-md tracking-wider">
                        ВЕЧНЫЙ ФЬЮЧЕРС
                      </span>
                    )}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-950/80 rounded-full border border-zinc-800">
                  <div className={cn("w-1.5 h-1.5 rounded-full", marketPhase.isTrading ? "bg-emerald-500" : "bg-amber-500")} />
                  <span className="text-[9px] font-bold text-zinc-300 uppercase">{marketPhase.name.split(' ')[0]}</span>
                </div>
              </div>

              {/* Huge Result Number */}
              <div className="text-center py-2 bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-4 shadow-inner">
                <p className={cn(
                  "text-4xl sm:text-5xl font-black font-mono tracking-tight transition-all",
                  !calculations.hasValidTargetPrice ? "text-zinc-500 text-3xl sm:text-4xl" : total > 0 ? "text-emerald-400" : total < 0 ? "text-rose-400" : "text-white"
                )}>
                  {!calculations.hasValidTargetPrice ? (
                    loading ? "Загрузка котировок..." : "0,00 ₽"
                  ) : (
                    <>
                      {total > 0 ? '+' : ''}{formatMoney(total)}
                      <span className="text-xl ml-1.5 text-zinc-500">₽</span>
                    </>
                  )}
                </p>

                <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                  {calculations.hasValidTargetPrice ? (
                    <>
                      <span className={cn(
                        "text-[10px] font-bold font-mono px-2.5 py-1 rounded-full border",
                        Number(pointsDiff) > 0 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : Number(pointsDiff) < 0 ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-zinc-400 bg-zinc-800 border-zinc-700"
                      )}>
                        {Number(pointsDiff) > 0 ? '+' : ''}{pointsDiff} пт (ВМ)
                      </span>
                      
                      {isPerp && totalFunding !== 0 && (
                        <span className={cn(
                          "text-[10px] font-bold font-mono px-2.5 py-1 rounded-full border",
                          totalFunding > 0 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                        )}>
                          Своп: {totalFunding > 0 ? '+' : ''}{formatMoney(totalFunding)} ₽
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] text-zinc-500 font-medium">
                      {loading ? "Получение данных с Мосбиржи..." : "Укажите цену для расчета"}
                    </span>
                  )}
                </div>
              </div>

              {/* Margin & Funding Decomposition */}
              <div className="bg-zinc-950/80 border border-zinc-800/90 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-medium">Вариационная маржа (котировка):</span>
                  <span className={cn("font-mono font-bold", totalVM > 0 ? "text-emerald-400" : totalVM < 0 ? "text-rose-400" : "text-zinc-300")}>
                    {totalVM > 0 ? '+' : ''}{formatMoney(totalVM)} ₽
                  </span>
                </div>

                {isPerp && (
                  <div className="flex justify-between items-center text-xs border-t border-zinc-800/60 pt-2">
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-400 font-medium">Накопленный фандинг (своп):</span>
                      <Tooltip title="Фандинг вечного фьючерса" content="Сумма всех ежедневных начислений или списаний за перенос открытой позиции через клиринг 23:50.">
                        <HelpCircle className="w-3 h-3 text-zinc-600 hover:text-amber-400 cursor-pointer" />
                      </Tooltip>
                    </div>
                    <span className={cn("font-mono font-bold", totalFunding > 0 ? "text-emerald-400" : totalFunding < 0 ? "text-rose-400" : "text-amber-400")}>
                      {totalFunding > 0 ? '+' : ''}{formatMoney(totalFunding)} ₽
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center text-xs border-t border-zinc-800/60 pt-2">
                  <span className="text-zinc-400 font-medium">Уже списано/зачислено (история):</span>
                  <span className="font-mono font-bold text-zinc-300">
                    {settled > 0 ? '+' : ''}{formatMoney(settled)} ₽
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs border-t border-zinc-800/60 pt-2">
                  <span className="text-zinc-400 font-medium">Ожидает в текущей сессии:</span>
                  <span className={cn("font-mono font-bold", pending > 0 ? "text-emerald-400" : pending < 0 ? "text-rose-400" : "text-zinc-400")}>
                    {pending > 0 ? '+' : ''}{formatMoney(pending)} ₽
                  </span>
                </div>
              </div>

              {/* Simulation / Interactive Price Override */}
              <div className="space-y-3 bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800/70">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-400 font-medium">Расчетная цена / Текущая:</span>
                    <Tooltip title="Моделирование цены" content="Вы можете ввести любую свою цену для расчета сценария «Что если цена изменится до...»">
                      <HelpCircle className="w-3 h-3 text-zinc-600 hover:text-blue-400 cursor-pointer" />
                    </Tooltip>
                  </div>
                  <div className="relative">
                    <input 
                      type="text" 
                      inputMode="decimal"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      placeholder={details?.targetPrice ? String(details.targetPrice) : "0.00"}
                      className="w-28 bg-zinc-900 border border-zinc-700/70 rounded-lg text-right px-2.5 py-1 font-mono text-white font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    />
                    {customPrice !== '' && (
                      <button 
                        onClick={() => setCustomPrice('')} 
                        className="absolute -right-6 top-1 text-zinc-400 hover:text-white"
                        title="Сбросить к рыночной цене"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs border-t border-zinc-800/50 pt-2">
                  <span className="text-zinc-400 font-medium">Чистая позиция:</span>
                  <span className={cn(
                    "font-mono font-black",
                    netPosition > 0 ? "text-emerald-400" : netPosition < 0 ? "text-rose-400" : "text-zinc-400"
                  )}>
                    {netPosition > 0 ? `▲ Long (${netPosition} лот.)` : netPosition < 0 ? `▼ Short (${Math.abs(netPosition)} лот.)` : 'Закрыта (0)'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs border-t border-zinc-800/50 pt-2">
                  <span className="text-zinc-400 font-medium">Средняя цена входа:</span>
                  <span className="font-mono font-bold text-zinc-300">{avgEntry}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-1">
                <button 
                  onClick={() => setIsDetailedBreakdownOpen(true)}
                  disabled={!marketData}
                  className="h-12 w-12 flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all active:scale-95 shadow-lg shrink-0"
                  title="Детальная выписка"
                >
                  <Layers className="w-5 h-5 text-blue-400" />
                </button>

                <button 
                  id="copy-btn" 
                  onClick={handleCopy} 
                  disabled={!marketData}
                  className={cn(
                    "flex-1 h-12 rounded-xl flex items-center justify-center gap-2.5 font-black text-xs transition-all active:scale-95 shadow-xl",
                    copied ? "bg-emerald-600 text-white" : "bg-white text-zinc-950 hover:bg-zinc-200"
                  )}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Отчет скопирован' : 'Поделиться отчетом'}
                </button>
              </div>
            </div>
          </div>

          {/* Market Specs Card */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Параметры инструмента (ФОРТС)</h3>
              <span className="text-[10px] text-zinc-500 font-mono">{lastUpdateTime ? `Обновлено: ${lastUpdateTime}` : ''}</span>
            </div>

            {marketData ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Котировка (Last)</p>
                  <p className="font-mono text-white text-base font-black">{marketData.last}</p>
                </div>
                <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">РЦ Пред. Клиринга</p>
                  <p className="font-mono text-amber-400 text-base font-black">{marketData.prevSettlePrice}</p>
                </div>
                <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-2.5">
                  <p className="text-[9px] text-zinc-500 font-bold uppercase mb-0.5">Шаг цены</p>
                  <p className="font-mono text-zinc-300 text-xs font-bold">{marketData.minStep}</p>
                </div>
                <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-2.5">
                  <p className="text-[9px] text-zinc-500 font-bold uppercase mb-0.5">Стоимость шага</p>
                  <p className="font-mono text-zinc-300 text-xs font-bold">{marketData.stepPrice} ₽</p>
                </div>
              </div>
            ) : (
              <div className="py-8 px-4 text-center text-zinc-500 text-xs bg-zinc-950/60 rounded-2xl border border-zinc-800/60 space-y-1">
                <p className="font-bold text-zinc-400">Тикер не выбран</p>
                <p className="text-[11px] text-zinc-500">Введите тикер в поиске выше (например, USDRUBF, SBERF, CNYRUBF)</p>
              </div>
            )}
          </div>
        </section>

        {/* Middle Column: Trade Management */}
        <section className="xl:col-span-4 space-y-5">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 flex flex-col shadow-xl h-full">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                <h3 className="text-xs font-black uppercase text-zinc-300 tracking-wider">
                  Реестр сделок ({validTradesMapped.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {showClearConfirm ? (
                  <div className="flex items-center gap-1 bg-rose-500/20 border border-rose-500/30 px-2 py-1 rounded-lg">
                    <span className="text-[10px] text-rose-400 font-bold mr-1">Очистить?</span>
                    <button onClick={performClearAll} className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded font-bold hover:bg-rose-500">Да</button>
                    <button onClick={() => setShowClearConfirm(false)} className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded font-bold">Нет</button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowClearConfirm(true)}
                    className="text-[10px] font-bold text-zinc-500 hover:text-rose-400 uppercase transition-colors"
                  >
                    Очистить
                  </button>
                )}
                <button 
                  id="add-trade-btn" 
                  onClick={addTrade}
                  className="text-[10px] font-black uppercase px-3 py-1.5 rounded-xl bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-all active:scale-95 border border-blue-500/30 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Сделка
                </button>
              </div>
            </div>

            <div className="space-y-3.5 overflow-y-auto max-h-[640px] pr-1">
              {trades.length === 0 ? (
                <div className="py-12 px-4 text-center border border-dashed border-zinc-800/80 rounded-2xl bg-zinc-950/40 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center mx-auto text-zinc-500 border border-zinc-800">
                    <Plus className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-300">Реестр сделок пуст</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Нажмите «+ Сделка», чтобы добавить вход в позицию</p>
                  </div>
                  <button 
                    onClick={addTrade} 
                    className="text-xs font-bold px-4 py-2 rounded-xl bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 transition-all active:scale-95 inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Добавить первую сделку
                  </button>
                </div>
              ) : (
                trades.map((trade, i) => (
                  <TradeCard
                    key={trade.id}
                    trade={trade}
                    index={i}
                    totalCount={trades.length}
                    suggestedPrice={historyMap.get(trade.date)}
                    onUpdate={updateTrade}
                    onRemove={removeTrade}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Clearing Journal & Funding Breakdown */}
        <section className="xl:col-span-4 space-y-5">
          {/* Clearing Journal Card */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-black uppercase text-zinc-200 tracking-wider">
                  Журнал клирингов
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-zinc-800">
                  {timeline.length} дн.
                </span>
                <Tooltip title="История ежедневных расчетов" content="Здесь показаны официальные клиринги Мосбиржи за каждый торговый день: расчетная цена, вариационная маржа и ставка фандинга.">
                  <HelpCircle className="w-3.5 h-3.5 text-zinc-600 hover:text-blue-400 cursor-pointer" />
                </Tooltip>
              </div>

              {/* Refresh history button */}
              <button 
                onClick={() => {
                  hapticFeedback('light');
                  const validTrades = trades.filter(t => t.date);
                  const earliest = validTrades.reduce((min, tr) => {
                    const iso = normalizeDateToISO(tr.date);
                    return (iso && iso < min) ? iso : min;
                  }, '2023-01-01');
                  const fromDate = earliest < '2023-01-01' ? earliest : '2023-01-01';
                  fetchHistoryOnly(ticker, fromDate);
                }}
                disabled={historyLoading}
                title="Обновить историю клирингов MOEX"
                className="text-[10px] font-bold text-zinc-400 hover:text-white bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={cn("w-3 h-3 text-blue-400", historyLoading && "animate-spin")} />
                <span>MOEX ISS</span>
              </button>
            </div>

            {/* Filter Pills */}
            {timeline.length > 0 && (
              <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => { setClearingFilter('all'); setClearingVisibleCount(20); }}
                  className={cn(
                    "text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all shrink-0 border",
                    clearingFilter === 'all' 
                      ? "bg-blue-600/30 text-blue-300 border-blue-500/50" 
                      : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white"
                  )}
                >
                  Все ({timeline.length})
                </button>

                {isPerp && swapDaysCount > 0 && (
                  <button
                    type="button"
                    onClick={() => { setClearingFilter('swap'); setClearingVisibleCount(20); }}
                    className={cn(
                      "text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all shrink-0 border",
                      clearingFilter === 'swap' 
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/50" 
                        : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-amber-400"
                    )}
                  >
                    Со свопом ({swapDaysCount})
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => { setClearingFilter('profit'); setClearingVisibleCount(20); }}
                  className={cn(
                    "text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all shrink-0 border",
                    clearingFilter === 'profit' 
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50" 
                      : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-emerald-400"
                  )}
                >
                  + Прибыль
                </button>

                <button
                  type="button"
                  onClick={() => { setClearingFilter('loss'); setClearingVisibleCount(20); }}
                  className={cn(
                    "text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all shrink-0 border",
                    clearingFilter === 'loss' 
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/50" 
                      : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-rose-400"
                  )}
                >
                  - Списания
                </button>
              </div>
            )}

            {/* List of Clearing Sessions */}
            <div className="space-y-2 overflow-y-auto pr-1 max-h-[520px]">
              {displayedTimeline.length > 0 ? (
                displayedTimeline.map((h) => {
                  const dayOfWeek = getDayOfWeekStr(h.date);
                  return (
                    <div key={h.date} className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 flex justify-between items-center hover:bg-zinc-900/90 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-white font-mono">{h.date}</p>
                          {dayOfWeek && (
                            <span className="text-[9px] font-bold text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                              {dayOfWeek}
                            </span>
                          )}
                          <span className="text-[9px] text-zinc-500 font-mono">23:50</span>
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono",
                            h.netPos > 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : h.netPos < 0 ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-zinc-900 text-zinc-400 border-zinc-800"
                          )}>
                            {Math.abs(h.netPos)} лот. {h.netPos > 0 ? 'Long' : h.netPos < 0 ? 'Short' : 'Закрыта'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                          <span>РЦ: {h.settlePrice}</span>
                          {isPerp && h.swapRate !== undefined && h.swapRate !== 0 && (
                            <span className={cn(h.swapRate > 0 ? "text-amber-400/90" : "text-emerald-400/90")}>
                              Своп: {h.swapRate} ({formatMoney(h.dailyFunding)} ₽)
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className={cn(
                          "text-xs font-black font-mono",
                          h.dailyTotal > 0 ? "text-emerald-400" : h.dailyTotal < 0 ? "text-rose-400" : "text-zinc-500"
                        )}>
                          {h.dailyTotal > 0 ? '+' : ''}{formatMoney(h.dailyTotal)} ₽
                        </p>
                        <p className="text-[9px] text-zinc-500">
                          {h.dailyFunding !== 0 ? `ВМ: ${h.dailyVM > 0 ? '+' : ''}${formatMoney(h.dailyVM)} ₽` : 'зачислено в клиринг'}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-zinc-600 gap-2">
                  <AlertTriangle className="w-8 h-8 opacity-40 text-amber-500" />
                  <p className="text-xs font-bold uppercase">
                    {historyLoading ? 'Загрузка истории клирингов...' : 'Сессии не найдены'}
                  </p>
                  <p className="text-[10px] text-zinc-500 text-center max-w-[240px]">
                    {clearingFilter !== 'all' 
                      ? 'По выбранному фильтру нет клиринговых сессий.' 
                      : 'Проверьте дату и параметры сделок выше.'}
                  </p>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {filteredTimeline.length > 20 && (
              <div className="mt-3 pt-3 border-t border-zinc-800/80 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Показано: <strong className="text-zinc-300">{displayedTimeline.length}</strong> из <strong className="text-zinc-300">{filteredTimeline.length}</strong> сессий</span>
                  {clearingVisibleCount > 20 && (
                    <button
                      type="button"
                      onClick={() => setClearingVisibleCount(20)}
                      className="text-blue-400 hover:text-blue-300 font-bold"
                    >
                      Свернуть до 20
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {clearingVisibleCount < filteredTimeline.length && (
                    <>
                      <button
                        type="button"
                        onClick={() => setClearingVisibleCount(prev => Math.min(filteredTimeline.length, prev + 50))}
                        className="flex-1 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-white text-[11px] font-bold py-2 rounded-xl transition-all active:scale-98"
                      >
                        + Показать еще 50
                      </button>
                      <button
                        type="button"
                        onClick={() => setClearingVisibleCount(filteredTimeline.length)}
                        className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[11px] font-bold py-2 px-3 rounded-xl transition-all active:scale-98"
                      >
                        Все ({filteredTimeline.length})
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Funding Mechanics Explanation Card */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 shadow-xl space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">
                Механика вечного фьючерса
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
                ETS ФОРТС
              </span>
            </div>

            <div className="space-y-2.5 text-xs text-zinc-400 leading-relaxed bg-zinc-950 p-4 rounded-2xl border border-zinc-800/60">
              <p>
                <strong className="text-white">Клиринг в 23:50 МСК:</strong> Каждый вечер позиция переоценивается по Расчетной Цене (РЦ), а накопленная за день ВМ зачисляется или списывается со счета.
              </p>
              <p>
                <strong className="text-white">Фандинг (Своп-ставка):</strong> Обеспечивает схождение цены фьючерса со спот-курсом. При положительном свопе покупатели (Long) платят продавцам (Short). При отрицательном — наоборот.
              </p>
            </div>
          </div>
        </section>

      </div>

      {/* Modals */}
      <InstructionsModal 
        isOpen={isInstructionsOpen} 
        onClose={() => setIsInstructionsOpen(false)} 
      />

      <DetailedBreakdownModal 
        isOpen={isDetailedBreakdownOpen} 
        onClose={() => setIsDetailedBreakdownOpen(false)} 
        marketData={marketData}
        calculations={calculations}
        ticker={ticker}
        isPerp={isPerp}
      />
    </main>
  );
}
