'use client';
import { motion, AnimatePresence } from 'motion/react';
import { X, BookOpen, Clock, Activity, Coins, ShieldAlert } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function InstructionsModal({ isOpen, onClose }: Props) {
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
            className="relative w-full max-w-3xl bg-black border border-zinc-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
          >
            <div className="p-6 border-b border-zinc-900 flex justify-between items-center sticky top-0 bg-black/90 backdrop-blur-sm z-10">
              <h2 className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-blue-500" /> Инструкция пользователя
              </h2>
              <button onClick={onClose} className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
              
              <section className="space-y-3">
                <h3 className="text-sm font-bold uppercase text-zinc-400 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Что такое F.Calc?
                </h3>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  <strong>F.Calc</strong> — это профессиональный калькулятор Вариационной Маржи (ВМ) для фьючерсов Московской Биржи (ФОРТС). 
                  Он позволяет точно рассчитать ваш финансовый результат, учитывая шаг цены, стоимость шага, клиринги и фандинг (по вечным фьючерсам).
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold uppercase text-zinc-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Единая Торговая Сессия (ЕТС) и Клиринг
                </h3>
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900">
                  <ul className="space-y-4 text-sm text-zinc-300">
                    <li className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                      <span className="text-emerald-500 font-black w-16">08:50</span> 
                      <span>Старт торгов. Вариационная маржа пересчитывается по текущей рыночной цене (Live).</span>
                    </li>
                    <li className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                      <span className="text-amber-500 font-black w-16">19:00</span> 
                      <span>Начало вечерней сессии. Сделки, совершенные после 19:00, переносятся на следующий торговый день для расчетов ВМ. Фиксируются промежуточные цены.</span>
                    </li>
                    <li className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                      <span className="text-rose-500 font-black w-16">23:50</span> 
                      <span><strong>Единственный основной клиринг 2026 года.</strong> Торги останавливаются на 40 минут. Биржа фиксирует <em>Расчетную Цену (РЦ)</em>. Начисляется или списывается реальный финансовый результат на ваш брокерский счет. В этот момент списывается/начисляется фандинг.</span>
                    </li>
                  </ul>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold uppercase text-zinc-400 flex items-center gap-2">
                  <Coins className="w-4 h-4" /> Как считается маржа?
                </h3>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  Все котировки фьючерсов транслируются в <strong>ПУНКТАХ</strong> (например, 75000), а профит начисляется в <strong>РУБЛЯХ</strong>.
                  Перевод пунктов в рубли осуществляется автоматически:
                </p>
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 font-mono text-sm text-center text-zinc-300 uppercase font-black">
                  ВМ = (Цена_Текущая - Цена_Входа) / Шаг × Стоимость_Шага × Лоты
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  <strong>Важное правило биржи:</strong> если вы перенесли позицию со вчерашнего дня (дождались клиринга 23:50), то новая ВМ считается уже <strong>НЕ от вашей цены входа</strong>, а от Расчетной Цены (РЦ) прошлого вечера. 
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-bold uppercase text-zinc-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Вечные Фьючерсы и Фандинг
                </h3>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  Вечные фьючерсы (USDRUBF, IMOEXF) не имеют даты экспирации. Для удержания цены фьючерса возле базового актива используется механизм <strong>Фандинга (Funding)</strong>.
                </p>
                <ul className="list-disc pl-5 text-zinc-300 text-sm leading-relaxed space-y-1">
                  <li>Начисляется/списывается <strong>один раз в день в клиринг (23:50)</strong>.</li>
                  <li>Если фандинг <strong>положительный (+)</strong> — лонгисты (Покупка) платят шортистам (Продажа).</li>
                  <li>Если фандинг <strong>отрицательный (-)</strong> — шортисты платят лонгистам.</li>
                </ul>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  F.Calc автоматически собирает ставку фандинга за текущие стуки из API Мосбиржи и вшивает ее в предстоящий клиринг. Вы также можете поправить значение фандинга вручную в панели расчетов.
                </p>
              </section>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
