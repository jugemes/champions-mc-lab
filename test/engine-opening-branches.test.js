'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {load}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {groups}=require('../environment-m7-teams');
const {opponentLeadHypotheses,checkOpeningBranches}=require('../engine-opening-branches');
const sim=load(),own=reportedLive();
const group=groups.find(g=>g.name==='01_M7_golisopod_balance');
const names=group.team.map(p=>p.species);
test('rival 3+lead scenarios derive from public six & documented sets, not actual forced selections',()=>{
 const a=opponentLeadHypotheses(sim,own,names,{maxScenes:5});
 const b=opponentLeadHypotheses(sim,own,[...names],{maxScenes:5});
 assert.deepEqual(a,b);
 assert.ok(a.length>=2);
 for(const x of a){
   assert.equal(x.assumedThree.length,3);
   assert.ok(x.assumedThree.every(s=>names.includes(s)));
   assert.equal(x.assumedThree[0],x.assumedLead);
 }
 assert.ok(a.some(s=>s.assumedLead==='Golisopod'),
   'must test a public Mega threat even if old opponent preview ranks a different lead');
});
test('two-turn pressure branches include own alternative lead and preserve conditional Mega hypotheses',()=>{
 const r=checkOpeningBranches(sim,own,names,{
   ownLead:'Hydreigon',ownThree:['Hydreigon','Garchomp','Tyranitar'],maxScenes:5});
 assert.ok(r.results.length>0);
 const mega=r.results.filter(x=>x.assumedEnemyLead==='Golisopod'&&x.enemyMega);
 const base=r.results.filter(x=>x.assumedEnemyLead==='Golisopod'&&!x.enemyMega);
 assert.ok(mega.length>0&&base.length>0,
   'Mega and base must both be evaluated as possibilities, not revealed actual item');
 assert.ok(mega.some(x=>x.ourFirstMove==='Flamethrower'&&x.foeLeadFainted),
   'Showdown must recognize valid conditional Mega Golisopod KO');
 assert.equal(r.ownThree[0],'Hydreigon');
});
