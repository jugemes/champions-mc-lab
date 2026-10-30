'use strict';
// PR #68 request (PR #67 review 5712132484): Encore-forced Swords Dance was
// tagged as the rival's own setupSpam. v3 regressions, synthetic logs plus
// full pinned-Showdown games.
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const {misplaysV2}=require('../misplay-tags-v2');
const {misplaysV3,anyTag,requestInfo,VOLUNTARY_PR69}=require('../misplay-tags-v3');
const {battle,rivalScript}=require('../encore-lead-audit');
const {caseList}=require('../legal-search-v2-compare');
const {reportedLive}=require('../reported-live-roster-20261027');
const {hashSeed}=require('../lab');
const L=(...x)=>x.join('\n');
const sd=t=>['|turn|'+t,'|move|p1a: Primarina|Encore|p2a: Golisopod','|move|p2a: Golisopod|Swords Dance|p2a: Golisopod'];
// ChatGPT's synthetic repro: SD (free), Encore lands, two locked SDs.
const ENCORED=L('|turn|1','|move|p1a: Primarina|Moonblast|p2a: Golisopod','|move|p2a: Golisopod|Swords Dance|p2a: Golisopod',
  '|turn|2','|move|p1a: Primarina|Encore|p2a: Golisopod','|-start|p2a: Golisopod|Encore','|move|p2a: Golisopod|Swords Dance|p2a: Golisopod',
  ...sd(3),...sd(4));
const req=(side,turn,o={})=>({side,turn,locked:false,lockedMove:null,canSwitch:true,...o});

test('v2 is unchanged: Encore-forced SDs still count as setupSpam (old definition kept)',()=>{
  assert.equal(misplaysV2(ENCORED).p2.setupSpam,2);
});
test('v3: SDs picked while already Encored are setupForcedEncore, not setupSpam',()=>{
  const m=misplaysV3(ENCORED).p2;
  assert.equal(m.setupSpam,0);assert.equal(m.setupForcedEncore,2);
  assert.equal(m.encoreStay,0,'log-only: switch availability unknown, so not counted');
});
test('v3: the same 3 SDs without an Encore are setupSpam',()=>{
  const m=misplaysV3(ENCORED.replace('|-start|p2a: Golisopod|Encore\n','')).p2;
  assert.equal(m.setupSpam,2);assert.equal(m.setupForcedEncore,0);
});
test('v3: with requests, staying in an Encored SD while a switch is legal is encoreStay (review tier since PR #70)',()=>{
  const requests=[req('p2',3,{locked:true,lockedMove:'Swords Dance'}),req('p2',4,{locked:true,lockedMove:'Swords Dance',canSwitch:false})];
  const m=misplaysV3(ENCORED,{requests}).p2;
  assert.equal(m.encoreStay,1);
  assert.equal(anyTag(m),false,'switch legal != proven misplay');assert.equal(anyTag(m,VOLUNTARY_PR69),true,'PR #69 aggregate kept');
});
test('v3: Encore landing mid-turn does not make that turn\'s pick forced',()=>{
  // T2 SD was chosen before the Encore landed, so T3 (free pick, Encore ended at end of T2) is a chosen 3rd SD.
  const log=L('|turn|1','|move|p2a: Golisopod|Swords Dance|p2a: Golisopod',
    '|turn|2','|move|p1a: Primarina|Encore|p2a: Golisopod','|-start|p2a: Golisopod|Encore','|move|p2a: Golisopod|Swords Dance|p2a: Golisopod','|-end|p2a: Golisopod|Encore',
    '|turn|3','|move|p2a: Golisopod|Swords Dance|p2a: Golisopod');
  assert.equal(misplaysV3(log).p2.setupSpam,1);
});
test('v3: Encore ends on -end, switch-out and faint (no setupForcedEncore after)',()=>{
  const base=L('|turn|1','|move|p2a: Golisopod|Swords Dance|p2a: Golisopod','|turn|2','|-start|p2a: Golisopod|Encore','|move|p2a: Golisopod|Swords Dance|p2a: Golisopod');
  const third=L('|turn|3','|move|p2a: Golisopod|Swords Dance|p2a: Golisopod');
  assert.equal(misplaysV3(L(base,third)).p2.setupForcedEncore,1);
  assert.equal(misplaysV3(L(base,'|-end|p2a: Golisopod|Encore',third)).p2.setupSpam,1);
  // switched out and back: Encore must not survive the switch. PR #70: the
  // move history is per active stint (3 SDs after the return = 1 setupSpam);
  // stintReset:false keeps the PR #69 / v2 history
  const back=L(base,'|turn|3','|switch|p2a: Garchomp|Garchomp, L50|185/185','|turn|4','|switch|p2a: Golisopod|Golisopod, L50|100/182',
    '|turn|5','|move|p2a: Golisopod|Swords Dance|p2a: Golisopod','|turn|6','|move|p2a: Golisopod|Swords Dance|p2a: Golisopod','|turn|7','|move|p2a: Golisopod|Swords Dance|p2a: Golisopod');
  const m=misplaysV3(back).p2;assert.equal(m.setupForcedEncore,0);assert.equal(m.setupSpam,1);
  assert.equal(misplaysV3(back,{stintReset:false}).p2.setupSpam,misplaysV2(back).p2.setupSpam);
  assert.equal(misplaysV3(L(base,'|faint|p2a: Golisopod','|switch|p2a: Golisopod|Golisopod, L50|1/182',third)).p2.setupForcedEncore,0);
});
test('v3: resistRepeat keeps the v2 key (regression: no "resistedRepeat")',()=>{
  const log=L('|turn|9','|move|p2a: Skarmory|Brave Bird|p1a: Rotom','|-resisted|p1a: Rotom','|turn|10','|move|p2a: Skarmory|Brave Bird|p1a: Rotom','|-resisted|p1a: Rotom');
  const m=misplaysV3(log).p2;
  assert.equal(m.resistRepeat,1);assert.equal(misplaysV2(log).p2.resistRepeat,1);assert.equal('resistedRepeat' in m,false);
});
test('v3: Choice-locked repeat into an immunity is lockedRepeat; lockedStay only if a switch was legal',()=>{
  const log=L('|turn|4','|move|p1a: Garchomp|Earthquake|p2a: Eelektross','|-immune|p2a: Eelektross|[from] ability: Levitate',
    '|turn|5','|move|p1a: Garchomp|Earthquake|p2a: Eelektross','|-immune|p2a: Eelektross|[from] ability: Levitate');
  assert.equal(misplaysV3(log).p1.immuneRepeat,1,'without requests: v2 behaviour');
  const a=misplaysV3(log,{requests:[req('p1',5,{locked:true,lockedMove:'Earthquake'})]}).p1;
  assert.deepEqual([a.immuneRepeat,a.lockedRepeat,a.lockedStay],[0,1,1]);
  const b=misplaysV3(log,{requests:[req('p1',5,{locked:true,lockedMove:'Earthquake',canSwitch:false})]}).p1;
  assert.deepEqual([b.lockedRepeat,b.lockedStay,anyTag(b)],[1,0,false]);
});
test('requestInfo: one enabled move = locked; trapped / empty bench = no switch; Struggle not a lock',()=>{
  const mk=(moves,bench,o={})=>({active:[{moves,...o}],side:{pokemon:[{active:true,condition:'100/100'},...bench]}});
  const mv=(m,d=false)=>({move:m,disabled:d});
  const enc=mk([mv('Swords Dance'),mv('Leech Life',true),mv('Sucker Punch',true)],[{active:false,condition:'50/100'}]);
  assert.deepEqual(requestInfo(enc,'p2',3,{encored:true}),{side:'p2',turn:3,locked:true,lockedMove:'Swords Dance',canSwitch:true,lockReason:'encore'});
  assert.equal(requestInfo(enc,'p2',3).lockReason,'other','one enabled move without a logged Encore is not Encore');
  assert.equal(requestInfo(mk([mv('Swords Dance'),mv('Leech Life')],[{active:false,condition:'0 fnt'}]),'p2',3).canSwitch,false);
  assert.equal(requestInfo(mk([mv('Swords Dance'),mv('Leech Life')],[{active:false,condition:'5/100'}],{trapped:true}),'p2',3).canSwitch,false);
  assert.equal(requestInfo(mk([mv('Struggle')],[]),'p2',3).locked,false);
});

// Full pinned-Showdown games, case A forcedA, our Primarina lead, seed of the
// PR #67 compare (7400000, gi 0, s 0), forward side.
const A=caseList().find(c=>c.id==='A_golisopod');
const run=(t1,enc,three=['Primarina','Metagross','Garchomp'])=>battle(sim,reportedLive(),structuredClone(A.team),hashSeed(7400000),
  {ownThree:three,foeThree:A.forcedA,reverse:false,script:rivalScript(t1,enc,sim.Dex.mod('champions'))});
test('real Battle: Encore starts/ends in the log, rival AI stays, v2 calls it setupSpam, v3 splits it',async()=>{
  const r=await run('ai','stay');
  assert.equal(r.won,true);
  assert.match(r.log,/\|-start\|p2a: Golisopod\|Encore/);assert.match(r.log,/\|-end\|p2a: Golisopod\|Encore/);
  assert.ok(misplaysV2(r.log).p2.setupSpam>0);
  const m=misplaysV3(r.log,{requests:r.reqLog}).p2;
  assert.ok(m.setupForcedEncore>0);assert.ok(m.encoreStay>0,'rival had a legal switch and stayed');
  // request turn alignment: every Encore-locked request is on a turn whose start had Encore active
  const locked=r.reqLog.filter(x=>x.side==='p2'&&x.locked);
  assert.ok(locked.length>0&&locked.every(x=>x.lockedMove==='Swords Dance'));
  // own side wastes turns re-using Encore on an already Encored target (our turn-AI weakness)
  assert.ok(misplaysV3(r.log).p1.encoreRepeat>0);assert.match(r.log,/\|move\|p1a: Primarina\|Encore\|\|\[still\]\n\|-fail\|p1a: Primarina/);
});
test('real Battle: rival switching out of Encore (toGarchomp) removes the Encore win',async()=>{
  const r=await run('ai','toGarchomp');
  assert.match(r.log,/\|-start\|p2a: Golisopod\|Encore[\s\S]*\|switch\|p2a: Garchomp/);
  const m=misplaysV3(r.log,{requests:r.reqLog}).p2;
  assert.equal(m.setupSpam+m.setupForcedEncore+m.encoreStay,0);
  assert.equal(r.won,false);
});
