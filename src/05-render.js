/* ══════════════════════════════════════════════════════════════
   8. 렌더링
   ══════════════════════════════════════════════════════════════ */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const f=(v,d)=>(v===null||v===undefined||!isFinite(v))?'—':Number(v).toFixed(d);
const sgn=(v,d)=>(v>=0?'+':'')+f(v,d);

/* ── 8-1 계열 탭 + 검증 탭 ──────────────────────────────────── */
const REVIEW_TAB='__review';
function renderTabs(rv){
  rv=rv||review();
  const fam=ORDER.map(k=>{
    const G=GRADES[k], R=S.res[k];
    const cons=constraints(k,R), ops=operability(k);
    const bad=cons.filter(x=>x.lv==='no').length+ops.length;
    const wa=cons.filter(x=>x.lv==='wa').length;
    const dot=bad?'no':(wa?'wa':'ok');
    return `<button class="tab${k===S.tab?' on':''}" data-tab="${k}"
      role="tab" aria-selected="${k===S.tab}">
      <i class="tdot-${dot}"></i>
      <b>${G.famKo}</b>
      <span>기준 ${G.label} · ${f(R.YS,0)} / ${f(R.TS,0)} MPa · ${f(R.cost.total,0)} USD/t</span>
    </button>`;
  }).join('');
  const low=PERSONAS.filter(p=>rv[p.id].score<9).length;
  const on=S.tab===REVIEW_TAB;
  return $('#tabs').innerHTML = fam + `<button class="tab rev${on?' on':''}"
    data-tab="${REVIEW_TAB}" role="tab" aria-selected="${on}">
    <i class="tdot-${rv.pass?'ok':'no'}"></i>
    <b>페르소나 검증</b>
    <span>${rv.pass?`5인 전원 통과 · 최저 ${rv.min.toFixed(1)} / 10`
                   :`미통과 ${low}인 · 최저 ${rv.min.toFixed(1)} / 10`}</span>
  </button>`;
}
/* 선택된 탭에 맞춰 표시 대상 전환 */
function applyTab(){
  const rev=S.tab===REVIEW_TAB;
  ORDER.forEach(k=>{
    const bay=document.querySelector(`[data-bay="${k}"]`);
    if(bay) bay.hidden = rev || k!==S.tab;
  });
  const b=$('#board'); if(b) b.hidden=!rev;
}


/* ── 8-2 페르소나 보드 ──────────────────────────────────────── */
function renderBoard(rv){
  $('#personas').innerHTML=PERSONAS.map(p=>{
    const o=rv[p.id], col=o.score>=9?'var(--pass)':o.score>=7?'var(--warn)':'var(--fail)';
    return `<div class="persona">
      <div class="p-top">
        <span class="dot" style="background:${p.c};color:${p.c}"></span>
        <span class="p-name">${p.n}<em>${p.r}</em></span>
        <span class="score" style="color:${col}">${o.score.toFixed(1)}<small>/10</small></span>
      </div>
      <div class="bar"><i style="width:${o.score*10}%;background:${col}"></i></div>
      <ul class="p-notes">${o.notes.slice(0,7).map(n=>
        `<li class="${n.hit?'hit':''}">${esc(n.txt)}</li>`).join('')}</ul>
    </div>`;
  }).join('');
  const g=$('#gate');
  g.className='gate '+(rv.pass?'ok':'no');
  g.textContent=rv.pass?`설계 승인 — 최저 ${rv.min.toFixed(1)} / 10`
                       :`검증 미통과 — 최저 ${rv.min.toFixed(1)} / 10 (기준 9.0)`;
}

/* ── 8-3 공정 열이력 ────────────────────────────────────────── */
/* 곡선만 SVG, 모든 글자는 HTML 이라 본문과 같은 크기로 읽힌다 */
function thermo(k){
  const p=S.g[k].proc, R=S.res[k];
  const pts=[['슬라브',p.rhfT],['RDT',p.rdt],['FDT',p.fdt],['CT',p.ct],
             ['열연소둔',p.hrAnnT],['냉간압연',60],['냉연소둔',p.crAnnT]];
  const H=130, hi=1320;
  const pct=v=>(1-v/hi)*100;
  const X=i=>i*100/(pts.length-1);
  const line=pts.map((q,i)=>`${X(i).toFixed(2)},${(pct(q[1])*H/100).toFixed(2)}`).join(' ');
  const ac1=(R.fam!=='austenitic'&&R.gmax>5)?R.ac1:null;
  const grid=[400,800,1200];
  return `<div class="thermo">
    <div class="cap">공정 열이력 · ${p.slab} mm 슬라브 → ${p.hrT} mm 열연 → ${p.crT} mm 냉연</div>
    <div class="tplot" style="height:${H}px">
      <svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">
        ${grid.map(t=>`<line x1="0" y1="${pct(t)*H/100}" x2="100" y2="${pct(t)*H/100}"
          stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"
          stroke-dasharray="3 4"/>`).join('')}
        ${ac1?`<line x1="0" y1="${pct(ac1)*H/100}" x2="100" y2="${pct(ac1)*H/100}"
          stroke="var(--fail)" stroke-width="1.4" vector-effect="non-scaling-stroke"
          stroke-dasharray="6 3"/>`:''}
        <polyline points="${line}" fill="none" stroke="var(--amber)" stroke-width="2.4"
          vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
      ${grid.map(t=>`<span class="tgrid" style="top:${pct(t)}%">${t} ℃</span>`).join('')}
      ${ac1?`<span class="tac1" style="top:${pct(ac1)}%">Ac1 ${ac1.toFixed(0)} ℃</span>`:''}
      ${pts.map((q,i)=>`<span class="tdot ${i>=5?'cold':'hot'}"
        style="left:${X(i)}%;top:${pct(q[1])}%"></span>`).join('')}
    </div>
    <div class="tstage">${pts.map((q,i)=>
      `<div class="${i>=5?'cold':'hot'}"><b>${q[0]}</b><span>${i===5?'냉간':q[1]+' ℃'}</span></div>`).join('')}</div>
  </div>`;
}

/* ── 8-4b 변경 요약 — 무엇을 바꿨고 왜 그렇게 움직였는지 ───── */
function summaryHTML(k){
  const c=S.chg[k];
  if(!c) return `<div class="sumbox empty-sum">
    <b>변경 요약</b> — 아직 수정한 항목이 없습니다. 위 제조조건을 고치거나 물성 값을 직접 입력하면
    그 변화가 어떤 야금 경로를 거쳐 어느 물성으로 이어졌는지 여기에 정리됩니다.</div>`;
  const A=c.A, B=c.B;
  const rows=PROP.map(pr=>{
    const a=A[pr.k], b=B[pr.k], dv=b-a;
    if(Math.abs(dv)<Math.pow(10,-pr.d)/2) return null;
    const lim=GRADES[k].mech[pr.k];
    let flag='';
    if(lim){ const[lo,hi]=lim;
      if(lo!==null&&b<lo) flag=`<span class="sf no">규격 미달 (min ${lo})</span>`;
      else if(hi!==null&&b>hi) flag=`<span class="sf no">규격 초과 (max ${hi})</span>`;
      else if((lo!==null&&a<lo)||(hi!==null&&a>hi)) flag=`<span class="sf ok">규격 진입</span>`;
    }
    return `<tr><td>${pr.n}</td><td><span class="num">${f(a,pr.d)}</span></td>
      <td><span class="num">${f(b,pr.d)}</span></td>
      <td><span class="num ${dv>0?'up':'dn'}">${sgn(dv,pr.d)}</span>
      <span class="mini">${pr.u}</span></td><td>${flag}</td></tr>`;
  }).filter(Boolean);
  const dC=B.cost.total-A.cost.total;
  if(Math.abs(dC)>=0.5) rows.push(`<tr><td>총원가</td><td><span class="num">${f(A.cost.total,0)}</span></td>
    <td><span class="num">${f(B.cost.total,0)}</span></td>
    <td><span class="num ${dC<0?'up':'dn'}">${sgn(dC,0)}</span><span class="mini">USD/t</span></td>
    <td>${Math.abs(dC)>40?`<span class="sf ${dC<0?'ok':'no'}">원가 영향 큼</span>`:''}</td></tr>`);

  // 중간 야금 변수 — 실제로 움직인 것만
  const mid=[];
  const m=(n,a,b,d,u,why)=>{ if(Math.abs(b-a)>=Math.pow(10,-d)/2)
    mid.push(`<li><b>${n}</b> ${f(a,d)} → ${f(b,d)} ${u||''}${why?` — ${why}`:''}</li>`); };
  m('결정립 d',A.d,B.d,1,'µm',`ASTM ${f(A.G,1)} → ${f(B.G,1)}, Hall–Petch 기여 `
    +`${f((A.fam==='austenitic'?15.4*0.46:18.97)*Math.pow(A.d/1000,-0.5),0)} → `
    +`${f((B.fam==='austenitic'?15.4*0.46:18.97)*Math.pow(B.d/1000,-0.5),0)} MPa`);
  if(B.fam==='austenitic'){
    m('Md30',A.md30,B.md30,1,'℃',`30 % 변형 α′ ${f(A.V30,1)} → ${f(B.V30,1)} %, TRIP 기여 ${f(A.trip,0)} → ${f(B.trip,0)} MPa`);
    m('Nieq',A.nieq,B.nieq,2,'','γ 안정도');
    m('잔류 δ',A.dFin,B.dFin,2,'%');
    m('δ @1300 ℃',A.dCast,B.dCast,1,'%','열간압연 연성');
    m('용접 FN',A.FN,B.FN,1,'');
  }else{
    m('γmax',A.gmax,B.gmax,1,'%','가열 시 생성 가능한 오스테나이트량');
    m('Ac1',A.ac1,B.ac1,0,'℃',`냉연소둔 ${S.g[k].proc.crAnnT} ℃ 대비 ${S.g[k].proc.crAnnT>B.ac1?'초과':'미만'}`);
    m('마르텐사이트',A.fm*100,B.fm*100,0,'%','냉각 중 변태량');
    m('KFF',A.kff,B.kff,2,'');
    m('r̄ 값',A.rbar,B.rbar,2,'','심가공성');
    m('리징지수',A.ridge,B.ridge,1,'/10');
  }
  m('PREN',A.pren,B.pren,1,'',`Epit 기본항 ${f(-75+21*A.pren,0)} → ${f(-75+21*B.pren,0)} mV`);
  m('유효 C (Ceff)',A.Ceff,B.Ceff,4,'%','Ti·Nb 안정화 후 잔여 고용탄소');
  m('예민화 DOS',A.DOS,B.DOS,0,'/100',`Epit ${f(A.dSens,0)} → ${f(B.dSens,0)} mV`);

  // 판정 변화
  const cb=constraints(k,B), ca=constraints(k,A).map(x=>x.id);
  const born=cb.filter(x=>!ca.includes(x.id)), gone=ca.filter(id=>!cb.some(x=>x.id===id));
  const verdict=[];
  born.forEach(x=>verdict.push(`<span class="sf ${x.lv==='no'?'no':'wa'}">신규 ${x.txt}</span>`));
  if(gone.length) verdict.push(`<span class="sf ok">해소 ${gone.length}건</span>`);

  return `<div class="sumbox">
    <div class="sum-h"><b>변경 요약</b>
      <span class="sum-what">${esc(c.what)}${c.from===null?'':
        ` <span class="num">${f(c.from,c.d)}</span> → <span class="num">${f(c.to,c.d)}</span> ${esc(c.unit)}`}</span>
      <span class="sum-mode">${c.mode}</span></div>
    ${c.items?`<div class="sum-t">바꾼 항목 ${c.items.length}건</div>
      <ul class="sum-items">${c.items.map(x=>`<li><b>${esc(x.label)}</b> <span class="num">${f(x.from,x.d)}</span> → <span class="num">${f(x.to,x.d)}</span> ${esc(x.unit)}</li>`).join('')}</ul>`:''}
    ${c.miss?`<div class="sum-miss"><b>목표 미달</b>
      ${esc(c.miss.label)} 목표 <span class="num">${f(c.miss.target,c.d)}</span> ${esc(c.miss.unit)} 는
      ${esc(c.miss.mode)} 조정만으로는 도달하지 못했습니다. 규격·조업창 안에서 탐색으로 찾은 최선이
      <span class="num">${f(c.miss.reach,c.d)}</span> ${esc(c.miss.unit)} 입니다.
      ${c.miss.bind?`<br>한계에 닿은 항목: ${esc(c.miss.bind)}`:''}
      <br><span class="sum-fine">결합된 비선형 모델을 수치탐색한 결과이므로 이론적 상한과
      수 % 차이가 날 수 있습니다. 목표 자체가 규격 범위 밖이라는 판정은 유효합니다.</span></div>`:''}
    <div class="sum-grid">
      <div><div class="sum-t">야금 경로</div>
        ${mid.length?`<ul class="sum-mid">${mid.join('')}</ul>`
          :'<p class="empty">중간 변수 변화 없음 — 물성에 직접 작용했습니다.</p>'}</div>
      <div><div class="sum-t">물성·원가 변화</div>
        ${rows.length?`<table class="sum-tb"><thead><tr><th>항목</th><th>이전</th><th>변경</th>
          <th>차이</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table>`
          :'<p class="empty">유효 자릿수 내 변화 없음</p>'}</div>
    </div>
    ${verdict.length?`<div class="sum-v">${verdict.join('')}</div>`:''}
    <p class="sum-note">${esc(c.note||'')}</p></div>`;
}
/* ── 8-4 강종 베이 ──────────────────────────────────────────── */
function fieldHTML(k,kind,m){
  const st=S.g[k], committed=(kind==='comp'?st.comp:st.proc)[m.k];
  const pk=kind+':'+m.k, isPend=!!st.pend[pk];
  const v=isPend?st.pend[pk].to:committed;
  const cls=[st.touched[m.k]?'touched':'',st.solved[m.k]?'solved':'',
             isPend?"pending":""].filter(Boolean).join(" ")+idcls(k,kind,m.k);
  const spec=kind==='comp'?GRADES[k].spec[m.k]:null;
  // 기준강종 규격을 벗어났는지는 모드와 무관하게 항상 표시한다 (개발강종 표식)
  const oos=spec&&(v<spec[0]-1e-9||(spec[1]!==null&&v>spec[1]+1e-9))?' oos':'';
  const [rlo,rhi]=fieldRange(k,kind,m.k);
  const hint=spec?`${spec[0]}–${spec[1]===null?'—':spec[1]}`:(m.u||'');
  const was=isPend?`<u title="반영 전 값">${f(committed,m.d)}</u>`:'';
  const title=kind==='comp'
    ? `${GRADES[k].label} 규격 ${spec?spec[0]+'–'+(spec[1]===null?'—':spec[1]):'해당 없음'} / 입력 가능 ${f(rlo,m.d)}–${f(rhi,m.d)}`
    : `조업창 ${f(rlo,m.d)}–${f(rhi,m.d)} ${m.u}`;
  return `<div class="f"><label title="${title}">${m.n||m.k}<i>${was||hint}</i></label>
    <input type="number" class="${cls}${oos}" value="${v}" step="${m.s}"
      data-g="${k}" data-kind="${kind}" data-key="${m.k}"
      min="${rlo}" max="${rhi}" title="${title}"
      aria-label="${GRADES[k].label} ${m.n||m.k}"></div>`;
}
function propHTML(k,g){
  const R=S.res[k], sp=GRADES[k].mech;
  return PROP.filter(p=>p.grp===g).map(p=>{
    const v=R[p.k], lim=sp[p.k];
    let s='',c='ok';
    if(lim){ const[lo,hi]=lim;
      if(lo!==null&&v<lo){s=`A240 min ${lo}`;c='lo';}
      else if(hi!==null&&v>hi){s=`A240 max ${hi}`;c='hi';}
      else s=lo!==null?`min ${lo} 충족`:`max ${hi} 충족`;
    }else{
      if(p.k==='Ep') s=v>250?'우수':v>120?'보통':'취약';
      if(p.k==='ic') s=v<2?'부동태화 용이':v<8?'보통':'난부동태';
      c=(p.k==='Ep'?(v>250?'ok':v>120?'hi':'lo'):(v<2?'ok':v<8?'hi':'lo'));
    }
    return `<div class="prop${dcls(k,p.k)}" data-pk="${p.k}" data-g="${k}">
      <div class="prop-l"><b>${p.n}</b><span>${p.u}</span></div>
      ${S.diff[k]&&S.diff[k][p.k]?`<span class="chgtag">${S.diff[k][p.k]==="up"?"▲":"▼"}</span>`:""}
      <input type="number" value="${f(v,p.d)}" step="${p.d?0.1:1}"
        data-g="${k}" data-prop="${p.k}" aria-label="${GRADES[k].label} ${p.n} 목표값">
      <div class="sub"><span class="vs ${c}">${s}</span></div></div>`;
  }).join('')+`<div class="chooser" id="ch-${k}-${g}" hidden></div>`;
}
function idxHTML(k){
  const R=S.res[k], it=[];
  // dk = 변경 하이라이트용 키 (outSnap 의 필드명)
  const add=(a,b,c,dk)=>it.push([a,b,c||'',dk||'']);
  add('Creq / Nieq',`${f(R.creq,2)} / ${f(R.nieq,2)}`,'','creq');
  if(R.fam!=='ferritic') add('δ @1300 ℃',f(R.dCast,1)+' %',R.dCast>=2&&R.dCast<=12?'ok':'wa','dCast');
  if(R.fam==='austenitic') add('용접 FN',f(R.FN,1),R.FN>=3&&R.FN<=12?'ok':'wa','FN');
  if(R.fam==='austenitic'){
    add('잔류 δ',f(R.dFin,2)+' %',R.dFin<=1?'ok':'wa','dFin');
    add('Md30 (Nohara)',f(R.md30,0)+' ℃',Math.abs(R.md30)<=40?'ok':'wa','md30');
    add('α′ @30 % 변형',f(R.V30,1)+' %','','V30');
    add('Ms',f(R.msA,0)+' ℃','','msA');
    add('비투자율 µr',f(R.mu,3),'','mu');
  }else{
    add('γmax',f(R.gmax,1)+' %',R.fam==='martensitic'?(R.gmax>=90?'ok':'wa'):(R.gmax<=65?'ok':'wa'),'gmax');
    add('KFF',f(R.kff,2),R.kff>=13.5?'ok':'wa','kff');
    add('Ac1 / Ac3',`${f(R.ac1,0)} / ${f(R.ac3,0)} ℃`,'','ac1');
    add('Ms',f(R.msMar,0)+' ℃','','msMar');
    add('마르텐사이트',f(R.fm*100,0)+' %',R.fam==='martensitic'?'':(R.fm>0.02?'wa':'ok'),'fm');
    if(R.fam==='ferritic'){
      add('r̄ 값',f(R.rbar,2),R.rbar>=0.95?'ok':'wa','rbar');
      add('리징지수',f(R.ridge,1)+' /10',R.ridge<=6?'ok':'wa','ridge');
    }
  }
  add('결정립 d',`${f(R.d,1)} µm`,R.d>=8&&R.d<=45?'ok':'wa','d');
  add('ASTM 립도',f(R.G,1),'','G');
  add('예민화 DOS',f(R.DOS,0)+' /100',R.DOS<=30?'ok':'wa','DOS');
  add('유효 C (Ceff)',f(R.Ceff,4)+' %','','Ceff');
  add('냉간압하율',f(R.crRed,1)+' %',R.crRed>=40&&R.crRed<=92?'ok':'wa','crRed');
  add('소둔 유효시간',f(R.tCR,0)+' s','','tCR');
  return `<div class="idx">${it.map(([a,b,c,dk])=>
    `<div class="ix${dk?dcls(k,dk):''}"><span class="k">${a}</span>`
    +`<span class="v ${c}">${b}</span></div>`).join('')}</div>`;
}
function costHTML(k){
  const R=S.res[k], C=R.cost, T=C.total;
  const seg=[['Ni',C.brk.Ni],['Cr',C.brk.Cr],['Fe',C.brk.Fe],['Mo',C.brk.Mo],
             ['Cu',C.brk.Cu],
             ['기타',C.brk.Mn+C.brk.Si+C.brk.Ti+C.brk.Nb+C.brk.N+C.brk.Al+C.brk.C],
             ['정련',C.refine],['가공',C.conv]].filter(s=>s[1]>0.5);
  const ref=GRADES[k].refCost, dv=(T-ref)/ref*100;
  return `<div class="cost-top${dcls(k,"costTotal")}"><b class="num">${f(T,0)}</b><span>USD / 톤 (냉연 코일)</span>
    <span style="margin-left:auto;color:${dv>2?'var(--fail)':'var(--pass)'}">
    벤치마크 ${ref} 대비 ${sgn(dv,1)} %</span></div>
    <div class="cbar">${seg.map(([n,v])=>
      `<div style="width:${v/T*100}%;background:${COST_COLOR[n]}" title="${n} ${f(v,0)}">
       ${v/T>0.09?`<span>${n}</span>`:''}</div>`).join('')}</div>
    <div class="clegend">${seg.map(([n,v])=>
      `<div><span><i style="background:${COST_COLOR[n]}"></i>${n}</span>
       <b>${f(v,0)}<span class="mini">${(v/T*100).toFixed(0)}%</span></b></div>`).join('')}
      <div><span>성분원가 소계</span><b>${f(C.alloy+C.refine,0)}</b></div>
      <div><span>단위 YS당</span><b>${f(T/R.YS,2)}<span class="mini">$/t·MPa</span></b></div>
    </div>`;
}
/* 대기 중인 수정을 한 번에 반영하는 바 — 여러 항목을 고친 뒤 확인 */
function applyBarHTML(k){
  const n=pendCount(k);
  if(!n) return '';
  const list=Object.values(S.g[k].pend).map(p=>
    `${esc(p.label)} <span class="num">${f(p.from,p.d)}</span>→<span class="num">${f(p.to,p.d)}</span>`
  ).join(' · ');
  return `<div class="applybar" data-ab="${k}">
    <span class="ab-n">수정 ${n}건 대기</span>
    <span class="ab-list">${list}</span>
    <button class="btn sm pri" data-apply="${k}">수정 확인</button>
    <button class="btn sm" data-revert="${k}">되돌리기</button>
  </div>`;
}

function bayHTML(k){
  const G=GRADES[k], R=S.res[k], cons=constraints(k,R), ops=operability(k);
  const chips=[];
  const specOK=!cons.some(x=>x.id.startsWith('spec_')||x.id.startsWith('mech_'));
  chips.push(specOK?["ok","기준규격 적합"]:["no","기준규격 이탈"]);
  chips.push(cons.filter(x=>x.lv==='wa').length
    ?['wa',`야금 주의 ${cons.filter(x=>x.lv==='wa').length}`]:['ok','야금 정상']);
  chips.push(ops.length?['no',`조업 오류 ${ops.length}`]:['ok','조업 가능']);
  const near=nearestGrade(R.fam,S.g[k].comp);
  const offN=Object.entries(G.spec).filter(([e,[lo,hi]])=>{const v=S.g[k].comp[e];
    return v<lo-1e-9||(hi!==null&&v>hi+1e-9);}).length;
  chips.push(offN?["wa",`개발강종 · 최근접 ${near.g}`]:["ok",`표준 ${G.label}`]);
  chips.push(["ok",`${f(R.cost.total,0)} USD/t`]);
  return `<section class="bay" data-bay="${k}"${k===S.tab?"":" hidden"}>
    <header class="bay-head">
      <div class="bay-id"><b>${G.famKo}</b><span>기준 ${G.label} · ${G.note}</span></div>
      <div class="chips">${chips.map(([c,t])=>`<span class="chip ${c}">${t}</span>`).join('')}</div>
    </header>
    ${applyBarHTML(k)}
    <div class="bay-body">
      <div class="col in">
        <div class="grp"><div class="grp-h"><h3>공정 개요</h3></div>${thermo(k)}</div>
        <div class="grp rail comp"><div class="grp-h"><h3>성분</h3><span class="u">wt %</span>
          <span class="hint">라벨 아래 숫자는 A240 규격범위</span></div>
          <div class="fields c13">${EL.map(m=>fieldHTML(k,'comp',m)).join('')}</div></div>
        <div class="grp rail hot"><div class="grp-h"><h3>열간 공정</h3>
          <span class="hint">슬라브 → 가열 → 조압연 → 사상 → 권취 → 소둔</span></div>
          <div class="fields p13">${PR.filter(m=>m.st==='hot').map(m=>fieldHTML(k,'proc',m)).join('')}</div></div>
        <div class="grp rail cold"><div class="grp-h"><h3>냉간 공정</h3>
          <span class="hint">냉간압연 → 연속소둔</span></div>
          <div class="fields p13">${PR.filter(m=>m.st==='cold').map(m=>fieldHTML(k,'proc',m)).join('')}</div></div>
      </div>
      <div class="col out">
        <div class="grp"><div class="grp-h"><h3>기계적 성질</h3>
          <span class="hint">값을 고쳐 넣으면 역설계</span></div>
          <div class="props">${propHTML(k,'mech')}</div></div>
        <div class="grp"><div class="grp-h"><h3>내식성</h3>
          <span class="u">3.5 % NaCl 30 ℃ / 0.5 M H₂SO₄</span></div>
          <div class="props">${propHTML(k,'corr')}</div></div>
        <div class="grp"><div class="grp-h"><h3>야금 지표</h3></div>${idxHTML(k)}</div>
        <div class="grp"><div class="grp-h"><h3>원가</h3></div>${costHTML(k)}</div>
      </div>
    </div>
    <div class="sumwrap">${summaryHTML(k)}</div>
    <details class="basis"><summary>설계 근거 · 적용 회귀식 ${R.eq.length}건</summary>
      <div class="basis-body">${R.eq.map(e=>`<div class="eq"><h4>${esc(e.h)}</h4>
        <code>${esc(e.f)}</code><p>${esc(e.t).replace(/\n/g,'<br>')}</p>
        <p class="src">${esc(e.s)}</p></div>`).join('')}</div>
      <div class="trail"><div class="trail-h">변경 이력</div>
        ${S.log[k].length?S.log[k].slice(-14).reverse().map(e=>
          `<div class="entry">${e}</div>`).join(''):'<div class="empty">변경 없음 — 기준 설계값</div>'}
      </div>
    </details></section>`;
}

/* ── 8-6 전체 ───────────────────────────────────────────────── */
function render(){
  recalc();
  const rv=review();
  renderTabs(rv); renderBoard(rv);
  $('#bays').innerHTML=ORDER.map(bayHTML).join('');
  applyTab();
  bindBays();
}
