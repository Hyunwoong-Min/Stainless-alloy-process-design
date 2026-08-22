/* ══════════════════════════════════════════════════════════════
   4. 상태
   ══════════════════════════════════════════════════════════════ */
const S={g:{},prices:{...PRICE0},log:{},thread:[],res:{},chg:{},diff:{},inDiff:{},tab:ORDER[0]};
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

  // 규격 성분
  Object.entries(G.spec).forEach(([e,[lo,hi]])=>{
    const v=c[e];
    if(v<lo-1e-9)      add('spec_'+e,`${e} 규격`,v,`${e} ${v} % < A240 하한 ${lo} %`,'no',{t:'comp',e,v:lo});
    else if(hi!==null&&v>hi+1e-9) add('spec_'+e,`${e} 규격`,v,`${e} ${v} % > A240 상한 ${hi} %`,'no',{t:'comp',e,v:hi});
  });
  // 기계적 규격
  Object.entries(G.mech).forEach(([m,[lo,hi]])=>{
    const v=R[m], u=PROP.find(x=>x.k===m).u;
    if(lo!==null&&v<lo) add('mech_'+m,`${m} 규격`,v,`${m} ${v.toFixed(0)} ${u} < A240 최소 ${lo}`,'no',{t:'prop',e:m,v:lo*1.04});
    if(hi!==null&&v>hi) add('mech_'+m,`${m} 규격`,v,`${m} ${v.toFixed(0)} ${u} > A240 최대 ${hi}`,'no',{t:'prop',e:m,v:hi*0.96});
  });
  // 열간연성 — δ/γ 이상역을 갖는 계열에만 적용
  if(R.fam!=='ferritic'){
    if(R.dCast<2)      add('dcast','열간연성 δ',R.dCast,`1300 ℃ δ ${R.dCast.toFixed(1)} % < 2 % — 완전 오스테나이트 응고, 고온균열 위험`,'wa',{t:'comp',e:'Cr',v:c.Cr+0.35});
    else if(R.dCast>12)add('dcast','열간연성 δ',R.dCast,`1300 ℃ δ ${R.dCast.toFixed(1)} % > 12 % — 열간압연 중 에지크랙 위험`,'wa',{t:'comp',e:'Ni',v:c.Ni+0.35});
  }
  if(R.fam==='austenitic'){
    if(R.md30>40)  add('md30','Md30',R.md30,`Md30 ${R.md30.toFixed(0)} ℃ > 40 — 성형 중 α′ 과다, 시효균열·자성 발현`,'wa',{t:'comp',e:'Ni',v:c.Ni+0.30});
    if(R.md30<-40) add('md30','Md30',R.md30,`Md30 ${R.md30.toFixed(0)} ℃ < −40 — TRIP 소실로 연신·인장 저하`,'wa',{t:'comp',e:'Ni',v:c.Ni-0.30});
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
    if(R.gmax<90)  add('gmax','γmax',R.gmax,`γmax ${R.gmax.toFixed(0)} % < 90 — 완전 경화 불가, δ 잔류`,'wa',{t:'comp',e:'C',v:Math.min(0.145,c.C+0.015)});
    if(R.msMar<150)add('ms','Ms',R.msMar,`Ms ${R.msMar.toFixed(0)} ℃ < 150 — 잔류 오스테나이트 과다`,'wa',{t:'comp',e:'C',v:Math.max(0.085,c.C-0.012)});
  }
  // 공통
  // 완전 안정화에 필요한 Ti = TiN 소모분(3.42·N) + 잔여 C 고정분(4·Ceff) + 여유
  const tiNeed=3.42*c.N+4*Math.max(0,c.C-c.Nb/7.75)+0.02;
  if(R.DOS>30)  add('dos','예민화',R.DOS,
                    `DOS ${R.DOS.toFixed(0)} / 100 — 입계 Cr 결핍, 내식성 저하`
                    +(R.fam!=='austenitic'?` (완전 안정화 소요 Ti ≒ ${tiNeed.toFixed(3)} %, 현재 ${c.Ti} %)`:''),'wa',
                    R.fam==='austenitic'?{t:'proc',e:'crAnnV',v:p.crAnnV+20}
                                        :{t:'comp',e:'Ti',v:tiNeed});
  if(R.d>45)    add('grain','결정립',R.d,`d ${R.d.toFixed(0)} µm (ASTM ${R.G.toFixed(1)}) — 오렌지필·강도 저하`,'wa',{t:'proc',e:'crAnnT',v:p.crAnnT-25});
  if(R.d<8)     add('grain','결정립',R.d,`d ${R.d.toFixed(1)} µm — 재결정 불완전 가능`,'wa',{t:'proc',e:'crAnnT',v:p.crAnnT+25});
  if(R.pren<11) add('pren','PREN',R.pren,`PREN ${R.pren.toFixed(1)} < 11 — 스테인리스 최소 Cr 요건 미달`,'no',{t:'comp',e:'Cr',v:c.Cr+0.5});
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
  if(mode==='comp'){
    return Object.entries(GRADES[k].knobs).map(([e,[lo,hi]])=>({e,lo,hi,
      st:EL.find(x=>x.k===e).s, d:EL.find(x=>x.k===e).d}));
  }
  // 공정 노브는 설비 최대범위가 아니라 강종별 야금학적 조업창(pk) 안에서만 움직인다
  const win=GRADES[k].pk||{};
  return PROC_KNOBS.map(e=>{const m=PR.find(x=>x.k===e), w=win[e];
    return {e,lo:w?Math.max(m.min,w[0]):m.min,hi:w?Math.min(m.max,w[1]):m.max,st:m.s,d:m.d};});
}
/* 목적물성 prop 을 target 으로 — mode: 'comp' | 'proc'
   1단계: 단위 원가당 효율이 높은 노브부터 이분법으로 접근 (최소원가 우선)
   2단계: 그래도 목표 미달이면 좌표하강으로 도달 가능한 한계치까지 밀어붙이고,
          그 한계치와 한계를 만든 제약을 함께 보고한다 */
function solve(k,prop,target,mode){
  const R0=S.res[k], base=R0[prop];
  const steps=[], knobs=knobList(k,mode), rejected=[];
  const want=Math.sign(target-base);                  // +1 이면 올려야 함
  const tol=Math.abs(target)*0.004;
  const getv=e=>(mode==='comp'?S.g[k].comp:S.g[k].proc)[e];
  const setv=(e,v)=>{ (mode==='comp'?S.g[k].comp:S.g[k].proc)[e]=v; };

  // 새 'no' 등급 제약이 생기지 않는 변경만 채택
  const tryMove=(e,v)=>{
    const before=S.res[k], v0=getv(e);
    if(Math.abs(v-v0)<1e-12) return null;
    const Rn=trial(k,mode,e,v);
    setv(e,v); S.res[k]=Rn;
    const c0=constraints(k,before).filter(x=>x.lv==='no').map(x=>x.id);
    const born=constraints(k,Rn).filter(x=>x.lv==='no'&&!c0.includes(x.id));
    if(born.length){ setv(e,v0); S.res[k]=before; return {ok:false,born}; }
    return {ok:true,before,Rn,v0};
  };
  const record=(kb,v0,to,before,Rn)=>{
    const ex=steps.find(s=>s.knob===kb.e);
    if(ex){ ex.to=to; ex.dP=Rn[prop]-ex.beforeP; ex.dC=Rn.cost.total-ex.beforeC; }
    else steps.push({knob:kb.e,mode,from:v0,to,d:kb.d,
      beforeP:before[prop], beforeC:before.cost.total,
      dP:Rn[prop]-before[prop], dC:Rn.cost.total-before.cost.total,
      sens:kb.dP, unit:mode==='comp'?'wt%':(PR.find(x=>x.k===kb.e).u)});
    S.g[k].solved[kb.e]=1;
  };

  // 6-1 민감도 · 단가탄력도
  const sens=knobs.map(kb=>{
    const v0=getv(kb.e);
    const h=Math.max(kb.st,(kb.hi-kb.lo)/60);
    const vp=Math.min(kb.hi,v0+h), vm=Math.max(kb.lo,v0-h);
    if(vp-vm<1e-12) return null;
    const Rp=trial(k,mode,kb.e,vp), Rm=trial(k,mode,kb.e,vm);
    const dP=(Rp[prop]-Rm[prop])/(vp-vm);
    const dC=(Rp.cost.total-Rm.cost.total)/(vp-vm);
    if(!isFinite(dP)||Math.abs(dP)<1e-9) return null;
    return {...kb,v0,dP,dC,eff:Math.abs(dP)/(Math.abs(dC)+0.35)};
  }).filter(Boolean).sort((a,b)=>b.eff-a.eff);

  // 6-2 1단계 — 효율 순 이분법
  for(const kb of sens){
    if(Math.abs(target-S.res[k][prop])<tol) break;
    const v0=getv(kb.e);
    const dir=Math.sign(target-S.res[k][prop])*Math.sign(kb.dP);
    const lo=dir>0?v0:kb.lo, hi=dir>0?kb.hi:v0;
    if(hi-lo<1e-9) continue;
    const fn=v=>trial(k,mode,kb.e,v)[prop]-target;
    const flo=fn(lo), fhi=fn(hi);
    let bv;
    if(flo*fhi<=0){ let a=lo,b=hi;
      for(let i=0;i<44;i++){const m=(a+b)/2; (fn(a)*fn(m)<=0)?b=m:a=m;}
      bv=(a+b)/2;
    }else bv=Math.abs(flo)<Math.abs(fhi)?lo:hi;
    bv=cl(Math.round(bv/kb.st)*kb.st,kb.lo,kb.hi);
    if(Math.abs(bv-v0)<kb.st*0.5) continue;
    const r=tryMove(kb.e,bv);
    if(!r) continue;
    if(!r.ok){ rejected.push({knob:kb.e,mode,to:bv,d:kb.d,eff:kb.eff,
                              why:r.born.map(x=>x.txt)}); continue; }
    record(kb,r.v0,bv,r.before,r.Rn);
  }

  // 6-3 2단계 — 아직 목표에 못 미치면 좌표하강으로 한계치 탐색
  let limited=false, binding=[];
  if(Math.abs(target-S.res[k][prop])>=tol){
    for(let pass=0; pass<5; pass++){
      const prev=S.res[k][prop];
      for(const kb of sens){
        const v0=getv(kb.e), n=24;
        let bestV=v0, bestP=S.res[k][prop];
        for(let i=0;i<=n;i++){
          const v=cl(Math.round((kb.lo+(kb.hi-kb.lo)*i/n)/kb.st)*kb.st,kb.lo,kb.hi);
          const pv=trial(k,mode,kb.e,v)[prop];
          // 목표 방향으로 더 나아가되 목표를 넘지는 않도록
          const better = want>0 ? (pv>bestP && pv<=target+tol) : (pv<bestP && pv>=target-tol);
          if(better){ bestP=pv; bestV=v; }
        }
        if(Math.abs(bestV-v0)<kb.st*0.5) continue;
        const r=tryMove(kb.e,bestV);
        if(!r) continue;
        if(!r.ok){ if(!rejected.some(x=>x.knob===kb.e))
            rejected.push({knob:kb.e,mode,to:bestV,d:kb.d,eff:kb.eff,
                           why:r.born.map(x=>x.txt)});
          continue; }
        record(kb,r.v0,bestV,r.before,r.Rn);
      }
      if(Math.abs(S.res[k][prop]-prev)<Math.abs(target)*0.0005) break;
    }
    if(Math.abs(target-S.res[k][prop])>=tol){
      limited=true;
      // 한계를 만든 요인 — 규격/조업창 끝에 닿은 노브
      binding=sens.filter(kb=>{
        const v=getv(kb.e);
        return Math.abs(v-kb.lo)<kb.st*0.6 || Math.abs(v-kb.hi)<kb.st*0.6;
      }).slice(0,5).map(kb=>({e:kb.e,at:Math.abs(getv(kb.e)-kb.lo)<kb.st*0.6?'하한':'상한',
                              lo:kb.lo,hi:kb.hi,d:kb.d}));
    }
  }
  recalc();
  return {steps,rejected,limited,binding,
          achieved:S.res[k][prop],ceiling:S.res[k][prop],
          target,base,sens:sens.slice(0,6),prop,mode};
}

/* ── Ni 절감 최적화 (GREEN) ─────────────────────────────────── */
function niCut(k){
  const R=S.res[k]; if(R.fam!=='austenitic') return null;
  const c0={...S.g[k].comp}, cost0=R.cost.total, md0=R.md30, pr0=R.pren;
  let best=null;
  for(let dNi=0.05;dNi<=1.20;dNi+=0.05){
    const Ni=c0.Ni-dNi; if(Ni<GRADES[k].knobs.Ni[0]) break;
    for(let dN=0;dN<=0.045;dN+=0.005){
      const N=Math.min(GRADES[k].knobs.N[1],c0.N+dN);
      for(let dCu=0;dCu<=0.70;dCu+=0.05){
        const Cu=Math.min(GRADES[k].knobs.Cu[1],c0.Cu+dCu);
        for(let dMn=0;dMn<=0.80;dMn+=0.10){
          const Mn=Math.min(GRADES[k].knobs.Mn[1],c0.Mn+dMn);
          const c={...c0,Ni:+Ni.toFixed(3),N:+N.toFixed(3),Cu:+Cu.toFixed(3),Mn:+Mn.toFixed(3)};
          const R2=compute(k,c,S.g[k].proc,S.prices);
          if(Math.abs(R2.md30-md0)>12) continue;
          if(R2.pren<pr0-0.25) continue;
          if(R2.dCast<2||R2.dCast>10) continue;
          if(R2.FN<3||R2.FN>12) continue;
          if(R2.YS<GRADES[k].mech.YS[0]||R2.TS<GRADES[k].mech.TS[0]||R2.EL<GRADES[k].mech.EL[0]) continue;
          if(R2.HV>GRADES[k].mech.HV[1]) continue;
          const save=cost0-R2.cost.total;
          if(!best||save>best.save) best={c,R:R2,save,dNi,dN:N-c0.N,dCu:Cu-c0.Cu,dMn:Mn-c0.Mn};
        }
      }
    }
  }
  return best&&best.save>8?best:null;
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
