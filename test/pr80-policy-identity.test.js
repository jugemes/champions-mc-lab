'use strict';
// PR #80 (ChatGPT review #5718315491 of PR #79): policy identity of the general
// public-six entry (cache validity, own-six hash completeness), executed vs
// raw policy, side-independent draw and a deterministic side-fixed regression.
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const G=require('../public-six-general');
const {reportedLive}=require('../reported-live-roster-20261027');
const {caseList}=require('../legal-search-v2-compare');
const {holdoutSixes}=require('../holdout-20261031-general');
const {rivalPicks}=require('../public-six-holdout');
const C_Y=caseList().find(c=>c.id==='C_charizardY').team;
const TINY={maxScenarios:1,n1:2,r2:1,expand:false,workers:2};
// PR #79's saved HX_rain support (reports/data/general-search-holdout-20261031.json),
// mass 0.9507 after the p<0.03 cut. Used as a fixture with the CURRENT identity.
const HX_RAIN_V1=[['Tyranitar>Primarina/Garchomp',0.1605],['Hydreigon>Metagross/Primarina',0.1408],['Metagross>Hydreigon/Primarina',0.14],
  ['Hydreigon>Metagross/Garchomp',0.1099],['Metagross>Hydreigon/Garchomp',0.0999],['Metagross>Hydreigon/Tyranitar',0.0967],
  ['Primarina>Hydreigon/Tyranitar',0.0831],['Garchomp>Metagross/Hydreigon',0.0811],['Garchomp>Hydreigon/Primarina',0.0387]];
function savedFixture(own,six,opts={}){
  const x=HX_RAIN_V1.map(([,p])=>p),e=G.emitSupport(x,0);
  return {...G.policyIdentity(own,opts),publicKey:G.keyOf(six),codeFiles:G.codeRevision().files,security:0.2,games:{total:1},seconds:1,
    support:e.map(({k,p})=>({pick:HX_RAIN_V1[k][0],p}))};
}

test('finding 1: a saved result is rejected, with reasons, for a wrong engine / format / params / AI / code / version',()=>{
  const own=reportedLive(),six=holdoutSixes().HX_rain.publicSix,ok=savedFixture(own,six);
  assert.deepEqual(G.cacheCheck(ok,[...six].reverse(),own),{ok:true,reasons:[]},'legitimate same-input reuse');
  const bad=[
    [{showdown:'WRONG-SHA'},/saved engine WRONG-SHA/],[{format:'wrong'},/format wrong/],
    [{params:{...ok.params,n1:1}},/search params differ/],[{ownAI:{...ok.ownAI,encoreGuard:'off'}},/own turn AI differs/],
    [{code:'0000000000000000',codeFiles:{...ok.codeFiles,'lab.js':'x'}},/code revision .*lab\.js/],[{version:'general-v1'},/version general-v1/],
  ];
  for(const [patch,re] of bad){
    const c=G.cacheCheck({...ok,...patch},six,own);
    assert.equal(c.ok,false,JSON.stringify(patch));assert.match(c.reasons.join('; '),re);
  }
  // the exact PR #79 counterexample: matching version/publicKey/ownHash, wrong SHA/format/params
  const pr79={...ok,showdown:'WRONG-SHA',format:'wrong',params:{n1:1}};
  assert.equal(G.usableSaved(pr79,six,own),false);
  // a saved result made with TINY params is not reused for default params and vice versa
  assert.equal(G.usableSaved(savedFixture(own,six,TINY),six,own),false);
  assert.equal(G.usableSaved(ok,six,own,TINY),false);
  // worker count is not part of the identity
  assert.equal(G.usableSaved(ok,six,own,{workers:7}),true);
  // the real PR #79 saved files (general-v1) are refused, not silently reused
  const v1=require('../reports/data/general-search-holdout-20261031.json').HX_rain;
  assert.equal(G.usableSaved(v1,six,own),false);
});
test('finding 1: a rejected or missing cache gives an explained immediate fallback, never a stale policy',async()=>{
  const own=reportedLive(),six=holdoutSixes().HX_rain.publicSix;
  const bad={...savedFixture(own,six),showdown:'WRONG-SHA'};
  const r=await G.choosePublicSixGeneral({sim,own,publicSix:six,seed:[6,1,2,3],saved:bad});
  assert.equal(r.status,'fallback');assert.equal(r.cache,'miss');
  assert.match(r.cacheRejected.join(),/WRONG-SHA/);assert.match(r.fallback,/legacy chooseThree/);
  assert.equal(r.pick.length,3);assert.deepEqual(r.selection.map(n=>own[n-1].species),r.pick);
  const ok=await G.choosePublicSixGeneral({sim,own,publicSix:six,seed:[6,1,2,3],saved:savedFixture(own,six)});
  assert.equal(ok.status,'general');assert.equal(ok.cache,'saved');
});
test('finding 1: in-process memo is keyed by the policy identity (TINY search is not reused for default params)',async()=>{
  const own=reportedLive(),six=C_Y.map(p=>p.species);
  const a=await G.choosePublicSixGeneral({sim,own,publicSix:six,seed:[1,2,3,4],opts:TINY,allowSearch:true});
  assert.equal(a.cache,'searched');
  const b=await G.choosePublicSixGeneral({sim,own,publicSix:six,seed:[1,2,3,4],opts:TINY});
  assert.equal(b.cache,'memo');assert.deepEqual(b.pick,a.pick);
  const c=await G.choosePublicSixGeneral({sim,own,publicSix:six,seed:[1,2,3,4]});
  assert.equal(c.status,'fallback','default params never reuse the TINY memo');
  const d=await G.choosePublicSixGeneral({sim,own,publicSix:six,seed:[1,2,3,4],opts:{...TINY,n1:3}});
  assert.equal(d.status,'fallback','other params never reuse the memo');
});
test('finding 2: level / IV / unsupported fields are rejected, not hashed as equal',()=>{
  const own=reportedLive(),h=G.ownHash(own);
  const explicit=own.map(p=>({...p,level:50,ivs:{hp:31,atk:31,def:31,spa:31,spd:31,spe:31}}));
  assert.equal(G.ownHash(explicit),h,'explicit level 50 / IV 31 is the simulated roster');
  const lv1=structuredClone(own);lv1[0].level=1;assert.throws(()=>G.ownHash(lv1),/level 1 unsupported/);
  const iv0=structuredClone(own);iv0[2].ivs={spe:0};assert.throws(()=>G.ownHash(iv0),/IV spe=0 unsupported/);
  const gen=structuredClone(own);gen[1].gender='F';assert.throws(()=>G.ownHash(gen),/gender/);
  const mv=structuredClone(own);mv[0].moves=[...mv[0].moves].reverse();assert.notEqual(G.ownHash(mv),h,'move order reaches the turn AI');
  const nat=structuredClone(own);nat[0].nature='Adamant';assert.notEqual(G.ownHash(nat),h);
});
test('finding 3: emitted support = executed probabilities; metrics are recomputed on it',()=>{
  const x=HX_RAIN_V1.map(([,p])=>p),e=G.emitSupport(x,0);
  assert.equal(e.reduce((s,a)=>s+a.p,0).toFixed(6),'1.000000');
  assert.equal(e.find(a=>a.k===0).p,0.1688,'0.1605/0.9507 = 0.168823 -> saved as executed');
  // raw vs emitted metrics differ when mass is dropped
  const P=[[1,0],[0,1],[1,1]],surv=[0,1,2],cells=[0,1];
  const raw=[0.49,0.49,0.02],em=G.emitSupport(raw),y=surv.map((_,k)=>em.find(a=>a.k===k)?.p||0);
  assert.deepEqual(y,[0.5,0.5,0]);
  const mr=G.policyMetrics(raw,P,surv,cells,cells),me=G.policyMetrics(y,P,surv,cells,cells);
  assert.equal(+mr.security.toFixed(3),0.51);assert.equal(me.security,0.5);
  // the entry draws with exactly the saved p (no hidden renormalisation)
});
test('finding 3: pickProbability returned by the entry equals the saved executed p',async()=>{
  const own=reportedLive(),six=holdoutSixes().HX_rain.publicSix,saved=savedFixture(own,six);
  for(let s=0;s<12;s++){
    const r=await G.choosePublicSixGeneral({sim,own,publicSix:six,seed:[s,1,2,3],saved});
    assert.equal(r.pickProbability,saved.support.find(x=>x.pick.split(/[>/]/).join()===r.pick.join()).p);
  }
});
test('finding 4: the draw is side-independent; PR #79 side-dependent draw reproducible on request',async()=>{
  const own=reportedLive(),six=holdoutSixes().HX_rain.publicSix,saved=savedFixture(own,six);
  const at=(side,o={})=>G.choosePublicSixGeneral({sim,own,publicSix:six,seed:[6,1,2,3],side,saved,...o}).then(r=>r.pick.join('/'));
  assert.equal(await at('p1'),await at('p2'));
  // PR #79 behaviour (reported by ChatGPT): p1 Garchomp>Metagross/Hydreigon, p2 Tyranitar>Primarina/Garchomp
  assert.equal(await at('p1',{sideDependentDraw:true}),'Garchomp/Metagross/Hydreigon');
  assert.equal(await at('p2',{sideDependentDraw:true}),'Tyranitar/Primarina/Garchomp');
});
test('finding 4: side-fixed regression draws once and plays the same 3+lead / rival 3+lead / seed as p1 and as p2 (real Battle)',async()=>{
  const own=reportedLive(),H=holdoutSixes().HX_rain,six=H.publicSix,dex=sim.Dex.mod('champions');
  const rival=H.hypotheses.a,rp=rivalPicks(dex,rival,own.map(p=>p.species),H.ace).picks.find(p=>p.src==='aceLead')||rivalPicks(dex,rival,own.map(p=>p.species),H.ace).picks[0];
  const r=await G.sideFixedRegression({sim,own,saved:savedFixture(own,six),publicSix:six,seed:[6,1,2,3],rivalTeam:rival,rivalPick:rp.pick});
  assert.deepEqual(r.games.map(g=>g.side),['p1','p2']);
  for(const g of r.games){
    const t1=g.t1t2.slice(0,g.t1t2.indexOf('T1')+1).join(' ');
    assert.ok(g.t1t2.some(l=>l.startsWith('switch|OWN:')&&l.includes(r.pick[0])),'our lead '+r.pick[0]+' '+t1);
    assert.ok(g.t1t2.some(l=>l.startsWith('switch|RIVAL:')&&l.includes(rp.pick[0])),'rival lead '+rp.pick[0]);
  }
});
test('utility rival branch requests a recovery / Encore / hazard / status move on T1 when one exists',async()=>{
  const H=holdoutSixes().HX_rain,own=reportedLive();
  // hypothesis b Swampert carries Stealth Rock
  const r=await G.runGames(own,[H.hypotheses.b],[{team:0,own:['Metagross','Hydreigon','Primarina'],foe:['Swampert','Dragonite','Gholdengo'],seed:[3,1,2,3],reverse:false,branch:'utility'}],{workers:1,keepLog:true});
  assert.equal(r[0].requested[0].move,'Stealth Rock');
  assert.ok(['executed','preempted','forcedOut'].includes(r[0].requested[0].result),JSON.stringify(r[0].requested));
});
test('a search refuses to run on an engine other than the pinned Showdown',async()=>{
  assert.equal(G.engineSha(),G.SHOWDOWN,'tests run on the pinned engine');
});
test('item 5/6 helpers: T1/T2 action parser and search-only human policies',()=>{
  const {actions}=require('../pr80-decision-trees');
  const a=actions(['switch|OWN:Tyranitar|Tyranitar, L50, M','switch|RIVAL:Archaludon|Archaludon, L50','T1','move|RIVAL:Archaludon|Flash Cannon',
    'move|OWN:Tyranitar|Stealth Rock','T2','move|RIVAL:Archaludon|Flash Cannon','faint|OWN:Tyranitar','switch|OWN:Primarina|Primarina, L50'],'OWN');
  assert.deepEqual(a,{T1:'Tyranitar:Stealth Rock',T2:'Tyranitar fainted, replace→Primarina'});
  assert.equal(actions(['T1','switch|RIVAL:Swampert|Swampert'],'RIVAL').T1,'switch→Swampert');
  const src=require('node:fs').readFileSync(path.join(__dirname,'../public-six-general-eval.js'),'utf8');
  assert.match(src,/human1=\{\[search\.pure\[0\]\.pick\]:1\}/,'human1 is fixed from the saved search only');
});
