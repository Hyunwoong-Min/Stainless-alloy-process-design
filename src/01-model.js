/* ══════════════════════════════════════════════════════════════
   1. 원소 · 공정 항목 정의
   ══════════════════════════════════════════════════════════════ */
const EL = [
  {k:'C', n:'C',  s:0.005, d:3, min:0.005,max:0.20},
  {k:'Si',n:'Si', s:0.01,  d:2, min:0.05, max:1.20},
  {k:'Mn',n:'Mn', s:0.01,  d:2, min:0.10, max:2.20},
  {k:'P', n:'P',  s:0.001, d:3, min:0.008,max:0.045},
  {k:'S', n:'S',  s:0.0005,d:4, min:0.0002,max:0.030},
  {k:'Cr',n:'Cr', s:0.05,  d:2, min:10.0, max:22.0},
  {k:'Ni',n:'Ni', s:0.05,  d:2, min:0.00, max:12.0},
  {k:'Mo',n:'Mo', s:0.01,  d:2, min:0.00, max:2.50},
  {k:'Ti',n:'Ti', s:0.005, d:3, min:0.000,max:0.500},
  {k:'Nb',n:'Nb', s:0.005, d:3, min:0.000,max:0.700},
  {k:'Cu',n:'Cu', s:0.01,  d:2, min:0.00, max:1.50},
  {k:'N', n:'N',  s:0.005, d:3, min:0.005,max:0.150},
  {k:'Al',n:'Al', s:0.001, d:3, min:0.001,max:0.080}
];
const PR = [
  {k:'slab',  n:'Slab 두께', u:'mm',    s:5,   d:0, min:150, max:260, st:'hot'},
  {k:'rhfT',  n:'가열로',    u:'℃',    s:5,   d:0, min:1120,max:1300, st:'hot'},
  {k:'rdt',   n:'RDT',       u:'℃',    s:5,   d:0, min:930, max:1180, st:'hot'},
  {k:'fdt',   n:'FDT',       u:'℃',    s:5,   d:0, min:760, max:1060, st:'hot'},
  {k:'hrT',   n:'열연 두께', u:'mm',    s:0.1, d:2, min:1.8, max:9.0,  st:'hot'},
  {k:'hrW',   n:'열연 폭',   u:'mm',    s:10,  d:0, min:900, max:1650, st:'hot'},
  {k:'ct',    n:'CT',        u:'℃',    s:10,  d:0, min:380, max:880,  st:'hot'},
  {k:'hrAnnT',n:'열연 소둔', u:'℃',    s:5,   d:0, min:680, max:1220, st:'hot'},
  {k:'hrAnnV',n:'열연 소둔속도',u:'m/min',s:1, d:0, min:6,   max:90,   st:'hot'},
  {k:'crT',   n:'냉연 두께', u:'mm',    s:0.05,d:2, min:0.25,max:3.2,  st:'cold'},
  {k:'crW',   n:'냉연 폭',   u:'mm',    s:10,  d:0, min:900, max:1650, st:'cold'},
  {k:'crAnnT',n:'냉연 소둔', u:'℃',    s:5,   d:0, min:640, max:1220, st:'cold'},
  {k:'crAnnV',n:'냉연 소둔속도',u:'m/min',s:1, d:0, min:8,   max:160,  st:'cold'}
];
const PROP = [
  {k:'YS', n:'YS',     u:'MPa',     d:0, grp:'mech'},
  {k:'TS', n:'TS',     u:'MPa',     d:0, grp:'mech'},
  {k:'EL', n:'EL',     u:'%',       d:1, grp:'mech'},
  {k:'HV', n:'HV',     u:'HV0.5',   d:0, grp:'mech'},
  {k:'Ep', n:'공식전위',u:'mV(SCE)',d:0, grp:'corr'},
  {k:'ic', n:'임계전류밀도',u:'mA/cm²',d:2, grp:'corr'}
];

/* ── 강종 기준 데이터 (ASTM A240) ───────────────────────────── */
const GRADES = {
  '304':{
    label:'STS 304', family:'austenitic', famKo:'Austenite계',
    comp:{C:0.050,Si:0.45,Mn:1.10,P:0.030,S:0.0020,Cr:18.20,Ni:8.35,Mo:0.20,
          Ti:0.005,Nb:0.010,Cu:0.35,N:0.045,Al:0.005},
    proc:{slab:200,rhfT:1250,rdt:1080,fdt:920,hrT:3.5,hrW:1250,ct:750,
          hrAnnT:1120,hrAnnV:25,crT:1.00,crW:1240,crAnnT:1090,crAnnV:55},
    spec:{C:[0,0.080],Si:[0,0.75],Mn:[0,2.00],P:[0,0.045],S:[0,0.030],
          Cr:[18.0,20.0],Ni:[8.0,10.5],N:[0,0.10]},
    mech:{YS:[205,null],TS:[515,null],EL:[40,null],HV:[null,210]},
    knobs:{C:[0.020,0.075],Si:[0.20,0.70],Mn:[0.60,1.90],Cr:[18.05,19.90],
           Ni:[8.02,10.40],Mo:[0.02,0.55],Cu:[0.05,1.00],N:[0.020,0.095],
           Nb:[0.000,0.045],Ti:[0.000,0.045],S:[0.0004,0.008],P:[0.015,0.038]},
    pk:{rhfT:[1200,1290],rdt:[1000,1120],fdt:[880,1000],ct:[550,820],hrT:[2.5,6.0],
        hrAnnT:[1050,1180],hrAnnV:[15,60],crAnnT:[1020,1160],crAnnV:[25,120]},
    refCost:2745, demand:'세계 STS 수요의 약 45 % — 최대 범용 강종',
    note:'용체화 소둔 후 완전 오스테나이트. 가공유기 마르텐사이트(TRIP)가 연신·인장을 지배.'
  },
  '430':{
    label:'STS 430', family:'ferritic', famKo:'Semi-Ferrite계',
    comp:{C:0.045,Si:0.30,Mn:0.40,P:0.028,S:0.0015,Cr:16.30,Ni:0.20,Mo:0.02,
          Ti:0.005,Nb:0.010,Cu:0.08,N:0.040,Al:0.010},
    proc:{slab:200,rhfT:1220,rdt:1050,fdt:850,hrT:4.00,hrW:1250,ct:720,
          hrAnnT:880,hrAnnV:40,crT:0.80,crW:1240,crAnnT:850,crAnnV:60},
    spec:{C:[0,0.12],Si:[0,1.00],Mn:[0,1.00],P:[0,0.040],S:[0,0.030],
          Cr:[16.0,18.0],Ni:[0,0.75]},
    mech:{YS:[205,null],TS:[450,null],EL:[22,null],HV:[null,192]},
    knobs:{C:[0.015,0.10],Si:[0.15,0.90],Mn:[0.20,0.90],Cr:[16.05,17.90],
           Ni:[0.05,0.60],Mo:[0.01,0.45],Cu:[0.02,0.45],N:[0.010,0.055],
           Nb:[0.000,0.45],Ti:[0.000,0.35],S:[0.0004,0.008],P:[0.015,0.035]},
    pk:{rhfT:[1150,1260],rdt:[980,1100],fdt:[800,920],ct:[600,800],hrT:[3.0,6.5],
        hrAnnT:[820,960],hrAnnV:[20,70],crAnnT:[800,930],crAnnV:[30,130]},
    refCost:1275, demand:'세계 STS 수요의 약 20 % — 400계 최대 품목, 가전/주방',
    note:'γmax·Kaltenhauser 인자가 조직을, 리징·r값이 성형성을 좌우. 비안정화재는 예민화에 취약.'
  },
  '410':{
    label:'STS 410', family:'martensitic', famKo:'Martensite계',
    comp:{C:0.120,Si:0.40,Mn:0.50,P:0.025,S:0.0020,Cr:12.50,Ni:0.30,Mo:0.03,
          Ti:0.003,Nb:0.005,Cu:0.10,N:0.035,Al:0.008},
    proc:{slab:200,rhfT:1230,rdt:1060,fdt:880,hrT:4.50,hrW:1250,ct:730,
          hrAnnT:780,hrAnnV:20,crT:1.20,crW:1240,crAnnT:760,crAnnV:30},
    spec:{C:[0.08,0.15],Si:[0,1.00],Mn:[0,1.00],P:[0,0.040],S:[0,0.030],
          Cr:[11.5,13.5],Ni:[0,0.75]},
    mech:{YS:[205,null],TS:[450,null],EL:[20,null],HV:[null,192]},
    knobs:{C:[0.085,0.145],Si:[0.20,0.90],Mn:[0.30,0.90],Cr:[11.6,13.4],
           Ni:[0.05,0.70],Mo:[0.01,0.45],Cu:[0.02,0.35],N:[0.010,0.045],
           Nb:[0.000,0.10],Ti:[0.000,0.10],S:[0.0004,0.008],P:[0.015,0.035]},
    pk:{rhfT:[1160,1270],rdt:[1000,1110],fdt:[840,950],ct:[600,800],hrT:[3.5,7.0],
        hrAnnT:[720,830],hrAnnV:[12,50],crAnnT:[700,940],crAnnV:[15,90]},
    refCost:1255, demand:'세계 STS 수요의 약 4 % — 커틀러리·밸브·체결류',
    note:'최종 소둔온도가 Ac1을 넘는 순간 오스테나이트→마르텐사이트로 물성이 급변.'
  },
  '439':{
    label:'STS 439', family:'ferritic', famKo:'Fully-Ferrite계',
    comp:{C:0.012,Si:0.35,Mn:0.30,P:0.025,S:0.0012,Cr:17.40,Ni:0.25,Mo:0.02,
          Ti:0.310,Nb:0.010,Cu:0.08,N:0.012,Al:0.045},
    proc:{slab:200,rhfT:1200,rdt:1040,fdt:830,hrT:4.00,hrW:1250,ct:700,
          hrAnnT:900,hrAnnV:45,crT:0.70,crW:1240,crAnnT:950,crAnnV:55},
    spec:{C:[0,0.030],Si:[0,1.00],Mn:[0,1.00],P:[0,0.040],S:[0,0.030],
          Cr:[17.0,19.0],Ni:[0,0.50],N:[0,0.030],Ti:[0.20,1.10],Al:[0,0.15]},
    mech:{YS:[205,null],TS:[415,null],EL:[22,null],HV:[null,183]},
    knobs:{C:[0.006,0.028],Si:[0.15,0.90],Mn:[0.15,0.90],Cr:[17.05,18.90],
           Ni:[0.05,0.45],Mo:[0.01,0.45],Cu:[0.02,0.45],N:[0.006,0.028],
           Nb:[0.000,0.55],Ti:[0.200,0.90],S:[0.0004,0.008],P:[0.015,0.035]},
    pk:{rhfT:[1150,1250],rdt:[980,1090],fdt:[790,900],ct:[580,780],hrT:[3.0,6.0],
        hrAnnT:[850,1000],hrAnnV:[25,75],crAnnT:[880,1010],crAnnV:[30,120]},
    refCost:1372, demand:'세계 STS 수요의 약 3 % — 자동차 배기계·저수조·건재',
    note:'Ti 완전 안정화로 γmax = 0. 고용 침입형 원소가 없어 r값이 높고 예민화가 원리적으로 차단.'
  }
};
/* 탭 표시 순서 */
const ORDER = ['304','410','430','439'];
const PROC_KNOBS = ['rhfT','rdt','fdt','ct','hrT','hrAnnT','hrAnnV','crAnnT','crAnnV'];

/* 원료 단가 (USD / kg 함유원소) */
const PRICE0 = {Cr:2.20,Ni:16.50,Mo:58.0,Mn:1.55,Si:1.90,Ti:7.20,Nb:26.0,
                Cu:9.60,N:8.50,Al:2.60,C:0.90,Fe:0.47};
const COST_COLOR = {Ni:'#5B7FB8',Cr:'#0E6E7A',Fe:'#8A96A0',Mo:'#8E5AA8',
                    Cu:'#B0703A',기타:'#B05810',정련:'#A93030',가공:'#5E6E62'};

/* ══════════════════════════════════════════════════════════════
   2. 야금 회귀식
   ══════════════════════════════════════════════════════════════ */
const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const L10=Math.log10;

// 당량 — Hammar & Svensson (1979)
const creqHS=c=>c.Cr+1.37*c.Mo+1.5*c.Si+2*c.Nb+3*c.Ti;
const nieqHS=c=>c.Ni+22*c.C+14.2*c.N+0.31*c.Mn+c.Cu;
// 당량 — WRC-1992
const creqWRC=c=>c.Cr+c.Mo+0.7*c.Nb;
const nieqWRC=c=>c.Ni+35*c.C+20*c.N+0.25*c.Cu;
const ferriteNo=c=>Math.max(0,3.34*creqWRC(c)-2.46*nieqWRC(c)-28.6);

// δ-페라이트: Hull 식 + 온도 의존 경계 b(T)
const bT=T=>6.7+(1300-T)*0.0157;
const deltaAt=(c,T)=>Math.max(0,3*(creqHS(c)-0.93*nieqHS(c)-bT(T)));

// ASTM 결정립도 번호 ↔ 평균 입경(µm)
const astmG=d=>-6.6438*L10(d/1000)-3.288;

// Md30 — Nohara (1977) / Angel (1954)
const md30N=(c,d)=>551-462*(c.C+c.N)-9.2*c.Si-8.1*c.Mn-13.7*c.Cr
                   -29*(c.Ni+c.Cu)-18.5*c.Mo-68*c.Nb-1.42*(astmG(d)-8);
const md30A=c=>413-462*(c.C+c.N)-9.2*c.Si-8.1*c.Mn-13.7*c.Cr-9.5*c.Ni-18.5*c.Mo;
// Ms — Eichelman & Hull (오스테나이트계) / Andrews (마르텐사이트계)
const msAus=c=>1305-1665*(c.C+c.N)-28*c.Si-33*c.Mn-42*c.Cr-61*c.Ni;
const msMar=c=>539-423*c.C-30.4*c.Mn-17.7*c.Ni-12.1*c.Cr-7.5*c.Mo-7.5*c.Si;

// 400계 지표
const gammaMax=c=>cl(420*c.C+470*c.N+23*c.Ni+9*c.Cu+7*c.Mn-11.5*c.Cr-11.5*c.Si
                     -12*c.Mo-47*c.Nb-49*c.Ti-52*c.Al+189,0,100);
const kffK=c=>c.Cr+6*c.Si+8*c.Ti+4*c.Mo+2*c.Al-2*c.Mn-4*c.Ni-40*(c.C+c.N);
const ac1T=c=>720+12*c.Cr+25*c.Si+30*c.Mo+40*c.Nb+60*c.Ti+45*c.Al
              -25*c.Mn-30*c.Ni-15*c.Cu-250*c.C-400*c.N;
const ac3T=c=>ac1T(c)+90-200*c.C+3*c.Cr;
const prenV=c=>c.Cr+3.3*c.Mo+16*c.N;

// 안정화: Ti가 N을 먼저(TiN), 남은 Ti와 Nb가 C를 고정
function stabilize(c){
  let ti=c.Ti;
  const nTi=Math.min(c.N,ti/3.42); ti-=3.42*nTi;
  const cTi=Math.min(c.C,ti/4.0);
  const cNb=Math.min(c.C-cTi,c.Nb/7.75);
  return {Ceff:Math.max(0,c.C-cTi-cNb), Neff:Math.max(0,c.N-nTi)};
}

/* ── 결정립 성장 (Beck 형) ─────────────────────────────────── */
const GG={austenitic:{n:2.5,Q:280000,k0:6.0e12},
          ferritic  :{n:2.0,Q:230000,k0:6.56e11}};
function grow(d0,TC,t,fam,pin){
  const g=GG[fam==='austenitic'?'austenitic':'ferritic'];
  const r=g.k0*Math.exp(-g.Q/(8.314*(TC+273.15)))*t*pin;
  return Math.pow(Math.pow(d0,g.n)+r,1/g.n);
}
// ferrite 중 C 고용도 근사 (wt%)
const csolF=T=>0.008*Math.exp((T-700)/220);
