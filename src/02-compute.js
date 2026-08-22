/* ══════════════════════════════════════════════════════════════
   3. 순방향 모델 : 성분 + 제조조건 → 조직 → 물성 → 원가
   ══════════════════════════════════════════════════════════════ */
function compute(key, comp, proc, prices){
  const G=GRADES[key], fam=G.family, c=comp, p=proc, P=prices||PRICE0;
  const R={key,fam,eq:[]};
  const eq=(h,f,t,s)=>R.eq.push({h,f,t,s});

  /* ── 3-1 압하율 · 소둔 유효시간 ─────────────────────────── */
  const hrRed=(p.slab-p.hrT)/p.slab*100;
  const crRed=(p.hrT-p.crT)/p.hrT*100;
  const tHR=2700/p.hrAnnV, tCR=2700/p.crAnnV;   // 유효 소킹길이 45 m 가정
  R.hrRed=hrRed; R.crRed=crRed; R.tHR=tHR; R.tCR=tCR;

  /* ── 3-2 안정화 · 상평형 지표 ───────────────────────────── */
  const {Ceff,Neff}=stabilize(c);
  R.Ceff=Ceff; R.Neff=Neff;
  R.creq=creqHS(c); R.nieq=nieqHS(c);
  R.dCast=deltaAt(c,1300);            // 슬라브·재가열역 (열간연성)
  R.dHot =deltaAt(c,Math.min(p.rhfT,1300));
  R.FN=ferriteNo(c);
  R.gmax=gammaMax(c); R.kff=kffK(c);
  R.ac1=ac1T(c); R.ac3=ac3T(c);
  R.pren=prenV(c);
  R.msMar=msMar(c);

  /* ── 3-3 결정립 이력 ────────────────────────────────────── */
  const pin=1/(1+12*(c.Nb+c.Ti)+3*Ceff);
  R.pin=pin;
  const hbBase=fam==='austenitic'?22:55;
  R.dHB=hbBase*Math.exp((p.fdt-900)/130)*(1+Math.max(0,p.ct-550)/1200)
        *Math.pow(60/Math.max(30,hrRed),0.3);

  // γmax≈0 인 완전 페라이트계는 오스테나이트가 생기지 않으므로 Ac1 분기 자체가 무의미
  const canTransform = R.gmax > 5;
  const subHR = fam!=='austenitic' && canTransform && p.hrAnnT < R.ac1;
  const subCR = fam!=='austenitic' && canTransform && p.crAnnT < R.ac1;
  // 열연 소둔 후
  if(subHR){ R.dHRA=grow(14,p.hrAnnT,tHR,fam,0.35); }
  else     { R.dHRA=grow(R.dHB*0.6,p.hrAnnT,tHR,fam,pin); }
  // 냉연 재결정 초기립 → 최종립
  let d0=(fam==='austenitic'?4.5:6.0)+0.10*R.dHRA*Math.pow(70/Math.max(20,crRed),0.8);
  if(subCR) d0=Math.max(d0,12);
  R.d0=d0;
  R.d=grow(d0,p.crAnnT,tCR,fam,subCR?0.35:pin);
  R.G=astmG(R.d);

  /* ── 3-4 δ 잔류 · Md30 ──────────────────────────────────── */
  R.dFin = fam==='austenitic' ? deltaAt(c,p.crAnnT) : null;
  R.md30 = fam==='austenitic' ? md30N(c,R.d) : null;
  R.md30A= fam==='austenitic' ? md30A(c) : null;
  R.msA  = fam==='austenitic' ? msAus(c) : null;
  R.V30  = fam==='austenitic' ? 50/(1+Math.exp(-(R.md30-25)/30)) : 0;

  /* ── 3-5 예민화 (Cr 결핍) ───────────────────────────────── */
  const tCool=20*Math.sqrt(p.crT)*Math.sqrt(50/p.crAnnV);
  R.tCool=tCool;
  let dosC, tNose;
  if(fam==='austenitic'){
    dosC=Ceff;
    tNose=Math.pow(10,-3.6-4.6*L10(Math.max(dosC,1e-4)));
    R.DOS=100*Math.pow(cl(tCool/tNose,0,1),1.5);
  }else{
    dosC=Math.min(Ceff,csolF(p.crAnnT));
    tNose=Math.pow(10,-5.6-4.6*L10(Math.max(Ceff,1e-4)));
    R.DOS=100*cl(dosC/0.05,0,1)*Math.pow(cl(tCool/tNose,0,1),0.4);
  }
  R.tNose=tNose; R.dosC=dosC;

  /* ── 3-6 마르텐사이트 변태 (400계) ──────────────────────── */
  R.fm=0; R.Cg=0;
  if(fam!=='austenitic' && canTransform && p.crAnnT>R.ac1){
    const fg=cl((p.crAnnT-R.ac1)/Math.max(1,R.ac3-R.ac1),0,1)*R.gmax/100;
    R.Cg=Math.min(c.C/Math.max(fg,0.05),0.50);
    const rate=20*(p.crAnnV/50)/Math.max(0.25,p.crT);   // ℃/s 근사
    R.coolRate=rate;
    R.fm=fg*cl(rate/1.0,0.35,1);                        // 410은 공랭경화형
  }

  /* ── 3-7 기계적 성질 ────────────────────────────────────── */
  const dmm=R.d/1000, hp=Math.pow(dmm,-0.5);
  let YS,TS,ELg,HV;
  if(fam==='austenitic'){
    const dF=R.dFin;
    const pk=4.4+23*c.C+32*c.N+0.24*c.Cr+0.94*c.Mo+1.3*c.Si+2.6*c.Nb
             +1.7*c.Ti+0.82*c.Al+0.16*dF+0.46*hp;
    R.ysPick=15.4*pk;
    YS=R.ysPick+38+18;                       // 조질압연 + 계열보정
    const pt=29+35*c.C+55*c.N+2.4*c.Si+0.11*c.Ni+1.2*c.Mo+5*c.Nb+3*c.Ti
             +1.2*c.Al+0.14*dF+0.82*hp;
    R.tsPick=15.4*pt;
    R.trip=3.0*R.V30;
    TS=R.tsPick+R.trip+12;
    // 연신율 — Md30 의존성. 2차식은 최적점 근방에서만 유효해서 안정형
    // 오스테나이트(316L·310S, Md30 ≪ 0)에서 발산한다. 양쪽으로 포화하는
    // 비대칭 종형으로 바꿔, TRIP 이 없어도 연신이 50 % 대에 머무르게 한다.
    //   Md30 ≈ +10 : TRIP 최적, 연신 최대
    //   Md30 ≪ 0   : 안정형 — TRIP 없음, 균일연신만 (하한 52)
    //   Md30 ≫ +10 : 과준안정형 — α′ 조기 생성으로 변형 국부화 (하한 40)
    const md=R.md30, PEAK=58;
    const elMd = md<=10 ? 52+(PEAK-52)*Math.exp(-Math.pow((md-10)/55,2))
                        : 40+(PEAK-40)*Math.exp(-Math.pow((md-10)/40,2));
    ELg=elMd-0.020*(YS-250)-0.020*(TS-620)-1.5*dF
        +cl(0.05*(R.d-25),-1.5,2.5)-2.5*Math.max(0,0.6-p.crT);
    ELg=cl(ELg,8,62);
    HV=0.21*TS+0.09*YS+5;
  }else{
    const freeI=Math.min(Ceff+Neff, subCR?0.002:0.008);
    R.freeI=freeI;
    const ysF=55+3.7*c.Cr+83*c.Si+32*c.Mn+11*c.Mo+690*c.P+5000*freeI
              +18.97*hp+180*Math.min(0.5,c.Nb)
              +(fam==="martensitic"?-53:0)
              // 아임계 소둔재의 구상화 탄화물 강화 — C 가 높을수록 탄화물 분율이 커진다
              +((fam==="martensitic"&&subCR)?450*Math.min(0.5,Math.max(0,c.C-0.08)):0);
    const tsF=ysF+175+900*freeI;
    R.rbar=cl(1.00+0.010*(crRed-60)+(p.hrAnnT>800?0.5:0)-6*(c.C+c.N)
              +1.0*Math.min(0.4,c.Nb+c.Ti),0.7,1.95);
    R.ridge=cl(0.6*(R.dHB/40)+0.5*(70/Math.max(20,crRed))+0.4*(p.fdt-800)/100
               -(p.hrAnnT>850?0.5:0),0,10);
    const elF=31-0.045*(ysF-300)+4*(R.rbar-1.0)-0.35*R.ridge-800*freeI
              -(fam==='martensitic'?6:0);
    if(R.fm>0.01){
      const hvM=Math.min(700,250+1400*R.Cg), tsM=3.3*hvM, ysM=0.78*tsM;
      R.hvM=hvM;
      YS=ysF*(1-R.fm)+ysM*R.fm; TS=tsF*(1-R.fm)+tsM*R.fm;
      ELg=elF*Math.pow(1-R.fm,1.5)+6*R.fm;
    }else{ YS=ysF; TS=tsF; ELg=elF; }
    R.ysF=ysF; R.tsF=tsF;
    HV=0.26*TS+0.05*YS+14;
  }
  R.YS=YS; R.TS=TS; R.EL=Math.max(2,ELg); R.HV=HV;
  R.elMd = fam==="austenitic" ? ELg : null;

  /* ── 3-8 내식성 ─────────────────────────────────────────── */
  const famOff={austenitic:0,ferritic:-50,martensitic:-60}[fam];
  R.dS=-60*(L10(Math.max(c.S,1e-5))+3.7);
  R.dSens=-1.8*R.DOS;
  R.dTi=-100*Math.max(0,c.Ti-0.05);
  R.dGr=-0.4*(R.d-25);
  R.Ep=-75+21*R.pren+famOff+R.dS+R.dSens+R.dTi+R.dGr;
  R.famOff=famOff;
  R.logIc=5.35-0.105*c.Cr-0.16*c.Mo-0.22*c.Cu-0.045*c.Ni-0.06*c.Si
          +1.6*c.C+0.010*R.DOS;
  R.ic=Math.pow(10,R.logIc)/1000;               // µA→mA/cm²
  R.mu = fam==='austenitic' ? 1.002+0.02*(R.dFin||0) : null;

  /* ── 3-9 원가 ───────────────────────────────────────────── */
  let alloy=0, alloyPct=0; const brk={};
  ['Cr','Ni','Mo','Mn','Si','Ti','Nb','Cu','N','Al','C'].forEach(e=>{
    const v=c[e]*10*P[e]; brk[e]=v; alloy+=v; alloyPct+=c[e];
  });
  const feFrac=(100-alloyPct-c.P-c.S)/100;
  brk.Fe=feFrac*1000*P.Fe; alloy+=brk.Fe;
  const sPen=c.S<0.010?45*L10(0.010/Math.max(c.S,2e-4)):0;
  const pPen=c.P<0.030?30*L10(0.030/Math.max(c.P,5e-3)):0;
  const cPen=c.C<0.030?1500*(0.030-c.C):0;
  const nPen=c.N<0.020?900*(0.020-c.N):0;
  const refine=sPen+pPen+cPen+nPen;

  const melt=175;
  const hot=55+0.09*Math.max(0,p.rhfT-1150)+8*(p.slab/200);
  const hrAnn=16*Math.pow(p.hrAnnT/900,1.9)+850/p.hrAnnV;
  const cold=22+0.75*crRed+30*Math.max(0,0.8-p.crT)/0.4;
  const crAnn=16*Math.pow(p.crAnnT/900,1.9)+850/p.crAnnV;
  const pickle=12+0.02*Math.max(0,p.hrAnnT-800)+0.02*Math.max(0,p.crAnnT-800);
  const yld=40*(1250/p.crW-1)+15;
  const conv=melt+hot+hrAnn+cold+crAnn+pickle+yld;

  R.cost={alloy,refine,conv,total:alloy+refine+conv,brk,
          sPen,pPen,cPen,nPen,melt,hot,hrAnn,cold,crAnn,pickle,yld};

  /* ── 3-10 근거 기록 ─────────────────────────────────────── */
  eq('Cr·Ni 당량 (Hammar–Svensson)',
     'Creq = Cr+1.37Mo+1.5Si+2Nb+3Ti\nNieq = Ni+22C+14.2N+0.31Mn+Cu',
     `Creq = ${R.creq.toFixed(2)}  ·  Nieq = ${R.nieq.toFixed(2)}  ·  비 = ${(R.creq/R.nieq).toFixed(3)}`,
     'Hammar & Svensson, Solidification and Casting of Metals (1979)');
  eq('δ-페라이트 (Hull 식 + 온도의존 경계)',
     'δ% = 3·[Creq − 0.93·Nieq − b(T)]\nb(T) = 6.7 + (1300 − T)×0.0157',
     `1300 ℃ : ${R.dCast.toFixed(1)} %  (열간연성 지배)`
     +(R.dFin!==null?`\n최종소둔 ${p.crAnnT} ℃ : ${R.dFin.toFixed(2)} %`:''),
     'Hull(1973)의 δ 계산식에 γ 안정성의 온도 의존성을 부가한 내부 상관식');
  eq('용접부 페라이트수 (WRC-1992)',
     'Creq = Cr+Mo+0.7Nb , Nieq = Ni+35C+20N+0.25Cu\nFN ≈ 3.34Creq − 2.46Nieq − 28.6',
     `FN = ${R.FN.toFixed(1)}`,'WRC-1992 등FN선의 선형근사');
  if(fam==='austenitic'){
    eq('Md30 — 가공유기 마르텐사이트 (Nohara)',
       'Md30 = 551 − 462(C+N) − 9.2Si − 8.1Mn − 13.7Cr\n        − 29(Ni+Cu) − 18.5Mo − 68Nb − 1.42(ν−8)',
       `Md30 = ${R.md30.toFixed(1)} ℃  (Angel 식: ${R.md30A.toFixed(1)} ℃)\n`
       +`ν = ASTM ${R.G.toFixed(1)} → 30 % 변형 시 α′ ${R.V30.toFixed(1)} %`,
       'Nohara, Ono & Ohashi, Tetsu-to-Hagané 63 (1977)');
    eq('0.2 % 내력 (Pickering)',
       'σy = 15.4[4.4+23C+32N+0.24Cr+0.94Mo+1.3Si\n      +2.6Nb+1.7Ti+0.82Al+0.16δ+0.46 d^−½]',
       `Pickering 기본값 ${R.ysPick.toFixed(0)} MPa + 조질압연 38 + 계열보정 18 = ${YS.toFixed(0)} MPa`,
       'F.B. Pickering, Physical Metallurgy of Stainless Steel Development (1976)');
    eq('인장강도 + TRIP 기여',
       'σu = 15.4[29+35C+55N+2.4Si+0.11Ni+1.2Mo+…+0.82 d^−½]\nΔσTRIP = 3.0 × V(α′)30%',
       `${R.tsPick.toFixed(0)} + ${R.trip.toFixed(0)}(TRIP) + 12 = ${TS.toFixed(0)} MPa`,
       'Pickering 식 + Md30 기반 TRIP 항');
    eq('Ms (Eichelman & Hull)',
       'Ms = 1305 − 1665(C+N) − 28Si − 33Mn − 42Cr − 61Ni',
       `Ms = ${R.msA.toFixed(0)} ℃ → 실온에서 열적 마르텐사이트 없음`,
       'Eichelman & Hull, Trans. ASM 45 (1953)');
  }else{
    eq('γmax — 최대 오스테나이트량',
       '%γmax = 420C+470N+23Ni+9Cu+7Mn−11.5Cr−11.5Si\n          −12Mo−47Nb−49Ti−52Al+189',
       `γmax = ${R.gmax.toFixed(1)} %`,'페라이트계 STS γmax 회귀식');
    eq('Kaltenhauser 페라이트 인자',
       'KFF = Cr+6Si+8Ti+4Mo+2Al−2Mn−4Ni−40(C+N)',
       `KFF = ${R.kff.toFixed(2)} — 13.5 미만이면 냉각 중 마르텐사이트 생성`,
       'Kaltenhauser, Metals Eng. Quarterly (1971)');
    eq('변태점 Ac1 / Ac3',
       'Ac1 = 720+12Cr+25Si+30Mo+40Nb+60Ti+45Al\n       −25Mn−30Ni−15Cu−250C−400N',
       `Ac1 = ${R.ac1.toFixed(0)} ℃ , Ac3 = ${R.ac3.toFixed(0)} ℃\n`
       +`냉연소둔 ${p.crAnnT} ℃ → ${p.crAnnT<R.ac1?'아임계 (완전 연화)':'임계역 이상 → 마르텐사이트 '+(R.fm*100).toFixed(0)+' %'}`,
       'AISI 409/410/420/430 문헌 Ac1 실측값에 보정한 내부 상관식');
    eq('Ms (Andrews)','Ms = 539 − 423C − 30.4Mn − 17.7Ni − 12.1Cr − 7.5Mo − 7.5Si',
       `Ms = ${R.msMar.toFixed(0)} ℃`,'K.W. Andrews, JISI 203 (1965)');
    eq('내력 — Hall–Petch + 고용강화',
       'σy = 55+3.7Cr+83Si+32Mn+11Mo+690P\n      +5000(Cfree+Nfree)+18.97 d^−½ +180Nb+60Ti',
       `σy(페라이트) = ${R.ysF.toFixed(0)} MPa , d = ${R.d.toFixed(1)} µm (ASTM ${R.G.toFixed(1)})`
       +(R.fm>0.01?`\n마르텐사이트 ${(R.fm*100).toFixed(0)} % 혼합 → ${YS.toFixed(0)} MPa`:''),
       'ky = 0.6 MPa·m^½ (BCC), 고용강화계수는 페라이트계 문헌값');
    eq('성형성 지표','r̄ = f(냉간압하율, 열연소둔, 고용 C+N, Nb+Ti)\n리징 = f(열연립경, 압하율, FDT)',
       `r̄ = ${R.rbar.toFixed(2)} , 리징지수 = ${R.ridge.toFixed(1)} / 10`,
       '{111} 재결정집합조직 형성 인자 기반 내부 지수');
  }
  eq('결정립 성장 (Beck 형)',
     `d^${GG[fam==='austenitic'?'austenitic':'ferritic'].n} − d₀^n = k₀·exp(−Q/RT)·t·Z\n`
     +`Q = ${GG[fam==='austenitic'?'austenitic':'ferritic'].Q/1000} kJ/mol , Z = Zener 핀닝`,
     `열연판 ${R.dHB.toFixed(0)} → 열연소둔 ${R.dHRA.toFixed(0)} → 재결정 ${d0.toFixed(1)} → 최종 ${R.d.toFixed(1)} µm\n`
     +`소둔 유효시간 = 45 m ÷ ${p.crAnnV} m/min = ${tCR.toFixed(0)} s , Z = ${(subCR?0.35:pin).toFixed(2)}`,
     '유효 소킹길이 45 m 가정');
  eq('내공식성 (PREN 기반)',
     'PREN = Cr + 3.3Mo + 16N\nEpit = −75 + 21·PREN + 계열보정 + ΔS + Δ예민화 + ΔTi + Δ결정립',
     `PREN ${R.pren.toFixed(1)} → 기본 ${(-75+21*R.pren).toFixed(0)} , 계열 ${famOff} , S ${R.dS.toFixed(0)} , `
     +`예민화 ${R.dSens.toFixed(0)} , Ti ${R.dTi.toFixed(0)} , 립경 ${R.dGr.toFixed(0)}\n= ${R.Ep.toFixed(0)} mV(SCE)`,
     'ASTM G61 조건(3.5 % NaCl, 30 ℃) 실측 대표값 회귀');
  eq('임계전류밀도 (0.5 M H₂SO₄, 30 ℃)',
     'log₁₀ icrit[µA/cm²] = 5.35 − 0.105Cr − 0.16Mo − 0.22Cu\n   − 0.045Ni − 0.06Si + 1.6C + 0.010·DOS',
     `log icrit = ${R.logIc.toFixed(2)} → ${R.ic.toFixed(2)} mA/cm²`,
     '동전위 분극 실측 대표값 회귀 (낮을수록 부동태화 용이)');
  eq('예민화 지수 (Cr 결핍도)',
     'Ceff = C − Ti/4 − Nb/7.75  (TiN 우선 고정)\nDOS = f(고용 C, 냉각 체류시간 / TTS 노즈시간)',
     `Ceff = ${Ceff.toFixed(4)} % , 고용 C = ${dosC.toFixed(4)} %\n`
     +`850→550 ℃ 체류 ${tCool.toFixed(0)} s vs 노즈 ${tNose.toFixed(1)} s → DOS ${R.DOS.toFixed(0)} / 100`,
     'TTS 곡선 노즈시간의 C 의존성 근사');
  eq('성분 원가',
     'Σ(원소 wt% × 10 kg/t × 단가) + Fe 단가 + 정련 페널티 + 가공비',
     `합금 ${alloy.toFixed(0)} + 정련 ${refine.toFixed(0)} + 가공 ${conv.toFixed(0)} = ${R.cost.total.toFixed(0)} USD/t\n`
     +`Ni 기여 ${brk.Ni.toFixed(0)} (${(brk.Ni/alloy*100).toFixed(0)} %) , Cr 기여 ${brk.Cr.toFixed(0)}`,
     'FeCr·LME Ni·FeMo 등 2025년 수준 단가, 상단 [원료 단가]에서 변경 가능');
  return R;
}
