'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {groups}=require('../environment-m7-teams');
const {engineDamageSample,engineTurnSample,createHypotheticalBattle,FORMAT}=require('../engine-reference');
const sim=load();
const live=reportedLive();
const megaBug=groups.find(g=>g.name==='01_M7_golisopod_balance').team;
const sun=groups.find(g=>g.name==='03_M7_charizardY_offense').team;

test('isolated Showdown Battle boots M-C preview with two explicit full-six hypotheses',()=>{
 const b=createHypotheticalBattle(sim,live,megaBug,{ourLead:'Hydreigon',opponentLead:'Golisopod'});
 try{
  assert.equal(b.format.id,FORMAT);
  assert.equal(b.p1.active[0].species.name,'Hydreigon');
  assert.equal(b.p2.active[0].species.name,'Golisopod');
 }finally{b.destroy();}
});
test('Showdown engine, not custom type/form heuristics: Mega-Golisopod changes damage for Flamethrower',()=>{
 const base=engineDamageSample(sim,live,megaBug,{ourLead:'Hydreigon',opponentLead:'Golisopod',move:'Flamethrower'});
 const mega=engineDamageSample(sim,live,megaBug,{ourLead:'Hydreigon',opponentLead:'Golisopod',move:'Flamethrower',opponentMega:true});
 assert.equal(base.opponentForm,'Golisopod');
 assert.equal(mega.opponentForm,'Golisopod-Mega');
 assert.equal(mega.opponentAbility,'Tough Claws');
 assert.ok(base.rawDamage>0&&mega.rawDamage>base.rawDamage,'Fire should do much more damage after Bug/Steel Mega');
});
test('Showdown damage to Mega-Golisopod correctly reduces Electric coverage versus base Bug/Water',()=>{
 const base=engineDamageSample(sim,live,megaBug,{ourLead:'Rotom-Wash',opponentLead:'Golisopod',move:'Thunderbolt'});
 const mega=engineDamageSample(sim,live,megaBug,{ourLead:'Rotom-Wash',opponentLead:'Golisopod',move:'Thunderbolt',opponentMega:true});
 assert.ok(base.rawDamage>mega.rawDamage,'Electric should be less valuable after foe changes from Water to Steel');
});
test('Levitate immunity and known Choice Scarf speed are resolved in Showdown itself',()=>{
 const lev=engineDamageSample(sim,live,live,{ourLead:'Garchomp',opponentLead:'Rotom-Wash',move:'Earthquake'});
 assert.equal(lev.rawDamage,0);
 assert.equal(lev.immune,true);
 const scarf=engineDamageSample(sim,live,sun,{ourLead:'Garchomp',opponentLead:'Charizard',move:'Rock Slide'});
 assert.ok(scarf.ourSpeed>scarf.opponentSpeed);
});
test('oracle refuses unvalidated or non-own move instead of peeking enemy hidden battle info',()=>{
 assert.throws(()=>engineDamageSample(sim,live,megaBug,{
   ourLead:'Hydreigon',opponentLead:'Golisopod',move:'Dazzling Gleam'}),/our explicitly known set/);
 const bad=megaBug.map(x=>({...x}));
 bad[1]={...bad[1],item:bad[0].item};
 assert.throws(()=>createHypotheticalBattle(sim,live,bad,{
   ourLead:'Hydreigon',opponentLead:'Golisopod'}),/illegal hypothetical team/);
});

test('one full Showdown turn: Flamethrower prevents Mega-Golisopod Swords Dance, Draco Meteor does not',()=>{
 const common={ourLead:'Hydreigon',opponentLead:'Golisopod',
   opponentMove:'Swords Dance',opponentMega:true,seed:[2026,10,28,2]};
 const fire=engineTurnSample(sim,live,megaBug,{...common,ourMove:'Flamethrower'});
 const dragon=engineTurnSample(sim,live,megaBug,{...common,ourMove:'Draco Meteor'});
 assert.equal(fire.opponentAfter.form,'Golisopod-Mega');
 assert.equal(dragon.opponentAfter.form,'Golisopod-Mega');
 assert.equal(fire.opponentAfter.hp,0,'engine should KO before setup');
 assert.ok(dragon.opponentAfter.hp>0,'resisted Draco should fail to stop setup');
 assert.ok(dragon.opponentAfter.boosts.atk>=2,'Showdown itself applies Swords Dance after resisted hit');
 assert.ok(fire.events.some(x=>x.includes('Flamethrower')));
 assert.ok(dragon.events.some(x=>x.includes('Swords Dance')));
});
