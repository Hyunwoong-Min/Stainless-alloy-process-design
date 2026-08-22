/* ══════════════════════════════════════════════════════════════
   11. 원료 단가 패널
   ══════════════════════════════════════════════════════════════ */
function renderPrices(){
  const box=$('#priceBox');
  box.innerHTML=`<div class="grp-h"><h3>원료 단가</h3>
    <span class="u">USD / kg 함유원소 · Fe는 스크랩·DRI 기준</span>
    <span class="hint">변경 즉시 3개 강종 원가와 그린 평가에 반영</span></div>
    <div class="fields c13">${Object.keys(S.prices).map(e=>
      `<div class="f"><label>${e}</label>
       <input type="number" step="0.05" min="0" value="${S.prices[e]}" data-price="${e}"
       aria-label="${e} 단가"></div>`).join('')}</div>`;
  box.addEventListener('input',e=>{
    const el=e.target.dataset.price; if(!el) return;
    const v=parseFloat(e.target.value); if(!isFinite(v)||v<0) return;
    S.prices[el]=v; recalc(); refreshOut();
  });
}

/* ══════════════════════════════════════════════════════════════
   12. 설계 문의 — 현재 계산 상태를 읽어 답변
   ══════════════════════════════════════════════════════════════ */
function which(q){
  for(const k of ORDER) if(q.includes(k)) return k;
  if(/fully.?ferrite|완전\s*페라이트|풀\s*페라이트/i.test(q)) return '439';
  if(/semi.?ferrite|반\s*페라이트|세미/i.test(q)) return '430';
  if(/austenit|오스테나이트|300계/i.test(q)) return '304';
  if(/martensit|마르텐사이트/i.test(q)) return '410';
  if(/ferrit|페라이트|400계/i.test(q)) return '430';
  return null;
}
const tbl=(head,rows)=>`<table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

const INTENTS=[
 {kw:['델타','페라이트','delta','δ','응고','열간연성','에지크랙'],ex:['ferrit'],
  fn:(q,k)=>{k=k||'304';const R=S.res[k];
   return `<p><b>${GRADES[k].label}</b> 의 δ-페라이트는 Hammar–Svensson 당량을 Hull 식에 넣어 계산합니다.
   γ 안정성이 온도에 따라 변하므로 경계항 b(T)에 온도 의존성을 두었습니다.</p>
   <pre>Creq = Cr+1.37Mo+1.5Si+2Nb+3Ti      = ${f(R.creq,2)}
Nieq = Ni+22C+14.2N+0.31Mn+Cu       = ${f(R.nieq,2)}
b(T) = 6.7 + (1300 − T)×0.0157
δ%   = 3·[Creq − 0.93·Nieq − b(T)]</pre>
   ${tbl(['온도','b(T)','δ %','의미'],[
     ['1300 ℃ (재가열)',f(bT(1300),2),f(R.dCast,1),'열간압연 연성 — 2~10 % 권장'],
     ['가열로 '+S.g[k].proc.rhfT+' ℃',f(bT(Math.min(S.g[k].proc.rhfT,1300)),2),f(R.dHot,1),'슬라브 소킹 시 잔류량'],
     ['최종소둔 '+S.g[k].proc.crAnnT+' ℃',f(bT(S.g[k].proc.crAnnT),2),R.dFin!==null?f(R.dFin,2):'—',
      R.fam==='austenitic'?'제품 잔류 δ — 1 % 이하 목표':'페라이트 기지이므로 해당 없음']])}
   <p>현재 1300 ℃ 기준 <b>${f(R.dCast,1)} %</b> 로 ${R.dCast<2?'<b>2 % 미만</b> — 완전 오스테나이트 응고 모드가 되어 고온균열 위험이 있습니다. Cr을 올리거나 Ni를 낮추십시오.'
   :R.dCast>10?'<b>10 % 초과</b> — 열간압연 중 δ/γ 계면에서 에지크랙이 발생합니다. Ni·N·Cu 를 올려 Nieq 를 높이십시오.'
   :'적정 범위(2~10 %)입니다. FA 응고모드로 고온균열 저항이 확보됩니다.'}</p>
   <p>WRC-1992 기준 용접부 페라이트수는 <b>FN ${f(R.FN,1)}</b> 입니다 (권장 3~12).</p>`;}},

 {kw:['md30','가공유기','trip','마르텐사이트 변태','α′','알파프라임','자성','자화'],
  fn:(q,k)=>{k=k||'304';const R=S.res[k];
   if(R.fam!=='austenitic') return `<p><b>${GRADES[k].label}</b> 은 ${GRADES[k].famKo}이므로 Md30(가공유기 마르텐사이트) 개념이 적용되지 않습니다.
     대신 Ms = <b>${f(R.msMar,0)} ℃</b> (Andrews 식) 로, 냉각만으로 마르텐사이트가 생성됩니다.
     현재 최종 소둔 ${S.g[k].proc.crAnnT} ℃ 는 Ac1 ${f(R.ac1,0)} ℃ ${S.g[k].proc.crAnnT<R.ac1?'미만이므로 마르텐사이트가 생기지 않습니다':'이상이므로 마르텐사이트 '+f(R.fm*100,0)+' % 가 생성됩니다'}.</p>`;
   return `<p>Md30 은 30 % 변형 시 마르텐사이트가 50 % 생기는 온도입니다. Nohara 식은 결정립도 항을 포함해 공정 영향까지 반영합니다.</p>
   <pre>Md30 = 551 − 462(C+N) − 9.2Si − 8.1Mn − 13.7Cr
        − 29(Ni+Cu) − 18.5Mo − 68Nb − 1.42(ν−8)
     ν = ASTM ${f(R.G,1)} (d = ${f(R.d,1)} µm)
Md30 = ${f(R.md30,1)} ℃      Angel 식(립도항 없음) = ${f(R.md30A,1)} ℃</pre>
   ${tbl(['항','계수 × 함량','기여 ℃'],[
     ['C+N',`462 × ${f(S.g[k].comp.C+S.g[k].comp.N,3)}`,f(-462*(S.g[k].comp.C+S.g[k].comp.N),1)],
     ['Cr',`13.7 × ${f(S.g[k].comp.Cr,2)}`,f(-13.7*S.g[k].comp.Cr,1)],
     ['Ni+Cu',`29 × ${f(S.g[k].comp.Ni+S.g[k].comp.Cu,2)}`,f(-29*(S.g[k].comp.Ni+S.g[k].comp.Cu),1)],
     ['Mn',`8.1 × ${f(S.g[k].comp.Mn,2)}`,f(-8.1*S.g[k].comp.Mn,1)],
     ['Si',`9.2 × ${f(S.g[k].comp.Si,2)}`,f(-9.2*S.g[k].comp.Si,1)]])}
   <p>Md30 = ${f(R.md30,1)} ℃ → 상온 인장 시 30 % 변형점에서 α′ <b>${f(R.V30,1)} %</b> 생성,
   인장강도에 <b>+${f(R.trip,0)} MPa</b> 기여합니다.</p>
   <p>연신율은 Md30 이 약 <b>+10 ℃</b> 부근일 때 최대가 됩니다. TRIP 이 국부 네킹을 지연시키기 때문입니다.
   현재 최적점에서 ${f(Math.abs(R.md30-10),0)} ℃ 벗어나 연신 손실 <b>${f(0.008*Math.pow(R.md30-10,2),1)} %p</b> 입니다.
   ${R.md30>40?'Md30 이 너무 높아 성형 후 자성 발현·시효균열 위험이 있습니다.'
    :R.md30<-40?'Md30 이 너무 낮아 TRIP 효과를 못 쓰고 있습니다. Ni·Cu·N 을 낮추면 강도·연신이 함께 오릅니다.':''}</p>`;}},

 {kw:['감마','γmax','gamma','오스테나이트량'],
  fn:(q,k)=>{k=k||'430';const R=S.res[k],c=S.g[k].comp;
   return `<p><b>${GRADES[k].label}</b> 의 γmax(가열 시 생성 가능한 최대 오스테나이트량)입니다.</p>
   <pre>%γmax = 420C + 470N + 23Ni + 9Cu + 7Mn
        − 11.5Cr − 11.5Si − 12Mo − 47Nb − 49Ti − 52Al + 189
      = ${f(R.gmax,1)} %</pre>
   ${tbl(['γ 안정화','기여','α 안정화','기여'],[
     ['C 420×'+f(c.C,3),f(420*c.C,1),'Cr 11.5×'+f(c.Cr,2),f(-11.5*c.Cr,1)],
     ['N 470×'+f(c.N,3),f(470*c.N,1),'Si 11.5×'+f(c.Si,2),f(-11.5*c.Si,1)],
     ['Ni 23×'+f(c.Ni,2),f(23*c.Ni,1),'Ti 49×'+f(c.Ti,3),f(-49*c.Ti,1)],
     ['Mn 7×'+f(c.Mn,2),f(7*c.Mn,1),'Nb 47×'+f(c.Nb,3),f(-47*c.Nb,1)]])}
   <p>Kaltenhauser 페라이트 인자 <b>KFF = ${f(R.kff,2)}</b> (= Cr+6Si+8Ti+4Mo+2Al−2Mn−4Ni−40(C+N)).
   13.5 미만이면 냉각 중 마르텐사이트가 생겨 용접부·소둔재가 경화됩니다.</p>
   <p>${R.fam==='martensitic'
     ?`410 은 완전 경화가 목적이므로 γmax ≥ 90 % 가 필요합니다. 현재 <b>${f(R.gmax,0)} %</b> — ${R.gmax>=90?'충족':'미달, C 또는 N 을 올리십시오'}.`
     :`430 은 γmax 가 65 % 를 넘으면 마르텐사이트 과다로 연성이 급락합니다. 현재 <b>${f(R.gmax,0)} %</b> — ${R.gmax<=65?'적정':'과다, Cr·Si·Ti·Nb 를 올리십시오'}.`}</p>`;}},

 {kw:['ac1','ac3','변태점','변태온도','임계'],
  fn:(q,k)=>{k=k||'410';const R=S.res[k],p=S.g[k].proc;
   if(R.fam==='austenitic') return `<p>304 는 상온~용융까지 오스테나이트 단상역이므로 Ac1/Ac3 변태점이 존재하지 않습니다.
     대신 δ 용해온도와 σ상 석출역(600~900 ℃)이 소둔 설계 기준이 됩니다.</p>`;
   return `<p><b>${GRADES[k].label}</b> 변태점과 소둔온도의 관계입니다. 이것이 400계 설계의 핵심 분기점입니다.</p>
   <pre>Ac1 = 720 + 12Cr + 25Si + 30Mo + 40Nb + 60Ti + 45Al
      − 25Mn − 30Ni − 15Cu − 250C − 400N   = ${f(R.ac1,0)} ℃
Ac3 = Ac1 + 90 − 200C + 3Cr                 = ${f(R.ac3,0)} ℃</pre>
   ${tbl(['공정','온도 ℃','Ac1 대비','결과'],[
     ['열연 FDT',p.fdt,p.fdt>R.ac1?'초과':'미만',p.fdt>R.ac1?'오스테나이트역 압연':'페라이트역 압연'],
     ['권취 CT',p.ct,p.ct>R.ac1?'초과':'미만',p.ct>R.ac1?'권취 후 변태':'코일 내 템퍼링'],
     ['열연소둔',p.hrAnnT,p.hrAnnT>R.ac1?'초과':'미만',p.hrAnnT>R.ac1?'재경화 — 아임계로 낮출 것':'완전 연화 (구상화)'],
     ['냉연소둔',p.crAnnT,p.crAnnT>R.ac1?'초과':'미만',
      p.crAnnT>R.ac1?`마르텐사이트 ${f(R.fm*100,0)} % → HV ${f(R.HV,0)}`:'완전 연화']])}
   <p>현재 냉연 소둔 <b>${p.crAnnT} ℃</b> 는 Ac1 ${f(R.ac1,0)} ℃ ${p.crAnnT>R.ac1?'을 넘습니다':'미만입니다'}.
   ${p.crAnnT>R.ac1
     ?`오스테나이트로 변태한 부분이 냉각 중 마르텐사이트가 되어 경도 HV ${f(R.HV,0)}, 연신 ${f(R.EL,1)} % 입니다.
        Ms = ${f(R.msMar,0)} ℃ 이므로 상온까지 거의 완전 변태합니다.`
     :`탄화물이 구상화된 연질 페라이트 조직으로 YS ${f(R.YS,0)} MPa, EL ${f(R.EL,1)} % 입니다.
        소둔온도를 Ac1 위로 ${f(R.ac1-p.crAnnT+10,0)} ℃ 만 올려도 물성이 급변하니 조업 편차 관리가 중요합니다.`}</p>`;}},

 {kw:['pren','내식','부식','공식','전위','pitting','염화물'],
  fn:(q,k)=>{const ks=k?[k]:ORDER;
   return `<p>공식전위는 PREN 을 기본항으로 하고, 조직·개재물 인자를 감점으로 반영합니다.</p>
   <pre>PREN = Cr + 3.3Mo + 16N
Epit = −75 + 21·PREN + 계열보정 + ΔS + Δ예민화 + ΔTi + Δ결정립</pre>
   ${tbl(['강종','PREN','기본항','계열','ΔS','Δ예민화','Δ립경','Epit mV'],
     ks.map(g=>{const R=S.res[g];return [GRADES[g].label,f(R.pren,1),f(-75+21*R.pren,0),
       f(R.famOff,0),f(R.dS,0),f(R.dSens,0),f(R.dGr,0),`<b>${f(R.Ep,0)}</b>`];}))}
   <p>계열보정은 기지상 차이입니다 — 오스테나이트 0, 페라이트 −50, 마르텐사이트 −60 mV.
   같은 PREN 이어도 BCC 기지는 Cr 확산이 빨라 국부 결핍이 쉽고, 마르텐사이트는 격자 변형으로 부동태 피막이 불안정합니다.</p>
   <p>ΔS 는 MnS 개재물 항입니다: <code>ΔS = −60·(log₁₀S% + 3.7)</code>.
   S 를 ${(S.g[ks[0]].comp.S*1e4).toFixed(0)} ppm 에서 절반으로 낮추면 Epit 이 약 <b>+18 mV</b> 개선되지만
   심탈황 비용이 <b>+${f(45*L10(2),0)} USD/t</b> 발생합니다.</p>
   ${tbl(['강종','icrit mA/cm²','판정'],ks.map(g=>{const R=S.res[g];
     return [GRADES[g].label,f(R.ic,2),R.ic<2?'부동태화 용이':R.ic<8?'보통':'난부동태'];}))}
   <p>임계전류밀도는 <code>log icrit = 5.35 − 0.105Cr − 0.16Mo − 0.22Cu − 0.045Ni − 0.06Si + 1.6C + 0.010·DOS</code>
   로, Cu 와 Mo 의 계수가 가장 큽니다. Cu 0.3 % 추가는 icrit 을 약 20 % 낮춥니다.</p>`;}},

 {kw:['예민화','sensitiz','입계','dos','cr결핍','크롬결핍','안정화','ti','nb','탄화물'],
  fn:(q,k)=>{k=k||'430';const R=S.res[k],c=S.g[k].comp;
   return `<p><b>${GRADES[k].label}</b> 의 입계 Cr 결핍(예민화) 평가입니다.</p>
   <pre>Ti → N 우선 고정(TiN, Ti/N = 3.42) → 잔여 Ti 가 C 고정(TiC, Ti/C = 4.0)
Nb → 잔여 C 고정 (NbC, Nb/C = 7.75)
Ceff = ${f(R.Ceff,4)} %   Neff = ${f(R.Neff,4)} %
고용 C = ${f(R.dosC,4)} %  (${R.fam==='austenitic'?'γ 중 전량 고용':'ferrite 고용도 한계 적용'})
850→550 ℃ 체류 ${f(R.tCool,0)} s  vs  TTS 노즈 ${f(R.tNose,1)} s
DOS = ${f(R.DOS,0)} / 100  →  Epit ${f(R.dSens,0)} mV</pre>
   <p>${R.fam==='austenitic'
     ? `오스테나이트는 C 확산이 느려 노즈시간이 ${f(R.tNose,0)} s 로 깁니다. 연속소둔의 급냉으로 대부분 회피됩니다.
        C 를 0.03 % 이하(L 급)로 낮추면 노즈시간이 약 10배 길어집니다.`
     : `페라이트는 C 확산이 오스테나이트의 약 100배로 빨라 노즈시간이 <b>${f(R.tNose,1)} s</b> 에 불과합니다.
        급냉만으로는 회피가 불가능하고, <b>Ti·Nb 안정화</b>가 유일한 해법입니다.`}</p>
   <p>완전 안정화에 필요한 양: Ti ≥ ${f(3.42*c.N+4*Math.max(0,c.C-c.Nb/7.75),3)} % 또는
   Nb ≥ ${f(7.75*R.Ceff,3)} %. 현재 Ti ${f(c.Ti,3)} / Nb ${f(c.Nb,3)} %.
   ${R.Ceff>0.005?`<b>${f(R.Ceff,4)} % 의 C 가 미고정</b> 상태입니다.`:'C 가 충분히 고정되어 있습니다.'}</p>
   <p>단, Ti 안정화는 TiN 개재물이 공식 기점이 되어 <code>ΔTi = −100·max(0, Ti−0.05)</code> 만큼 Epit 을 깎습니다.
   Nb 안정화(441계)가 표면품질과 내식성 양쪽에서 유리하지만 FeNb 단가가 $${S.prices.Nb}/kg 으로 FeTi 의 ${f(S.prices.Nb/S.prices.Ti,1)}배입니다.</p>`;}},

 {kw:['결정립','립경','grain','astm','hall','petch','소둔온도','소둔속도','재결정'],
  fn:(q,k)=>{k=k||'304';const R=S.res[k],p=S.g[k].proc;
   return `<p><b>${GRADES[k].label}</b> 의 결정립 이력입니다. 소둔온도·속도가 물성으로 이어지는 주 경로입니다.</p>
   <pre>d^n − d₀^n = k₀·exp(−Q/RT)·t·Z      n = ${GG[R.fam==='austenitic'?'austenitic':'ferritic'].n},
Q = ${GG[R.fam==='austenitic'?'austenitic':'ferritic'].Q/1000} kJ/mol,  Z(Zener 핀닝) = ${f(R.pin,2)}
소둔 유효시간 t = 45 m ÷ 라인속도</pre>
   ${tbl(['단계','조건','입경 µm','ASTM'],[
     ['열연판',`FDT ${p.fdt} ℃, CT ${p.ct} ℃`,f(R.dHB,1),f(astmG(R.dHB),1)],
     ['열연소둔 후',`${p.hrAnnT} ℃ × ${f(R.tHR,0)} s`,f(R.dHRA,1),f(astmG(R.dHRA),1)],
     ['냉연 재결정',`압하율 ${f(R.crRed,1)} %`,f(R.d0,1),f(astmG(R.d0),1)],
     ['최종',`${p.crAnnT} ℃ × ${f(R.tCR,0)} s`,`<b>${f(R.d,1)}</b>`,`<b>${f(R.G,1)}</b>`]])}
   <p>Hall–Petch 기여: ${R.fam==='austenitic'
     ?`Pickering 식의 <code>0.46·d^−½</code> 항 = <b>${f(15.4*0.46*Math.pow(R.d/1000,-0.5),0)} MPa</b>`
     :`<code>ky·d^−½</code>, ky = 0.6 MPa·m^½ = <b>${f(18.97*Math.pow(R.d/1000,-0.5),0)} MPa</b>`} (전체 YS ${f(R.YS,0)} MPa 중)</p>
   <p>소둔온도를 <b>±25 ℃</b> 바꾸면 입경이 ${(()=>{const a=trial(k,'proc','crAnnT',p.crAnnT-25),
     b=trial(k,'proc','crAnnT',p.crAnnT+25);
     return `${f(a.d,1)} ~ ${f(b.d,1)} µm 로 변하고 YS 가 ${f(a.YS,0)} ~ ${f(b.YS,0)} MPa 로 움직입니다`;})()}.
   라인속도를 올리면 유효시간이 줄어 같은 온도에서도 입경이 작아집니다 —
   ${(()=>{const b=trial(k,'proc','crAnnV',Math.min(150,p.crAnnV+30));
     return `${p.crAnnV} → ${Math.min(150,p.crAnnV+30)} m/min 시 d ${f(R.d,1)} → ${f(b.d,1)} µm, YS ${f(R.YS,0)} → ${f(b.YS,0)} MPa`;})()}.</p>`;}},

 {kw:['원가','비용','cost','단가','ni','니켈','절감','싸','저렴','경제'],
  fn:(q,k)=>{const ks=k?[k]:ORDER;
   const rows=ks.map(g=>{const R=S.res[g],C=R.cost;
     return [GRADES[g].label,f(C.brk.Ni,0),f(C.brk.Cr,0),f(C.brk.Fe,0),f(C.refine,0),f(C.conv,0),`<b>${f(C.total,0)}</b>`,
       sgn((C.total-GRADES[g].refCost)/GRADES[g].refCost*100,1)+' %'];});
   const k0=ks[0], nc=niCut(k0);
   return `<p>USD / 톤 냉연 코일 기준 원가 구조입니다.</p>
   ${tbl(['강종','Ni','Cr','Fe','정련','가공','합계','벤치마크 대비'],rows)}
   <p>304 의 원가는 <b>Ni 단가에 거의 선형으로 종속</b>됩니다. Ni 1 % 는
   10 kg/t × $${S.prices.Ni}/kg = <b>$${f(10*S.prices.Ni,0)}/t</b> 이며, 이는 Cr 1 %(${f(10*S.prices.Cr,0)})의 ${f(S.prices.Ni/S.prices.Cr,1)}배입니다.</p>
   <p>정련 페널티는 규격 하한을 과도하게 밑돌 때 발생하는 실비입니다:
   <code>S: 45·log₁₀(0.010/S)</code>, <code>P: 30·log₁₀(0.030/P)</code>,
   <code>C&lt;0.03: 1500·(0.03−C)</code>, <code>N&lt;0.02: 900·(0.02−N)</code>.
   현재 ${GRADES[k0].label} 의 정련비 <b>$${f(S.res[k0].cost.refine,0)}/t</b> 중 탈황이 $${f(S.res[k0].cost.sPen,0)} 입니다.</p>
   ${nc?`<p><b>절감 여지</b> — ${GRADES[k0].label} 에서 Ni 를 ${f(nc.dNi,2)} % 줄이고
     N +${f(nc.dN,3)} · Cu +${f(nc.dCu,2)} · Mn +${f(nc.dMn,2)} 로 치환하면
     Md30·PREN·δ·FN·A240 기계적 규격을 모두 유지한 채 <b>$${f(nc.save,0)}/t</b> 를 절감합니다.
     상단 <b>Ni 절감 최적화</b> 버튼으로 적용할 수 있습니다.</p>
     <p>근거: Nieq 식에서 N 의 계수는 14.2, Cu 는 1.0, Mn 은 0.31 입니다. 즉 N 1 kg 은 Ni 14.2 kg 의 오스테나이트
     안정화 효과를 내면서 단가는 $${S.prices.N} 대 $${f(14.2*S.prices.Ni,0)} 입니다.</p>`
    :`<p>현재 설계는 제약조건 하에서 이미 최소원가 근방입니다.</p>`}
   <p>가공비는 소둔온도·라인속도에 직접 반응합니다:
   <code>16·(T/900)^1.9 + 850/V</code>. 속도를 올리면 톤당 고정비가 줄지만 결정립이 작아져 강도가 오르므로
   물성 목표와 함께 봐야 합니다.</p>`;}},

 {kw:['리징','ridging','r값','rbar','성형','deep draw','디프','오렌지'],
  fn:(q,k)=>{k=k||'430';const R=S.res[k],p=S.g[k].proc;
   if(R.fam==='austenitic') return `<p>304 는 FCC 라 r̄ ≈ 0.9~1.1 로 낮고 리징도 발생하지 않습니다.
     대신 TRIP(Md30 ${f(R.md30,0)} ℃)이 균일연신을 지배하며, 현재 EL <b>${f(R.EL,1)} %</b> 입니다.
     연신 최대점은 Md30 ≈ +10 ℃ 입니다.</p>`;
   return `<p><b>${GRADES[k].label}</b> 의 성형성 지표입니다.</p>
   ${tbl(['지표','값','목표','인자'],[
     ['r̄ (Lankford)',f(R.rbar,2),'≥ 0.95','냉간압하율, 열연소둔, 고용 C+N, Nb+Ti'],
     ['리징지수',f(R.ridge,1)+' /10','≤ 6','열연 입경, 압하율, FDT, 열연소둔'],
     ['열연 입경',f(R.dHB,1)+' µm','작을수록 유리','FDT '+p.fdt+' ℃, CT '+p.ct+' ℃'],
     ['냉간압하율',f(R.crRed,1)+' %','70~85 %','열연 '+p.hrT+' → 냉연 '+p.crT+' mm']])}
   <p>리징은 주조 주상정에서 물려온 {100} 집합조직 콜로니가 냉간압연 후에도 남아 생깁니다. 대책 순서는
   ① 열연 FDT 를 낮춰 페라이트역 압연으로 변형 축적 → ② 열연소둔(850 ℃ 이상)으로 재결정 → ③ 냉간압하율 70 % 이상 확보입니다.</p>
   <p>현재 FDT ${p.fdt} ℃ 를 ${p.fdt-30} ℃ 로 낮추면 리징지수가
   ${f(trial(k,'proc','fdt',p.fdt-30).ridge,1)} 로 개선됩니다.
   Nb·Ti 안정화로 고용 C+N 을 없애면 {111} 집합조직이 발달해 r̄ 이 1.6 이상까지 올라갑니다(439/441 강종의 원리).</p>`;}},

 {kw:['용접','weld','fn','시그마','σ상','sigma'],
  fn:(q,k)=>{const ks=k?[k]:ORDER;
   return `<p>용접 응고 조직은 WRC-1992 당량으로 평가합니다.</p>
   <pre>Creq = Cr + Mo + 0.7Nb        Nieq = Ni + 35C + 20N + 0.25Cu
FN ≈ 3.34·Creq − 2.46·Nieq − 28.6</pre>
   ${tbl(['강종','Creq','Nieq','FN','판정'],ks.map(g=>{const c=S.g[g].comp,R=S.res[g];
     return [GRADES[g].label,f(creqWRC(c),2),f(nieqWRC(c),2),f(R.FN,1),
       R.FN<3?'고온균열 위험':R.FN>12?'σ상 취화 위험':'양호'];}))}
   <p>FN 3~12 가 권장역입니다. 3 미만이면 완전 오스테나이트 응고로 S·P 가 입계에 편석해 고온균열이 나고,
   12 초과면 600~900 ℃ 노출 시 σ상이 석출해 취화합니다.</p>
   <p>400계는 HAZ 마르텐사이트가 문제입니다. KFF = ${ks.map(g=>`${GRADES[g].label} ${f(S.res[g].kff,2)}`).join(', ')}
   — 13.5 미만이면 용접부가 경화되므로 Ti·Nb 안정화 또는 Al 첨가로 KFF 를 올립니다.</p>`;}},

 {kw:['시장','수요','판매','경쟁','marketab','옐로'],
  fn:(q,k)=>{const rv=review();
   return `<p>옐로(마케터) 평가 <b>${rv.yellow.score.toFixed(1)} / 10</b></p>
   ${tbl(['강종','A240 성분','A240 기계','원가 대비','수요'],ORDER.map(g=>{
     const G=GRADES[g],R=S.res[g],c=S.g[g].comp;
     const so=Object.entries(G.spec).filter(([e,[lo,hi]])=>c[e]<lo-1e-9||(hi!==null&&c[e]>hi+1e-9)).length;
     const mf=Object.entries(G.mech).filter(([m,[lo,hi]])=>(lo!==null&&R[m]<lo)||(hi!==null&&R[m]>hi)).map(([m])=>m);
     return [G.label,so?`${so}항목 이탈`:'적합',mf.length?mf.join(',')+' 미달':'적합',
       sgn((R.cost.total-G.refCost)/G.refCost*100,1)+' %',G.demand];}))}
   <ul>${rv.yellow.notes.map(n=>`<li>${n.hit?'▲ ':''}${esc(n.txt)}</li>`).join('')}</ul>
   <p>규격 범위를 벗어난 성분은 표준강종으로 팔 수 없고 고객별 승인(수요가 재질 심사)이 필요해
   판매 리드타임이 6~12개월 늘어납니다. 원가 우위가 5 % 미만이면 개발강종화는 통상 수지가 맞지 않습니다.</p>`;}},

 {kw:['검증','페르소나','점수','레드','그린','블루','평가','review'],
  fn:()=>{const rv=review();
   return `<p>페르소나 5인 합의 판정 — 최저 <b>${rv.min.toFixed(1)} / 10</b> ${rv.pass?'(승인)':'(미통과, 기준 9.0)'}</p>
   ${tbl(['페르소나','역할','점수','주요 지적'],PERSONAS.map(p=>{const o=rv[p.id];
     const hits=o.notes.filter(n=>n.hit);
     return [p.n,p.r,`<b>${o.score.toFixed(1)}</b>`,
       hits.length?esc(hits[0].txt):'지적사항 없음'];}))}
   ${PERSONAS.filter(p=>rv[p.id].score<10).map(p=>
     `<p><b>${p.n}</b> — ${rv[p.id].notes.filter(n=>n.hit).map(n=>esc(n.txt)).join(' / ')||'감점 없음'}</p>`).join('')}
   <p>상단 <b>자동 개선</b> 버튼은 지적사항을 감점 순으로 최대 14회 반복 적용합니다.</p>`;}},

 {kw:['왜','근거','이유','바뀌','변경','why','설명','어떻게'],
  fn:(q,k)=>{const ks=k?[k]:ORDER;
   const has=ks.filter(g=>S.log[g].length);
   if(!has.length) return `<p>아직 변경 이력이 없습니다. 제조조건이나 물성 값을 수정하면
     적용된 회귀식과 계산 경로가 각 강종 하단 <b>설계 근거</b>에 기록됩니다.</p>`;
   return has.map(g=>`<p><b>${GRADES[g].label}</b></p>
     ${S.log[g].slice(-4).reverse().map(e=>`<p style="border-left:2px solid var(--edit);padding-left:9px">${e}</p>`).join('')}`).join('');}},

 {kw:['비교','차이','대비','compare','어느','추천'],
  fn:()=>{const ks=ORDER;
   return `<p>4개 계열 현재 설계 비교입니다.</p>
   ${tbl(['항목',...ks.map(k=>GRADES[k].label)],[
     ['기지상',...ks.map(k=>GRADES[k].famKo)],
     ['YS MPa',...ks.map(k=>f(S.res[k].YS,0))],
     ['TS MPa',...ks.map(k=>f(S.res[k].TS,0))],
     ['EL %',...ks.map(k=>f(S.res[k].EL,1))],
     ['HV',...ks.map(k=>f(S.res[k].HV,0))],
     ['Epit mV',...ks.map(k=>f(S.res[k].Ep,0))],
     ['icrit mA/cm²',...ks.map(k=>f(S.res[k].ic,2))],
     ['PREN',...ks.map(k=>f(S.res[k].pren,1))],
     ['결정립 µm',...ks.map(k=>f(S.res[k].d,1))],
     ['총원가 $/t',...ks.map(k=>`<b>${f(S.res[k].cost.total,0)}</b>`)],
     ['$/t per MPa YS',...ks.map(k=>f(S.res[k].cost.total/S.res[k].YS,2))]])}
   ${(()=>{
     // 계열이 늘거나 바뀌어도 낡지 않도록, 비교 문구를 계산 결과에서 만든다
     const hi=ks.slice().sort((a,b)=>S.res[b].cost.total-S.res[a].cost.total)[0];
     const lo=ks.slice().sort((a,b)=>S.res[a].cost.total-S.res[b].cost.total)[0];
     const H=S.res[hi], L=S.res[lo];
     const niShare=f(H.cost.brk.Ni/H.cost.total*100,0);
     const best=ks.slice().sort((a,b)=>S.res[b].Ep-S.res[a].Ep)[0];
     const cheapPerYS=ks.slice().sort((a,b)=>
       (S.res[a].cost.total/S.res[a].YS)-(S.res[b].cost.total/S.res[b].YS))[0];
     return `<p>가장 비싼 계열은 <b>${GRADES[hi].famKo}</b>(${f(H.cost.total,0)} USD/t)로,
       원가의 ${niShare} % 가 Ni 입니다. 가장 싼 <b>${GRADES[lo].famKo}</b>(${f(L.cost.total,0)})
       대비 ${f((H.cost.total/L.cost.total-1)*100,0)} % 높습니다.</p>
     <p>다만 ${GRADES[lo].famKo} 는 공식전위가 ${f(H.Ep-L.Ep,0)} mV,
       연신율이 ${f(H.EL-L.EL,1)} %p 열위입니다. 염화물 환경이 아니고 심가공이 아니라면
       원가 우위가 그만큼 유효합니다.</p>
     <p>내식성 최고는 <b>${GRADES[best].famKo}</b>(Epit ${f(S.res[best].Ep,0)} mV, PREN ${f(S.res[best].pren,1)}),
       강도당 원가가 가장 낮은 쪽은 <b>${GRADES[cheapPerYS].famKo}</b>
       (${f(S.res[cheapPerYS].cost.total/S.res[cheapPerYS].YS,2)} $/t·MPa) 입니다.</p>`;
   })()}`;}}
];
function answer(q){
  const k=which(q), ql=q.toLowerCase();
  let best=null,bs=0;
  INTENTS.forEach(it=>{
    let s=0; it.kw.forEach(w=>{ if(ql.includes(w.toLowerCase())) s+=w.length>=3?2:1; });
    if(s>bs){bs=s;best=it;}
  });
  if(!best) return `<p>다음 주제로 물어보시면 현재 계산 상태 기준으로 답변합니다.</p>
    <ul><li>델타페라이트 · 응고모드 · 열간연성</li><li>Md30 · 가공유기 마르텐사이트 · TRIP</li>
    <li>γmax · Kaltenhauser 인자 · Ac1/Ac3 변태점</li><li>PREN · 공식전위 · 임계전류밀도</li>
    <li>예민화 · Ti/Nb 안정화</li><li>결정립 · 소둔온도/속도 · Hall–Petch</li>
    <li>성분원가 · Ni 절감</li><li>리징 · r값 · 성형성</li><li>용접 FN · σ상</li>
    <li>시장성 · 페르소나 검증 결과</li><li>강종 비교</li><li>방금 왜 바뀌었나</li></ul>
    <p>계열명(Austenite / Martensite / Semi-Ferrite / Fully-Ferrite) 또는 강종번호(304 / 410 / 430 / 439)를 함께 쓰면 그 기준으로 답합니다.</p>`;
  return best.fn(ql,k);
}
function ask(q,a){ S.thread.unshift({q,a:a||answer(q)}); renderThread(); }
function renderThread(){
  $('#thread').innerHTML=S.thread.map(t=>
    `<div class="qa"><div class="q">${esc(t.q)}</div><div class="a">${t.a}</div></div>`).join('');
}
const SUGGEST=['304 델타페라이트가 왜 이 값인가?','Md30 이 연신율에 미치는 영향은?',
  '410 의 Ac1 과 소둔온도 관계','430 예민화를 막으려면?','성분원가에서 Ni 절감 여지',
  '결정립과 소둔조건의 관계','4계열 내식성 비교','439 완전 페라이트가 예민화에 강한 이유','페르소나 검증 결과','430 리징 대책','용접 FN 은 괜찮은가'];
function renderSuggest(){
  $('#suggest').innerHTML=SUGGEST.map(s=>`<button class="sg" type="button">${s}</button>`).join('');
}
$('#suggest').addEventListener('click',e=>{
  const b=e.target.closest('.sg'); if(!b) return;
  $('#askInput').value=b.textContent; ask(b.textContent);
});
$('#askForm').addEventListener('submit',e=>{
  e.preventDefault();
  const v=$('#askInput').value.trim(); if(!v) return;
  ask(v); $('#askInput').value='';
});

/* ══════════════════════════════════════════════════════════════
   13. 기동
   ══════════════════════════════════════════════════════════════ */
initState(); render(); renderPrices(); renderSuggest();
ask('4개 계열 기준 설계 현황은?');
