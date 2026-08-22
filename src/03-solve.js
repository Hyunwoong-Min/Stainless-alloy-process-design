/* ══════════════════════════════════════════════════════════════
   4. 상태
   ══════════════════════════════════════════════════════════════ */
const S={g:{},prices:{...PRICE0},log:{},thread:[],res:{},chg:{},diff:{},inDiff:{},
         tab:ORDER[0], scope:"dev"};   // scope: "dev" 신강종 개발 | "std" 기본강종 규격 준수
function initState(){
  ORDER.forEach(k=>{
    S.g[k]={comp:{...GRADES[k].comp},proc:{...GRADES[k].proc},
              touched:{},solved:{},pend:{}};
    S.log[k]=[];
  });
  S.thread=[]; S.chg={}; S.diff={}; S.inDiff={};
}
const calc=k=>compute(k,S.g[k].comp,S.g[k].proc,S.prices);
function recalc(){ ORDER.forEach(k=>S.res[k]=calc(k)); }

/* ══════════════════════════════════════════════════════════════
   5. 야금 제약 (RED 페르소나의 판정 기준)
   ══════════════════════════════════════════════════════════════ */
function constraints(k,R){
  const G=GRADES[k], c=S.g[k].comp, p=S.g[k].proc, out=[];
  const add=(id,name,val,txt,lv,fix)=>out.push({id,name,val,txt,lv,fix});
  const dev=S.scope==='dev';
  // 신강종 개발 모드에서는 기본강종 규격 이탈이 '불합격'이 아니라 '개발강종' 표식이다.
  // 다만 야금학적 정합성(스테인리스 성립 요건, 계열 정체성)은 모드와 무관하게 지킨다.
  const specLv = dev?'wa':'no';
  const tail = dev?' (개발강종 — 표준 규격 밖)':'';

  // 기본강종 성분 규격
  Object.entries(G.spec).forEach(([e,[lo,hi]])=>{
    const v=c[e];
    if(v<lo-1e-9)      add('spec_'+e,`${e} 규격`,v,`${e} ${v} % < ${G.label} 하한 ${lo} %`+tail,specLv,{t:'comp',e,v:lo});
    else if(hi!==null&&v>hi+1e-9) add('spec_'+e,`${e} 규격`,v,`${e} ${v} % > ${G.label} 상한 ${hi} %`+tail,specLv,{t:'comp',e,v:hi});
  });
  // 기본강종 기계적 규격
  Object.entries(G.mech).forEach(([m,[lo,hi]])=>{
    const v=R[m], u=PROP.find(x=>x.k===m).u;
    if(lo!==null&&v<lo) add('mech_'+m,`${m} 규격`,v,`${m} ${v.toFixed(0)} ${u} < ${G.label} 최소 ${lo}`+tail,specLv,{t:'prop',e:m,v:lo*1.04});
    if(hi!==null&&v>hi) add('mech_'+m,`${m} 규격`,v,`${m} ${v.toFixed(0)} ${u} > ${G.label} 최대 ${hi}`+tail,specLv,{t:'prop',e:m,v:hi*0.96});
  });
  // ── 여기부터는 모드와 무관하게 지켜야 하는 야금학적 요건 ──
  if(R.pren<11) add('pren','PREN',R.pren,`PREN ${R.pren.toFixed(1)} < 11 — 부동태 피막이 성립하지 않아 스테인리스가 아님`,'no',{t:'comp',e:'Cr',v:c.Cr+0.5});
  if(c.Cr<10.5) add('cr105','최소 Cr',c.Cr,`Cr ${c.Cr} % < 10.5 % — 스테인리스 정의 미달`,'no',{t:'comp',e:'Cr',v:10.6});
  // 계열 정체성 — 이걸 벗어나면 다른 계열이 되어 모델 자체가 어긋난다
  if(R.fam==='austenitic'&&R.dCast>25)
    add('famid','계열 정체성',R.dCast,`δ ${R.dCast.toFixed(0)} % — 오스테나이트계를 벗어나 듀플렉스 영역`,'no',{t:'comp',e:'Ni',v:c.Ni+1.0});
  if(R.fam==='ferritic'&&R.gmax>85)
    add('famid','계열 정체성',R.gmax,`γmax ${R.gmax.toFixed(0)} % — 페라이트계를 벗어나 마르텐사이트계 거동`,'no',{t:'comp',e:'Cr',v:c.Cr+1.0});
  if(R.fam==='martensitic'&&R.gmax<50)
    add('famid','계열 정체성',R.gmax,`γmax ${R.gmax.toFixed(0)} % — 경화가 불가해 마르텐사이트계로 성립하지 않음`,'no',{t:'comp',e:'C',v:Math.min(0.9,c.C+0.05)});

  // 열간연성 — δ/γ 이상역을 갖는 계열에만 적용
  if(R.fam!=='ferritic'){
    if(R.dCast<2)      add('dcast','열간연성 δ',R.dCast,`1300 ℃ δ ${R.dCast.toFixed(1)} % < 2 % — 완전 오스테나이트 응고, 고온균열 위험`,'wa',{t:'comp',e:'Cr',v:c.Cr+0.35});
    else if(R.dCast>12)add('dcast','열간연성 δ',R.dCast,`1300 ℃ δ ${R.dCast.toFixed(1)} % > 12 % — 열간압연 중 에지크랙 위험`,'wa',{t:'comp',e:'Ni',v:c.Ni+0.35});
  }
  if(R.fam==='austenitic'){
    if(R.md30>40)  add('md30','Md30',R.md30,`Md30 ${R.md30.toFixed(0)} ℃ > 40 — 성형 중 α′ 과다, 시효균열·자성 발현`,'wa',{t:'comp',e:'Ni',v:c.Ni+0.30});
    if(R.md30<-80) add('md30','Md30',R.md30,`Md30 ${R.md30.toFixed(0)} ℃ < −80 — TRIP 소실, 안정형 오스테나이트`,'wa',{t:'comp',e:'Ni',v:c.Ni-0.30});
    if(R.FN<3)     add('fn','용접 FN',R.FN,`FN ${R.FN.toFixed(1)} < 3 — 용접 고온균열 위험`,'wa',{t:'comp',e:'Cr',v:c.Cr+0.3});
    if(R.FN>12)    add('fn','용접 FN',R.FN,`FN ${R.FN.toFixed(1)} > 12 — 용접부 취화·σ상 석출 위험`,'wa',{t:'comp',e:'Ni',v:c.Ni+0.3});
    if(R.dFin>1.0) add('dfin','잔류 δ',R.dFin,`최종 δ ${R.dFin.toFixed(2)} % > 1 % — 성형성·표면품질 저하`,'wa',{t:'proc',e:'crAnnT',v:p.crAnnT-25});
  }
  if(R.fam==='ferritic'){
    if(R.gmax>65)  add('gmax','γmax',R.gmax,`γmax ${R.gmax.toFixed(0)} % > 65 — 마르텐사이트 과다로 연성 급락`,'wa',{t:'comp',e:'Cr',v:c.Cr+0.30});
    if(R.ridge>6)  add('ridge','리징',R.ridge,`리징지수 ${R.ridge.toFixed(1)} / 10 — 성형 후 표면 줄무늬 결함`,'wa',{t:'proc',e:'fdt',v:p.fdt-25});
    if(R.rbar<0.95)add('rbar','r값',R.rbar,`r̄ ${R.rbar.toFixed(2)} < 0.95 — 심가공 부적합`,'wa',{t:'proc',e:'crAnnT',v:p.crAnnT+15});
  }
  if(R.fam==='martensitic'){
    if(R.gmax<90)  add('gmax','γmax',R.gmax,`γmax ${R.gmax.toFixed(0)} % < 90 — 완전 경화 불가, δ 잔류`,'wa',{t:'comp',e:'C',v:Math.min(0.9,c.C+0.015)});
    if(R.msMar<150)add('ms','Ms',R.msMar,`Ms ${R.msMar.toFixed(0)} ℃ < 150 — 잔류 오스테나이트 과다`,'wa',{t:'comp',e:'C',v:Math.max(0.03,c.C-0.012)});
  }
  // 공통
  const tiNeed=3.42*c.N+4*Math.max(0,c.C-c.Nb/7.75)+0.02;
  if(R.DOS>30)  add('dos','예민화',R.DOS,
                    `DOS ${R.DOS.toFixed(0)} / 100 — 입계 Cr 결핍, 내식성 저하`
                    +(R.fam!=='austenitic'?` (완전 안정화 소요 Ti ≒ ${tiNeed.toFixed(3)} %, 현재 ${c.Ti} %)`:''),'wa',
                    R.fam==='austenitic'?{t:'proc',e:'crAnnV',v:p.crAnnV+20}
                                        :{t:'comp',e:'Ti',v:tiNeed});
  if(R.d>45)    add('grain','결정립',R.d,`d ${R.d.toFixed(0)} µm (ASTM ${R.G.toFixed(1)}) — 오렌지필·강도 저하`,'wa',{t:'proc',e:'crAnnT',v:p.crAnnT-25});
  if(R.d<8)     add('grain','결정립',R.d,`d ${R.d.toFixed(1)} µm — 재결정 불완전 가능`,'wa',{t:'proc',e:'crAnnT',v:p.crAnnT+25});
  return out;
}

/* ── 조업 가능성 (BLUE) ─────────────────────────────────────── */
function operability(k){
  const p=S.g[k].proc, R=S.res[k], out=[];
  const add=(t,fix)=>out.push({txt:t,fix});
  if(p.crT>=p.hrT)      add('냉연 두께가 열연 두께 이상 — 압연 불가',{t:'proc',e:'crT',v:p.hrT*0.28});
  if(p.hrT>=p.slab)     add('열연 두께가 슬라브 이상 — 압연 불가',{t:'proc',e:'hrT',v:4});
  if(p.fdt>p.rdt)       add('FDT가 RDT보다 높음 — 열이력 모순',{t:'proc',e:'fdt',v:p.rdt-140});
  if(p.rdt>p.rhfT)      add('RDT가 가열로 온도보다 높음 — 열이력 모순',{t:'proc',e:'rdt',v:p.rhfT-160});
  if(p.ct>p.fdt)        add('CT가 FDT보다 높음 — 권취 불가',{t:'proc',e:'ct',v:p.fdt-140});
  if(p.crW>p.hrW)       add('냉연 폭이 열연 폭 초과 — 폭 확장 불가',{t:'proc',e:'crW',v:p.hrW-10});
  if(R.crRed<40)        add(`냉간압하율 ${R.crRed.toFixed(0)} % < 40 % — 재결정 집합조직 미발달`,{t:'proc',e:'hrT',v:p.crT/0.32});
  if(R.crRed>92)        add(`냉간압하율 ${R.crRed.toFixed(0)} % > 92 % — 압연하중 한계 초과`,{t:'proc',e:'hrT',v:p.crT/0.15});
  if(p.crAnnT>1180)     add('냉연 소둔온도가 CAL 설비 한계(1180 ℃) 초과',{t:'proc',e:'crAnnT',v:1160});
  if(R.tCR<12)          add(`소둔 유효시간 ${R.tCR.toFixed(0)} s < 12 s — 재결정 미완`,{t:'proc',e:'crAnnV',v:150});
  // 재결정 하한 — 이 아래로는 회복만 일어나 냉연 조직이 그대로 남는다
  const rxT=R.fam==='austenitic'?1000:(R.fam==='ferritic'?790:700);
  if(p.crAnnT<rxT) add(`냉연 소둔 ${p.crAnnT} ℃ < 재결정 하한 ${rxT} ℃ — 냉간가공 조직 잔류, 물성 예측 불가`,
                       {t:'proc',e:'crAnnT',v:rxT+30});
  if(R.fam!=='austenitic' && p.hrAnnT>R.ac1)
    add(`열연 소둔 ${p.hrAnnT} ℃ > Ac1 ${R.ac1.toFixed(0)} ℃ — 소둔 목적(연화)과 반대로 재경화`,
        {t:'proc',e:'hrAnnT',v:Math.round(R.ac1)-40});
  // 고탄소 마르텐사이트계는 Ac1 을 넘겨 소둔하면 급냉으로 경화된다. 실제 연질
  // 소둔은 상자소둔의 서냉(~25 ℃/h)이 필요한데 본 모델은 연속소둔만 다룬다.
  if(R.fam==='martensitic' && R.fm>0.5 && R.HV>300)
    add(`냉연 소둔 ${p.crAnnT} ℃ > Ac1 ${R.ac1.toFixed(0)} ℃ 이고 급냉이라 HV ${R.HV.toFixed(0)} 의 경화재가 됩니다. `
       +`연질 소둔이 목적이면 Ac1 미만으로 낮추십시오. 고탄소재의 상자소둔(서냉)은 이 모델의 적용역 밖입니다.`,
       {t:'proc',e:'crAnnT',v:Math.round(R.ac1)-30});
  return out;
}

/* ══════════════════════════════════════════════════════════════
   6. 역설계 솔버 — 최소원가 탐욕 알고리즘
   ══════════════════════════════════════════════════════════════ */
function trial(k,mode,knob,val){
  const c={...S.g[k].comp}, p={...S.g[k].proc};
  if(mode==='comp') c[knob]=val; else p[knob]=val;
  return compute(k,c,p,S.prices);
}
function knobList(k,mode){
  const dev=S.scope==='dev', fam=GRADES[k].family;
  const FR=FAM_RANGE[fam], FP=FAM_PK[fam];
  const comp=()=>Object.entries(GRADES[k].knobs).map(([e,[lo,hi]])=>{
    const m=EL.find(x=>x.k===e);
    // 신강종 개발 모드에서는 기본강종 규격창이 아니라 계열 설계공간을 쓴다
    const r=dev&&FR[e]?FR[e]:[lo,hi];
    return {e,lo:Math.max(m.min,r[0]),hi:Math.min(m.max,r[1]),kind:'comp',
            st:m.s,d:m.d,u:'wt%',n:e};
  });
  const proc=()=>{ const win=(dev&&FP)?FP:(GRADES[k].pk||{});
    return PROC_KNOBS.map(e=>{const m=PR.find(x=>x.k===e), w=win[e];
      return {e,lo:w?Math.max(m.min,w[0]):m.min,hi:w?Math.min(m.max,w[1]):m.max,
              kind:'proc',st:m.s,d:m.d,u:m.u,n:m.n};});
  };
  if(mode==='comp') return comp();
  if(mode==='proc') return proc();
  return comp().concat(proc());          // 'both' — 성분과 제조조건을 함께 쓴다
}
const MODE_KO={comp:'성분',proc:'제조조건',both:'성분+제조조건'};
/* 입력칸이 허용할 범위 — 화면과 솔버가 같은 창을 쓰도록 */
function fieldRange(k,kind,key){
  const fam=GRADES[k].family;
  if(kind==='comp'){
    const m=EL.find(x=>x.k===key);
    if(S.scope==='dev'){ const r=FAM_RANGE[fam][key]||[m.min,m.max];
      return [Math.max(m.min,r[0]),Math.min(m.max,r[1])]; }
    const sp=GRADES[k].spec[key], kn=GRADES[k].knobs[key];
    const lo=Math.max(m.min, sp?sp[0]:(kn?kn[0]:m.min));
    const hi=Math.min(m.max, sp&&sp[1]!==null?sp[1]:(kn?kn[1]:m.max));
    return [lo,hi];
  }
  const m=PR.find(x=>x.k===key);
  const win=S.scope==='dev'?FAM_PK[fam]:(GRADES[k].pk||{});
  const w=win?win[key]:null;
  return w?[Math.max(m.min,w[0]),Math.min(m.max,w[1])]:[m.min,m.max];
}
/* 목적물성 prop 을 target 으로 — mode: 'comp' | 'proc'
   1단계: 단위 원가당 효율이 높은 노브부터 이분법으로 접근 (최소원가 우선)
   2단계: 그래도 목표 미달이면 좌표하강으로 도달 가능한 한계치까지 밀어붙이고,
          그 한계치와 한계를 만든 제약을 함께 보고한다 */
function solve(k,prop,target,mode){
  const t0=performance.now();
  const R0=S.res[k], base=R0[prop];
  const steps=[], knobs=knobList(k,mode), rejected=[];
  const want=Math.sign(target-base);                  // +1 이면 올려야 함
  const tol=Math.abs(target)*0.004;
  // 'both' 모드에서는 노브마다 성분/공정이 섞이므로 종류를 노브에서 읽는다
  const KIND={}; knobs.forEach(kb=>KIND[kb.e]=kb.kind);
  const bucket=e=>KIND[e]==='comp'?S.g[k].comp:S.g[k].proc;
  const getv=e=>bucket(e)[e];
  const setv=(e,v)=>{ bucket(e)[e]=v; };
  const tri=(e,v)=>trial(k,KIND[e],e,v);
  const orig={}; knobs.forEach(kb=>orig[kb.e]=getv(kb.e));

  // 새 'no' 등급 제약이 생기지 않는 변경만 채택
  const tryMove=(e,v)=>{
    const before=S.res[k], v0=getv(e);
    if(Math.abs(v-v0)<1e-12) return null;
    const Rn=tri(e,v);
    setv(e,v); S.res[k]=Rn;
    const c0=constraints(k,before).filter(x=>x.lv==='no').map(x=>x.id);
    const born=constraints(k,Rn).filter(x=>x.lv==='no'&&!c0.includes(x.id));
    if(born.length){ setv(e,v0); S.res[k]=before; return {ok:false,born}; }
    return {ok:true,before,Rn,v0};
  };
  const record=(kb,v0,to,before,Rn)=>{
    const ex=steps.find(s=>s.knob===kb.e);
    if(ex){ ex.to=to; ex.dP=Rn[prop]-ex.beforeP; ex.dC=Rn.cost.total-ex.beforeC; }
    else steps.push({knob:kb.e,mode:kb.kind,name:kb.n,from:v0,to,d:kb.d,
      beforeP:before[prop], beforeC:before.cost.total,
      dP:Rn[prop]-before[prop], dC:Rn.cost.total-before.cost.total,
      sens:kb.dP, unit:kb.u});
    S.g[k].solved[kb.e]=1;
  };

  // 6-1 민감도 · 단가탄력도
  // 국소 미분만 쓰면 문턱형 인자를 놓친다. 예로 430 의 Ti 는 현재값 부근에서
  // 기울기가 0 이지만(TiN 고정에도 못 미치는 양), 완전 안정화 수준까지 올리면
  // 예민화가 사라져 공식전위가 크게 오른다. 그래서 전 구간 할선(secant)도 함께 본다.
  const sens=knobs.map(kb=>{
    const v0=getv(kb.e);
    const h=Math.max(kb.st,(kb.hi-kb.lo)/60);
    const vp=Math.min(kb.hi,v0+h), vm=Math.max(kb.lo,v0-h);
    if(vp-vm<1e-12) return null;
    const Rp=tri(kb.e,vp), Rm=tri(kb.e,vm);
    let dP=(Rp[prop]-Rm[prop])/(vp-vm);
    const dC=(Rp.cost.total-Rm.cost.total)/(vp-vm);
    // 전 구간 할선 — 구간 양끝과 중간 몇 점을 보고 최대 변화폭을 잡는다
    let plo=Infinity, phi=-Infinity;
    for(let i=0;i<=8;i++){
      const pv=tri(kb.e,kb.lo+(kb.hi-kb.lo)*i/8)[prop];
      if(pv<plo) plo=pv; if(pv>phi) phi=pv;
    }
    const span=phi-plo;
    if(!isFinite(dP)) dP=0;
    if(Math.abs(dP)<1e-9){
      if(span<Math.max(1e-6,Math.abs(R0[prop])*0.002)) return null;   // 정말 무관한 노브
      const pHi=tri(kb.e,kb.hi)[prop], pLo=tri(kb.e,kb.lo)[prop];
      dP=(pHi-pLo)/(kb.hi-kb.lo);
      if(Math.abs(dP)<1e-9) dP=span/(kb.hi-kb.lo);   // 비단조면 폭으로 대체
    }
    return {...kb,v0,dP,dC,span,eff:Math.abs(dP)/(Math.abs(dC)+0.35)};
  }).filter(Boolean).sort((a,b)=>b.eff-a.eff);

  // 6-2 1단계 — 효율 순 이분법
  for(const kb of sens){
    if(Math.abs(target-S.res[k][prop])<tol) break;
    const v0=getv(kb.e);
    const dir=Math.sign(target-S.res[k][prop])*Math.sign(kb.dP);
    const lo=dir>0?v0:kb.lo, hi=dir>0?kb.hi:v0;
    if(hi-lo<1e-9) continue;
    const fn=v=>tri(kb.e,v)[prop]-target;
    const flo=fn(lo), fhi=fn(hi);
    let bv;
    if(flo*fhi<=0){ let a=lo,b=hi;
      for(let i=0;i<44;i++){const m=(a+b)/2; (fn(a)*fn(m)<=0)?b=m:a=m;}
      bv=(a+b)/2;
    }else bv=Math.abs(flo)<Math.abs(fhi)?lo:hi;
    bv=cl(Math.round(bv/kb.st)*kb.st,kb.lo,kb.hi);
    // 스냅 때문에 구간 끝을 못 밟는 경우 보정
    if(Math.abs(bv-kb.lo)<kb.st) bv=Math.abs(fn(kb.lo))<Math.abs(fn(bv))?kb.lo:bv;
    if(Math.abs(bv-kb.hi)<kb.st) bv=Math.abs(fn(kb.hi))<Math.abs(fn(bv))?kb.hi:bv;
    if(Math.abs(bv-v0)<1e-12) continue;
    const r=tryMove(kb.e,bv);
    if(!r) continue;
    if(!r.ok){ rejected.push({knob:kb.e,mode:kb.kind,name:kb.n,to:bv,d:kb.d,eff:kb.eff,
                              why:r.born.map(x=>x.txt)}); continue; }
    record(kb,r.v0,bv,r.before,r.Rn);
  }

  // 6-3 2단계 — 목표 미달이면 한계치를 다시 찾는다.
  // 1단계는 각 노브를 끝값으로 밀어붙이므로 상호작용이 강한 계(Ti–N–C 결합 등)에서
  // 나쁜 모서리에 갇힐 수 있다. 그래서 원래 상태로 되돌린 뒤 좌표상승을 새로 돌리고,
  // 1단계 결과와 비교해 목표에 더 가까운 쪽을 채택한다.
  let limited=false, binding=[];
  if(Math.abs(target-S.res[k][prop])>=tol){
    const s1val=S.res[k][prop];
    const s1state={}; knobs.forEach(kb=>s1state[kb.e]=getv(kb.e));
    knobs.forEach(kb=>setv(kb.e,orig[kb.e]));       // 원점 복귀
    S.res[k]=calc(k);

    for(let pass=0; pass<16; pass++){
      if(performance.now()-t0>400) break;            // 응답성 보장용 시간 예산
      const prev=S.res[k][prop];
      // 좌표법은 노브 순서에 따라 다른 국소해에 갇힌다. 매 패스마다 방향을 뒤집는다.
      const order=(pass%2)?sens.slice().reverse():sens;
      const baseBad=constraints(k,S.res[k]).filter(x=>x.lv==="no").map(x=>x.id);
      for(const kb of order){
        const v0=getv(kb.e);
        // 후보값 생성 — 스텝 격자에 스냅하되 구간 양끝은 반드시 포함한다.
        // (예: S 는 스텝 0.0005 라 반올림하면 하한 0.0004 를 영영 밟지 못한다)
        const cands=(lo,hi,n)=>{
          const a=[kb.lo,kb.hi,lo,hi];
          for(let i=0;i<=n;i++) a.push(cl(Math.round((lo+(hi-lo)*i/n)/kb.st)*kb.st,kb.lo,kb.hi));
          return [...new Set(a.map(v=>cl(v,kb.lo,kb.hi)))];
        };
        // 규격을 깨지 않는 후보 중 목표에 가장 가까운 값. 최적값이 막히면
        // 통째로 포기하지 말고 규격을 지키는 차선값을 쓴다.
        const scan=(lo,hi,n)=>{
          let bv=null,bp=S.res[k][prop];
          for(const v of cands(lo,hi,n)){
            const R2=tri(kb.e,v);
            const pv=R2[prop];
            const better = want>0 ? (pv>bp && pv<=target+tol) : (pv<bp && pv>=target-tol);
            if(!better) continue;
            const born=constraints(k,R2).filter(x=>x.lv==='no'&&!baseBad.includes(x.id));
            if(born.length){
              if(!rejected.some(x=>x.knob===kb.e))
                rejected.push({knob:kb.e,mode:kb.kind,name:kb.n,to:v,d:kb.d,eff:kb.eff,
                               why:born.map(x=>x.txt)});
              continue;
            }
            bp=pv; bv=v;
          }
          return bv;
        };
        let best=scan(kb.lo,kb.hi,24);
        if(best!==null){
          const w=(kb.hi-kb.lo)/12;
          const fine=scan(Math.max(kb.lo,best-w),Math.min(kb.hi,best+w),16);
          if(fine!==null) best=fine;
        }
        if(best===null||Math.abs(best-v0)<1e-12) continue;
        const r=tryMove(kb.e,best);
        if(!r||!r.ok) continue;
      }
      if(Math.abs(S.res[k][prop]-prev)<Math.abs(target)*0.00005) break;
    }
    // 규격선에 붙어 정체하면 — 목적물성을 개선하지는 않지만 구속 규격의 여유를
    // 넓히는 수를 먼저 두고 다시 오른다. (예: 304 YS 는 EL 40 % 선에 걸리는데,
    // Mn·Cu 를 낮춰 Md30 을 최적점으로 옮기면 EL 여유가 생겨 Cr·Si 를 더 올릴 수 있다)
    const margin=()=>{
      const R=S.res[k]; let m=Infinity;
      Object.entries(GRADES[k].mech).forEach(([mk,[lo,hi]])=>{
        if(lo!==null) m=Math.min(m,(R[mk]-lo)/Math.abs(lo));
        if(hi!==null) m=Math.min(m,(hi-R[mk])/Math.abs(hi));
      });
      return m;
    };
    for(let round=0; round<4; round++){
      if(performance.now()-t0>700) break;
      if(Math.abs(target-S.res[k][prop])<tol) break;
      const p0=S.res[k][prop];
      const baseBad2=constraints(k,S.res[k]).filter(x=>x.lv==='no').map(x=>x.id);
      let moved=false;
      for(const kb of sens){
        const v0=getv(kb.e), pNow=S.res[k][prop], mNow=margin();
        let bv=null, bm=mNow;
        for(let i=0;i<=32;i++){
          const v=cl(Math.round((kb.lo+(kb.hi-kb.lo)*i/32)/kb.st)*kb.st,kb.lo,kb.hi);
          const R2=tri(kb.e,v);
          // 목적물성은 거의 유지하되(0.3 % 이내 손실) 규격 여유는 늘리는 수
          const keep = want>0 ? R2[prop]>=pNow-Math.abs(pNow)*0.003
                              : R2[prop]<=pNow+Math.abs(pNow)*0.003;
          if(!keep) continue;
          if(constraints(k,R2).filter(x=>x.lv==='no'&&!baseBad2.includes(x.id)).length) continue;
          const sv=(()=>{ const sav=getv(kb.e); setv(kb.e,v); const t=S.res[k]; S.res[k]=R2;
            const mm=margin(); S.res[k]=t; setv(kb.e,sav); return mm; })();
          if(sv>bm+1e-9){ bm=sv; bv=v; }
        }
        if(bv===null||Math.abs(bv-v0)<1e-12) continue;
        const r=tryMove(kb.e,bv);
        if(r&&r.ok) moved=true;
      }
      if(!moved) break;
      // 여유를 벌었으면 다시 개선 방향으로 두 패스
      for(let pass=0; pass<2; pass++){
        const baseBad=constraints(k,S.res[k]).filter(x=>x.lv==='no').map(x=>x.id);
        for(const kb of sens){
          const v0=getv(kb.e); let bv=null,bp=S.res[k][prop];
          for(let i=0;i<=32;i++){
            const v=cl(Math.round((kb.lo+(kb.hi-kb.lo)*i/32)/kb.st)*kb.st,kb.lo,kb.hi);
            const R2=tri(kb.e,v), pv=R2[prop];
            const better = want>0 ? (pv>bp && pv<=target+tol) : (pv<bp && pv>=target-tol);
            if(!better) continue;
            if(constraints(k,R2).filter(x=>x.lv==='no'&&!baseBad.includes(x.id)).length) continue;
            bp=pv; bv=v;
          }
          if(bv!==null&&Math.abs(bv-v0)>1e-12) tryMove(kb.e,bv);
        }
      }
      if(Math.abs(S.res[k][prop]-p0)<Math.abs(target)*0.00005) break;
    }

    // 두 결과 중 목표에 가까운 쪽 채택
    if(Math.abs(target-s1val) < Math.abs(target-S.res[k][prop])){
      knobs.forEach(kb=>setv(kb.e,s1state[kb.e]));
      S.res[k]=calc(k);
    }
    // 최종 상태 기준으로 steps 재구성 — 노브별 기여는 그 노브만 원래대로 되돌린 차이로 정의
    steps.length=0;
    const fin=S.res[k];
    knobs.forEach(kb=>{
      const to=getv(kb.e), from=orig[kb.e];
      if(Math.abs(to-from)<kb.st*0.5) return;
      const back=tri(kb.e,from);
      steps.push({knob:kb.e,mode:kb.kind,name:kb.n,from,to,d:kb.d,
        dP:fin[prop]-back[prop], dC:fin.cost.total-back.cost.total,
        sens:(sens.find(s=>s.e===kb.e)||{dP:0}).dP,
        unit:kb.u});
      S.g[k].solved[kb.e]=1;
    });

    if(Math.abs(target-S.res[k][prop])>=tol){
      limited=true;
      binding=sens.filter(kb=>{
        const v=getv(kb.e);
        return Math.abs(v-kb.lo)<kb.st*0.6 || Math.abs(v-kb.hi)<kb.st*0.6;
      }).slice(0,5).map(kb=>({e:kb.e,name:kb.n,kind:kb.kind,at:Math.abs(getv(kb.e)-kb.lo)<kb.st*0.6?"하한":"상한",
                              lo:kb.lo,hi:kb.hi,d:kb.d}));
    }
  }
  recalc();
  return {steps,rejected,limited,binding,
          achieved:S.res[k][prop],ceiling:S.res[k][prop],
          target,base,sens:sens.slice(0,6),prop,mode};
}


/* ══════════════════════════════════════════════════════════════
   6-b. 대기 중인 수정 (여러 항목을 모아 한 번에 반영)
   ══════════════════════════════════════════════════════════════ */
const pendCount=k=>Object.keys(S.g[k].pend).length;
const pendVal=(k,kind,key)=>{
  const p=S.g[k].pend[kind+':'+key];
  return p?p.to:(kind==='comp'?S.g[k].comp:S.g[k].proc)[key];
};
/* 화면에 표시되는 계산값 전체를 평탄한 맵으로 — 변경 하이라이트 판정용 */
function outSnap(R){
  const o={};
  PROP.forEach(p=>o[p.k]=R[p.k]);
  ['creq','nieq','dCast','FN','dFin','md30','V30','msA','mu','gmax','kff',
   'ac1','ac3','msMar','fm','rbar','ridge','d','G','DOS','Ceff','crRed','tCR','pren']
    .forEach(x=>{ if(typeof R[x]==='number'&&isFinite(R[x])) o[x]=R[x]; });
  o.costTotal=R.cost.total; o.costAlloy=R.cost.alloy;
  o.costRefine=R.cost.refine; o.costConv=R.cost.conv;
  return o;
}
/* 표시 자릿수보다 크게 움직인 항목만 up/dn 으로 표시 */
const DIFF_DEC={EL:1,ic:2,rbar:2,Ceff:4,mu:3,creq:2,nieq:2,kff:2,
                dFin:2,dCast:1,FN:1,V30:1,ridge:1,d:1,G:1,crRed:1};
function diffOut(A,B){
  const a=outSnap(A), b=outSnap(B), d={};
  Object.keys(b).forEach(kk=>{
    if(!(kk in a)) return;
    const dec=DIFF_DEC[kk]!==undefined?DIFF_DEC[kk]:0;
    const eps=Math.pow(10,-dec)/2;
    if(Math.abs(b[kk]-a[kk])>=eps) d[kk]=b[kk]>a[kk]?'up':'dn';
  });
  return d;
}
const dcls=(k,key)=>{ const d=S.diff[k]; return d&&d[key]?' chg-'+d[key]:''; };

/* 입력 항목(성분·공정)의 변경 방향 — 바뀐 칸에 색을 입히기 위한 표식 */
function markInputs(k,beforeComp,beforeProc){
  const m={};
  EL.forEach(x=>{ const a=beforeComp[x.k], b=S.g[k].comp[x.k];
    if(Math.abs(b-a)>=Math.pow(10,-x.d)/2) m['comp:'+x.k]=b>a?'up':'dn'; });
  PR.forEach(x=>{ const a=beforeProc[x.k], b=S.g[k].proc[x.k];
    if(Math.abs(b-a)>=Math.pow(10,-x.d)/2) m['proc:'+x.k]=b>a?'up':'dn'; });
  S.inDiff[k]=m;
  return m;
}
const idcls=(k,kind,key)=>{ const d=S.inDiff[k]; return d&&d[kind+':'+key]?' chg-'+d[kind+':'+key]:''; };
