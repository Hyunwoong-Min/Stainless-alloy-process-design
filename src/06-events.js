/* ══════════════════════════════════════════════════════════════
   9. 이벤트 — 위임 방식
   ══════════════════════════════════════════════════════════════ */
let bound=false, pending=null;
function bindBays(){ if(bound) return; bound=true;
  const root=$('#bays');

  // 9-1 제조조건 입력 → 즉시 계산하지 않고 대기열에 쌓는다
  root.addEventListener('input',e=>{
    const t=e.target; if(!t.dataset.kind) return;
    const {g:k,kind,key}=t.dataset;
    const v=parseFloat(t.value); if(!isFinite(v)) return;
    const meta=kind==='comp'?EL.find(x=>x.k===key):PR.find(x=>x.k===key);
    const nv=cl(v,meta.min,meta.max);
    const cur=(kind==='comp'?S.g[k].comp:S.g[k].proc)[key];
    const pk=kind+':'+key;
    if(Math.abs(nv-cur)<Math.pow(10,-meta.d)/2){
      delete S.g[k].pend[pk];                 // 원래 값으로 되돌린 경우
    }else{
      S.g[k].pend[pk]={kind,key,from:cur,to:nv,d:meta.d,
        label:kind==='comp'?key:meta.n, unit:kind==='comp'?'wt%':meta.u, meta};
    }
    t.classList.toggle("pending",!!S.g[k].pend[pk]);
    // 라벨의 규격범위 자리에 반영 전 값을 취소선으로 — 여러 항목을 고칠 때 원래 값을 잊지 않도록
    const lab=t.closest(".f").querySelector("label i");
    if(lab){
      if(S.g[k].pend[pk]) lab.innerHTML=`<u title="반영 전 값">${f(cur,meta.d)}</u>`;
      else{
        const sp=kind==="comp"?GRADES[k].spec[key]:null;
        lab.textContent=sp?`${sp[0]}–${sp[1]===null?"—":sp[1]}`:(meta.u||"");
      }
    }
    refreshBar(k);
  });

  // Enter 로도 반영
  root.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||!e.target.dataset.kind) return;
    e.preventDefault();
    const k=e.target.dataset.g;
    if(pendCount(k)) applyPending(k);
  });
  // 9-2 물성 입력 → 역설계 선택지 노출
  root.addEventListener('change',e=>{
    const t=e.target; if(!t.dataset.prop) return;
    const k=t.dataset.g, pk=t.dataset.prop;
    const tgt=parseFloat(t.value); if(!isFinite(tgt)) return;
    const cur=S.res[k][pk], meta=PROP.find(x=>x.k===pk);
    if(Math.abs(tgt-cur)<Math.abs(cur)*0.002){ t.value=f(cur,meta.d); return; }
    pending={k,pk,tgt,cur};
    const box=$(`#ch-${k}-${meta.grp}`);
    box.hidden=false;
    box.innerHTML=`<p><b>${meta.n}</b> ${f(cur,meta.d)} → <b>${f(tgt,meta.d)}</b> ${meta.u}
      &nbsp;무엇을 바꿔 맞출까요?</p>
      <button class="btn sm" data-solve="comp">성분 변경</button>
      <button class="btn sm" data-solve="proc">제조조건 변경</button>
      <button class="btn sm" data-solve="both">둘 다 변경</button>
      <button class="btn sm" data-solve="cancel">취소</button>`;
    document.querySelectorAll('.prop').forEach(p=>p.classList.remove('tgt'));
    t.closest('.prop').classList.add('tgt');
  });

  // 9-3 수정 확인 / 되돌리기
  root.addEventListener("click",e=>{
    const a=e.target.closest("[data-apply]");
    if(a){ applyPending(a.dataset.apply); return; }
    const r=e.target.closest("[data-revert]");
    if(r){ S.g[r.dataset.revert].pend={}; render(); return; }
  });

  // 9-4 역설계 선택 처리
  root.addEventListener('click',e=>{
    const b=e.target.closest('[data-solve]'); if(!b||!pending) return;
    const mode=b.dataset.solve, {k,pk,tgt}=pending;
    if(mode==='cancel'){ pending=null; render(); return; }
    const bIn=S.res[k];
    const bC={...S.g[k].comp}, bP={...S.g[k].proc};
    const r=solve(k,pk,tgt,mode);
    S.diff[k]=diffOut(bIn,S.res[k]); markInputs(k,bC,bP);
    logInverse(k,r);
    const pm=PROP.find(x=>x.k===pk);
    const miss=Math.abs(r.achieved-r.target)>=Math.abs(r.target)*0.01;
    const mko=MODE_KO[mode]||mode;
    const bindTxt=(r.binding||[]).map(b=>`${b.name||b.e} ${b.at}`).join(', ');
    // 솔버가 실제로 바꾼 항목 — 변경 요약에 그대로 나열한다
    const list=r.steps.map(s=>({label:(s.mode==='proc'?'[공정] ':'[성분] ')+(s.name||s.knob),
                                from:s.from,to:s.to,d:s.d,unit:s.unit}));
    snap(k,pm.n,r.base,r.achieved,pm.d,pm.u,
         `역설계 · ${mko} 조정`,
         bIn,S.res[k],
         (r.steps.length
           ? `${mko} ${r.steps.length}개 항목을 단위 원가당 물성 변화량이 큰 순으로 조정했습니다.`
           : '규격·조업창 내에 해가 없어 변경하지 않았습니다.')
         +(miss
           ? ` 목표 ${f(r.target,pm.d)} ${pm.u} 는 ${mko} 조정만으로는 도달하지 못했습니다.`
             +(mode!=='both'?' [둘 다 변경] 으로 다시 시도하면 더 움직일 수 있습니다.':'')
           : ''),
         list.length?list:null,
         miss?{target:r.target,reach:r.achieved,unit:pm.u,label:pm.n,
               mode:mko,bind:bindTxt}:null);
    pending=null; render();
    const bay=document.querySelector(`[data-bay="${k}"]`);
    if(bay) bay.querySelector('details.basis').open=true;
  });
}


/* ── 변경 스냅샷 : 요약 패널의 원본 데이터 ─────────────────── */
function snap(k,what,from,to,dec,unit,mode,A,B,note,items,miss){
  S.chg[k]={what,from,to,d:dec,unit,mode,A,B,note,items:items||null,miss:miss||null};
}
function noteFor(k,kind,key,A,B){
  const R=B;
  if(kind==='comp'){
    if(key==='Cr') return 'Cr 는 PREN·Creq·Ac1 을 동시에 올리는 축입니다. 내식성이 개선되는 대신 페라이트 안정화가 진행되고 합금비가 kg 당 ' + S.prices.Cr + ' USD 증가합니다.';
    if(key==='Ni') return 'Ni 는 Nieq 를 통해 오스테나이트를 안정화합니다. 원가 기여도가 가장 큰 원소이므로 N·Cu·Mn 치환 여지를 함께 검토하십시오.';
    if(key==='C'||key==='N') return '침입형 원소는 고용강화(Pickering 식 계수 C 23, N 32)로 강도를 직접 올리는 대신, 오스테나이트계에서는 Md30 을 낮춰 TRIP 연신을 깎고 페라이트계에서는 예민화 위험을 키웁니다.';
    if(key==='Ti'||key==='Nb') return 'Ti·Nb 는 탄질화물로 C 를 고정해 예민화를 막습니다. Ti 는 N 을 먼저(TiN, Ti/N=3.42) 소모하므로 C 고정분까지 확보하려면 그만큼 더 넣어야 하고, 과잉 Ti 는 TiN 개재물로 공식전위를 깎습니다.';
    if(key==='Mo') return 'Mo 는 PREN 계수 3.3 으로 내공식성 기여가 크고 임계전류밀도도 낮추지만, kg 당 ' + S.prices.Mo + ' USD 로 가장 비싼 원소입니다.';
    if(key==='S') return 'S 는 MnS 개재물로 공식 기점이 됩니다. 낮출수록 내식성이 좋아지지만 심탈황 비용이 로그 스케일로 증가합니다.';
    if(key==='Cu') return 'Cu 는 Nieq 에 1.0 계수로 들어가 Ni 를 대체할 수 있고 임계전류밀도를 크게 낮추지만, 과다 시 열간취성 위험이 있습니다.';
    return '성분 변화가 당량·PREN·조직 경로를 거쳐 물성에 반영되었습니다.';
  }
  if(key==='crAnnT'||key==='hrAnnT'){
    if(R.fam!=='austenitic' && R.gmax>5)
      return '소둔온도는 Ac1 ' + f(R.ac1,0) + ' ℃ 를 기준으로 거동이 갈립니다. 아래면 탄화물이 구상화된 연질 페라이트, 위면 오스테나이트가 생겨 냉각 중 마르텐사이트로 변태해 경도가 급등합니다.';
    return '소둔온도는 Beck 성장식 exp(−Q/RT) 항을 통해 결정립에 지수적으로 작용합니다. 온도가 오르면 입경이 커져 Hall–Petch 강화가 줄고 연신이 늘어납니다.';
  }
  if(key==='crAnnV'||key==='hrAnnV') return '라인속도는 소둔 유효시간(45 m ÷ 속도)을 통해 결정립 성장시간과 예민화역 체류시간을 동시에 바꿉니다. 빠를수록 입경이 작아 강도가 오르고 톤당 고정비가 줄지만, 재결정 미완 위험이 생깁니다.';
  if(key==='fdt'||key==='ct') return '열연 조건은 열연판 결정립을 통해 냉연 재결정 초기립에 이어집니다. 페라이트계에서는 이 경로가 리징과 r값을 좌우합니다.';
  if(key==='hrT'||key==='crT') return '두께 변경은 냉간압하율 ' + f(R.crRed,1) + ' % 를 바꿉니다. 압하율이 클수록 저장에너지가 커져 재결정립이 미세해지고 {111} 집합조직이 발달합니다.';
  if(key==='rhfT'||key==='rdt'||key==='slab') return '재가열·조압연 조건은 석출물 고용도와 총 압하량을 통해 하공정 조직에 간접 작용합니다.';
  return '공정 변화가 조직 경로를 거쳐 물성에 반영되었습니다.';
}
/* ── 변경 이력 기록 ─────────────────────────────────────────── */
function delta(a,b,key,d,u){
  const dv=b-a; if(Math.abs(dv)<Math.pow(10,-d)/2) return '';
  const cls=dv>0?'up':'dn';
  return ` <span class="${cls}">${key} ${sgn(dv,d)}${u}</span>`;
}
function logInverse(k,r){
  const meta=PROP.find(x=>x.k===r.prop);
  const head=`<b>역설계 · ${meta.n} ${f(r.base,meta.d)} → 목표 ${f(r.target,meta.d)} ${meta.u}</b>`;
  if(!r.steps.length){
    S.log[k].push(head+` <span class="dn">달성 불가</span><br>
      <span class="d">${r.mode==='comp'?'성분':'제조조건'} 조정 범위(규격·설비 한계) 내에서 목표에 도달하는 해가 없습니다.
      다른 조정 대상을 선택하거나 목표를 완화하십시오.</span>`);
    return;
  }
  const body=r.steps.map(s=>{
    const nm=s.name||s.knob;
    return `${nm} ${f(s.from,s.d)} → ${f(s.to,s.d)} ${s.unit} `
      +`(감도 ${sgn(s.sens,Math.abs(s.sens)>10?1:2)} ${meta.u}/${s.unit}, `
      +`${meta.n} ${sgn(s.dP,meta.d)}, 원가 ${sgn(s.dC,1)} $/t)`;
  }).join('<br>');
  const rank=r.sens.slice(0,4).map(s=>{
    const nm=s.n||s.e;
    return `${nm} ${f(s.eff,2)}`;}).join(' · ');
  const hit=Math.abs(r.achieved-r.target)<Math.abs(r.target)*0.01;
  const rej=(r.rejected||[]).map(x=>{
    const nm=x.name||x.knob;
    return `${nm} → ${f(x.to,x.d)} 기각: ${x.why.join(' / ')}`;}).join('<br>');
  S.log[k].push(head+` <span class="${hit?'up':'dn'}">달성 ${f(r.achieved,meta.d)}</span>`
    +(hit?'':` <span class="dn">— 규격·조업창 내에서 목표 미달</span>`)+`<br>
    <span class="d">선정 기준: 단위 원가당 물성 변화량(감도÷원가탄력도)이 큰 순.
    후보 효율 순위 — ${rank}<br>${body}`
    +(rej?`<br><b>기각된 후보</b><br>${rej}`:'')+`</span>`);
}

/* ── 출력부만 갱신 (입력 포커스 유지) ───────────────────────── */
function refreshOut(){
  const rv=review();
  renderTabs(rv); renderBoard(rv);
  ORDER.forEach(k=>{
    const bay=document.querySelector(`[data-bay="${k}"]`); if(!bay) return;
    const R=S.res[k], cons=constraints(k,R), ops=operability(k);
    const specOK=!cons.some(x=>x.id.startsWith('spec_')||x.id.startsWith('mech_'));
    const near=nearestGrade(R.fam,S.g[k].comp);
    const offN=Object.entries(GRADES[k].spec).filter(([e,[lo,hi]])=>{const v=S.g[k].comp[e];
      return v<lo-1e-9||(hi!==null&&v>hi+1e-9);}).length;
    const chips=[specOK?['ok','기준규격 적합']:['no','기준규격 이탈'],
      cons.filter(x=>x.lv==='wa').length?['wa',`야금 주의 ${cons.filter(x=>x.lv==='wa').length}`]:['ok','야금 정상'],
      ops.length?['no',`조업 오류 ${ops.length}`]:['ok','조업 가능'],
      offN?['wa',`개발강종 · 최근접 ${near.g}`]:['ok',`표준 ${GRADES[k].label}`],
      ['ok',`${f(R.cost.total,0)} USD/t`]];
    bay.querySelector('.chips').innerHTML=chips.map(([c,t])=>`<span class="chip ${c}">${t}</span>`).join('');
    bay.querySelector('.col.out').innerHTML=
      `<div class="grp"><div class="grp-h"><h3>기계적 성질</h3>
        <span class="hint">값을 고쳐 넣으면 역설계</span></div>
        <div class="props">${propHTML(k,'mech')}</div></div>
      <div class="grp"><div class="grp-h"><h3>내식성</h3>
        <span class="u">3.5 % NaCl 30 ℃ / 0.5 M H₂SO₄</span></div>
        <div class="props">${propHTML(k,'corr')}</div></div>
      <div class="grp"><div class="grp-h"><h3>야금 지표</h3></div>${idxHTML(k)}</div>
      <div class="grp"><div class="grp-h"><h3>원가</h3></div>${costHTML(k)}</div>`;
    const th=bay.querySelector(".thermo"); if(th) th.outerHTML=thermo(k);
    const sw=bay.querySelector(".sumwrap"); if(sw) sw.innerHTML=summaryHTML(k);
    const det=bay.querySelector('details.basis');
    const wasOpen=det.open;
    det.querySelector('summary').textContent=`설계 근거 · 적용 회귀식 ${R.eq.length}건`;
    det.querySelector('.basis-body').innerHTML=R.eq.map(e=>
      `<div class="eq"><h4>${esc(e.h)}</h4><code>${esc(e.f)}</code>
       <p>${esc(e.t).replace(/\n/g,'<br>')}</p><p class="src">${esc(e.s)}</p></div>`).join('');
    det.querySelector('.trail').innerHTML=`<div class="trail-h">변경 이력</div>`
      +(S.log[k].length?S.log[k].slice(-14).reverse().map(e=>`<div class="entry">${e}</div>`).join('')
        :'<div class="empty">변경 없음 — 기준 설계값</div>');
    det.open=wasOpen;
  });
}

/* ══════════════════════════════════════════════════════════════
   10. 상단 툴바
   ══════════════════════════════════════════════════════════════ */
$('#btnReset').onclick=()=>{ initState(); render(); renderSuggest(); renderThread(); };
$('#btnFix').onclick=()=>{
  const A0={}, C0={}, P0={};
  ORDER.forEach(g=>{A0[g]=S.res[g]; C0[g]={...S.g[g].comp}; P0[g]={...S.g[g].proc};});
  const ap=autoFix();
  ORDER.forEach(g=>{S.diff[g]=diffOut(A0[g],S.res[g]); markInputs(g,C0[g],P0[g]);});
  S.tab=REVIEW_TAB; render();
  const rv=review();
  ask(rv.pass
    ?`자동 개선 완료 — 페르소나 전원 ${rv.min.toFixed(1)}점 이상 달성`
    :`자동 개선 시도 — 현재 최저 ${rv.min.toFixed(1)}점`,
    `<p>${ap.length?'적용된 변경 '+ap.length+'건:':'적용 가능한 자동 개선안이 없습니다. 지적사항이 상충하거나 이미 한계값입니다.'}</p>`
    +(ap.length?`<ul>${ap.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`:'')
    +`<p>${rv.pass?'페르소나 5인 전원이 9.0 이상으로 <b>설계 승인</b> 상태입니다.'
      :'남은 지적사항은 페르소나 보드의 ▲ 표시 항목입니다.'}</p>`);
};
$('#btnNi').onclick=()=>{
  const res=[];
  ORDER.forEach(k=>{
    const nc=niCut(k); if(!nc) return;
    Object.keys(nc.c).forEach(e=>{ if(Math.abs(nc.c[e]-S.g[k].comp[e])>1e-9) S.g[k].solved[e]=1; });
    const before=S.res[k]; const prevNi=S.g[k].comp.Ni;
    const bC2={...S.g[k].comp}, bP2={...S.g[k].proc};
    S.g[k].comp={...nc.c}; recalc();
    S.diff[k]=diffOut(before,S.res[k]); markInputs(k,bC2,bP2);
    const A=S.res[k];
    S.log[k].push(`<b>Ni 절감 최적화</b> <span class="up">원가 −${f(nc.save,0)} $/t</span><br>
      <span class="d">Ni ${f(before.cost.brk.Ni/10/S.prices.Ni,2)} → ${f(S.g[k].comp.Ni,2)} wt%,
      N +${f(nc.dN,3)}, Cu +${f(nc.dCu,2)}, Mn +${f(nc.dMn,2)}<br>
      제약 유지: Md30 ${f(before.md30,0)}→${f(A.md30,0)} ℃ (±12 이내), PREN ${f(before.pren,1)}→${f(A.pren,1)},
      δ@1300 ${f(A.dCast,1)} %, FN ${f(A.FN,1)}, YS ${f(A.YS,0)} / TS ${f(A.TS,0)} / EL ${f(A.EL,1)} 모두 A240 충족<br>
      근거: Nieq = Ni+22C+14.2N+0.31Mn+Cu 에서 N은 Ni의 14.2배, Cu는 1배 오스테나이트 안정화 효과를 내지만
      단가는 N $${S.prices.N}/kg · Cu $${S.prices.Cu}/kg 대 Ni $${S.prices.Ni}/kg 이므로 등가 안정화당 비용이 낮음</span>`);
    snap(k,"Ni",prevNi,S.g[k].comp.Ni,2,"wt%","최소원가 최적화 · 성분 치환",before,A,
      "Nieq = Ni+22C+14.2N+0.31Mn+Cu 에서 N 의 계수는 14.2, Cu 는 1.0 입니다. 즉 N 1 kg 이 Ni 14.2 kg 의 오스테나이트 안정화 효과를 내면서 단가는 훨씬 낮으므로, Md30 등가를 유지한 채 Ni 를 덜어낼 수 있습니다.");
    res.push(`${GRADES[k].label}: Ni −${nc.dNi.toFixed(2)} wt% → −${nc.save.toFixed(0)} USD/t`);
  });
  render();
  ask('Ni 절감 최적화',res.length
    ?`<p>Md30 ±12 ℃, PREN, δ@1300 ℃, 용접 FN, A240 기계적 규격을 모두 유지하는 조건에서
       N·Cu·Mn 으로 Ni 를 치환했습니다.</p><ul>${res.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>`
    :'<p>현재 설계에서 제약을 유지하며 추가로 절감 가능한 Ni 여유가 없습니다. 이미 최소 원가 근방입니다.</p>');
};
$('#btnPrices').onclick=()=>{
  const box=$('#priceBox');
  box.hidden=!box.hidden;
  if(!box.hidden) box.querySelector('input').focus();
};

/* ── 탭 전환 ────────────────────────────────────────────────── */
$('#tabs').addEventListener('click',e=>{
  const b=e.target.closest('[data-tab]'); if(!b) return;
  S.tab=b.dataset.tab;
  renderTabs(); applyTab();
  window.scrollTo({top:$('#tabs').offsetTop-14,
    behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
});

/* ══════════════════════════════════════════════════════════════
   9-b. 대기 중인 수정 반영
   ══════════════════════════════════════════════════════════════ */
function refreshBar(k){
  const bay=document.querySelector(`[data-bay="${k}"]`); if(!bay) return;
  const old=bay.querySelector('.applybar');
  const html=applyBarHTML(k);
  if(old){ if(html) old.outerHTML=html; else old.remove(); }
  else if(html) bay.querySelector('.bay-head').insertAdjacentHTML('afterend',html);
}
function applyPending(k){
  const items=Object.values(S.g[k].pend);
  if(!items.length) return;
  const A=S.res[k];
  items.forEach(p=>{
    (p.kind==='comp'?S.g[k].comp:S.g[k].proc)[p.key]=p.to;
    S.g[k].touched[p.key]=1; delete S.g[k].solved[p.key];
  });
  recalc();
  const B=S.res[k];
  S.diff[k]=diffOut(A,B);                   // 변한 값에 색을 입히기 위한 표식
  S.inDiff[k]={}; items.forEach(p=>{ S.inDiff[k][p.kind+":"+p.key]=p.to>p.from?"up":"dn"; });
  logApply(k,items,A,B);
  const one=items.length===1?items[0]:null;
  const list=items.map(p=>({label:p.label,from:p.from,to:p.to,d:p.d,unit:p.unit}));
  snap(k,
    one?one.label:`${items.length}개 항목 동시 수정`,
    one?one.from:null, one?one.to:null, one?one.d:0,
    one?one.unit:'',
    one?'제조조건 수정 → 물성 재계산':`제조조건 ${items.length}건 일괄 수정 → 물성 재계산`,
    A,B,
    one?noteFor(k,one.kind,one.key,A,B)
       :'여러 항목을 동시에 바꾸면 각 인자의 기여가 겹칩니다. 아래 야금 경로는 합산 결과이며, '
        +'개별 기여를 분리해 보려면 한 항목씩 반영하십시오.',
    one?null:list);
  S.g[k].pend={};
  render();
}
function logApply(k,items,A,B){
  let d='';
  d+=delta(A.YS,B.YS,'YS',0,'');
  d+=delta(A.TS,B.TS,'TS',0,'');
  d+=delta(A.EL,B.EL,'EL',1,'');
  d+=delta(A.HV,B.HV,'HV',0,'');
  d+=delta(A.Ep,B.Ep,'Ep',0,'mV');
  d+=delta(A.ic,B.ic,'icrit',2,'');
  d+=delta(A.cost.total,B.cost.total,'원가',0,'$');
  const head=items.map(p=>`${p.label} ${f(p.from,p.d)}→${f(p.to,p.d)} ${p.unit}`).join(', ');
  const why=B.fam==='austenitic'
    ? `Nieq ${f(A.nieq,2)}→${f(B.nieq,2)}, Md30 ${f(A.md30,0)}→${f(B.md30,0)} ℃, PREN ${f(A.pren,1)}→${f(B.pren,1)}`
    : `γmax ${f(A.gmax,0)}→${f(B.gmax,0)} %, Ac1 ${f(A.ac1,0)}→${f(B.ac1,0)} ℃, PREN ${f(A.pren,1)}→${f(B.pren,1)}`;
  S.log[k].push(`<b>${esc(head)}</b>${d}<br><span class="d">경로: ${why}`
    +(Math.abs(B.d-A.d)>0.2?`, 결정립 ${f(A.d,1)}→${f(B.d,1)} µm`:'')+`</span>`);
}

/* ── 설계 범위 전환 : 기준강종 규격 준수 ↔ 신강종 개발 ─────── */
function renderScope(){
  const b=$('#btnScope'); if(!b) return;
  const dev=S.scope==='dev';
  b.textContent='설계 범위: '+(dev?'신강종 개발':'기준규격 준수');
  b.classList.toggle('pri',dev);
  b.title=dev
    ? '기준강종 규격을 벗어나 계열 전체 설계공간에서 새 조성을 만들 수 있습니다. 규격 이탈은 개발강종 표식으로만 표시됩니다.'
    : '기준강종(304/410/430/439) 규격 안에서만 설계합니다. 규격 이탈은 불합격으로 판정됩니다.';
}
$('#btnScope').onclick=()=>{
  S.scope=S.scope==='dev'?'std':'dev';
  renderScope();
  // 범위가 좁아지면 현재 값이 창 밖일 수 있으므로 입력창 범위만 다시 그린다
  render();
  ask(`설계 범위를 ${S.scope==='dev'?'신강종 개발':'기준규격 준수'} 로 전환`,
    S.scope==='dev'
    ? `<p>이제 기준강종 규격을 벗어나 <b>계열 전체 설계공간</b>에서 조성을 잡을 수 있습니다.
       오스테나이트계는 Cr 16~26 · Ni 6~22 · Mo 0~4 · Mn 0.2~8 · N 0.01~0.35 %,
       페라이트계는 Cr 10.5~30 · Mo 0~4.5 · Ti/Nb 0~1 %,
       마르텐사이트계는 C 0.03~0.90 · Cr 11~18 · Ni 0~4 % 범위입니다.</p>
      <p>기준강종 규격 이탈은 <b>개발강종</b> 표식으로만 표시하고 불합격으로 보지 않습니다.
       다만 아래 세 가지는 모드와 무관하게 지킵니다 — Cr ≥ 10.5 %, PREN ≥ 11,
       그리고 계열 정체성(오스테나이트계가 듀플렉스로, 페라이트계가 마르텐사이트계로
       넘어가지 않을 것). 이걸 넘으면 모델의 적용역 자체를 벗어납니다.</p>
      <p>설계 조성이 어느 상용강종에 가까운지는 각 계열 상단 칩에 <b>최근접 강종</b>으로 표시됩니다.</p>`
    : `<p>기준강종 규격 안에서만 설계합니다. 규격을 벗어난 항목은 불합격으로 판정되고
       역설계 솔버도 규격창 밖으로 나가지 않습니다.</p>`);
};
renderScope();
