from pathlib import Path
p=Path('/mnt/data/cf_latest/public/index.html')
s=p.read_text(encoding='utf-8')
s=s.replace('<p class="page-subtitle">Отдельные параметры и проверка лимитов BlackBit и Winance.</p>','<p class="page-subtitle">Расчёт суммы к получению с учётом комиссий выбранной площадки.</p>')
s=s.replace('        <div class="notice"><strong>Важно</strong><span>Лимиты и торговые комиссии задаются отдельно для каждой площадки. Комиссия вывода единая для BlackBit и Winance: фиксированная и процентная части не меняются между площадками.</span></div>\n','')
s=s.replace('<label class="field-label" for="gross">Сумма до комиссии вывода <span>USDT</span></label>','<label class="field-label" for="gross">Сумма <span>USDT</span></label>')
s=s.replace('<div class="amount-input"><input id="gross" type="number" inputmode="decimal" min="0" step="0.000001" value="100"><span>USDT</span></div>','<div class="amount-input"><input id="gross" type="number" inputmode="decimal" min="0" step="0.000001" value="100"><span>USDT</span></div>\n            <label class="withdraw-fee-toggle"><input id="withdrawFeeIncluded" type="checkbox" checked><span>Включить комиссию в сумму</span></label>')
s=s.replace('<div class="amount-input"><input id="erubUsdtTarget" type="number" min="0" step="0.01" value="500"><span>USDT</span></div>','<div class="amount-input"><input id="erubUsdtTarget" type="number" min="0" step="0.01" value="500"><span>USDT</span></div>\n              <label class="withdraw-fee-toggle"><input id="erubUsdtFeeIncluded" type="checkbox" checked><span>Включить комиссию в сумму</span></label>')
start=s.find('        <div class="tariff-section">')
end=s.find('        </div>\n      </section>\n      <section id="erub"', start)
if start!=-1 and end!=-1:
    s=s[:start]+s[end+len('        </div>\n'):]  # retain section close
s=s.replace('Дополнительные расчёты вывода ERUB</h3><p>Новые направления добавлены отдельно. Существующий расчёт BlackBit / Winance и все тарифы сохранены.</p>','Расчёт вывода ERUB</h3><p>Winance: торговая комиссия 0,2%; вывод USDT — 3 USDT + 1%; перевод RUB на карту — 5%.</p>')
s=s.replace('Оценка по ${erubNumber(target)} USDT после комиссий.', 'Оценка для суммы ${erubNumber(target)} USDT.')
p.write_text(s,encoding='utf-8')

p=Path('/mnt/data/cf_latest/public/app.js'); s=p.read_text(encoding='utf-8')
old='''  const net=feeKnown?Math.max(0,(gross-fixed)/(1+percent/100)):null;
  const fee=net===null?null:gross-net;
'''
new='''  const included=Boolean($("withdrawFeeIncluded")?.checked);
  const net=feeKnown?(included?Math.max(0,(gross-fixed)/(1+percent/100)):gross):null;
  const fee=net===null?null:(fixed+net*percent/100);
  const totalNeeded=net===null?null:net+fee;
'''
s=s.replace(old,new)
s=s.replace('`Комиссия: ${fee.toFixed(2)} USDT`','`Комиссия: ${fee.toFixed(2)} USDT`')
s=s.replace('if(min!==null&&gross+1e-9<min)', 'if(min!==null&&net!==null&&net+1e-9<min)')
s=s.replace('if(max!==null&&gross>max+1e-9)', 'if(max!==null&&net!==null&&net>max+1e-9)')
s=s.replace('Проверка лимита до комиссии · ${platform', 'Проверка лимита по сумме вывода · ${platform')
s=s.replace('Минимум: ${min===null?"не задан":min+" USDT"} · Максимум: ${max===null?"не задан":max.toLocaleString("ru-RU")+" USDT"}.', 'Минимум: ${min===null?"не задан":min+" USDT"} · Максимум: ${max===null?"не задан":max.toLocaleString("ru-RU")+" USDT"}. ${included?"Комиссия внутри введённой суммы.":`Потребуется всего ${totalNeeded?.toFixed(2)||"—"} USDT с комиссией.`}')
s=s.replace('["gross","withdrawExchange"].forEach', '["gross","withdrawExchange","withdrawFeeIncluded"].forEach')
# replace ERUB calc function body calculations in targeted snippets
s=s.replace('''  const target=Math.max(0,Number($("erubUsdtTarget")?.value)||0);
  if(usdt&&target>0){
    // Target is net USDT after Winance trading fee 0.2% and withdrawal fee 3 USDT + 1%.
    const withdrawalFee=3 + target*0.01;
    const requiredBeforeWithdrawal=target + withdrawalFee;
    const beforeTrade=requiredBeforeWithdrawal/(1-0.002);
    put("erubUsdtRate",`${erubNumber(usdt.rate)} USDT / ERUB`);
    put("erubUsdtNeeded",`${erubNumber(beforeTrade/usdt.rate)} ERUB`);
    put("erubUsdtStatus",`Оценка по ${usdt.source}. Цель ${erubNumber(target)} USDT после комиссий. Комиссия вывода ${erubNumber(withdrawalFee)} USDT (3 USDT + 1% от номинала), торговая комиссия 0,20%.`);
''','''  const target=Math.max(0,Number($("erubUsdtTarget")?.value)||0);
  const usdtIncluded=Boolean($("erubUsdtFeeIncluded")?.checked);
  if(usdt&&target>0){
    // Winance trading fee 0.2%; withdrawal fee 3 USDT + 1%.
    const payout=usdtIncluded?Math.max(0,(target-3)/(1.01)):target;
    const withdrawalFee=3+payout*0.01;
    const beforeTrade=(payout+withdrawalFee)/(1-0.002);
    const received=payout;
    put("erubUsdtRate",`${erubNumber(usdt.rate)} USDT / ERUB`);
    put("erubUsdtNeeded",`${erubNumber(beforeTrade/usdt.rate)} ERUB`);
    put("erubUsdtStatus",`Курс: ${usdt.source}. ${usdtIncluded?`Введённая сумма включает комиссии; после комиссий поступит около ${erubNumber(received)} USDT.`:`Цель к получению ${erubNumber(received)} USDT; всего потребуется около ${erubNumber(beforeTrade)} USDT до вывода.`} Торговая комиссия Winance 0,20%; вывод 3 USDT + 1%.`);
''')
s=s.replace('''    const grossRub=included?rubTarget:rubTarget+fee;
    const netRub=included?rubTarget-fee:rubTarget;
''','''    const grossRub=included?rubTarget:rubTarget+fee;
    const netRub=included?rubTarget-fee:rubTarget;
    const erubToSell=grossRub/(rub.rate*(1-0.002));
''')
s=s.replace('`${erubNumber(grossRub/rub.rate)} ERUB`','`${erubNumber(erubToSell)} ERUB`')
s=s.replace('Курс: ${rub.source}.`);','Курс: ${rub.source}; торговая комиссия Winance 0,20% учтена.`);')
s=s.replace('["erubUsdtTarget","erubRubTarget","erubRubFeeIncluded"]','["erubUsdtTarget","erubUsdtFeeIncluded","erubRubTarget","erubRubFeeIncluded"]')
p.write_text(s,encoding='utf-8')
