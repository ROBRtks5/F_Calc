'use client';
import { memo } from 'react';
import { Trash2, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Trade } from './types';

export const TradeCard = memo(({ 
  trade, 
  index, 
  totalCount, 
  suggestedPrice,
  onUpdate, 
  onRemove 
}: { 
  trade: Trade, 
  index: number, 
  totalCount: number, 
  suggestedPrice?: number,
  onUpdate: (id: string, field: keyof Trade, value: any) => void, 
  onRemove: (id: string) => void 
}) => {
  return (
    <div className="bg-zinc-950/90 border border-zinc-800/90 rounded-2xl p-4 space-y-3 group hover:border-zinc-700 transition-all focus-within:border-blue-500/50 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black text-white/60 uppercase tracking-wider bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800">
            Сделка #{index + 1}
          </span>
          <button 
            type="button"
            onClick={() => { 
              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); 
              onUpdate(trade.id, 'type', trade.type === 'Long' ? 'Short' : 'Long'); 
            }}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all active:scale-95 border", 
              trade.type === 'Long' 
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25' 
                : 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25'
            )}
          >
            {trade.type === 'Long' ? '▲ Покупка (Long)' : '▼ Продажа (Short)'}
          </button>
        </div>
        {totalCount > 1 && (
          <button 
            type="button"
            onClick={() => onRemove(trade.id)} 
            className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-rose-400 transition-colors bg-zinc-900/80 hover:bg-rose-950/40 rounded-lg border border-zinc-800"
            title="Удалить сделку"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Дата сделки</p>
          {suggestedPrice !== undefined && suggestedPrice > 0 && (!trade.price || String(trade.price).trim() === '') && (
            <button
              type="button"
              onClick={() => onUpdate(trade.id, 'price', String(suggestedPrice))}
              className="text-[9px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 transition-all active:scale-95"
            >
              <Sparkles className="w-2.5 h-2.5 text-blue-400" />
              Подставить РЦ дня: {suggestedPrice}
            </button>
          )}
        </div>
        <input 
          type="date" 
          value={trade.date}
          onChange={(e) => onUpdate(trade.id, 'date', e.target.value)}
          className="bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-2 w-full text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all font-mono"
        />
      </div>

      <div className="grid grid-cols-5 gap-2.5">
        <div className="col-span-3 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Цена входа (пункты)</p>
            {suggestedPrice !== undefined && suggestedPrice > 0 && trade.price !== String(suggestedPrice) && (
              <button
                type="button"
                onClick={() => onUpdate(trade.id, 'price', String(suggestedPrice))}
                className="text-[8px] font-bold text-zinc-400 hover:text-white underline decoration-zinc-700"
                title={`Установить официальную расчетную цену клиринга за ${trade.date}`}
              >
                РЦ: {suggestedPrice}
              </button>
            )}
          </div>
          <div className="relative">
            <input 
              type="text" 
              inputMode="decimal"
              value={trade.price}
              onChange={(e) => {
                const val = e.target.value;
                if (/^[0-9]*[.,]?[0-9]*$/.test(val) || val === '') {
                  onUpdate(trade.id, 'price', val);
                }
              }}
              className="bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-2 w-full text-xs text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600"
              placeholder={suggestedPrice ? `${suggestedPrice}` : "Например 80.97"}
            />
          </div>
        </div>

        <div className="col-span-2 space-y-1">
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Лоты (контракты)</p>
          <div className="flex items-center bg-zinc-900/90 rounded-xl border border-zinc-800 p-0.5">
            <button 
              type="button"
              onClick={() => { 
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); 
                onUpdate(trade.id, 'lots', Math.max(1, (trade.lots || 1) - 1)); 
              }}
              className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors font-mono font-bold text-xs"
            >-</button>
            <input 
              type="number" 
              min="1"
              value={trade.lots || 1}
              onChange={(e) => onUpdate(trade.id, 'lots', Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-transparent text-center text-xs text-white font-mono font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button 
              type="button"
              onClick={() => { 
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); 
                onUpdate(trade.id, 'lots', (trade.lots || 1) + 1); 
              }}
              className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors font-mono font-bold text-xs"
            >+</button>
          </div>
        </div>
      </div>
    </div>
  );
});

TradeCard.displayName = 'TradeCard';
