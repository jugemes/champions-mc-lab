'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {load}=require('../lab');
const {groups}=require('../environment-m7-teams');
const {reportedLive}=require('../reported-live-roster-20261027');
const {publicHypotheses}=require('../public-hypotheses');
const {publicMoveOutcomes}=require('../public-turn-options');
const sim=load(),own=reportedLive();
const gl=groups.find(g=>g.name==='01_M7_golisopod_balance');
const publicSix=gl.team.map(p=>p.species);
test('all 14 M-7 public sixes yield legal, item-distinct, explicitly sourced opponent hypotheses',()=>{
 for(const grp of groups){
  const names=grp.team.map(x=>x.species);
  const h=publicHypotheses(sim,names,{limit:2});
  assert.deepEqual(h.publicSix,names);
  assert.ok(h.assumptions.length>=1);
  for(const a of h.assumptions){
   assert.deepEqual(a.team.map(p=>p.species),names);
   assert.equal(new Set(a.team.map(p=>p.item)).size,6);
   assert.equal(a.probability,null,'do not invent set usage probabilities');
   assert.equal(sim.TeamValidator.get('gen9championsbssregmc').validateTeam(
     require('../lab').normalize(a.team)),null);
  }
 }
});
test('unsupported species fails closed rather than inventing a move, EV or item',()=>{
 assert.throws(()=>publicHypotheses(sim,['Golisopod','Garchomp','Mimikyu','Hippowdon','Primarina','Magikarp']),/no explicitly documented synthetic sets/);
});
test('exact Showdown counterfactual compares *both* Mega and non-Mega SD responses, not hidden rival sets',()=>{
 const outcome=publicMoveOutcomes(sim,own,publicSix,{ourLead:'Hydreigon',opponentLead:'Golisopod',
   assumptions:1,opponentMoves:['Swords Dance'],seed:[2026,10,28,1]});
 assert.equal(outcome.assumptionsUsed,1);
 assert.equal(outcome.cases.length,8); // 4 known own moves × 1 hypothetical move × 2 forms
 const fire=outcome.comparisons.find(x=>x.move==='Flamethrower');
 const dragon=outcome.comparisons.find(x=>x.move==='Draco Meteor');
 assert.equal(fire.testedCases,2);
 assert.equal(fire.enemyKO,1,'Fire KOs Mega but not base form');
 assert.equal(dragon.enemyKO,0);
 const megaFire=outcome.cases.find(x=>x.opponentMega&&x.ownMove==='Flamethrower');
 const megaDraco=outcome.cases.find(x=>x.opponentMega&&x.ownMove==='Draco Meteor');
 assert.ok(megaFire.foeFainted,'Flamethrower prevents Swords Dance on the Mega branch');
 assert.ok(!megaDraco.foeFainted,'Draco cannot KO the Mega');
 assert.ok(megaDraco.foeAttackBoost>=2,'Mega survives Draco and executes Swords Dance');
 assert.ok(outcome.cases.some(x=>x.opponentMega===true&&x.foeForm==='Golisopod-Mega'));
 assert.ok(outcome.cases.some(x=>x.opponentMega===false&&x.foeForm==='Golisopod'));
});
test('cannot present an uncovered move as a hypothetical enemy action',()=>{
 assert.throws(()=>publicMoveOutcomes(sim,own,publicSix,{
   ourLead:'Hydreigon',opponentLead:'Golisopod',opponentMoves:['Moonblast']
 }),/explicitly legal set moves/);
});
