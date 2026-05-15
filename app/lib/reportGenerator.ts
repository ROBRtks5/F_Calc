export function generateVMReport(
  ticker: string,
  isPerp: boolean,
  marketData: any,
  calculations: any,
  calcMode: 'Live' | 'Clearing',
  marketPhase: any,
  validTrades: any[]
) {
  const { total, pending, settled, netPosition, details } = calculations;

  // Determine trade date and period from the first valid trade
  let tradeDateStr = "2026-05-15";
  let dealPeriod = 'morning';
  if (validTrades && validTrades.length > 0) {
    tradeDateStr = validTrades[0].date;
    dealPeriod = validTrades[0].period || 'morning';
  }

  const parts = tradeDateStr.split('-');
  let reportDate = new Date();
  if (parts.length === 3) {
     reportDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }

  // Check if the trade date is today
  const moscowTimeStr = new Date().toLocaleString("en-US", {timeZone: "Europe/Moscow"});
  const mskNow = new Date(moscowTimeStr);
  const isToday = reportDate.getDate() === mskNow.getDate() && reportDate.getMonth() === mskNow.getMonth() && reportDate.getFullYear() === mskNow.getFullYear();

  // If trade date is today, and it's before 19:00 MSK -> Preliminary
  // If trade date is in the past -> Final
  const isReportBefore1900 = isToday ? mskNow.getHours() < 19 : false;
  const isDealBefore1900 = dealPeriod === 'morning';

  const days = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
  const currentDayStr = days[reportDate.getDay()]; // Day of the deal

  const currentDateStrFormat = `${reportDate.toLocaleDateString("ru-RU", { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${currentDayStr}`;

  const fmtPt = (val: number) => val.toFixed(2).replace('.', ',');
  const fmtRub = (val: number) => (+val).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ');
  const fmtCost = (val: number) => (+val).toLocaleString('ru-RU', { minimumFractionDigits: 3, maximumFractionDigits: 5 }).replace(/\s/g, ' ');
  const fmtPoint = (val: number) => (+val).toLocaleString('ru-RU', { minimumFractionDigits: 5, maximumFractionDigits: 5 }).replace(/\s/g, ' ');

  const uTicker = ticker.toUpperCase();
  let currency = 'RUB';
  let stepCostUsd: number | null = null;
  let ik: number | null = null;
  let baseAsset = 'Неизвестная база';

  if (['RTS', 'RI'].some(x => uTicker.startsWith(x))) {
    currency = 'USD';
    stepCostUsd = 0.2;
    ik = details.stepPrice / stepCostUsd;
    baseAsset = 'Индекс РТС';
  } else if (['SILV', 'SLV', 'S1'].some(x => uTicker.startsWith(x))) {
    currency = 'USD';
    stepCostUsd = 0.01;
    ik = details.stepPrice / stepCostUsd;
    baseAsset = 'Серебро (тройская унция)';
  } else if (['GOLD', 'GD'].some(x => uTicker.startsWith(x))) {
    currency = 'USD';
    stepCostUsd = 0.1;
    ik = details.stepPrice / stepCostUsd;
    baseAsset = 'Золото (тройская унция)';
  } else if (['BR'].some(x => uTicker.startsWith(x))) {
    currency = 'USD';
    stepCostUsd = 0.1; 
    ik = details.stepPrice / stepCostUsd;
    baseAsset = 'Нефть Brent';
  } else if (['NG'].some(x => uTicker.startsWith(x))) {
    currency = 'USD';
    stepCostUsd = 0.1; 
    ik = details.stepPrice / stepCostUsd;
    baseAsset = 'Природный газ';
  } else if (['SI'].some(x => uTicker.startsWith(x))) {
    currency = 'RUB';
    baseAsset = 'Курс доллар США - российский рубль';
  } else if (['CR'].some(x => uTicker.startsWith(x))) {
    currency = 'RUB';
    baseAsset = 'Курс китайский юань - российский рубль';
  } else if (['IM', 'MX', 'MM'].some(x => uTicker.startsWith(x))) {
    currency = 'RUB';
    baseAsset = 'Индекс МосБиржи';
  }

  const pointCost = details.stepPrice / details.minStep;
  
  // Detect simple open-close logic from validTrades
  let isSimpleClosed = false;
  let tIn: any;
  let tOut: any;
  if (validTrades && validTrades.length === 2 && netPosition === 0 && details.netPosCarriedOver === 0) {
      if (validTrades[0].lots === validTrades[1].lots && 
          validTrades[0].type !== validTrades[1].type) {
          isSimpleClosed = true;
          tIn = validTrades[0];
          tOut = validTrades[1];
      }
  } else if (validTrades && validTrades.length === 2 && details.currentTradesDetails?.length === 2 && netPosition === 0) {
      // fallback to currentTradesDetails if validTrades logic didn't match perfectly
      if (details.currentTradesDetails[0].lots === details.currentTradesDetails[1].lots && 
          details.currentTradesDetails[0].type !== details.currentTradesDetails[1].type) {
          isSimpleClosed = true;
          tIn = details.currentTradesDetails[0];
          tOut = details.currentTradesDetails[1];
      }
  }

  let specPoints = 0;
  if (isSimpleClosed) {
      const dir = tIn.type === 'Long' ? 1 : -1;
      specPoints = (tOut.priceInPoints - tIn.priceInPoints) * dir;
  } else {
      if (validTrades && validTrades.length > 0) {
         validTrades.forEach((trade: any) => {
            specPoints += (details.targetPrice - trade.priceInPoints) * (trade.type === 'Long' ? 1 : -1);
         });
      } else if (details.netPosCarriedOver !== 0) {
         specPoints = (details.targetPrice - details.prevSettlePrice);
      }
  }

  let text = `[0] КРАТКАЯ СВОДКА\n`;
  const posText = netPosition === 0 ? `закрыта (было ${isSimpleClosed ? tIn.lots : Math.abs(details.netPosCarriedOver || 0)} лот.)` : `открыта, ${Math.abs(netPosition)} лот.`;
  text += `- Позиция: ${posText}\n`;
  text += `- Контракт: ${uTicker}\n`;
  const periodStartStr = `${currentDateStrFormat}, ${isDealBefore1900 ? 'ДО' : 'ПОСЛЕ'} 19:00`;
  const periodEndStr = (isSimpleClosed && tOut.date) ? `${tOut.date.split('-').reverse().join('.')}, ${tOut.period === 'morning' ? 'ДО' : 'ПОСЛЕ'} 19:00` : periodStartStr;
  text += `- Период: ${periodStartStr} -> ${periodEndStr}\n`;
  text += `- Результат в пунктах: ${specPoints > 0 ? '+' : ''}${fmtPt(specPoints)} пт.\n`;
  // Total ruble amount
  let finalRub = total;
  if (isSimpleClosed) {
     finalRub = specPoints * pointCost * tIn.lots;
     // Quick fix: if points is 0 but diff mathematically was small enough to truncate to 0, or just exactly 0.
     if (specPoints === 0) finalRub = 0;
  }
  text += `- Итоговая вариационная маржа: ${finalRub > 0 ? '+' : ''}${fmtRub(finalRub)} ₽\n`;
  text += `- Статус: ${isReportBefore1900 ? 'Предварительный (ожидает фиксации 19:00)' : 'Финальный (по зафиксированным данным)'}\n\n`;

  text += `[1] ТАЙМЛАЙН СДЕЛКИ\n`;
  text += `Сделка: ${currentDateStrFormat}, ${isDealBefore1900 ? 'ДО' : 'ПОСЛЕ'} 19:00\n`;
  text += `  |\n  v\n`;
  text += `Фиксация РЦ/ИК: ${currentDateStrFormat}, 19:00\n`;
  text += `  |\n  v\n`;
  text += `Клиринг m-t-m: ${currentDateStrFormat}, 23:50-00:30\n`;
  if (isReportBefore1900) {
      text += `> Курс ещё не зафиксирован. Расчёт предварительный.\n\n`;
  } else {
      text += `> Курс зафиксирован. Расчёт финальный.\n\n`;
  }

  text += `[2] КАК РАБОТАЕТ ВМ В ЕТС (краткая теория)\n`;
  text += `- Биржа каждый день в 19:00 фиксирует:\n`;
  text += `  * Расчётную цену контракта (РЦ)\n`;
  text += `  * Индикативный курс валюты (ИК)\n\n`;
  text += `- Ночной клиринг m-t-m (23:50-00:30) считает разницу:\n`;
  text += `  ВМ = (РЦ_сегодня - РЦ_вчера) * Стоимость_пункта\n\n`;
  text += `- Если позиция закрыта до 19:00 или после 19:00 в день T:\n`;
  text += `  > Для расчёта ВМ используется ИК, зафиксированный в 19:00 этого же дня (дня T)\n\n`;
  text += `- Важное уточнение:\n`;
  text += `  * Индикативный курс рассчитывается непрерывно в течение дня (для отображения в терминале)\n`;
  text += `  * Но для официального расчёта ВМ в клиринге используется ТОЛЬКО зафиксированное значение в 19:00\n`;
  text += `  * Если отчёт формируется до 19:00, курс ещё не зафиксирован — используется последний доступный фиксированный курс\n\n`;

  text += `[3] ПАРАМЕТРЫ КОНТРАКТА ${uTicker}\n`;
  text += `- Базовый актив: ${baseAsset}\n`;
  text += `- Номинал: ${currency}\n`;
  text += `- Минимальный шаг цены (R): ${fmtPt(details.minStep)} пункта\n`;
  if (currency === 'USD' && stepCostUsd && ik) {
    text += `- Индикативный курс (ИК): ${fmtCost(ik)} ₽/$ (фиксация Биржи от ${currentDateStrFormat} 19:00 МСК)\n`;
    text += `- Стоимость 1 пункта: (${fmtCost(stepCostUsd)} $ * ${fmtCost(ik)}) / ${fmtPt(details.minStep)} = ${fmtPoint(pointCost)} ₽/пт.\n\n`;
  } else {
    text += `- Стоимость 1 пункта фиксирована: ${fmtPoint(pointCost)} ₽/пт. (ИК не применяется)\n\n`;
  }

  text += `[4] ПОЧЕМУ ИСПОЛЬЗОВАН ИМЕННО ЭТОТ ИНДИКАТИВНЫЙ КУРС?\n`;
  text += `- Сделка совершена: ${isDealBefore1900 ? 'ДО' : 'ПОСЛЕ'} 19:00 (${currentDayStr.toLowerCase()})\n`;
  if (!isDealBefore1900) {
    text += `- Вечерняя сессия относится к тому же торговому дню, поэтому используется ИК, зафиксированный в 19:00 этого дня.\n`;
  }
  text += `- Индикативный курс для клиринга фиксируется в 19:00 каждого торгового дня\n`;
  text += `- На момент формирования отчёта курс ${isReportBefore1900 ? 'ещё не зафиксирован' : 'уже зафиксирован'}\n`;
  text += `- Поэтому для расчёта использован: ИК ${currentDateStrFormat} 19:00 МСК\n\n`;
  if (isReportBefore1900) {
    text += `> Расчёт является предварительным. Окончательная сумма ВМ будет определена после фиксации индикативного курса в 19:00. Текущее значение показано на основе последнего доступного фиксированного курса.\n\n`;
  }

  text += `[5] ВАШ РАСЧЁТ ПО ШАГАМ\n\n`;
  text += `5.1. Исходные данные:\n`;
  
  if (isSimpleClosed) {
      text += `- Цена входа (Pвх): ${fmtPt(tIn.priceInPoints)} пт.\n`;
      text += `- Цена выхода (Pвых): ${fmtPt(tOut.priceInPoints)} пт.\n`;
      text += `- Направление: ${tIn.type === 'Long' ? 'Покупка (Лонг)' : 'Продажа (Шорт)'}\n`;
      text += `- Количество лотов: ${tIn.lots}\n`;
      text += `- Стоимость 1 пункта (Кпт): ${fmtPoint(pointCost)} ₽/пт.\n\n`;

      text += `5.2. Формула вариационной маржи (из Спецификации, п.2.1.2):\n`;
      text += `Если позиция открыта и закрыта в один день:\n`;
      text += `Для Покупки (Лонг): ВМ = (Цена выхода - Цена входа) * Кпт * лоты\n`;
      text += `Для Продажи (Шорт): ВМ = (Цена входа - Цена выхода) * Кпт * лоты\n`;
      text += `> Примечание: согласно методике Биржи, стоимость пункта округляется до 5 знаков после запятой, итоговая ВМ — до копеек.\n\n`;

      const pIn = tIn.priceInPoints;
      const pOut = tOut.priceInPoints;
      const dir = tIn.type === 'Long' ? 1 : -1;
      const pointDiff = specPoints;

      text += `5.3. Подстановка значений:\n`;
      if (dir === 1) {
          text += `Шаг 1: Разница в пунктах = ${fmtPt(pOut)} - ${fmtPt(pIn)} = ${pointDiff > 0 ? '+' : ''}${fmtPt(pointDiff)} пт. (для лонга)\n`;
      } else {
          text += `Шаг 1: Разница в пунктах = ${fmtPt(pIn)} - ${fmtPt(pOut)} = ${pointDiff > 0 ? '+' : ''}${fmtPt(pointDiff)} пт. (для шорта)\n`;
      }
      if (currency === 'USD' && stepCostUsd && ik) {
          text += `Шаг 2: Стоимость 1 пункта = (${fmtCost(stepCostUsd)} $ * ${fmtCost(ik)}) / ${fmtPt(details.minStep)} = ${fmtPoint(pointCost)} ₽/пт.\n`;
      } else {
          text += `Шаг 2: Стоимость 1 пункта = ${fmtCost(details.stepPrice)} ₽ / ${fmtPt(details.minStep)} = ${fmtPoint(pointCost)} ₽/пт.\n`;
      }
      text += `Шаг 3: Итого = ${fmtPt(Math.abs(pointDiff))} пт. * ${fmtPoint(pointCost)} ₽/пт. * ${tIn.lots} лот. = ${finalRub > 0 ? '+' : ''}${fmtRub(finalRub)} ₽\n\n`;

  } else {
      text += `- Расчётная цена предыдущего дня (РЦп): ${fmtPt(details.prevSettlePrice)} пт. (если применимо)\n`;
      text += `- Текущая расчётная цена (РЦт): ${fmtPt(details.targetPrice)} пт.\n`;
      text += `- Стоимость 1 пункта (Кпт): ${fmtPoint(pointCost)} ₽/пт.\n\n`;

      text += `5.2. Формула вариационной маржи (из Спецификации, п.2.1.2):\n`;
      text += `Если позиция открыта или перенесена:\n`;
      text += `Для Покупки (Лонг): ВМ = (РЦт - РЦп) * Кпт * лоты\n`;
      text += `Для Продажи (Шорт): ВМ = (РЦп - РЦт) * Кпт * лоты\n`;
      text += `> Примечание: согласно методике Биржи, стоимость пункта округляется до 5 знаков после запятой, итоговая ВМ — до копеек.\n\n`;

      text += `5.3. Подстановка значений:\n`;
      text += `Шаг 1: Стоимость 1 пункта = ${fmtCost(details.stepPrice)} ₽ / ${fmtPt(details.minStep)} = ${fmtPoint(pointCost)} ₽/пт.\n\n`;
      
      let stepCounter = 2;
      let finalCalcRub = 0;
      if (validTrades && validTrades.length > 0) {
          text += `Шаг ${stepCounter++}: Внутридневные сделки\n`;
          validTrades.forEach((trade: any, idx: number) => {
             const dir = trade.type === 'Long' ? 1 : -1;
             const diff = (details.targetPrice - trade.priceInPoints) * dir;
             let val = diff * trade.lots * pointCost;
             if (diff === 0) val = 0;
             finalCalcRub += val;
             text += `  Сделка #${idx + 1} (${trade.type === 'Long' ? 'Покупка' : 'Продажа'} ${trade.lots} лот. по ${fmtPt(trade.priceInPoints)} пт.):\n`;
             if (dir === 1) {
                 text += `  Разница: ${fmtPt(details.targetPrice)} - ${fmtPt(trade.priceInPoints)} = ${diff > 0 ? '+' : ''}${fmtPt(diff)} пт.\n`;
             } else {
                 text += `  Разница: ${fmtPt(trade.priceInPoints)} - ${fmtPt(details.targetPrice)} = ${diff > 0 ? '+' : ''}${fmtPt(diff)} пт.\n`;
             }
             text += `  ВМ = ${fmtPt(Math.abs(diff))} пт. * ${fmtPoint(pointCost)} ₽/пт. * ${trade.lots} лот. = ${val > 0 ? '+' : ''}${fmtRub(val)} ₽\n`;
          });
          text += `\n`;
      }
      
      if (details.netPosCarriedOver !== 0) {
          text += `Шаг ${stepCounter++}: Перенесённая позиция (${details.netPosCarriedOver > 0 ? 'Лонг' : 'Шорт'}, ${Math.abs(details.netPosCarriedOver)} лот.)\n`;
          const pnlPnts = (details.targetPrice - details.prevSettlePrice) * (details.netPosCarriedOver > 0 ? 1 : -1);
          let pnl = pnlPnts * Math.abs(details.netPosCarriedOver) * pointCost;
          if (pnlPnts === 0) pnl = 0;
          finalCalcRub += pnl;
          if (details.netPosCarriedOver > 0) {
              text += `  Разница: ${fmtPt(details.targetPrice)} - ${fmtPt(details.prevSettlePrice)} = ${pnlPnts > 0 ? '+' : ''}${fmtPt(pnlPnts)} пт.\n`;
          } else {
              text += `  Разница: ${fmtPt(details.prevSettlePrice)} - ${fmtPt(details.targetPrice)} = ${pnlPnts > 0 ? '+' : ''}${fmtPt(pnlPnts)} пт.\n`;
          }
          text += `  ВМ = ${fmtPt(Math.abs(pnlPnts))} пт. * ${fmtPoint(pointCost)} ₽/пт. * ${Math.abs(details.netPosCarriedOver)} лот. = ${pnl > 0 ? '+' : ''}${fmtRub(pnl)} ₽\n\n`;
      }
      
      if (isPerp && details.fundingTotal !== 0) {
          text += `Шаг ${stepCounter++}: Фандинг (комиссия/начисление)\n`;
          text += `  ВМ = ${details.fundingTotal > 0 ? '+' : ''}${fmtRub(details.fundingTotal)} ₽\n\n`;
          finalCalcRub += details.fundingTotal;
      }

      text += `Итоговая ВМ = ${finalCalcRub > 0 ? '+' : ''}${fmtRub(finalCalcRub)} ₽ <- ИТОГ\n\n`;
  }

  text += `[6] ИТОГ И ДОСТУПНОСТЬ СРЕДСТВ\n`;
  text += `- Рассчитанная вариационная маржа: ${finalRub > 0 ? '+' : ''}${fmtRub(finalRub)} ₽\n`;
  text += `- Направление: ${finalRub > 0 ? 'зачисление Вам' : (finalRub < 0 ? 'списание с Вас' : 'изменений нет')}\n`;
  text += `- Клиринг m-t-m: ${currentDateStrFormat} 23:50-00:30 МСК\n`;
  text += `- Средства начисляются/списываются в клиринг и сразу доступны для торговли.\n\n`;

  text += `[7] ЧАСТЫЕ ВОПРОСЫ (блок для обучения клиента)\n\n`;
  text += `В: Почему в отчёте указан курс вчерашнего дня, если сделка сегодня?\n`;
  text += `О: Индикативный курс для официального расчёта ВМ фиксируется в 19:00. Если сделка закрыта до 19:00, а отчёт сформирован до фиксации, используется последний доступный фиксированный курс. Если отчёт сформирован после 19:00 — используется курс, зафиксированный в 19:00 текущего дня. Это обеспечивает точность расчёта.\n\n`;
  
  text += `В: Чем отличается предварительный и финальный расчёт?\n`;
  text += `О: Предварительный - до 19:00, использует последний фиксированный курс. Финальный - после 19:00, использует курс, зафиксированный в 19:00 текущего дня. Разница обычно составляет копейки.\n\n`;
  
  text += `В: Почему моя прибыль в пунктах не совпадает с рублями?\n`;
  text += `О: Потому что стоимость пункта привязана к иностранной валюте и зависит от индикативного курса. Формула: (пункты) * (Стоимость шага * курс / мин. шаг) = рубли.\n\n`;
  
  text += `В: Когда деньги появятся на счёте?\n`;
  text += `О: Вариационная маржа рассчитывается в клиринг 23:50-00:30. Средства зачисляются/списываются сразу после клиринга и доступны для торговли.\n`;

  return text;
}



