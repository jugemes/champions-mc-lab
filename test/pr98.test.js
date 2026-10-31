'use strict';
// PR #98 request: P0 decision-time boundary of the public-immunity audit
// (same-turn Mega), P1 Air Balloon vs Mold Breaker in the immune-aware rival.
// Minimal reproductions on the ORIGINAL functions + pinned-Showdown battles.
const test=require('node:test'),assert=require('node:assert/strict');
const haveSD=!!process.env.SHOWDOWN_DIR;
const skip=!haveSD&&'SHOWDOWN_DIR not set';
const X=require('../pr96-paired');
const Y=require('../pr98-timing');
const T=require('../pr94-t1t2');

const sameTurnMegaLog=['|switch|p1a: Altaria|Altaria, L50, M|100/100','|switch|p2a: Hydreigon|Hydreigon, L50, M|100/100','|turn|1',
  '|detailschange|p1a: Altaria|Altaria-Mega, L50, M','|-mega|p1a: Altaria|Altaria|Altarianite',
  '|move|p2a: Hydreigon|Dragon Pulse|p1a: Altaria','|-immune|p1a: Altaria','|move|p1a: Altaria|Dragon Dance|p1a: Altaria','|turn|2',
  '|move|p2a: Hydreigon|Dragon Pulse|p1a: Altaria','|-immune|p1a: Altaria','|turn|3'].join('\n');

test('P0 reproduced on the original pr96 function: same-turn Mega leaks into the decision-time forme',{skip},()=>{
  const {load}=require('../lab');const dex=load().Dex.mod('champions');
  const a=X.publicImmune96(sameTurnMegaLog,'p2',dex);
  assert.deepEqual(a[0],{turn:1,move:'Dragon Pulse',target:'Altaria-Mega',why:'type'},'ChatGPT V8 counterexample');
  // base Altaria (Dragon/Flying) is hit super effectively by Dragon: no immunity at choice time
  assert.ok(dex.getImmunity('Dragon',dex.species.get('Altaria').types));
  // the pr94 detector has the same leak
  assert.equal(T.publicImmune(sameTurnMegaLog,'p2',dex)[0].target,'Altaria-Mega');
});

test('P0 fixed: same-turn Mega -> possible; next turn (Mega public) -> known',{skip},()=>{
  const {load}=require('../lab');const dex=load().Dex.mod('champions');
  const r=Y.publicImmune98(sameTurnMegaLog,'p2',dex);
  assert.deepEqual(r.known,[{turn:2,move:'Dragon Pulse',target:'Altaria-Mega',why:'type'}]);
  assert.equal(r.possible.length,1);
  assert.deepEqual(r.possible[0],{turn:1,move:'Dragon Pulse',chosenAgainst:'Altaria',hit:'Altaria-Mega',why:'post-choice mega (type)'});
  assert.equal(Y.irrationalGame98({branch:'ai'},{irrational:[],immune98:{known:[]}}),false);
  assert.equal(Y.irrationalGame98({branch:'ai'},{irrational:[],immune98:r}),true,'T2 known hit stays irrational');
  assert.equal(Y.irrationalGame98({branch:'ai'},{irrational:[],immune98:r,masked:[{turn:2,move:'Dragon Pulse',why:'type',replacement:'none (no alternative)'}]}),false,'forced (no alternative) is not irrational');
  // pr96 switch-in rule kept
  const sw=['|switch|p1a: Garchomp|Garchomp, L50|100/100','|switch|p2a: Heracross|Heracross, L50|100/100','|turn|1',
    '|switch|p1a: Rotom|Rotom-Wash, L50|100/100','|move|p2a: Heracross|Earthquake|p1a: Rotom','|-immune|p1a: Rotom','|turn|2',
    '|move|p2a: Heracross|Earthquake|p1a: Rotom','|-immune|p1a: Rotom','|turn|3'].join('\n');
  const s=Y.publicImmune98(sw,'p2',dex);
  assert.deepEqual(s.known.map(x=>[x.turn,x.why]),[[2,'only ability levitate']]);assert.equal(s.switchedIn,1);
  // a ground move into a public, unpopped Air Balloon is known; after the pop it is not immune any more
  const bl=['|switch|p1a: Garchomp|Garchomp, L50|100/100','|-item|p1a: Garchomp|Air Balloon','|switch|p2a: Excadrill|Excadrill, L50|100/100','|turn|1',
    '|move|p2a: Excadrill|Earthquake|p1a: Garchomp','|-immune|p1a: Garchomp','|turn|2'].join('\n');
  assert.deepEqual(Y.publicImmune98(bl,'p2',dex).known.map(x=>x.why),['public airballoon']);
  assert.deepEqual(X.publicImmune96(bl,'p2',dex),[],'pr96 detector ignored a public balloon');
});

test('lockedmove continuation (found in the PR #97 FINAL replay) is not a choice: pr96 known, pr98 locked',{skip},()=>{
  const {load}=require('../lab');const dex=load().Dex.mod('champions');
  // shape of the real FINAL line: T4 Outrage KOs our Metagross, T5 we bring Primarina, the locked Outrage continues into it
  const log=['|switch|p1a: Metagross|Metagross, L50|100/100','|switch|p2a: Kangaskhan|Kangaskhan, L50, F|100/100','|turn|4',
    '|move|p2a: Kangaskhan|Outrage|p1a: Metagross','|-damage|p1a: Metagross|0 fnt','|faint|p1a: Metagross','|switch|p1a: Primarina|Primarina, L50, F|100/100','|turn|5',
    '|move|p2a: Kangaskhan|Outrage|p1a: Primarina|[from]lockedmove','|-immune|p1a: Primarina','|turn|6'].join('\n');
  assert.deepEqual(X.publicImmune96(log,'p2',dex).map(x=>x.turn),[5],'pr96 tags a forced continuation');
  const r=Y.publicImmune98(log,'p2',dex);assert.deepEqual(r.known,[]);assert.equal(r.locked,1);
});

test('P1 reproduced and fixed: Mold Breaker does not ignore a public Air Balloon',{skip},()=>{
  const {load}=require('../lab');const dex=load().Dex.mod('champions');
  const req=(moves,ability)=>({active:[{moves:moves.map(m=>({move:m,id:m.toLowerCase().replace(/[^a-z]/g,''),pp:8}))}],
    side:{pokemon:[{active:true,ability,condition:'100/100',details:'Excadrill'}]}});
  const im=(f,r,b)=>f(dex,r,{foeAbility:'',foeItem:'',...b}).map(x=>x.move+':'+x.why);
  const q=req(['Earthquake','Iron Head'],'moldbreaker');
  assert.deepEqual(im(X.publicImmuneMoves,q,{foeActive:'Garchomp',foeItem:'Air Balloon'}),[],'pr96: balloon dropped (the P1)');
  assert.deepEqual(im(Y.publicImmuneMoves98,q,{foeActive:'Garchomp',foeItem:'Air Balloon'}),['Earthquake:airballoon']);
  assert.deepEqual(im(Y.publicImmuneMoves98,q,{foeActive:'Rotom-Wash'}),[],'Mold Breaker pierces Levitate (ability)');
  assert.deepEqual(im(Y.publicImmuneMoves98,q,{foeActive:'Garchomp'}),[],'unrevealed / popped balloon: not assumed');
  assert.deepEqual(im(Y.publicImmuneMoves98,req(['Thousand Arrows'],'moldbreaker'),{foeActive:'Garchomp',foeItem:'Air Balloon'}),[]);
  // without Mold Breaker pr98 == pr96 (pr96 test suite cases)
  for(const [mv,ab,b] of [[['Earthquake','Close Combat'],'guts',{foeActive:'Rotom-Wash'}],[['Earthquake'],'guts',{foeActive:'Garchomp',foeItem:'Air Balloon'}],
    [['Thunderbolt'],'guts',{foeActive:'Garchomp'}],[['Hydro Pump'],'guts',{foeActive:'Gastrodon',foeAbility:'Storm Drain'}],[['Earthquake'],'moldbreaker',{foeActive:'Hydreigon'}]])
    assert.deepEqual(im(Y.publicImmuneMoves98,req(mv,ab),b),im(X.publicImmuneMoves,req(mv,ab),b));
});

// ---------- pinned Showdown battles ----------
const forceMove=(name,turns)=>(req,bot,info)=>{if(!turns.includes(info.turn))return null;
  const i=req.active?.[0]?.moves.findIndex(m=>m.move===name&&!m.disabled);return i>=0?'move '+(i+1):null;};
const ownScriptMega=(req,bot,info)=>{if(info.turn>2||!req.active?.[0])return null;
  const i=req.active[0].moves.findIndex(m=>m.move==='Dragon Dance');return 'move '+(i+1)+(req.active[0].canMegaEvo?' mega':'');};
function validate(sim,team){const {normalize}=require('../lab');return sim.TeamValidator.get('gen9championsbssregmc').validateTeam(normalize(team))||[];}

test('P0 on pinned Showdown: N6/a Altaria Megas in T1 under a rival Draco Meteor (same turn vs next turn)',{skip},async()=>{
  const {load,hashSeed}=require('../lab');const {battle}=require('../encore-lead-audit');
  const sim=load(),dex=sim.Dex.mod('champions');
  const own=require('../holdout-20261031-pr96').unseenSixesPR96().N6_altaria.hypotheses.a;// legal N6/a, as OUR side
  const rival=require('../reported-live-roster-20261027').reportedLive();
  assert.deepEqual(validate(sim,own),[]);assert.deepEqual(validate(sim,rival),[]);
  for(const reverse of [false,true])for(const aware of [false,true]){
    const rec={},seed=hashSeed(9800000+(reverse?1:0));
    const rs=forceMove('Draco Meteor',[1,2]);
    const g=await battle(sim,structuredClone(own),structuredClone(rival),seed,{ownThree:['Altaria','Chesnaught','Espathra'],foeThree:['Hydreigon','Garchomp','Tyranitar'],
      reverse,script:aware?Y.immuneAware98(rs,dex,rec):rs,ownOptions:{script:ownScriptMega}});
    assert.equal(g.errors,0);
    const me=g.ownSide,L=g.log.split('\n');
    const t1=L.indexOf('|turn|1'),t2=L.indexOf('|turn|2'),t3=L.indexOf('|turn|3');
    const dc=L.findIndex(l=>l.startsWith('|detailschange|'+me+'a: Altaria|Altaria-Mega'));
    assert.ok(dc>t1&&dc<t2,'engine: Mega in T1 after both choices');
    const r=Y.publicImmune98(g.log,g.foeSide,dex,{maxTurn:2}),old=X.publicImmune96(g.log,g.foeSide,dex,{maxTurn:2});
    if(!aware){
      assert.ok(L.slice(t1,t2).some(l=>l.startsWith('|-immune|'+me+'a: Altaria')),'T1 Draco Meteor immune on Altaria-Mega');
      assert.ok(old.some(x=>x.turn===1),'pr96 detector: T1 counted irrational (P0 on the real engine)');
      assert.deepEqual(r.possible.map(x=>x.turn),[1]);
      assert.deepEqual(r.known.map(x=>x.turn),[2],'T2: the Mega is public, the hit is a known immunity');
    }else{
      // the rival chose T1 against public base Altaria: not masked; T2 the Mega is public: masked and re-decided
      assert.deepEqual((rec.masked||[]).filter(m=>m.turn<=2).map(m=>m.turn),[2]);
      assert.ok(!L.slice(t2,t3>0?t3:undefined).some(l=>/\|move\|[^|]*\|Draco Meteor\|/.test(l)),'no T2 Draco Meteor');
      assert.deepEqual(r.known,[]);
    }
  }
});

test('P1 on pinned Showdown: Mold Breaker Earthquake into a public Air Balloon is immune; pr98 masks it, pr96 does not',{skip},async()=>{
  const {load,hashSeed}=require('../lab');const {battle}=require('../encore-lead-audit');
  const sim=load(),dex=sim.Dex.mod('champions');
  const live=require('../reported-live-roster-20261027').reportedLive();
  // TEST-ONLY variants (not a breeding recommendation): our Garchomp holds Air Balloon; the rival has a legal Mold Breaker Excadrill.
  const own=live.map(p=>p.species==='Garchomp'?{...p,item:'Air Balloon',moves:['Earthquake','Dragon Claw','Rock Slide','Swords Dance']}:p);
  const exc={species:'Excadrill',item:'Focus Sash',ability:'Mold Breaker',nature:'Jolly',moves:['Earthquake','Iron Head','Rock Slide','Swords Dance'],evs:{hp:2,atk:32,spe:32}};
  const rival=live.map(p=>p.species==='Tyranitar'?exc:p);
  assert.deepEqual(validate(sim,own),[]);assert.deepEqual(validate(sim,rival),[]);
  const out={};
  for(const v of ['naive','pr96','pr98'])for(const lead of ['Garchomp','Rotom-Wash']){
    const rec={},rs=forceMove('Earthquake',[1]);
    const script=v==='naive'?rs:v==='pr96'?X.immuneAware(rs,dex,rec):Y.immuneAware98(rs,dex,rec);
    const ownThree=lead==='Garchomp'?['Garchomp','Rotom-Wash','Metagross']:['Rotom-Wash','Garchomp','Metagross'];
    const g=await battle(sim,structuredClone(own),structuredClone(rival),hashSeed(9810000),{ownThree,foeThree:['Excadrill','Hydreigon','Primarina'],
      script,ownOptions:{script:forceMove('Swords Dance',[1])}});
    assert.equal(g.errors,0,'no illegal choice after re-decision');
    const L=g.log.split('\n'),t1=L.indexOf('|turn|1'),t2=L.indexOf('|turn|2'),me=g.ownSide;
    const T1=L.slice(t1,t2>0?t2:undefined);
    out[v+':'+lead]={eq:T1.some(l=>/\|move\|[^|]*Excadrill\|Earthquake\|/.test(l)),imm:T1.some(l=>l.startsWith('|-immune|'+me+'a:')),
      hit:T1.some(l=>l.startsWith('|-damage|'+me+'a: Rotom')),masked:(rec.masked||[]).filter(m=>m.turn===1)};
    if(lead==='Garchomp')assert.ok(L.slice(0,t1).some(l=>l.startsWith('|-item|'+me+'a: Garchomp|Air Balloon')),'balloon public before the T1 choice');
  }
  assert.ok(out['naive:Garchomp'].eq&&out['naive:Garchomp'].imm,'engine: Air Balloon blocks Mold Breaker Earthquake');
  assert.ok(out['naive:Rotom-Wash'].eq&&!out['naive:Rotom-Wash'].imm&&out['naive:Rotom-Wash'].hit,'engine: Mold Breaker pierces Levitate');
  assert.ok(out['pr96:Garchomp'].eq&&out['pr96:Garchomp'].masked.length===0,'pr96 masker misses the balloon (P1)');
  assert.ok(!out['pr98:Garchomp'].eq&&out['pr98:Garchomp'].masked.length===1&&out['pr98:Garchomp'].masked[0].why==='airballoon','pr98 masks and re-decides');
  assert.ok(out['pr98:Rotom-Wash'].eq&&out['pr98:Rotom-Wash'].masked.length===0,'Levitate vs Mold Breaker still not masked');
});
