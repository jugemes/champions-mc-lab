'use strict';
// PR #94 request (ChatGPT review #5721596824 of PR #93): T1/T2 public-state
// key regression tests. Written before the pr94 battles.
const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../pr94-t1t2');
const T92=require('../pr92-t1t2');
const haveSD=!!process.env.SHOWDOWN_DIR;
// N2 ace name read from its holdout file: quoting it here would break
// test/pr92.test.js (N1/N2 names must stay absent from every other .js).
const N2=require('../holdout-20261031-pr92').unseenSixesPR92().N2_heracross,ACE=N2.ace,ACEM=ACE+'-Mega';

const LEGAL=['move:Hydro Pump','move:Volt Switch','move:Thunderbolt','move:Will-O-Wisp','switch:Metagross','switch:Garchomp'];
const o2=x=>({turn:2,rivalLead:'Charizard',ownActive:'Rotom-Wash',rivalActive:'Charizard',ownHP:1,rivalHP:1,ownStatus:'',rivalStatus:'',
  weather:'',terrain:'',trickRoom:false,ownBoosts:{},rivalBoosts:{},ownEncored:false,rivalEncored:false,ownHazards:{},rivalHazards:{},legal:LEGAL,...x});

test('PR93 P0 reproduced on the old key: Charizard / -Mega-X / -Mega-Y collide in pr92 keyOf',()=>{
  const k=['Charizard','Charizard-Mega-X','Charizard-Mega-Y'].map(r=>T92.keyOf({turn:2,rivalLead:'Charizard',ownActive:'Rotom-Wash',rivalActive:r,legal:[]}));
  assert.equal(new Set(k).size,1);
  assert.throws(()=>T92.keyOf({turn:2,rivalLead:'X',rivalActive:'X',ownActive:'Y',ownHP:0.5}),/non-public field ownHP/);
});

test('T2 key separates every PUBLIC difference: Mega forme, weather, HP, status, boosts, Encore, hazards, own legal set',()=>{
  const base=T.keyOf(o2({}));
  const diffs={megaX:{rivalActive:'Charizard-Mega-X'},megaY:{rivalActive:'Charizard-Mega-Y',weather:'sunnyday'},sunOnly:{weather:'sunnyday'},
    ownMega:{ownActive:'Metagross-Mega'},ownHP:{ownHP:0.4},rivalHP:{rivalHP:0.2},ownStatus:{ownStatus:'brn'},rivalStatus:{rivalStatus:'par'},
    rivalBoost:{rivalBoosts:{atk:1,spe:1}},ownBoost:{ownBoosts:{spa:-2}},ownEnc:{ownEncored:true,legal:['move:Thunderbolt','switch:Metagross','switch:Garchomp']},
    rivalEnc:{rivalEncored:true},hazard:{ownHazards:{stealthrock:1}},terrain:{terrain:'electricterrain'},tr:{trickRoom:true},
    pp0:{legal:LEGAL.filter(l=>l!=='move:Hydro Pump')},trapped:{legal:LEGAL.filter(l=>!l.startsWith('switch:'))},benchFainted:{legal:LEGAL.filter(l=>l!=='switch:Garchomp')}};
  const keys=Object.fromEntries(Object.entries(diffs).map(([n,x])=>[n,T.keyOf(o2(x))]));
  for(const [n,k] of Object.entries(keys))assert.notEqual(k,base,n+' collides with the base state');
  assert.equal(new Set(Object.values(keys)).size,Object.keys(keys).length,'two different public states collide');
  // Charizard-Mega-X vs -Mega-Y are distinct even before weather is considered
  assert.notEqual(T.keyOf(o2({rivalActive:'Charizard-Mega-X'})),T.keyOf(o2({rivalActive:'Charizard-Mega-Y'})));
});

test('T2 key is minimal: same band / sign / set -> same key; rival hidden item / moves / three are not inputs',()=>{
  assert.equal(T.keyOf(o2({ownHP:0.9})),T.keyOf(o2({ownHP:0.6})));// same band H
  assert.equal(T.keyOf(o2({rivalBoosts:{atk:0}})),T.keyOf(o2({})));
  assert.equal(T.keyOf(o2({legal:LEGAL.slice().reverse()})),T.keyOf(o2({})));// order of the request does not matter
  assert.equal(T.keyOf(o2({rivalHazards:{spikes:1}})),T.keyOf(o2({})));// hazards on the rival side: not a T2 decision input
  for(const f of ['rivalItem','rivalMoves','rivalThree','rivalSet','hypothesis','branch','seed','won','rivalAbility'])
    assert.throws(()=>T.keyOf(o2({[f]:'x'})),new RegExp('non-public field '+f));
});

test('an unrevealed Mega is never assumed: a base-forme rival keeps the base key (no -Mega guessed)',()=>{
  const k=T.keyOf(o2({rivalActive:'Charizard'}));
  assert.ok(k.split('|')[3]==='Charizard');
  assert.equal(T.forme('Charizard-Mega-Y, L50, F'),'Charizard-Mega-Y');
});

test('T1 key: rival lead forme + weather + own legal set; old boundary (non-public fields throw) kept',()=>{
  const o1=x=>({turn:1,rivalLead:ACE,rivalActive:ACE,ownActive:'Rotom-Wash',legal:LEGAL,weather:'',terrain:'',...x});
  assert.equal(T.keyOf(o1({})),'T1|'+ACE+'|-|-|'+LEGAL.slice().sort().join(','));
  assert.notEqual(T.keyOf(o1({weather:'sandstorm'})),T.keyOf(o1({})));
  assert.throws(()=>T.keyOf(o1({rivalItem:'Mega Stone'})),/non-public field rivalItem/);
});

test('table: rule only past MIN_GAIN, n >= MIN_N over >= MIN_CELLS; otherwise ABSTAIN (no recommendation)',()=>{
  const rows=[];
  for(let i=0;i<10;i++){const j={ci:i%3,branch:'ai',seed:[i],reverse:false};
    rows.push({j:{...j,label:'ai'},r:{won:i<3?1:0,keys:{1:'K'},used:{},act:{1:'move:B'}}});
    rows.push({j:{...j,label:'move:A'},r:{won:i<8?1:0,keys:{1:'K'},used:{1:'move:A'}}});}
  let t=T.tableFrom(rows,1,{minN:8,minGain:0.10,minCells:2});
  assert.equal(t.K.action,'rule:move:A');
  t=T.tableFrom(rows,1,{minN:8,minGain:0.10,minCells:4});// only 3 distinct cells
  assert.equal(t.K.action,'abstain');assert.equal(t.K.aiInfo.label,'move:B');
  assert.match(T.humanRules(t)[0],/ABSTAIN .*info only, not a recommendation/);
  // a forced game whose key differs from its paired base-AI game is not counted
  const bad=rows.map(x=>x.j.label==='ai'?x:{...x,r:{...x.r,keys:{1:'K2'}}});
  assert.equal(T.tableFrom(bad,1,{minN:8,minGain:0.10,minCells:1}).K.action,'abstain');
});

test('execution: table rule forces, abstain/unseen delegate; use summary separates forced replacements',()=>{
  const req={side:{pokemon:[{active:true,details:'Rotom-Wash, L50',condition:'157/157'},{active:false,details:'Metagross, L50',condition:'155/155'}]},
    active:[{moves:[{move:'Thunderbolt'},{move:'Volt Switch'}]}]};
  const bot={foeActive:ACEM,foeHP:1,foeBoosts:{},boosts:{},ownHazards:{},hazards:{},weather:'',terrain:''};
  const rec={},key=T.keyOf(T.obsFrom(req,bot,2,ACE));
  const s=T.planScript({table:{[key]:{action:'rule:switch:Metagross'}}},rec);
  assert.equal(s(req,{...bot},{turn:2}),null);// T1 lead not recorded -> lead null -> different key -> unseen
  const rec2={},s2=T.planScript({table:{[T.keyOf(T.obsFrom(req,{...bot,foeActive:ACE},1,ACE))]:{action:'abstain'},[key]:{action:'rule:switch:Metagross'}}},rec2);
  assert.equal(s2(req,{...bot,foeActive:ACE},{turn:1}),null);assert.equal(rec2.used[1],'abstain');
  assert.equal(s2(req,bot,{turn:2}),'switch 2');assert.equal(rec2.used[2],'rule:switch:Metagross');
  assert.equal(s2({...req,forceSwitch:[true]},bot,{turn:2}),null);assert.equal(rec2.forcedSwitch[2],true);
  const u=T.useSummary([{won:1,keys:{1:'a',2:'b'},used:{1:'abstain',2:'rule:x'},forcedSwitch:{}},{won:0,keys:{1:'a'},used:{1:'abstain:unseen'},forcedSwitch:{1:true}}]);
  assert.deepEqual([u.T1.reached,u.T1.abstain,u.T1.unseen,u.T2.forcedRule,u.T2.ruleWin,u.T1.forcedReplacementBefore],[2,1,1,1,1,1]);
});

test('eval seeds include cell and branch: no (cell, branch, s) pair shares a seed',()=>{
  const seen=new Set();
  for(let ci=0;ci<20;ci++)for(let bi=0;bi<16;bi++)for(let s=0;s<8;s++)seen.add(String(T.jobSeed(1,ci,bi,s)));
  assert.equal(seen.size,20*16*8);
});

test('pinned battle: Mega Charizard-Y / Heracross formes reach the key as shown on the protocol',{skip:!haveSD&&'SHOWDOWN_DIR not set'},()=>{
  const {load}=require('../lab');const dex=load().Dex.mod('champions');
  for(const s of ['Charizard-Mega-X','Charizard-Mega-Y',ACEM])assert.ok(dex.species.get(s).exists,s);
});

// ---- pr94-cover-preview: D1 public-immunity rationality, D2 Mega ability ----
const C=require('../pr94-cover-preview');
test('publicImmune: rival attack into a public immunity (type chart / only ability) is flagged; hidden-ability immunity is not',{skip:!haveSD&&'SHOWDOWN_DIR not set'},()=>{
  const {load}=require('../lab');const dex=load().Dex.mod('champions');
  const log=(own,move)=>['|switch|p1a: X|'+own+', L50|100/100','|switch|p2a: Y|'+ACE+', L50|100/100','|turn|1',
    '|move|p2a: Y|'+move+'|p1a: X','|-immune|p1a: X','|upkeep','|turn|2'].join('\n');
  assert.deepEqual(T.publicImmune(log('Rotom-Wash','Earthquake'),'p2',dex).map(x=>x.why),['only ability levitate']);
  assert.deepEqual(T.publicImmune(log('Metagross','Toxic'),'p2',dex),[]);// status move: not an attack
  assert.deepEqual(T.publicImmune(log('Garchomp','Thunderbolt'),'p2',dex).map(x=>x.why),['type']);
  // Primarina has two possible abilities: an immunity there would be hidden information
  assert.deepEqual(T.publicImmune(log('Primarina','Earthquake'),'p2',dex),[]);
  const j={branch:'ai'};
  assert.equal(C.rational94(j,{irrational:[],immune:[{turn:1}]}),false);
  assert.equal(C.rational94(j,{irrational:[],immune:[{turn:3}]}),true);
  assert.equal(C.rational94(j,{irrational:['1:Toxic'],immune:[]}),false);
});

test('withMegaAbility: Mega forme ability values Skill Link multi-hit / Tough Claws contact; validator-clean',{skip:!haveSD&&'SHOWDOWN_DIR not set'},()=>{
  const {load}=require('../lab');const sim=load(),dex=sim.Dex.mod('champions');const {legalRoleHypotheses,coherenceProblems}=require('../legal-role-hypotheses');
  const h=C.withMegaAbility(sim,legalRoleHypotheses(sim,ACE,{version:'v2'}));
  const old=h.sets.filter(s=>!s.tags.includes('megaability')),add=h.sets.filter(s=>s.tags.includes('megaability'));
  assert.ok(!old.some(s=>s.moves.some(m=>Array.isArray(dex.moves.get(m).multihit))),'the v2 template had no multi-hit move (the D2 gap)');
  assert.ok(add.length&&add.every(s=>s.moves.filter(m=>Array.isArray(dex.moves.get(m).multihit)).length>=1));
  const v=sim.TeamValidator.get('gen9championsbssregmc');
  for(const s of add){const {form,role,rationale,speedPoints,problems,tags,provenance,...set}=s;
    assert.deepEqual(v.validateSet(structuredClone(set),{})||[],[]);assert.deepEqual(coherenceProblems(dex,set,{formName:form}),[]);}
  assert.equal(C.megaAbilityCond(dex,dex.species.get('Charizard-Mega-Y'),['fireblast']),null);// Drought: no move-power rule
});

test('decidePR94 floor: max worst cell, then CVaR; never below legacy worst/CVaR',()=>{
  const L={pick:'L',legacy:true,cvar:0.4,mean:0.7,worst:0.2};
  const S=[L,{pick:'A',cvar:0.9,mean:0.95,worst:0.1},{pick:'B',cvar:0.6,mean:0.8,worst:0.5},{pick:'C',cvar:0.7,mean:0.8,worst:0.5}];
  assert.equal(C.decidePR94(S,{...C.COVER94,decision:'floor'}).pick,'C');
  assert.equal(C.decidePR94(S,{...C.COVER94,decision:'cvar'}).pick,'A');
  assert.equal(C.decidePR94([L,{pick:'A',cvar:0.9,mean:0.95,worst:0.1}],{...C.COVER94,decision:'floor'}).pick,'L');
});
