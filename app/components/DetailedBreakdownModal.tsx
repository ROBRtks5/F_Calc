'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Calculator, Wallet, HelpCircle } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { cn } from '@/lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  marketData: any;
  calculations: any;
  ticker: string;
  isPerp: boolean;
}

export function DetailedBreakdownModal({ isOpen, onClose, marketData, calculations, ticker, isPerp }: Props) {
  if (!marketData || !calculations.details) return null;

  const { details, netPosition, total, pending, settled } = calculations;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-black/90 backdrop-blur-md" 
            onClick={onClose} 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
          >
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center sticky top-0 bg-zinc-950/90 backdrop-blur-sm z-10">
              <h2 className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-500" /> Детальная выписка
              </h2>
              <button onClick={onClose} className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
              
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-black border border-zinc-900 rounded-2xl p-4">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Инструмент</div>
                  <p className="text-lg font-black text-white">{ticker.toUpperCase()}</p>
                </div>
                <div className="bg-black border border-zinc-900 rounded-2xl p-4">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">РЦ Пред. Клиринга</div>
                  <p className="text-lg font-mono font-bold text-amber-500">{details.prevSettlePrice}</p>
                </div>
                <div className="bg-black border border-zinc-900 rounded-2xl p-4">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1 mb-1 group">
                    Шаг Цены
                    <Tooltip title="Минимальный шаг цены" content="Минимальное изменение цены фьючерса (в пунктах).">
                      <HelpCircle className="w-3 h-3 text-zinc-600 opacity-50 group-hover:opacity-100 cursor-help" />
                    </Tooltip>
                  </div>
                  <p className="font-mono font-bold text-zinc-300">{details.minStep}</p>
                </div>
                <div className="bg-black border border-zinc-900 rounded-2xl p-4">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase flex items-center gap-1 mb-1 group">
                    Стоимость Шага
                    <Tooltip title="Стоимость шага цены" content="Денежный эквивалент изменения цены на один шаг (в рублях). Зависит от курса ЦБ.">
                      <HelpCircle className="w-3 h-3 text-zinc-600 opacity-50 group-hover:opacity-100 cursor-help" />
                    </Tooltip>
                  </div>
                  <p className="font-mono font-bold text-zinc-300">{details.stepPrice} ₽</p>
                </div>
              </div>

              {/* Math Breakdown - Mobile friendly rows instead of table */}
              <div className="bg-black border border-zinc-900 rounded-3xl overflow-hidden">
                <div className="bg-zinc-900/50 p-4 border-b border-zinc-900">
                  <h3 className="text-sm font-bold uppercase text-white flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-emerald-500" /> Текущая сессия к клирингу (23:50 MSK)
                  </h3>
                </div>
                <div className="flex flex-col">
                  {/* Row 1 */}
                  <div className="p-4 border-b border-zinc-900/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div className="flex-1">
                       <p className="font-bold text-white text-sm">ВМ (Перенос)</p>
                       <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">
                         {(details.targetPrice - details.prevSettlePrice).toFixed(2)} пт / {details.minStep} × {details.stepPrice} × {Math.abs(details.netPosCarriedOver)} лотов ({details.netPosCarriedOver > 0 ? 'Лонг' : details.netPosCarriedOver < 0 ? 'Шорт' : 'Нет'})
                       </p>
                    </div>
                    <div className={cn("font-mono font-black text-right text-base", details.pendingFromCarry > 0 ? "text-emerald-400" : details.pendingFromCarry < 0 ? "text-rose-400" : "text-zinc-400")}>
                      {details.pendingFromCarry > 0 ? '+' : ''}{Math.round(details.pendingFromCarry).toLocaleString('ru-RU')} ₽
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="p-4 border-b border-zinc-900/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div className="flex-1">
                       <p className="font-bold text-white text-sm">ВМ (Новые сделки)</p>
                       <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">PnL по сделкам, совершенным за сегодняшний день</p>
                    </div>
                    <div className={cn("font-mono font-black text-right text-base", details.pendingFromNew > 0 ? "text-emerald-400" : details.pendingFromNew < 0 ? "text-rose-400" : "text-zinc-400")}>
                      {details.pendingFromNew > 0 ? '+' : ''}{Math.round(details.pendingFromNew).toLocaleString('ru-RU')} ₽
                    </div>
                  </div>

                  {/* Row 3 (Funding) */}
                  {isPerp && (
                    <div className="p-4 border-b border-zinc-900/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div className="flex-1">
                         <p className="font-bold text-white text-sm">Фандинг</p>
                         <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">Списание/начисление ставки финансирования</p>
                      </div>
                      <div className={cn("font-mono font-black text-right text-base", details.fundingTotal > 0 ? "text-emerald-400" : details.fundingTotal < 0 ? "text-rose-400" : "text-amber-400")}>
                        {details.fundingTotal > 0 ? '+' : ''}{Math.round(details.fundingTotal).toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                  )}

                  {/* Total Row */}
                  <div className="p-4 bg-zinc-900/20 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-3">
                    <div className="flex-1">
                       <p className="font-black text-white uppercase text-sm">Итого к зачислению</p>
                       <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">Прогноз поступлений в клиринг (23:50 MSK)</p>
                    </div>
                    <div className={cn("font-mono font-black text-2xl tracking-tighter text-right", pending > 0 ? "text-emerald-500" : pending < 0 ? "text-rose-500" : "text-zinc-300")}>
                      {pending > 0 ? '+' : ''}{Math.round(pending).toLocaleString('ru-RU')} ₽
                    </div>
                  </div>
                </div>
              </div>

              {/* Settled Table */}
              <div className="bg-black border border-zinc-900 rounded-3xl overflow-hidden">
                <div className="bg-zinc-900/50 border-b border-zinc-900 p-4">
                  <h3 className="text-sm font-bold uppercase text-white flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-500" /> Уже зачислено (История)
                  </h3>
                </div>
                <div className="p-4">
                  {calculations.timeline && calculations.timeline.length > 0 ? (
                    <div className="space-y-3">
                      {calculations.timeline.map((h: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-sm border-b border-zinc-900/50 pb-3 last:border-0 last:pb-0">
                          <span className="text-zinc-400 font-mono text-xs">{h.date}</span>
                          <span className={cn("font-mono font-bold text-base", h.dailyVM > 0 ? "text-emerald-400" : h.dailyVM < 0 ? "text-rose-400" : "")}>
                            {h.dailyVM > 0 ? '+' : ''}{Math.round(h.dailyVM).toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500 text-center py-4">Сделок с пройденным клирингом не найдено.</p>
                  )}
                  <div className="mt-4 pt-4 border-t border-zinc-900/50 flex justify-between items-center">
                    <span className="font-bold text-white uppercase text-sm tracking-widest">Всего зачислено</span>
                    <span className="font-mono font-black text-lg text-white">{Math.round(settled).toLocaleString('ru-RU')} ₽</span>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
