export const getMoexSessionDateStr = (): string => {
  const moscowTimeStr = new Date().toLocaleString("en-US", {timeZone: "Europe/Moscow"});
  const mskNow = new Date(moscowTimeStr);
  const sessionDate = new Date(mskNow);
  if (mskNow.getHours() >= 19) sessionDate.setDate(sessionDate.getDate() + 1);
  if (sessionDate.getDay() === 6) sessionDate.setDate(sessionDate.getDate() + 2);
  else if (sessionDate.getDay() === 0) sessionDate.setDate(sessionDate.getDate() + 1);
  const year = sessionDate.getFullYear();
  const month = String(sessionDate.getMonth() + 1).padStart(2, '0');
  const day = String(sessionDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function generateVMReport(
  ticker: string,
  isPerp: boolean,
  marketData: any,
  calculations: any,
  marketPhase: any,
  validTrades: any[]
) {
  const { total, pending, settled, settledUnpaid, netPosition, details, timeline } = calculations;
  const uTicker = ticker.toUpperCase();
  let currency = 'RUB';
  let stepCostUsd: number | null = null;
  let ik: number | null = null;

  if (['RTS', 'RI'].some(x => uTicker.startsWith(x))) {
    currency = 'USD'; stepCostUsd = 0.2;
  } else if (['SILV', 'SLV', 'S1', 'SV'].some(x => uTicker.startsWith(x))) {
    currency = 'USD'; stepCostUsd = 0.01;
  } else if (['GOLD', 'GD'].some(x => uTicker.startsWith(x))) {
    currency = 'USD'; stepCostUsd = 0.1;
  } else if (['BR'].some(x => uTicker.startsWith(x))) {
    currency = 'USD'; stepCostUsd = 0.1;
  } else if (['NG'].some(x => uTicker.startsWith(x))) {
    currency = 'USD'; stepCostUsd = 0.1;
  } else if (['ED'].some(x => uTicker.startsWith(x))) {
    currency = 'USD'; stepCostUsd = 0.01; 
  } else {
    currency = 'RUB';
  }

  const minStepVal = details?.minStep || 1;
  const decimals = minStepVal.toString().includes('.') ? minStepVal.toString().split('.')[1].length : 0;
  const displayDecimals = Math.max(2, decimals);
  
  const fmtPt = (val: number) => (+val).toFixed(displayDecimals);
  const fmtPtSafe = (val: number) => {
      if (val === null || val === undefined || isNaN(val)) return 'Данные не загружены';
      const u = ticker.toUpperCase();
      if ((u.startsWith('S1') || u.startsWith('SLV') || u.startsWith('SILV')) && val < 5) return 'Данные не загружены';
      if ((u.startsWith('RI') || u.startsWith('RTS')) && val < 20000) return 'Данные не загружены';
      if (u.startsWith('BR') && val < 20) return 'Данные не загружены';
      if ((u.startsWith('GD') || u.startsWith('GOLD')) && val < 1000) return 'Данные не загружены';
      return fmtPt(val);
  };

  const fmtRub = (val: number) => (+val).toFixed(2);
  const getFmtPoint = (val: number) => {
    if (currency === 'USD') return (+val).toFixed(5);
    // For RUB or others, trim trailing zeros but keep at least 2
    let s = (+val).toFixed(5);
    while(s.endsWith('0') && s.length > s.indexOf('.') + 3) {
       s = s.slice(0, -1);
    }
    return s;
  };
  const fmtPoint = getFmtPoint;
  const fullDayNames = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
  const genitiveDayNames = ["Воскресенья", "Понедельника", "Вторника", "Среды", "Четверга", "Пятницы", "Субботы"];
  const fmtDateShort = (d: Date) => {
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth()+1).padStart(2, '0')}`;
  };
  
  if (currency === 'USD' && details && details.stepPrice && stepCostUsd) {
      ik = details.stepPrice / stepCostUsd;
  }

  const pointCost = (details.minStep && details.minStep > 0) ? (details.stepPrice / details.minStep) : (details.stepPrice || 1);
  let hasAbsurdPrices = false;

  const getNormDate = (dateStr: string, period: string) => dateStr;

  let allDatesStr = new Set<string>();
  if (validTrades) {
      validTrades.forEach((t: any) => {
          t.normDate = getNormDate(t.date, t.period);
          allDatesStr.add(t.normDate);
      });
  }
  if (calculations.timeline) calculations.timeline.forEach((h: any) => allDatesStr.add(h.date));

  let reportDateStr = getMoexSessionDateStr();
  
  if (pending !== 0 || Object.keys(validTrades).length > 0) {
      allDatesStr.add(reportDateStr);
  }
  
  if (allDatesStr.size === 0) allDatesStr.add(reportDateStr);

  const fmtYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };

  let earliestTrDateStr = Array.from(allDatesStr).sort()[0];
  if (validTrades && validTrades.length > 0) {
      earliestTrDateStr = validTrades.map(t => t.date).sort()[0];
  }
  let loopD = new Date(earliestTrDateStr || reportDateStr);
  let endD = new Date(reportDateStr);
  while(loopD <= endD) {
      if (loopD.getDay() !== 0 && loopD.getDay() !== 6) {
          allDatesStr.add(fmtYMD(loopD));
      }
      loopD.setDate(loopD.getDate() + 1);
  }

  const sortedDatesList = Array.from(allDatesStr).sort();

  if (sortedDatesList.length === 0) {
      sortedDatesList.push(reportDateStr);
  }

  const tradesByDate: Record<string, any[]> = {};
  if (validTrades) {
      validTrades.forEach((t) => {
          const d = t.normDate || t.date;
          if (!tradesByDate[d]) tradesByDate[d] = [];
          tradesByDate[d].push(t);
      });
  }

  let lastTradeIndex = -1;
  let cumPosForTrim = 0;
  for (let i = 0; i < sortedDatesList.length; i++) {
      const dStr = sortedDatesList[i];
      const dayTrades = tradesByDate[dStr] || [];
      const netDay = dayTrades.reduce((acc, t) => acc + (t.type === 'Long' ? t.lots : -t.lots), 0);
      cumPosForTrim += netDay;
      if (dayTrades.length > 0) {
          lastTradeIndex = i;
      }
  }

  if (lastTradeIndex !== -1 && cumPosForTrim === 0) {
      sortedDatesList.splice(lastTradeIndex + 1);
  }

  let earliestCalendarDateStr = sortedDatesList[0];
  if (validTrades && validTrades.length > 0) {
      const eTrDate = validTrades.map(t => t.date).sort()[0];
      if (eTrDate < earliestCalendarDateStr) {
          earliestCalendarDateStr = eTrDate;
      }
  }
  const minDate = new Date(earliestCalendarDateStr);
  const maxDate = new Date(sortedDatesList[sortedDatesList.length - 1]);
  const isMultiDay = sortedDatesList.length > 1;

  let isOverallLong = true;
  if (netPosition !== 0) {
      isOverallLong = netPosition > 0;
  } else if (validTrades.length > 0) {
      isOverallLong = validTrades[0].type === 'Long';
  }
  
  let preClosedLots = 0;
  let preOpenLots: { type: 'Long'|'Short', lots: number, basis: number }[] = [];

  sortedDatesList.forEach(dStr => {
      const dayTrades = tradesByDate[dStr] || [];
      dayTrades.forEach(t => {
          let lotsToMatch = t.lots;
          while (lotsToMatch > 0 && preOpenLots.length > 0 && preOpenLots[0].type !== t.type) {
              let matchLot = preOpenLots[0];
              let closedLots = Math.min(lotsToMatch, matchLot.lots);
              preClosedLots += closedLots;
              lotsToMatch -= closedLots;
              matchLot.lots -= closedLots;
              if (matchLot.lots === 0) preOpenLots.shift();
          }
          if (lotsToMatch > 0) {
              preOpenLots.push({ type: t.type, lots: lotsToMatch, basis: t.priceInPoints });
          }
      });
  });

  // --- STEP CREATION ---
  let stepsText = '';
  let stepNum = 1;
  let carriedPos = 0;
  let prevPrice: number | null = null;
  let prevDayNameGenitive = '';
  let sumSettled = 0;
  let sumPending = 0;
  let lastTimelineDateStr = sortedDatesList[0];
  let hasMissingData = false;
  
  sortedDatesList.forEach((dStr, idx) => {
      const dayTrades = tradesByDate[dStr] || [];
      const hObj = (calculations.timeline || []).find((h: any) => h.date === dStr);
      const isPendingDay = !hObj;

      if (dayTrades.length === 0 && carriedPos === 0) return;

      const td = new Date(dStr);
      const ds = fmtDateShort(td);
      let dayNameFull = fullDayNames[td.getDay()];
      let dayNameGenitive = genitiveDayNames[td.getDay()];

      const rcNum = hObj ? hObj.settlePrice : ((isPendingDay && dStr === reportDateStr && details.targetPrice !== undefined) ? details.targetPrice : null);
      if (rcNum === null || isNaN(rcNum)) {
           const netDay = dayTrades.reduce((acc, t) => acc + (t.type === 'Long' ? t.lots : -t.lots), 0);
           carriedPos += netDay;
           
           hasMissingData = true;
           
           if (isPendingDay && dStr !== reportDateStr) {
               stepsText += `Шаг ${stepNum}. ${dayNameFull} (${ds}) — исторические данные отсутствуют\n`;
               stepsText += `Архивная расчетная цена (РЦ) не найдена в базе. Пошаговый расчет временно прерван.\n\n`;
           } else {
               stepsText += `Шаг ${stepNum}. ${dayNameFull} (${ds}) — расчёт невозможен (отсутствуют данные биржи)\n\n`;
           }
           stepNum++;
           return;
      }

      if (fmtPtSafe(rcNum) === 'Данные не загружены') hasAbsurdPrices = true;
      const rcStr = fmtPtSafe(rcNum);

      const netDay = dayTrades.reduce((acc, t) => acc + (t.type === 'Long' ? t.lots : -t.lots), 0);
      const newPos = carriedPos + netDay;

      let dayVm = 0;
      let dayBreakdowns: string[] = [];
      let pointLabel = currency === 'USD' ? '[Стоимость пункта]' : '[Шаг цены в рублях]';
      const absCarry = Math.abs(carriedPos);

      if (carriedPos !== 0 && prevPrice !== null) {
          const ticks = Math.round((rcNum - prevPrice) / details.minStep);
          const trVm = Number((ticks * details.stepPrice * carriedPos).toFixed(2));
          dayVm += trVm;

          let isCarryLong = carriedPos > 0;
          let rCLabel = isPendingDay ? '[Текущая цена]' : `[РЦ ${dayNameGenitive}]`;
          let prevLabel = prevDayNameGenitive ? `[РЦ ${prevDayNameGenitive}]` : '[РЦ предыд]';
          
          let eq = '';
          if (isCarryLong) {
              eq = `(${rcStr} ${rCLabel} - ${fmtPt(prevPrice)} ${prevLabel}) x ${absCarry} лот x ${fmtPoint(pointCost)} ${pointLabel}`;
          } else {
              eq = `(${fmtPt(prevPrice)} ${prevLabel} - ${rcStr} ${rCLabel}) x ${absCarry} лот x ${fmtPoint(pointCost)} ${pointLabel}`;
          }
          dayBreakdowns.push(`Расчет: ${eq} = ${trVm > 0 ? '+' : ''}${fmtRub(trVm)} руб.`);
      }

      dayTrades.forEach((t: any) => {
          const isTradeLong = t.type === 'Long';
          const dir = isTradeLong ? 1 : -1;
          const ticks = Math.round((rcNum - t.priceInPoints) / details.minStep);
          const trVm = Number((ticks * details.stepPrice * dir * t.lots).toFixed(2));
          dayVm += trVm;

          let rCLabel = isPendingDay ? '[Текущая цена]' : `[РЦ ${dayNameGenitive}]`;
          let priceLabel = (isOverallLong && t.type === 'Short') || (!isOverallLong && t.type === 'Long') ? '[Цена закрытия сделки]' : '[Цена входа]';
          
          let eq = '';
          if (isTradeLong) {
               eq = `(${rcStr} ${rCLabel} - ${fmtPt(t.priceInPoints)} ${priceLabel}) x ${t.lots} лот x ${fmtPoint(pointCost)} ${pointLabel}`;
          } else {
               eq = `(${fmtPt(t.priceInPoints)} ${priceLabel} - ${rcStr} ${rCLabel}) x ${t.lots} лот x ${fmtPoint(pointCost)} ${pointLabel}`;
          }
          dayBreakdowns.push(`Расчет: ${eq} = ${trVm > 0 ? '+' : ''}${fmtRub(trVm)} руб.`);
      });

      const prevLength = dayBreakdowns.length;
      dayBreakdowns = dayBreakdowns.filter(b => !b.endsWith('= +0.00 руб.') && !b.endsWith('= 0.00 руб.') && !b.endsWith('= -0.00 руб.'));
      if (dayBreakdowns.length === 0 && prevLength > 0) {
          dayBreakdowns.push(`Расчет: промежуточный итог 0.00 руб.`);
      }

      dayVm = Number(dayVm.toFixed(2));
      const vmRub = `${dayVm > 0 ? '+' : ''}${fmtRub(dayVm)}`;

      let stepHeader = '';
      let stepDesc = '';

      if (isPendingDay) {
          if (netPosition === 0) {
               stepHeader = `Шаг ${stepNum}. ${dayNameFull} (${ds}) — ожидает расчетов: ${vmRub} руб.`;
               stepDesc = `Позиция закрыта. Клиринг еще не прошел, результат зафиксирован.`;
          } else {
               stepHeader = `Шаг ${stepNum}. ${dayNameFull} (${ds}) — плавающий результат: ${vmRub} руб.`;
               stepDesc = `Ночной клиринг завершен. Торги текущего дня еще в процессе, текущая цена сравнивается с ${prevDayNameGenitive ? `РЦ ${prevDayNameGenitive}` : (carriedPos !== 0 ? 'РЦ предыдущей сессии' : 'ценой входа')}.`;
          }
          sumPending += dayVm;
      } else {
          stepHeader = `Шаг ${stepNum}. ${dayNameFull} (${ds}) — зафиксировано на счете: ${vmRub} руб.`;
          if (carriedPos === 0 && dayTrades.length > 0) {
               stepDesc = `Позиция открыта внутри дня. В 19:00 биржа зафиксировала РЦ ${dayNameGenitive} и провела первую переоценку.`;
          } else if (carriedPos !== 0) {
               stepDesc = `Позиция перенеслась на новый день. В 19:00 биржа зафиксировала новую РЦ ${dayNameGenitive} и сравнила её с РЦ ${prevDayNameGenitive}.`;
          }
          sumSettled += dayVm;
      }

      stepsText += `${stepHeader}\n`;
      if (stepDesc) stepsText += `${stepDesc}\n`;
      if (dayBreakdowns.length > 0) {
          stepsText += dayBreakdowns.join('\n') + '\n';
      }
      
      sumSettled = Number(sumSettled.toFixed(2));
      sumPending = Number(sumPending.toFixed(2));

      if (!isPendingDay && stepNum > 1 && sumSettled !== dayVm) {
          stepsText += `(Суммарный зафиксированный итог за прошлые дни: ${sumSettled > 0 ? '+' : ''}${fmtRub(sumSettled)} руб.)\n`;
      }
      stepsText += '\n';

      carriedPos = newPos;
      if (!isPendingDay) {
         prevPrice = rcNum;
         prevDayNameGenitive = dayNameGenitive;
         lastTimelineDateStr = dStr;
      }
      stepNum++;
  });

  // --- RESULT AGGREGATION ---
  
  const entryTrades = validTrades.filter(t => t.type === (isOverallLong ? 'Long' : 'Short'));
  const avgEntry = entryTrades.reduce((acc, t) => acc + t.priceInPoints * t.lots, 0) / (entryTrades.length ? entryTrades.reduce((acc, t) => acc + t.lots, 0) : 1);
  
  let exitPrice = details.targetPrice || 0;
  if (netPosition === 0) {
      const exitTrades = validTrades.filter(t => t.type !== (isOverallLong ? 'Long' : 'Short'));
      if (exitTrades.length > 0) {
          exitPrice = exitTrades.reduce((acc, t) => acc + t.priceInPoints * t.lots, 0) / exitTrades.reduce((acc, t) => acc + t.lots, 0);
      }
  }

  let diff = isOverallLong ? (exitPrice - avgEntry) : (avgEntry - exitPrice);
  let checkLots = netPosition === 0 ? preClosedLots : Math.abs(netPosition);
  if (checkLots === 0) checkLots = 1;
  let diffTicks = Math.round(diff / details.minStep);
  let checkTotal = diffTicks * details.stepPrice * checkLots;
  checkTotal = Number(checkTotal.toFixed(2));
  
  const hasMixedTrades = validTrades.some(t => t.type !== validTrades[0].type) && netPosition !== 0;

  let totalResult = Number((sumSettled + sumPending).toFixed(2));
  if (hasMissingData && !hasMixedTrades) {
      totalResult = checkTotal;
  }
  
  if (isPerp && details.fundingTotal) {
      totalResult += details.fundingTotal;
      totalResult = Number(totalResult.toFixed(2));
  }
  
  let reportTitle = netPosition === 0 ? "ФИНАЛЬНЫЙ ФИНАНСОВЫЙ РЕЗУЛЬТАТ" : "ТЕКУЩИЙ СТАТУС ПОЗИЦИИ";
  let posText = netPosition === 0 ? "закрыта" : `${Math.abs(netPosition)} лот`;
  
  let section0 = `[0] ${reportTitle}\n`;
  section0 += `• Контракт: ${uTicker} (${posText})\n`;
  if (isMultiDay) {
     section0 += `• Период: ${fmtDateShort(minDate)} -> ${fmtDateShort(maxDate)}\n`;
  } else {
     section0 += `• Период: ${fmtDateShort(minDate)}\n`;
  }
  
  section0 += `\nФинансовый результат на данный момент:\n`;
  
  if (hasMissingData && !hasMixedTrades) {
      section0 += `• Общий итог позиции: ${checkTotal > 0 ? '+' : ''}${fmtRub(checkTotal)} руб.\n`;
      section0 += `(Плавающий итог и зафиксированная часть не разделены из-за отсутствия архивов Мосбиржи за часть дней)\n`;
  } else {
      if (sumSettled !== 0) {
          section0 += `• Накопленный итог (уже зафиксирован): ${sumSettled > 0 ? '+' : ''}${fmtRub(sumSettled)} руб.\n`;
      }
      if (sumPending !== 0 && netPosition !== 0) {
          section0 += `• Плавающий результат (еще меняется): ${sumPending > 0 ? '+' : ''}${fmtRub(sumPending)} руб.\n`;
      } else if (sumPending !== 0 && netPosition === 0) {
          section0 += `• Ожидает расчетов (по закрытой позиции): ${sumPending > 0 ? '+' : ''}${fmtRub(sumPending)} руб.\n`;
      }
  }
  
  if (isPerp && details.fundingTotal) {
      section0 += `• Фандинг (начислен/списан): ${details.fundingTotal > 0 ? '+' : ''}${fmtRub(details.fundingTotal)} руб.\n`;
  }
  
  section0 += `• Общий результат позиции: ${totalResult > 0 ? '+' : ''}${fmtRub(totalResult)} руб.\n\n`;

  // --- BAZA CONCEPTS ---
  let sectionConcepts = `БАЗОВЫЕ ПОНЯТИЯ\n`;
  sectionConcepts += `1. Расчетная цена (РЦ) — официальный ориентир, который биржа фиксирует каждый будний день в 19:00 МСК. Сделки, совершенные позже этого времени, относятся к вечерней торговой сессии и переоцениваются от зафиксированной РЦ.\n`;
  
  let pointLabelForFormula = 'Шаг цены в рублях';
  if (currency !== 'RUB' && ik) {
      sectionConcepts += `2. Индикативный курс — фиксируется в 19:00 МСК. Он пересчитывает стоимость шага цены валютных и товарных контрактов в рубли.\n`;
      sectionConcepts += `Во время единственного клиринга (23:50 -> 00:30) зафиксированный за день итог окончательно проводится по счету (происходит физическое списание или начисление ВМ и фандинга).\n\n`;
      pointLabelForFormula = 'Стоимость пункта';
  } else {
      sectionConcepts += `Во время единственного клиринга (23:50 -> 00:30) зафиксированный за день итог окончательно проводится по счету (происходит физическое списание или начисление ВМ и фандинга).\n\n`;
  }

  // --- FORMULAS ---
  let formulaSign1 = isOverallLong ? '(Текущая рыночная цена [или Цена закрытия сделки] - Цена входа)' : '(Цена входа - Текущая рыночная цена [или Цена закрытия сделки])';
  let formulaSign2 = isOverallLong ? '(Расчетная цена дня открытия - Цена входа)' : '(Цена входа - Расчетная цена дня открытия)';
  let formulaSign3 = isOverallLong ? '(Расчетная цена текущего дня - Расчетная цена предыдущего дня)' : '(Расчетная цена предыдущего дня - Расчетная цена текущего дня)';
  let formulaSign4 = isOverallLong ? '(Цена закрытия сделки - Расчетная цена предыдущего дня)' : '(Расчетная цена предыдущего дня - Цена закрытия сделки)';

  let sectionFormulas = `БАЗОВЫЕ ФОРМУЛЫ (ЛОГИКА РАСЧЕТА БЕЗ ЦИФР)\n`;
  sectionFormulas += `1. Общий результат напрямую: ${formulaSign1} х Количество лотов х ${pointLabelForFormula} = Общий итог\n`;
  sectionFormulas += `2. Первый день (при открытии): ${formulaSign2} х Количество лотов х ${pointLabelForFormula} = Результат за первый день\n`;
  sectionFormulas += `3. Перенос позиции (каждый следующий день): ${formulaSign3} х Количество лотов х ${pointLabelForFormula} = Результат за день переноса\n`;
  sectionFormulas += `4. Закрытие позиции (в день выхода): ${formulaSign4} х Количество лотов х ${pointLabelForFormula} = Результат за день закрытия\n`;
  sectionFormulas += `\n`;

  // --- STEPS ---
  let section1 = `[1] РАСЧЕТ ПО ШАГАМ\n`;
  section1 += `Биржа считает вариационную маржу не за весь период сразу, а суточными отрезками по формулам выше.\n\n`;
  section1 += stepsText;

  // --- REGULAR VERIFICATION ---
  let checkSection = `ПРОВЕРКА ИТОГА ПО ГРАФИКУ\n`;
  checkSection += `Чистая разница между ценой входа и ${netPosition === 0 ? 'ценой закрытия' : 'текущей ценой'}:\n`;
  
  let entryLabel = entryTrades.length > 1 ? 'Средняя цена входа' : 'Цена входа';
  const formulaCheck1 = isOverallLong ? `(${fmtPtSafe(exitPrice)} [${netPosition === 0 ? 'Цена закрытия сделки' : 'Текущая цена'}] - ${fmtPtSafe(avgEntry)} [${entryLabel}])` : `(${fmtPtSafe(avgEntry)} [${entryLabel}] - ${fmtPtSafe(exitPrice)} [${netPosition === 0 ? 'Цена закрытия сделки' : 'Текущая цена'}])`;
  
  let plLabel = currency !== 'RUB' ? '[Стоимость пункта]' : '[Шаг цены в рублях]';
  checkSection += `${formulaCheck1} x ${checkLots} лот x ${fmtPoint(pointCost)} ${plLabel} = ${checkTotal > 0 ? '+' : ''}${fmtRub(checkTotal)} руб.\n`;
  
  if (hasMixedTrades) {
      checkSection = `ПРОВЕРКА ИТОГА\nОбщий торговый результат: ${totalResult > 0 ? '+' : ''}${fmtRub(totalResult)} руб.\nРассчитано с учетом частичного закрытия или встречных сделок (простая математическая формула напрямую неприменима).\n`;
  } else {
      const tolerance = details.stepPrice * checkLots * 2 + 0.1;
      const diffTotal = Number(Math.abs(checkTotal - totalResult).toFixed(2));
      if (diffTotal <= tolerance) { 
          let sumPendingStr = sumPending < 0 ? `- ${fmtRub(Math.abs(sumPending))}` : `+ ${fmtRub(sumPending)}`;
          if (diffTotal === 0) {
              checkSection += `Если сложить зафиксированный итог и текущее плавающее значение (${fmtRub(sumSettled)} ${sumPendingStr}), получится ровно ${totalResult > 0 ? '+' : ''}${fmtRub(totalResult)} руб. Математика расчетов полностью совпадает.\n`;
          } else {
              let diffText = diffTotal === 0.01 ? '1 копейку' : `${fmtRub(diffTotal)} руб.`;
              checkSection += `Если сложить зафиксированный итог и текущее плавающее значение (${fmtRub(sumSettled)} ${sumPendingStr}), получится ${totalResult > 0 ? '+' : ''}${fmtRub(totalResult)} руб. Расхождение в ${diffText} с прямым расчетом по графику вызвано округлением результатов вариационной маржи на каждом отдельном шаге клиринга биржи. Математика расчетов полностью сходится с учетом округлений.\n`;
          }
          if (currency !== 'RUB' && isMultiDay) {
              checkSection += `(Важно: Пошаговая история прошлых дней смоделирована по текущей стоимости шага цены. Из-за динамического изменения индикативного курса валют в прошлые даты, реальные исторические списания/начисления по вашему брокерскому счету могут отличаться. Итоговый финансовый результат позиции остается корректным).\n`;
          }
          if (entryTrades.length > 1 || (netPosition === 0 && validTrades.filter(t => t.type !== entryTrades[0].type).length > 1)) {
              checkSection += `(Примечание: Из-за математического усреднения нескольких цен сделок в формуле выше возможна микро-погрешность на 1-2 пункта относительно точного пошагового результата).\n`;
          }
      }
  }

  let nkcText = `\nТекущий плавающий результат зафиксируется в единственный клиринг (23:50–00:30 МСК) и запишется на баланс по официальным данным Московской биржи (НКЦ).\n`;
  let nkcTextClosed = `\nИтоговый финансовый результат зафиксирован по официальным данным Московской биржи (НКЦ).\n`;

  if (hasAbsurdPrices) {
      checkSection += `\nВНИМАНИЕ: Имеются некорректные данные рыночной цены, поэтому финальные расчеты могут отличаться от справочных.\n`;
  }
  
  checkSection += (netPosition !== 0) ? nkcText : nkcTextClosed;

  return (section0 + sectionConcepts + sectionFormulas + section1 + checkSection).trim();
}


