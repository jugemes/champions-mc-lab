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

test('Showdown full turn: *landed* Draco is resisted while Flamethrower KOs Mega before setup',()=>{
 const common={ourLead:'Hydreigon',opponentLead:'Golisopod',
   opponentMove:'Swords Dance',opponentMega:true};
 // Avoid conflating a Draco miss with a resisted hit. The oracle uses real
 // accuracy RNG, so find and disclose a deterministic seed where it landed.
 let hit=null,seed=null;
 for(let i=0;i<32;i++){
   const candidate=[2026,10,28,i];
   const result=engineTurnSample(sim,live,megaBug,{...common,ourMove:'Draco Meteor',seed:candidate});
   if(result.opponentAfter.hp>0&&result.opponentAfter.hp<result.opponentAfter.maxhp){
     hit=result;seed=candidate;break;
   }
 }
 assert.ok(hit,'require actual landed-but-nonlethal Draco before comparing choices');
 const fire=engineTurnSample(sim,live,megaBug,{...common,ourMove:'Flamethrower',seed});
 assert.equal(fire.opponentAfter.form,'Golisopod-Mega');
 assert.equal(hit.opponentAfter.form,'Golisopod-Mega');
 assert.equal(fire.opponentAfter.hp,0,'engine should KO before setup');
 assert.ok(hit.opponentAfter.hp>0&&hit.opponentAfter.hp<hit.opponentAfter.maxhp,
   'Draco *landed* but Golisopod survived');
 assert.ok(hit.opponentAfter.boosts.atk>=2,'Showdown applies Swords Dance after survived resisted hit');
 assert.ok(fire.events.some(x=>x.includes('Flamethrower')));
 assert.ok(hit.events.some(x=>x.includes('Swords Dance')));
});
