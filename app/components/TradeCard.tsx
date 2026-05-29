import { memo } from 'react';
import { Trash2, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Trade } from './types';
import { Tooltip } from './Tooltip';

export const TradeCard = memo(({ 
  trade, 
  index, 
  totalCount, 
  onUpdate, 
  onRemove 
}: { 
  trade: Trade, 
  index: number, 
  totalCount: number, 
  onUpdate: (id: string, field: keyof Trade, value: any) => void, 
  onRemove: (id: string) => void 
}) => {
  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 space-y-3 group hover:border-zinc-700 transition-all focus-within:border-blue-500/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-black text-white/50 uppercase tracking-widest bg-zinc-900/50 px-2 py-1 rounded-md border border-zinc-800/50">Сделка #{index + 1}</span>
          <button 
            onClick={() => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); onUpdate(trade.id, 'type', trade.type === 'Long' ? 'Short' : 'Long'); }}
            className={cn(
              "px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all active:scale-95", 
              trade.type === 'Long' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
            )}
          >
            {trade.type === 'Long' ? 'Покупка' : 'Продажа'}
          </button>
        </div>
        <button 
          onClick={() => onRemove(trade.id)} 
          className="w-8 h-8 flex items-center justify-center text-zinc-700 hover:text-rose-500 transition-colors bg-zinc-900 rounded-lg"
          title="Удалить сделку"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <p className="text-[8px] font-bold text-zinc-600 uppercase ml-1">Дата сделки</p>
          <input 
            type="date" value={trade.date}
            onChange={(e) => onUpdate(trade.id, 'date', e.target.value)}
            className="bg-zinc-900 border border-zinc-800/50 rounded-lg px-2 py-1.5 w-full text-[16px] md:text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-3 space-y-1">
          <div className="flex items-center justify-between ml-1 mb-1">
            <div className="flex items-center gap-1">
              <p className="text-[8px] font-bold text-zinc-600 uppercase">Цена</p>
              <Tooltip title="Формат ввода цены" content="Укажите, в каких единицах вводится цена. Система корректно рассчитает маржу независимо от выбора.">
                <HelpCircle className="w-3 h-3 text-zinc-700 hover:text-blue-500" />
              </Tooltip>
            </div>
            <button
              onClick={() => onUpdate(trade.id, 'priceMode', (trade.priceMode || 'rubles') === 'rubles' ? 'points' : 'rubles')}
              className="flex items-center bg-zinc-900 border border-zinc-800 rounded overflow-hidden"
              title="Переключить единицы измерения (Рубли / Пункты)"
            >
              <span className={cn("px-1.5 py-0.5 text-[8px] font-bold uppercase transition-colors", (trade.priceMode || 'rubles') === 'rubles' ? "bg-blue-500/20 text-blue-400" : "text-zinc-600 hover:text-zinc-400")}>
                ₽
              </span>
              <span className={cn("px-1.5 py-0.5 text-[8px] font-bold uppercase transition-colors", (trade.priceMode || 'rubles') === 'points' ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-600 hover:text-zinc-400")}>
                ПТ
              </span>
            </button>
          </div>
          <div className="relative">
            <input 
              type="number" step="any" value={trade.price}
              onChange={(e) => onUpdate(trade.id, 'price', e.target.value)}
              className="bg-zinc-900 border border-zinc-800/50 rounded-lg pl-3 pr-2 py-2 w-full text-[16px] md:text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/30"
              placeholder={(trade.priceMode || 'rubles') === 'rubles' ? "В рублях" : "В пунктах"}
            />
          </div>
        </div>
        <div className="col-span-2 space-y-1">
          <p className="text-[8px] font-bold text-zinc-600 uppercase ml-1">Лоты</p>
          <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800/50">
            <button 
              onClick={() => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); onUpdate(trade.id, 'lots', Math.max(0, trade.lots - 1)); }}
              className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            >-</button>
            <input 
              type="number" 
              value={trade.lots}
              onChange={(e) => onUpdate(trade.id, 'lots', Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-transparent text-center text-[16px] md:text-xs text-white font-mono focus:outline-none"
            />
            <button 
              onClick={() => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); onUpdate(trade.id, 'lots', trade.lots + 1); }}
              className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            >+</button>
          </div>
        </div>
      </div>
    </div>
  );
});
TradeCard.displayName = 'TradeCard';
