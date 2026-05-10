'use client';

import { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';
import { Search, Copy, Check, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, Info, Plus, Trash2, HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { Tooltip } from './components/Tooltip';
import { TradeCard } from './components/TradeCard';
import { Trade, PositionType } from './components/types';
import { SplashScreen } from './components/SplashScreen';
import { InstructionsModal } from './components/InstructionsModal';
import { DetailedBreakdownModal } from './components/DetailedBreakdownModal';

// Helper for API resilience
async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 2, backoff = 500): Promise<Response> {
  try {
    const res = await fetch(url, options);
    if (res.status === 429 && retries > 0) {
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    return res;
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
    if (retries > 0) {
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw err;
  }
}

export default function Home() {
  const [ticker, setTicker] = useState('SiM6');
  const [allInstruments, setAllInstruments] = useState<{ list: { ticker: string, name: string, uid?: string, type?: string, source?: string, realExchange?: string, classCode?: string }[], synced: boolean }>({ list: [], synced: false });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [funding, setFunding] = useState('');
  
  const [marketData, setMarketData] = useState<{ 
    last: number, 
    prevSettlePrice: number, 
    settlePrice: number, 
    stepPrice: number, 
    minStep: number,
    funding?: number,
    historyCount?: number,
    source?: string
  } | null>(null);
  const [historyStatus, setHistoryStatus] = useState<'idle' | 'loading' | 'success' | 'partial' | 'error'>('idle');
  const [historyData, setHistoryData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isDetailedBreakdownOpen, setIsDetailedBreakdownOpen] = useState(false);

  const hapticFeedback = useCallback((strength: 'light' | 'medium' | 'heavy' = 'light') => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      const pattern = strength === 'heavy' ? [50, 30, 50] : strength === 'medium' ? [30] : [10];
      navigator.vibrate(pattern);
    }
  }, []);

  // Removed syncInstruments from down below and defined here:
  const syncInstruments = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setError(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      
      const url = `https://iss.moex.com/iss/engines/futures/markets/forts/securities.json?iss.only=securities&iss.meta=off&securities.columns=SECID,SHORTNAME,LATNAME`;
      const res = await fetchWithRetry(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Ошибка синхронизации: ${res.status}`);
      const data = await res.json();
      
      const moexSecurities = data.securities?.data || [];
      const list = moexSecurities.map((row: any) => ({
        ticker: row[0],
        name: (row[1] || row[2] || '').slice(0, 50),
        source: 'moex',
        type: 'ФОРТС'
      }));

      setAllInstruments({ list, synced: true });
      localStorage.setItem('moex_instruments', JSON.stringify(list));
      hapticFeedback('medium');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Превышено время ожидания синхронизации');
      } else {
        console.error(err);
        setError('Ошибка синхронизации: ' + err.message);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, hapticFeedback]);

  useEffect(() => {
    let instruments: any[] = [];
    const savedInstrumentsStr = localStorage.getItem('moex_instruments');
    if (savedInstrumentsStr) {
        try {
            instruments = JSON.parse(savedInstrumentsStr);
        } catch (e) {
            console.error('Failed to parse saved instruments', e);
        }
    }
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAllInstruments({ list: instruments, synced: instruments.length > 0 });

    if (instruments.length === 0) {
      // Auto-sync if nothing in storage
      syncInstruments();
    }

    const savedTradesStr = localStorage.getItem('moex_trades');
    let parsedTrades: Trade[] | null = null;
    if (savedTradesStr) {
        try {
            parsedTrades = JSON.parse(savedTradesStr);
        } catch (e) {
            console.error('Failed to parse saved trades', e);
        }
    }

    if (parsedTrades && parsedTrades.length > 0) {
        setTrades(parsedTrades);
    } else {
        setTrades([{
            id: '1',
            date: new Date().toISOString().split('T')[0],
            period: 'morning',
            type: 'Long',
            price: '',
            priceMode: 'rubles',
            lots: 1
        }]);
    }
  }, [syncInstruments]);

  useEffect(() => {
    localStorage.setItem('moex_trades', JSON.stringify(trades));
  }, [trades]);

  const isPerp = useMemo(() => {
    const perpsPattern = /F$/;
    const current = ticker.toUpperCase();
    return perpsPattern.test(current) && current.length >= 5; // e.g. USDRUBF, IMOEXF, SBERF
  }, [ticker]);


  const getMarketSession = useCallback((now: Date = new Date()) => {
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeVal = hours * 100 + minutes;

    if (timeVal >= 850 && timeVal < 1900) {
      return {
        calcMode: 'Live' as const,
        phase: {
          id: 'intraday',
          name: 'Торги идут (LIVE)',
          description: 'Вариационная маржа считается по текущим рыночным ценам.'
        }
      };
    } else if (timeVal >= 1900 && timeVal < 2350) {
      return {
        calcMode: 'Clearing' as const,
        phase: {
          id: 'planned',
          name: 'Ожидание клиринга (19:00-23:50)',
          description: 'Цены зафиксированы. Биржа готовится к начислению ВМ.'
        }
      };
    } else if (timeVal >= 2350 || timeVal < 30) {
      return {
        calcMode: 'Clearing' as const,
        phase: {
          id: 'clearing',
          name: 'Клиринг (23:50-00:30)',
          description: 'Идет начисление ВМ на ваш брокерский счет.'
        }
      };
    } else {
      return {
        calcMode: 'Live' as const,
        phase: {
          id: 'post-clearing',
          name: 'Ночная пауза (00:30-08:50)',
          description: 'Клиринг завершен. Новые торги и расчет ВМ начнутся с 08:50.'
        }
      };
    }
  }, []);

  const [session, setSession] = useState<{calcMode: 'Live' | 'Clearing', phase: any}>({
    calcMode: 'Live',
    phase: {
      id: 'intraday',
      name: 'Загрузка...',
      description: 'Определение торговой сессии...'
    }
  });

  const { calcMode, phase: marketPhase } = session;

  const updateMarketSession = useCallback(() => {
    setSession(getMarketSession());
  }, [getMarketSession]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updateMarketSession();
    const timer = setInterval(() => {
      updateMarketSession();
    }, 60000); // Check every minute
    
    return () => clearInterval(timer);
  }, [updateMarketSession]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);



  const isStale = useMemo(() => {
    if (!lastUpdateTimestamp || !now) return false;
    // Data is stale if older than 5 minutes during trading hours
    return now - lastUpdateTimestamp > 5 * 60 * 1000;
  }, [lastUpdateTimestamp, now]);

  const filteredInstruments = useMemo(() => {
    const t = ticker.toLowerCase();
    // For MOEX tab, only show FORTS futures or moex source
    return allInstruments.list.filter(i => 
      (i.source === 'moex' || i.type === 'ФОРТС') &&
      (i.ticker.toLowerCase().includes(t) || i.name.toLowerCase().includes(t))
    ).slice(0, 8);
  }, [allInstruments.list, ticker]);

  const selectInstrument = (inst: any) => {
    hapticFeedback('light');
    setTicker(inst.ticker);
    setShowSuggestions(false);
    fetchMarketData(inst.ticker);
  };

  const clearAllTrades = () => {
    if (confirm('Очистить все сделки?')) {
      hapticFeedback('heavy');
      setTrades([{
        id: '1',
        date: new Date().toISOString().split('T')[0],
        period: 'morning',
        type: 'Long',
        price: '',
        priceMode: 'rubles',
        lots: 1
      }]);
    }
  };

  const abortControllerRef = useRef<AbortController | null>(null);


  const fetchMarketData = useCallback(async (t: string) => {
    if (!t) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);
    setError(null);
    setHistoryStatus('loading');
    
    try {
      // 1. Fetch Current Market Data
      const moexUrl = `https://iss.moex.com/iss/engines/futures/markets/forts/securities/${t.toUpperCase()}.json`;
      const res = await fetchWithRetry(moexUrl, { signal });
      if (signal.aborted) return;
      
      if (!res.ok) throw new Error('Ошибка загрузки маркет-данных');
      const data = await res.json();

      if (!data?.securities?.data?.[0] || !data?.marketdata?.data?.[0]) {
        throw new Error(`Тикер ${t} не найден или данные недоступны`);
      }

      const secCols = data.securities.columns;
      const secRow = data.securities.data[0];
      const mdCols = data.marketdata.columns;
      const mdRow = data.marketdata.data[0];

      const getVal = (cols: string[], row: any[], name: string) => row[cols.indexOf(name)];

      const lastPrice = parseFloat(getVal(mdCols, mdRow, 'LAST')) || 0;
      const prevSettle = parseFloat(getVal(secCols, secRow, 'PREVSETTLEPRICE')) || 0;
      const settle = parseFloat(getVal(secCols, secRow, 'SETTLEPRICE')) || 0;
      const stepPrice = parseFloat(getVal(secCols, secRow, 'STEPPRICE')) || 1;
      const minStep = parseFloat(getVal(secCols, secRow, 'MINSTEP')) || 1;
      const swapRate = parseFloat(getVal(mdCols, mdRow, 'SWAPRATE'));
      const fundingRate = parseFloat(getVal(secCols, secRow, 'FUNDINGRATE'));
      
      const parsedMarketData = {
        last: lastPrice,
        prevSettlePrice: prevSettle,
        settlePrice: settle,
        stepPrice: stepPrice,
        minStep: minStep,
        funding: !isNaN(swapRate) ? swapRate : (!isNaN(fundingRate) ? fundingRate : undefined),
        source: 'MOEX ISS'
      };

      setMarketData(parsedMarketData);
      setLastUpdateTime(new Date().toLocaleTimeString('ru-RU'));
      setLastUpdateTimestamp(Date.now());

      if (parsedMarketData.funding !== undefined && parsedMarketData.funding !== 0) {
        setFunding(parsedMarketData.funding.toString());
      } else {
        setFunding('');
      }

      // 2. Fetch History
      let histData: any[] = [];
      try {
        const d = new Date();
        d.setMonth(d.getMonth() - 3);
        const fromDate = d.toISOString().split('T')[0];
        
        const histUrl = `https://iss.moex.com/iss/history/engines/futures/markets/forts/securities/${t.toUpperCase()}.json?limit=100&from=${fromDate}`;
        const moexHistRes = await fetchWithRetry(histUrl, { signal });
        if (signal.aborted) return;

        if (moexHistRes.ok) {
          const hData = await moexHistRes.json();
          if (hData?.history?.data?.length > 0) {
            const hCols = hData.history.columns;
            const hRows = hData.history.data;
            const getHVal = (row: any[], name: string) => row[hCols.indexOf(name)];

            histData = hRows.map((row: any[]) => ({
              tradeDate: getHVal(row, 'TRADEDATE'),
              settlePrice: parseFloat(getHVal(row, 'SETTLEPRICE')) || parseFloat(getHVal(row, 'CLOSE')) || 0,
              openPrice: parseFloat(getHVal(row, 'OPEN')) || 0,
              high: parseFloat(getHVal(row, 'HIGH')) || 0,
              low: parseFloat(getHVal(row, 'LOW')) || 0,
            }));
            setHistoryStatus('success');
          } else {
            setHistoryStatus('partial');
          }
        }
        
        if (histData.length > 0) {
          setHistoryData(histData);
          setMarketData(prev => prev ? { ...prev, historyCount: histData.length } : null);
        } else {
          setHistoryData(null);
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        console.error('History fetch error:', e);
        setHistoryStatus('error');
        setHistoryData(null);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message);
      setMarketData(null);
      setHistoryData(null);
      setHistoryStatus('error');
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchMarketData('SiM6');
  }, [fetchMarketData]);

  const addTrade = () => {
    hapticFeedback('light');
    setTrades([...trades, {
      id: Date.now().toString() + Math.random().toString(),
      date: new Date().toISOString().split('T')[0],
      period: 'morning',
      type: 'Long',
      price: '',
      priceMode: 'rubles',
      lots: 1
    }]);
  };

  const removeTrade = (id: string) => {
    hapticFeedback('medium');
    setTrades(trades.filter(t => t.id !== id));
  };

  const updateTrade = (id: string, field: keyof Trade, value: any) => {
    setTrades(trades.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const calculations = useMemo(() => {
    if (!marketData || trades.length === 0) return { total: 0, pending: 0, settled: 0, netPosition: 0, details: null, timeline: [] };

    const { last, prevSettlePrice, settlePrice, stepPrice, minStep } = marketData;
    const targetPrice = calcMode === 'Live' ? last : (settlePrice || last);

    let netPosition = 0;
    let totalVM = 0;
    
    const validTrades = trades
      .filter(t => !isNaN(parseFloat(t.price)) && t.lots > 0)
      .map(t => {
        const rawPrice = parseFloat(t.price);
        const pMode = t.priceMode || 'rubles';
        const priceInPoints = pMode === 'rubles' ? (rawPrice * minStep) / stepPrice : rawPrice;
        return { ...t, priceInPoints };
      });

    for (const t of validTrades) {
        const p = t.priceInPoints;
        const dir = t.type === 'Long' ? 1 : -1;
        netPosition += dir * t.lots;
        // Calculation using ticks to avoid float issues
        const ticks = Math.round((targetPrice - p) / minStep);
        const pnlFix = ticks * stepPrice * t.lots * dir;
        totalVM += pnlFix;
    }

    const getNormDate = (dateStr: string, period: 'morning' | 'evening' | undefined) => {
        if (!period || period === 'morning') return dateStr;
        const d = new Date(dateStr);
        const day = d.getDay();
        if (day === 5) d.setDate(d.getDate() + 3); // Friday -> Monday
        else if (day === 6) d.setDate(d.getDate() + 2); // Saturday -> Monday
        else d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    };

    const now = new Date();
    // In UTC the hours might be different, but assuming Local Time here since we are in a frontend application
    const isNowEvening = now.getHours() >= 19 && now.getHours() <= 23;
    const currentPeriod = isNowEvening ? 'evening' : 'morning';
    const todayClearingDate = getNormDate(now.toISOString().split('T')[0], currentPeriod);
    
    let netPosCarriedOver = 0;
    let currentTradesPnL = 0;
    let currentTradesDetails: any[] = [];

    const normTrades = validTrades.map(t => ({
      ...t,
      normDate: getNormDate(t.date, t.period)
    }));

    for (const t of normTrades) {
        const p = t.priceInPoints;
        const dir = t.type === 'Long' ? 1 : -1;
        
        // Logical check for "today's clearing session" deals vs carries
        if (t.normDate >= todayClearingDate) {
            const ticks = Math.round((targetPrice - p) / minStep);
            const pnlFix = ticks * stepPrice * t.lots * dir;
            currentTradesPnL += pnlFix;
            currentTradesDetails.push({ ...t, pnl: pnlFix });
        } else {
            netPosCarriedOver += dir * t.lots;
        }
    }
    
    const ticksCarried = Math.round((targetPrice - prevSettlePrice) / minStep);
    const pendingFromCarry = ticksCarried * stepPrice * netPosCarriedOver;
    const pendingFromNew = currentTradesPnL;
    let pendingVM = pendingFromCarry + pendingFromNew;
    let fundingTotalVal = 0;

    if (isPerp && funding) {
      const fnd = parseFloat(funding);
      if (!isNaN(fnd)) {
        // Positive funding means Long pays (negative PnL), Short receives (positive PnL)
        fundingTotalVal = -fnd * netPosition;
        pendingVM += fundingTotalVal;
        totalVM += fundingTotalVal;
      }
    }

    const timeline: any[] = [];
    if (historyData && historyData.length > 0) {
       const sortedHistory = [...historyData]
         .map(h => ({ ...h, tradeDate: h.tradeDate.split('T')[0] }))
         .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
       
       const sortedTrades = [...normTrades]
         .sort((a, b) => a.normDate.localeCompare(b.normDate));

       const earliestTradeDate = sortedTrades[0]?.normDate;
       
       if (earliestTradeDate) {
           const relevantHistory = sortedHistory.filter(h => h.tradeDate >= earliestTradeDate);
           
           relevantHistory.forEach((day, idx) => {
               let carryPosAtStart = 0;
               sortedTrades.forEach(t => {
                   if (t.normDate < day.tradeDate) {
                       carryPosAtStart += (t.type === 'Long' ? 1 : -1) * t.lots;
                   }
               });

               let dailyVM = 0;
               if (idx > 0) {
                   const prevSettle = relevantHistory[idx-1].settlePrice;
                   const ticks = Math.round((day.settlePrice - prevSettle) / minStep);
                   dailyVM += ticks * stepPrice * carryPosAtStart;
               }

               const todayTrades = sortedTrades.filter(t => t.normDate === day.tradeDate);
               todayTrades.forEach(t => {
                    const tradePrice = t.priceInPoints;
                    const dir = t.type === 'Long' ? 1 : -1;
                    const ticks = Math.round((day.settlePrice - tradePrice) / minStep);
                    dailyVM += ticks * stepPrice * dir * t.lots;
               });

               timeline.push({
                   date: day.tradeDate,
                   settlePrice: day.settlePrice,
                   netPos: carryPosAtStart + todayTrades.reduce((acc, t) => acc + (t.type === 'Long' ? 1 : -1) * t.lots, 0),
                   dailyVM
               });
           });
       }
    }

    const settledVM = timeline.reduce((acc, h) => acc + h.dailyVM, 0);
    const finalTotalVM = settledVM + pendingVM;

    return { 
      total: finalTotalVM,
      pending: pendingVM, 
      settled: settledVM, 
      netPosition, 
      details: { 
        targetPrice, 
        netPosCarriedOver, 
        currentTradesPnL, 
        prevSettlePrice, 
        pendingFromCarry, 
        pendingFromNew, 
        currentTradesDetails,
        minStep,
        stepPrice,
        fundingTotal: fundingTotalVal
      }, 
      timeline 
    };
  }, [marketData, trades, calcMode, isPerp, funding, historyData]);

  const { total, pending, settled, netPosition, details, timeline } = calculations;

  // validTradesMapped has priceInPoints computed:
  const validTradesMapped = useMemo(() => {
    if (!marketData) return [];
    return trades
      .filter(t => !isNaN(parseFloat(t.price)) && t.lots > 0)
      .map(t => {
        const rawPrice = parseFloat(t.price);
        const pMode = t.priceMode || 'rubles';
        const priceInPoints = pMode === 'rubles' ? (rawPrice * marketData.minStep) / marketData.stepPrice : rawPrice;
        return { ...t, priceInPoints };
      });
  }, [trades, marketData]);

  const netLots = validTradesMapped.reduce((acc, t) => acc + (t.type === 'Long' ? t.lots : -t.lots), 0);
  
  let avgEntry = '—';
  if (netLots !== 0) {
    const netValue = validTradesMapped.reduce((acc, t) => acc + (t.priceInPoints * t.lots * (t.type === 'Long' ? 1 : -1)), 0);
    avgEntry = (Math.abs(netValue / netLots)).toFixed(2);
  } else if (validTradesMapped.length > 0) {
    avgEntry = 'Позиция закрыта';
  }

  const pointsDiff = netLots !== 0 && avgEntry !== '—' && details?.targetPrice ? 
    ((details.targetPrice - parseFloat(avgEntry)) * (netPosition > 0 ? 1 : -1)).toFixed(2) : '0.00';

  const handleCopy = () => {
    if (!marketData || !details) return;

    const posEmoji = netPosition > 0 ? '📈' : netPosition < 0 ? '📉' : '➖';
    const posTypeStr = netPosition > 0 ? 'ПОКУПКА (Long)' : netPosition < 0 ? 'ПРОДАЖА (Short)' : 'ЗАКРЫТА (Flat)';
    
    const reportHeader = `📊 ВЫПИСКА ПО ВАРИАЦИОННОЙ МАРЖЕ
Московская Биржа (ММВБ-РТС)
-----------------------------------
🔹 Статус рынка: ${marketPhase.name}
🔹 Инструмент: ${ticker.toUpperCase()}
${posEmoji} Позиция: ${posTypeStr} [${Math.abs(netPosition)} лот.]
🔹 Средняя цена входа: ${avgEntry} пт.
🔹 Текущая (расчетная) цена: ${details.targetPrice} пт.
🔹 Разница: ${pointsDiff > '0' ? '+' : ''}${pointsDiff} пт.
-----------------------------------`;

    let historySummary = '';
    if (timeline && timeline.length > 0) {
      const items = timeline.map((h) => {
        const side = h.netPos > 0 ? 'Покупка' : h.netPos < 0 ? 'Продажа' : 'Нет';
        return `▫️ ${h.date}: РЦ ${h.settlePrice} | В портфеле: ${Math.abs(h.netPos)} лот. (${side}) | Зачислено ВМ: ${Math.round(h.dailyVM).toLocaleString('ru-RU')} ₽`;
      }).join('\n');
      historySummary = `\n📋 ИСТОРИЯ КЛИРИНГОВ (Зачислено на счет):\n${items}\n`;
    }

    // fundingVal calculation
    const fundingVal = isPerp ? Math.round(-parseFloat(funding || '0') * netPosition) : 0;
    const pendingDetails = `\n📈 ТЕКУЩАЯ СЕССИЯ (Ожидается в клиринг 23:50):\n` +
      `• РЦ прошлого клиринга (точка отсчета): ${details.prevSettlePrice}\n` +
      `• ВМ по перенесенным позициям (со вчера): ${Math.round(details.pendingFromCarry).toLocaleString('ru-RU')} ₽\n` +
      `• ВМ по новым сделкам (сегодня): ${Math.round(details.pendingFromNew).toLocaleString('ru-RU')} ₽\n` +
      `${isPerp ? `• Начисленный фандинг: ${fundingVal > 0 ? '+' : ''}${fundingVal.toLocaleString('ru-RU')} ₽\n` : ''}` +
      `👉 Прогноз зачисления в клиринг (23:50): ${Math.round(pending).toLocaleString('ru-RU')} ₽`;

    const disclaimer = `\n📝 ПОЯСНЕНИЯ ДЛЯ КЛИЕНТОВ:\n` +
      `1. Вариационная маржа (ВМ) — это ваш профит/убыток, который начисляется или списывается биржей 1 раз в сутки (в 23:50 МСК).\n` +
      `2. Котировки торгуются в ПУНКТАХ, а итоговый результат начисляется в РУБЛЯХ (с учетом шага и стоимости шага цены на текущий день).\n` +
      `3. Расчеты производятся на стороне НКЦ (Национального Клирингового Центра). Брокер только транслирует данные, ошибок в клиринге биржи не бывает.\n` +
      `4. Если ваша ВМ отличается от ручных расчетов сделки, учтите, что для СТАРЫХ (со вчерашнего дня) позиций прибыль всегда считается от Расчетной цены (РЦ) вчерашнего клиринга, а не от вашей цены входа.\n` +
      `${isPerp ? `5. По ВЕЧНЫМ фьючерсам биржа рассчитывает "Фандинг" (ставку финансирования). Эта сумма списывается или начисляется автоматически в зависимости от перекоса спроса/предложения. Ставка известна до клиринга, она публикуется на сайте Мосбиржи.\n` : ''}`;

    const reportText = `${reportHeader}
${historySummary}
${pendingDetails}
-----------------------------------
💰 ИТОГОВЫЙ ФИНАНСОВЫЙ РЕЗУЛЬТАТ (PnL): ${total > 0 ? '+' : ''}${total.toLocaleString('ru-RU')} ₽
${disclaimer}
`;
    
    if (navigator.share) {
      hapticFeedback('medium');
      navigator.share({
        title: `Отчет по ВМ: ${ticker}`,
        text: reportText.trim()
      }).catch(() => {}); // Suppress AbortError to prevent Next.js overlay
    } else {
      hapticFeedback('medium');
      navigator.clipboard.writeText(reportText.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-4">
      {/* Compact Top Bar */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-3 px-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl backdrop-blur-md sticky top-4 z-[50] shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-sm font-black uppercase tracking-widest text-zinc-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse bg-blue-500" />
              VM.MOEX <span className="text-[10px] text-zinc-500 font-normal">v2.0</span>
            </h1>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tight">Финансовый Терминал 2026</p>
          </div>
          
          <div className="h-8 w-[1px] bg-zinc-800 hidden md:block" />

          {/* Quick Select Tickers */}
          <div className="hidden lg:flex gap-1">
            {['USDRUBF', 'IMOEXF', 'SBERF', 'CNYRUBF'].map(t => (
              <button 
                key={t}
                onClick={() => { setTicker(t); fetchMarketData(t); }}
                className={cn("px-2 py-1 rounded text-[10px] font-bold transition-all", ticker.toLowerCase() === t.toLowerCase() ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300")}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="h-8 w-[1px] bg-zinc-800 hidden md:block" />

          <div className="relative flex-1 group min-w-[200px]">
                <input 
                  type="text" 
                  value={ticker}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="ПОИСК ТИКЕРА..."
                  className="bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 w-full text-[16px] md:text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 uppercase font-mono transition-all h-10 md:h-12"
                />
                <Search className="absolute left-3 top-2.5 md:top-3.5 w-4 h-4 text-zinc-600 group-focus-within:text-blue-500 transition-colors" />
                
                <AnimatePresence>
                  {showSuggestions && filteredInstruments.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl z-[100] backdrop-blur-md"
                    >
                      <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {filteredInstruments.map((inst) => (
                          <button
                            key={inst.uid || inst.ticker}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                selectInstrument(inst);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-zinc-800/80 flex flex-col transition-colors border-b border-zinc-800/50 last:border-0"
                          >
                            <span className="text-[11px] font-bold text-white uppercase font-mono flex items-center justify-between">
                              {inst.ticker}
                              <span className="text-[9px] text-zinc-500 font-normal uppercase">ФОРТС</span>
                            </span>
                            <span className="text-[9px] text-zinc-500 truncate">{inst.name}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                id="fetch-btn"
                onClick={() => fetchMarketData(ticker)}
                disabled={loading || !ticker}
                className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl p-2.5 transition-all active:scale-95 disabled:opacity-50 h-10 md:h-12 w-10 md:w-12 flex items-center justify-center text-center"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin text-blue-500" /> : <RefreshCw className="w-5 h-5" />}
              </button>

        </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsInstructionsOpen(true)}
              className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all"
            >
              <Info className="w-5 h-5" />
            </button>
            <button 
              onClick={syncInstruments}
              disabled={isSyncing}
              className={cn(
                "flex-1 sm:flex-none flex items-center justify-center gap-2 text-[10px] font-bold uppercase transition-all px-4 py-2 md:py-3 rounded-xl border h-10 md:h-12",
                allInstruments.synced ? "text-emerald-500 bg-emerald-500/5 border-emerald-500/20" : "text-blue-400 bg-blue-500/5 border-blue-500/20 hover:text-blue-300"
              )}
            >
              {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : allInstruments.synced ? <Check className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
              <span className="hidden sm:inline">{isSyncing ? 'СИНХРОНИЗАЦИЯ...' : allInstruments.synced ? 'СИНХРОНИЗАЦИЯ ОК' : 'СИНХРОНИЗАЦИЯ API'}</span>
            </button>
          </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Left Column: Result Card */}
        <section className="xl:col-span-4 space-y-4">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl group">
             <div className={cn("absolute inset-0 opacity-10 blur-3xl transition-all duration-1000", total > 0 ? "bg-emerald-500" : total < 0 ? "bg-rose-500" : "bg-blue-500")} />
             
             <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Итоговый результат</p>
                    <h2 className="text-sm font-black text-white uppercase">{ticker}</h2>
                  </div>
                  {isPerp && (
                    <div className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md">
                      <span className="text-[9px] font-black text-amber-500 uppercase">ВЕЧНЫЙ</span>
                    </div>
                  )}
                </div>

                <div className="text-center py-2">
                  <p className={cn("text-5xl font-black font-mono tracking-tighter transition-all duration-500", total > 0 ? "text-emerald-400" : total < 0 ? "text-rose-400" : "text-white")}>
                    {total > 0 ? '+' : ''}{total.toLocaleString('ru-RU')}
                    <span className="text-2xl ml-2 text-zinc-600">₽</span>
                  </p>
                  
                  {details?.targetPrice && netPosition !== 0 && (
                    <div className="flex justify-center mt-2 animate-in fade-in zoom-in duration-500">
                       <p className={cn("text-[10px] font-bold font-mono px-3 py-1 rounded-full backdrop-blur-sm border", Number(pointsDiff) > 0 ? "text-emerald-500/80 bg-emerald-500/10 border-emerald-500/20" : Number(pointsDiff) < 0 ? "text-rose-500/80 bg-rose-500/10 border-rose-500/20" : "text-zinc-400 bg-zinc-800/50 border-zinc-700/50")}>
                         {Number(pointsDiff) > 0 ? '+' : ''}{pointsDiff} пунктов
                       </p>
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-1 mt-4">
                    <div className="flex items-center gap-1">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
                        {marketPhase.id === 'planned' ? 'Индикативная ВМ' : 'Вариационная маржа'}
                      </p>
                      <Tooltip 
                        title="Что такое ВМ?" 
                        content="Вариационная маржа — это ваша текущая прибыль или убыток. Она пересчитывается в реальном времени, но официально начисляется на счет только во время клиринга (в 00:30)."
                      >
                        <HelpCircle className="w-3 h-3 text-zinc-700 hover:text-blue-500 transition-colors" />
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-950/50 rounded-full border border-zinc-800/50">
                      <div className={cn("w-1.5 h-1.5 rounded-full", 
                        marketPhase.id === 'intraday' ? 'bg-blue-500' : 
                        marketPhase.id === 'planned' ? 'bg-orange-500 animate-pulse' :
                        marketPhase.id === 'clearing' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'
                      )} />
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter">{marketPhase.name}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-zinc-950/80 p-3 rounded-2xl border border-zinc-800/50">
                      <p className="text-[8px] font-bold text-zinc-600 uppercase mb-1">Накоплено (Live)</p>
                      <p className={cn("font-mono text-sm font-bold", pending > 0 ? "text-emerald-500" : pending < 0 ? "text-rose-500" : "text-zinc-400")}>
                        {pending > 0 ? '+' : ''}{Math.round(pending).toLocaleString('ru-RU')} <span className="text-[10px]">₽</span>
                      </p>
                    </div>
                    <div className="bg-zinc-950/80 p-3 rounded-2xl border border-zinc-800/50">
                      <p className="text-[8px] font-bold text-zinc-600 uppercase mb-1">Зафиксировано</p>
                      <p className="font-mono text-sm font-bold text-zinc-400">
                        {Math.round(settled).toLocaleString('ru-RU')} <span className="text-[10px]">₽</span>
                      </p>
                    </div>
                </div>

                   <div className="space-y-3 mt-4 bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/30">
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <div className="flex items-center gap-1 group">
                      <span>Расчетная цена ({calcMode === 'Live' ? 'Рынок' : 'Клиринг'}):</span>
                      <Tooltip title="Расчетная цена (РЦ)" content="Это фиксированная цена, по которой биржа рассчитывает вашу прибыль. Текщая рыночная цена используется до 19:00, далее фиксируется РЦ дня.">
                        <HelpCircle className="w-3 h-3 text-zinc-800 hover:text-blue-400 cursor-pointer" />
                      </Tooltip>
                    </div>
                    <span className="font-mono text-zinc-300 font-bold">{details?.targetPrice || '---'}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <div className="flex items-center gap-1">
                      <span>Чистая позиция:</span>
                      <Tooltip title="Размер позиции" content="Показывает сколько контрактов (лотов) у вас на руках. Положительное значение — покупка, отрицательное — продажа.">
                        <HelpCircle className="w-3 h-3 text-zinc-800 hover:text-blue-400 cursor-pointer" />
                      </Tooltip>
                    </div>
                    <span className={cn("font-mono font-bold", netPosition > 0 ? "text-emerald-500" : netPosition < 0 ? "text-rose-500" : "text-zinc-500")}>
                      {netPosition > 0 ? 'ПОКУПКА (LONG)' : netPosition < 0 ? 'ПРОДАЖА (SHORT)' : 'НЕТ ПОЗИЦИИ (0)'} [{Math.abs(netPosition)}]
                    </span>
                  </div>
                  {isPerp && funding && (
                    <div className="flex justify-between text-[11px] text-zinc-500 pt-2 border-t border-zinc-800/50">
                      <div className="flex items-center gap-1">
                        <Info className="w-3 h-3 text-amber-500" /> 
                        <span>Фандинг (накоп.):</span>
                        <Tooltip title="Фандинг" content="Плата за перенос позиции по вечному фьючерсу. Если цена выше базового актива — платят покупатели, если ниже — продавцы.">
                          <HelpCircle className="w-3 h-3 text-zinc-800 hover:text-amber-400 cursor-pointer" />
                        </Tooltip>
                      </div>
                      {(() => {
                        const val = details?.fundingTotal || 0;
                        return (
                          <span className={cn("font-mono font-bold", val > 0 ? "text-emerald-400" : val < 0 ? "text-rose-400" : "text-amber-400")}>
                            {val > 0 ? '+' : ''}{Math.round(val).toLocaleString('ru-RU')} ₽
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={() => setIsDetailedBreakdownOpen(true)}
                    disabled={!marketData}
                    title="Показать детальную выписку"
                    className={cn("h-14 w-14 flex items-center justify-center rounded-2xl flex-shrink-0 transition-all active:scale-95 border border-zinc-800 bg-zinc-900/80 text-zinc-400 shadow-xl", !marketData ? "opacity-20 cursor-not-allowed" : "hover:text-white hover:bg-zinc-800")}
                  >
                    <Info className="w-5 h-5" />
                  </button>

                  <button 
                    id="copy-btn" onClick={handleCopy} disabled={!marketData}
                    className={cn("flex-1 h-14 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest text-[10px] sm:text-xs transition-all active:scale-95 shadow-xl", copied ? "bg-emerald-600 text-white shadow-emerald-900/20" : "bg-white text-zinc-950 hover:bg-zinc-200 shadow-white/5 border border-white/10", !marketData && "opacity-20 cursor-not-allowed")}
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    {copied ? 'СКОПИРОВАНО' : 'ПОДЕЛИТЬСЯ ОТЧЕТОМ'}
                  </button>
                </div>
             </div>
          </div>

          {/* Market Data Indicators */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5 space-y-4 shadow-xl">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Индикаторы</h3>
                  <Tooltip title="Рыночные котировки" content="Здесь отображаются данные с биржи в реальном времени. Можно переключаться между текущим рынком и результатами последнего клиринга.">
                    <HelpCircle className="w-3 h-3 text-zinc-800 hover:text-blue-500 cursor-pointer" />
                  </Tooltip>
                </div>
                {lastUpdateTime && (
                  <div className="flex flex-col items-end">
                    {isStale ? (
                      <button 
                        onClick={() => fetchMarketData(ticker)}
                        className="flex items-center gap-1 group/stale text-rose-500 hover:text-rose-400 transition-colors"
                      >
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span className="text-[8px] font-black uppercase underline decoration-rose-500/30">ДАННЫЕ УСТАРЕЛИ! ОБНОВИТЬ?</span>
                      </button>
                    ) : (
                      <p className="text-[8px] font-bold uppercase text-zinc-700">Обновлено: {lastUpdateTime}</p>
                    )}
                  </div>
                )}
                <div className="flex bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 m-1" />
                </div>
             </div>
             
             {marketData && (
                 <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-zinc-950 border border-zinc-800/50 rounded-xl p-3">
                      <p className="text-zinc-600 font-bold uppercase mb-1">ПОСЛ. ЦЕНА</p>
                      <p className="font-mono text-white text-lg font-black">{marketData.last}</p>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800/50 rounded-xl p-3">
                      <p className="text-zinc-600 font-bold uppercase mb-1">ПРЕД. КЛИРИНГ</p>
                      <p className="font-mono text-zinc-400 text-lg font-bold">{marketData.prevSettlePrice}</p>
                    </div>
                    <div className="bg-blue-600/5 border border-blue-600/10 rounded-xl p-3 col-span-2 flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-1 mb-0.5">
                          <p className="text-blue-500 font-bold uppercase text-[9px]">ОЖИДАЕМЫЙ КЛИРИНГ (19:00)</p>
                          <Tooltip title="Прогноз цены фиксации" content="Примерная цена, которая будет зафиксирована в 19:00 для итоговых расчетов.">
                            <HelpCircle className="w-2.5 h-2.5 text-blue-500/50" />
                          </Tooltip>
                        </div>
                        <p className="font-mono text-white text-xl font-black">{marketData.settlePrice || '---'}</p>
                      </div>
                      <AlertTriangle className="w-5 h-5 text-blue-500/30" />
                    </div>
                 </div>
             )}
          </div>
        </section>

        {/* Middle Column: Trades List */}
        <section className="xl:col-span-4 space-y-4">
           <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5 flex flex-col shadow-xl h-full">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/50">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Портфель</h3>
                  <Tooltip title="Ваш реестр сделок" content="Этот список показывает все ваши позиции. Если сделка совершена в прошлые дни, она учитывается по цене последнего клиринга.">
                    <HelpCircle className="w-3 h-3 text-zinc-800 hover:text-blue-500 cursor-pointer" />
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={clearAllTrades}
                    className="text-[9px] font-black text-zinc-600 hover:text-rose-500 uppercase tracking-tighter transition-colors"
                  >
                    Очистить всё
                  </button>
                  <button 
                    id="add-trade-btn" onClick={addTrade}
                    className="text-[10px] font-black uppercase px-3 py-1.5 rounded-xl bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-all active:scale-95 border border-blue-500/10"
                  >
                    <Plus className="w-3 h-3 inline mr-1" /> Добавить
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1 custom-scrollbar">
                {trades.map((trade, i) => (
                  <TradeCard
                    key={trade.id}
                    trade={trade}
                    index={i}
                    totalCount={trades.length}
                    onUpdate={updateTrade}
                    onRemove={removeTrade}
                  />
                ))}
              </div>
           </div>
        </section>

        {/* Right Column: Log & Config */}
        <section className="xl:col-span-4 space-y-4">
           <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5 shadow-xl h-[45%] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Журнал клирингов</h3>
                  <Tooltip title="История расчетов" content="Тут показано, сколько денег биржа списывала или начисляла вам каждый вечер. Помогает следить за итоговым результатом.">
                    <HelpCircle className="w-3 h-3 text-zinc-800 hover:text-blue-500 cursor-pointer" />
                  </Tooltip>
                </div>
                <Info className="w-3.5 h-3.5 text-zinc-700" />
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {timeline.length > 0 ? (
                  timeline.map((h) => (
                    <div key={h.date} className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/50 flex justify-between items-center transition-all hover:bg-zinc-900">
                      <div>
                        <p className="text-[9px] font-bold text-zinc-200">{h.date}</p>
                        <p className="text-[8px] text-zinc-600 font-mono">РЦ: {h.settlePrice}</p>
                      </div>
                      <p className={cn("text-[11px] font-black font-mono", h.dailyVM > 0 ? "text-emerald-500" : h.dailyVM < 0 ? "text-rose-500" : "text-zinc-600")}>
                        {h.dailyVM > 0 ? '+' : ''}{Math.round(h.dailyVM)} ₽
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full opacity-30 gap-2">
                    <Trash2 className="w-8 h-8" />
                    <p className="text-[9px] font-bold uppercase">История не найдена</p>
                  </div>
                )}
              </div>
           </div>

           <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5 shadow-xl h-[53%] flex flex-col justify-between">
              <div>
                <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-6">Настройка инструмента</h3>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black text-white uppercase tracking-tight">Тип контракта</p>
                        <Tooltip title="Магия вечности" content="Приложение автоматически определяет вечные фьючерсы по тикеру. Для них учитывается фандинг.">
                          <HelpCircle className="w-3 h-3 text-zinc-700" />
                        </Tooltip>
                      </div>
                      <p className="text-[9px] text-zinc-600 font-bold uppercase">
                        {isPerp ? "Обнаружен вечный фьючерс" : "Стандартный контракт"}
                      </p>
                    </div>
                    <div className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase transition-all duration-500", isPerp ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" : "bg-zinc-800/50 text-zinc-500 border border-zinc-800")}>
                      {isPerp ? "ВЕЧНЫЙ" : "СРОЧНЫЙ"}
                    </div>
                  </div>

                  {isPerp && (
                    <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex justify-between items-center animate-in fade-in zoom-in duration-500">
                      <div className="space-y-1 w-full">
                        <div className="flex justify-between items-center w-full">
                          <p className="text-[8px] font-bold text-amber-600/50 uppercase tracking-widest">Ставка фандинга</p>
                          <TrendingUp className="w-4 h-4 text-amber-500/30" />
                        </div>
                        <div className="flex items-center mt-1">
                          <input 
                            type="number"
                            step="0.01"
                            value={funding}
                            onChange={(e) => setFunding(e.target.value)}
                            placeholder="0.00"
                            className="bg-transparent border-none text-xs font-mono text-amber-500 font-black focus:ring-0 p-0 w-20 outline-none"
                          />
                          <span className="text-[10px] text-amber-500 font-black">₽/лот</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl space-y-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                      <HelpCircle className="w-8 h-8 text-blue-500" />
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-blue-400" />
                      <p className="text-[9px] text-blue-400 font-black uppercase">УВЕДОМЛЕНИЕ РЫНКА ETS 2026</p>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-relaxed font-medium">
                      {marketPhase.description}
                    </p>
                    <p className="text-[9px] text-zinc-500 leading-relaxed italic border-t border-zinc-800/50 pt-2">
                      Основной клиринг: 23:50–00:30. Цены фиксируются в 19:00 MSK.
                    </p>
                  </div>
                </div>
              </div>
           </div>
        </section>
      </div>
      <SplashScreen />
      <InstructionsModal isOpen={isInstructionsOpen} onClose={() => setIsInstructionsOpen(false)} />
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
