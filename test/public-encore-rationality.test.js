'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {policyStatusScore}=require('../tactics');
const {evaluateMoveV3}=require('../field-counterplay');
const {Bot,load}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {groups}=require('../environment-m7-teams');
const {makeThreeBattle}=require('../engine-three-branch');

const context={ratio:0.9,turn:3,foeHP:0.8,
 foeLastMove:'Swords Dance',foeLastMoveTurn:2,
 boosts:{},foeBoosts:{atk:2},lastStatuses:{},hazards:{}};

test('Encore is sensible when publicly observed opposing setup has not been encored',()=>{
 const free=policyStatusScore('Encore',context);
 assert.ok(free>100,'Before Encore volatile, legitimate repeat-setup threat can be encored');
 assert.equal(policyStatusScore('Encore',{...context,foeEncoreActive:true}),0,
  'After public Encore active, prevent a pointless repeat attempt');
});

test('opt-in v4 penalizes an already active Encore, retaining an attacking alternative',()=>{
 const sim=load(),dex=sim.Dex.mod('champions');
 const pri=reportedLive().find(x=>x.species==='Primarina');
 assert.equal(evaluateMoveV3(dex,pri,'Golisopod','Encore',
  {...context,foeEncoreActive:true,available:pri.moves}),0);
 assert.ok(evaluateMoveV3(dex,pri,'Golisopod','Sparkling Aria',
  {...context,foeEncoreActive:true,available:pri.moves})>0);
 assert.ok(evaluateMoveV3(dex,pri,'Golisopod','Encore',
  {...context,foeEncoreActive:false,available:pri.moves})>0);
});

test('real pinned Showdown Encore public event toggles ONLY v4 status tracking',async()=>{
 const sim=load();
 const own=reportedLive(),foe=groups.find(x=>x.name==='01_M7_golisopod_balance').team;
 const b=makeThreeBattle(sim,own,foe,{
  ownThree:['Primarina','Metagross','Hydreigon'],
  foeThree:['Golisopod','Mimikyu','Garchomp'],
  seed:[2026,10,29,55]
 });
 let logs;
 try{
  const a1=b.p1.active[0].moveSlots.findIndex(x=>x.id==='moonblast');
  const b1=b.p2.active[0].moveSlots.findIndex(x=>x.id==='swordsdance');
  assert.ok(a1>=0&&b1>=0);
  b.makeChoices('move '+(a1+1),'move '+(b1+1));
  const enc=b.p1.active[0].moveSlots.findIndex(x=>x.id==='encore');
  assert.ok(enc>=0);
  b.makeChoices('move '+(enc+1),'move '+(b1+1));
  logs=b.log.join('\n');
  assert.ok(logs.includes('|-start|p2a:')&&logs.includes('|Encore'),
   'Actual Showdown engine must visibly start Encore on opponent; no fabricated log');
 }finally{b.destroy();}
 // These are genuine public battle log lines captured from the pinned
 // engine; Bot.run is used strictly as a log observer (no fake requests).
 const reader=async function*(){yield logs;};
 const trace={selections:[],choices:[],errors:[],immuneObservations:[],engineAdvices:[]};
 const v4=new Bot(reader(),sim.Dex.mod('champions'),own,'p1',trace,null,null,{
  decisionPolicy:'v4-public-status'
 });
 await v4.run();
 assert.equal(v4.foeEncoreActive,true);
 const old=new Bot(reader(),sim.Dex.mod('champions'),own,'p1',trace,null,null,{
  decisionPolicy:'v3-public-immunity'
 });
 await old.run();
 assert.equal(old.foeEncoreActive,false,'Baseline policy stays unchanged for paired experiment');
});
