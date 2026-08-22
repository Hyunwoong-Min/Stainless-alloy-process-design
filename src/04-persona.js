/* ══════════════════════════════════════════════════════════════
   7. 페르소나 검증 (10점 만점, 전원 9점 이상이어야 설계 확정)
   ══════════════════════════════════════════════════════════════ */
const PERSONAS=[
  {id:'red',   c:'#B03636', n:'레드',  r:'스테인리스강 설계 권위자'},
  {id:'blue',  c:'#2E6FB8', n:'블루',  r:'공정·지시서 검증'},
  {id:'green', c:'#2C7A4B', n:'그린',  r:'원료 원가 전문가'},
  {id:'yellow',c:'#A8820C', n:'옐로',  r:'시장성 검증'},
  {id:'black', c:'#4A5560', n:'블랙',  r:'설계 수행 / 모델 정합'}
];
function review(){
  const out={}; PERSONAS.forEach(p=>out[p.id]={score:10,notes:[],fixes:[]});
  const push=(id,txt,pen,fix)=>{const o=out[id];o.notes.push({txt,hit:pen>0});
    o.score-=pen; if(fix)o.fixes.push(fix);};

  ORDER.forEach(k=>{
    const R=S.res[k], G=GRADES[k], c=S.g[k].comp, L=G.label;
    /* RED — 야금 타당성 */
    const cons=constraints(k,R);
    if(!cons.length) push('red',`${L} 야금 제약 전 항목 충족 (δ·Md30/γmax·FN·예민화·립경)`,0);
    cons.forEach(x=>push('red',`${L} ${x.txt}`,x.lv==='no'?2.0:1.0,{k,...x.fix}));

    /* BLUE — 조업 가능성 */
    const ops=operability(k);
    if(!ops.length) push('blue',`${L} 공정 열이력·압하 스케줄 정합, 설비 능력 내`,0);
    ops.forEach(x=>push('blue',`${L} ${x.txt}`,1.6,{k,...x.fix}));

    /* GREEN — 원가 */
    const dv=(R.cost.total-G.refCost)/G.refCost;
    if(dv>0.02){
      push('green',`${L} 원가 ${R.cost.total.toFixed(0)} USD/t — 기준 ${G.refCost} 대비 +${(dv*100).toFixed(1)} %`,
           Math.min(3,dv*45),null);
    }else{
      push('green',`${L} 원가 ${R.cost.total.toFixed(0)} USD/t — 기준 대비 ${(dv*100).toFixed(1)} %`,0);
    }
    if(R.fam==='austenitic'){
      const ni=R.cost.brk.Ni/R.cost.alloy*100;
      push('green',`${L} 합금비 중 Ni 비중 ${ni.toFixed(0)} %, Cr ${(R.cost.brk.Cr/R.cost.alloy*100).toFixed(0)} %`,0);
    }
    if(c.S<0.0008) push('green',`${L} S ${(c.S*1e4).toFixed(0)} ppm — 심탈황 비용 ${R.cost.sPen.toFixed(0)} USD/t 발생`,
                        Math.min(1,R.cost.sPen/70),{k,t:'comp',e:'S',v:0.0015});
    if(R.cost.conv>560) push('green',`${L} 가공비 ${R.cost.conv.toFixed(0)} USD/t 과다 — 소둔 온도·속도 재검토`,
                             Math.min(1.2,(R.cost.conv-560)/90),{k,t:'proc',e:'crAnnV',v:Math.min(150,S.g[k].proc.crAnnV+25)});

    /* YELLOW — 시장성 */
    const near=nearestGrade(R.fam,c);
    const dev=S.scope==='dev';
    let offSpec=0;
    Object.entries(G.spec).forEach(([e,[lo,hi]])=>{
      if(c[e]<lo-1e-9||(hi!==null&&c[e]>hi+1e-9)) offSpec++;
    });
    if(!offSpec){
      push('yellow',`${L} ${G.label} 규격 안 — 표준강종으로 즉시 판매 가능`,0);
    }else if(dev){
      // 개발강종은 규격 이탈 자체가 잘못이 아니라, 가까운 상용강종 대비
      // 차별점이 있는지와 승인 부담이 관건이다
      if(near.d<1.0)
        push('yellow',`${L} 기준 규격 ${offSpec}항목 이탈 — 조성이 사실상 ${near.g} 에 해당 (거리 ${near.d.toFixed(2)}). 기존 강종과 겹쳐 신규 개발 명분이 약함`,1.0,null);
      else if(near.d<2.0)
        push('yellow',`${L} 기준 규격 ${offSpec}항목 이탈 — ${near.g} 변형강 (거리 ${near.d.toFixed(2)}). 고객 승인 6~12개월 필요`,0.5,null);
      else
        push('yellow',`${L} 기준 규격 ${offSpec}항목 이탈 — 신규 조성 (최근접 ${near.g}, 거리 ${near.d.toFixed(2)}). 재질 심사·규격 등재 필요`,0.8,null);
    }else{
      push('yellow',`${L} 성분 ${offSpec}개 항목이 ${G.label} 규격 밖 — 표준강종으로 판매 불가`,
           Math.min(3,offSpec*1.5),null);
    }
    const mfail=Object.entries(G.mech).filter(([m,[lo,hi]])=>
      (lo!==null&&R[m]<lo)||(hi!==null&&R[m]>hi)).map(([m])=>m);
    if(mfail.length) push('yellow',
      dev?`${L} ${mfail.join(', ')} 가 ${G.label} 기준 밖 — 신규 물성 등급으로 제시해야 함`
         :`${L} ${mfail.join(', ')} 규격 미달 — 성적서 발행 불가`,
      dev?mfail.length*0.4:mfail.length*1.5,null);
    const pc=(R.cost.total-G.refCost)/G.refCost*100;
    if(pc>6) push('yellow',`${L} 기준강종 대비 원가 +${pc.toFixed(0)} % — 그만한 성능 차별점이 필요`,Math.min(2,(pc-6)/9),null);
    else push('yellow',`${L} ${G.demand}`,0);
    /* BLACK — 모델 정합 */
    const bad=[...Object.values(R).filter(v=>typeof v==='number'&&!isFinite(v))];
    if(bad.length) push('black',`${L} 모델 발산 — 입력 범위 확인 필요`,3,null);
    else push('black',`${L} 계산 수렴, ${R.eq.length}개 회귀식 적용 · 근거 기록 완료`,0);
    if(R.fam==='austenitic'&&Math.abs(R.md30-R.md30A)>230)
      push('black',`${L} Nohara·Angel Md30 편차 ${Math.abs(R.md30-R.md30A).toFixed(0)} ℃ — 두 식의 적용역 상이, 참고만`,0.3,null);
  });

  PERSONAS.forEach(p=>{out[p.id].score=Math.max(0,Math.min(10,out[p.id].score));});
  out.min=Math.min(...PERSONAS.map(p=>out[p.id].score));
  out.pass=out.min>=9;
  return out;
}

/* ── 자동 개선 : 9점 미만 지적사항을 순차 반영 ─────────────── */
/* 게이트는 9.0 이지만 자동 개선은 9.5 를 목표로 여유를 확보한다 */
function autoFix(){
  const applied=[]; let prev=-1;
  for(let it=0; it<14; it++){
    const rv=review();
    if(rv.min>=9.5) break;
    if(rv.min<=prev && it>0) break;          // 개선이 멈추면 중단
    prev=rv.min;
    const fixes=[];
    PERSONAS.forEach(p=>{ if(rv[p.id].score<9.5) fixes.push(...rv[p.id].fixes); });
    if(!fixes.length) break;
    const f=fixes[0]; if(!f||!f.k) break;
    const k=f.k;
    if(f.t==='comp'){
      const kn=GRADES[k].knobs[f.e]||[EL.find(x=>x.k===f.e).min,EL.find(x=>x.k===f.e).max];
      const spec=GRADES[k].spec[f.e];
      let lo=kn[0],hi=kn[1];
      if(spec){ lo=Math.max(lo,spec[0]); if(spec[1]!==null) hi=Math.min(hi,spec[1]); }
      const dec=EL.find(x=>x.k===f.e).d;
      const nv=+cl(f.v,lo,hi).toFixed(dec);
      if(Math.abs(nv-S.g[k].comp[f.e])<1e-9) break;
      applied.push(`${GRADES[k].label} ${f.e} ${S.g[k].comp[f.e]} → ${nv} wt%`);
      S.g[k].comp[f.e]=nv; S.g[k].solved[f.e]=1;
    }else if(f.t==='proc'){
      const m=PR.find(x=>x.k===f.e);
      const nv=+cl(f.v,m.min,m.max).toFixed(m.d);
      if(Math.abs(nv-S.g[k].proc[f.e])<1e-9) break;
      applied.push(`${GRADES[k].label} ${m.n} ${S.g[k].proc[f.e]} → ${nv} ${m.u}`);
      S.g[k].proc[f.e]=nv; S.g[k].solved[f.e]=1;
    }else if(f.t==='prop'){
      const r=solve(k,f.e,f.v,'proc');
      if(!r.steps.length){ const r2=solve(k,f.e,f.v,'comp');
        if(!r2.steps.length) break;
        applied.push(`${GRADES[k].label} ${f.e} 목표 ${f.v.toFixed(0)} → 성분 ${r2.steps.map(s=>s.knob).join('·')} 조정`);
      }else applied.push(`${GRADES[k].label} ${f.e} 목표 ${f.v.toFixed(0)} → 공정 ${r.steps.map(s=>s.knob).join('·')} 조정`);
    }else break;
    recalc();
  }
  return applied;
}
