'use strict';
// PR #86 (ChatGPT review #5720466858 of PR #85): nested public-condition key
// validation (P1), saved utility-cause labels vs current code, abstain gates,
// predeclared DEV/FINAL/unseen cells.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs');
const C=require('../pr84-public-cond-entry');
const S=require('../pr86-safe-entry');
const H=require('../holdout-20261031-pr86');
const R84=require('../pr84-reaudit');

const base={ownHP:0.5,ownStatus:'',ownBoosts:{atk:1},ownEncored:false,ownHazards:{},foeHP:0.8,foeStatus:'',foeBoosts:{},foeEncored:false,foeHazards:{stealthrock:1},weather:'',terrain:''};

test('P1 ChatGPT repro: a non-public nested field throws instead of entering the key',()=>{
  assert.throws(()=>C.condSig({ownHP:.5,ownBoosts:{atk:1,hiddenHeldItem:'Choice Specs'},foeHP:.8}),/ownBoosts\.hiddenHeldItem/);
  for(const f of ['foeBoosts','ownHazards','foeHazards'])assert.throws(()=>C.condSig({...base,[f]:{secretSet:1}}),/non-public cond field/);
  // wrong value types / non-public strings in public slots
  assert.throws(()=>C.condSig({...base,ownBoosts:{atk:'Choice Specs'}}),/non-public cond value/);
  assert.throws(()=>C.condSig({...base,ownBoosts:{atk:7}}),/non-public cond value/);
  assert.throws(()=>C.condSig({...base,foeHazards:{spikes:4}}),/non-public cond value/);
  assert.throws(()=>C.condSig({...base,foeStatus:'choicespecs'}),/non-public cond value/);
  assert.throws(()=>C.condSig({...base,weather:'leftovers'}),/non-public cond value/);
  assert.throws(()=>C.condSig({...base,terrain:'focussash'}),/non-public cond value/);
  assert.throws(()=>C.condSig({...base,foeHP:1.5}),/non-public cond value/);
  assert.throws(()=>C.condSig({...base,ownBoosts:[1]}),/non-public cond value/);
  // a hidden parameter cannot change the decision: every variant throws, none keys
  const obs=v=>({publicSix:['A','B','C','D','E','F'],ownThree:['X','Y','Z'],turn:1,rivalActive:'A',legal:[],cond:{...base,foeBoosts:{atk:1,hidden:v}}});
  for(const v of ['Choice Scarf','Focus Sash',1,0])assert.throws(()=>C.decideEarlyV3({rules:{}},obs(v)),/non-public/);
});

test('P1 fix keeps PR #85 keys: valid input unchanged, every saved V3 table key re-validates',()=>{
  assert.equal(C.condSig(base),'o:H/atk+1/h:|f:H//h:stealthrock+1|w:/t:');
  assert.equal(C.condSig({...base,ownBoosts:{atk:0,spa:-2},foeStatus:'par',weather:'sunnyday',terrain:'psychicterrain',foeEncored:true}),
    'o:H/spa-2/h:|f:Hpar//E/h:stealthrock+1|w:sunnyday/t:psychicterrain');
  const t=JSON.parse(fs.readFileSync('reports/data/pr84-reaudit-v3table.json','utf8'));
  let n=0;
  for(const k of Object.keys(t.rules)){
    const c=k.split('#').slice(-2)[0],[o,f,w]=c.split('|');
    const side=s=>{const [hp,b,...r]=s.slice(2).split('/');const hz=r.pop().slice(2);
      const kv=x=>Object.fromEntries(x?x.split(',').map(z=>{const m=z.match(/^([a-z]+)([+-]\d+)$/);return [m[1],Number(m[2])];}):[]);
      return {hp:{F:1,H:0.6,L:0.3,C:0.1}[hp[0]],status:hp.slice(1),boosts:kv(b),enc:r.includes('E'),hz:kv(hz)};};
    const O=side(o),F=side(f),[wx,tx]=w.split('/');
    const cond={ownHP:O.hp,ownStatus:O.status,ownBoosts:O.boosts,ownEncored:O.enc,ownHazards:O.hz,foeHP:F.hp,foeStatus:F.status,foeBoosts:F.boosts,foeEncored:F.enc,foeHazards:F.hz,
      weather:wx.slice(2),terrain:tx.slice(2)};
    assert.equal(C.condSig(cond),c,'saved key '+c);n++;
  }
  assert.equal(n,200);
});

test('utility-cause labels: current utilCause reproduces the 6 saved PR #85 examples',()=>{
  const d=JSON.parse(fs.readFileSync('reports/data/pr84-reaudit.json','utf8'));
  const ex=d.utilityRationalIrrational.examples;assert.equal(ex.length,6);
  for(const e of ex)assert.equal(R84.utilCause(e),e.cause);
  assert.equal(Object.values(d.utilityRationalIrrational.byCause).reduce((s,v)=>s+v,0),d.utilityRationalIrrational.n);
});

const six=['A','B','C','D','E','F'],own3=['X','Y','Z'];
const T={rules:{}};
const k1=C.obsKeyV3({publicSix:six,ownThree:own3,turn:1,rivalActive:'A',legal:['move:Tackle','switch:Y'],cond:base});
T.rules[k1]={status:'rule',action:'switch:Y',reason:'r'};
const o1={publicSix:six,ownThree:own3,turn:1,rivalActive:'A',legal:['move:Tackle','switch:Y'],cond:base};

test('safeDecide: gates return the base AI (abstain) unless allowed; uncovered stays uncovered',()=>{
  assert.equal(S.safeDecide(T,o1,{gate:'v3'}).action,'switch:Y');
  for(const g of ['abstain','t2only','loco','loco_t2']){const d=S.safeDecide(T,o1,{gate:g});assert.equal(d.status,'abstain');assert.equal(d.action,null);assert.equal(d.tabled,'switch:Y');}
  assert.equal(S.safeDecide(T,o1,{gate:'loco',loco:new Set([k1])}).action,'switch:Y');
  assert.equal(S.safeDecide(T,{...o1,rivalActive:'B'},{gate:'v3'}).status,'uncovered');
  assert.throws(()=>S.safeDecide(T,{...o1,rivalThree:['A','B','C']},{gate:'v3'}),/non-public field/);
  assert.throws(()=>S.safeDecide(T,o1,{gate:'nope'}),/unknown gate/);
});

test('locoKeys: a rule trained on one cell, or reversed when a cell is held out, does not pass',()=>{
  const g=(cell,label,won,n=8)=>Array.from({length:n},(_,i)=>({key:'K',label,cond:'h|'+cell+'|'+['ai','attack'][i%2],won:typeof won==='function'?won(i):won}));
  const games=[...g('c1:a/b/c','=base',0),...g('c1:a/b/c','switch:Y',1),...g('c2:d/e/f','=base',0),...g('c2:d/e/f','switch:Y',1)];
  const M=require('../pr82-switch-utility-t1t2');
  const t=M.buildTable(games);assert.equal(t.rules.K.status,'rule');
  assert.deepEqual([...S.locoKeys(games,t).pass],['K']);
  // one cell only
  const one=games.filter(x=>x.cond.startsWith('h|c1'));const t1=M.buildTable(one);
  assert.equal(S.locoKeys(one,t1).pass.size,0);assert.match(S.locoKeys(one,t1).detail.K,/trained on 1 cell/);
  // rule only wins on c1: holding out c1 removes the rule
  const mix=[...g('c1:a/b/c','=base',0),...g('c1:a/b/c','switch:Y',1),...g('c2:d/e/f','=base',1),...g('c2:d/e/f','switch:Y',0),...g('c3:g/h/i','=base',0),...g('c3:g/h/i','switch:Y',1)];
  const tm=M.buildTable(mix,{minWorst:0});
  if(tm.rules.K.status==='rule')assert.equal(S.locoKeys(mix,tm,{minWorst:0}).pass.size,0);
});

test('predeclared cells: DEV / FINAL disjoint from used cells and from each other; unseen sixes not in our six',()=>{
  const {picks,label}=require('../a-preview-matrix-audit');
  const team=['P','Q','R','S','T','U'].map(species=>({species}));
  const legacy=['Q','R','S'],used=[legacy,['P','Q','R'],['R','Q','S']];
  const dev=H.devCells({picks:picks(team),label,legacy,ace:'P',used});
  const fin=H.finalCells({picks:picks(team),label,legacy,ace:'P',used:[...used,...dev.map(c=>c.foe)]});
  const all=[...used,...dev.map(c=>c.foe),...fin.map(c=>c.foe)].map(x=>x.join('/'));
  assert.equal(new Set(all).size,all.length);
  assert.deepEqual(dev.map(c=>c.src),['lead3','aceLeadB']);assert.equal(dev[1].foe[0],'P');
  assert.deepEqual(fin.map(c=>c.src),['aceBack2','swapIn']);assert.deepEqual(fin[1].foe,['Q','R','P']);
  const U=H.unseenSixesPR86(),ownSix=['Metagross','Hydreigon','Primarina','Garchomp','Tyranitar','Rotom-Wash'];
  assert.equal(Object.keys(U).length,3);
  for(const x of Object.values(U)){const a=x.hypotheses.a.map(p=>p.species),b=x.hypotheses.b.map(p=>p.species);
    assert.deepEqual(a,b);assert.ok(a.includes(x.ace));assert.ok(!a.some(s=>ownSix.includes(s)));}
});
