'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {load}=require('../lab');
const {groups}=require('../environment-m7-teams');
const {reportedLive}=require('../reported-live-roster-20261027');
const {adviseEngineTurn}=require('../engine-turn-advisor');
const sim=load();
const own=reportedLive();
const publicSix=groups.find(x=>x.name==='01_M7_golisopod_balance').team.map(x=>x.species);
test('engine turn advisor preserves contradictory Mega versus base branches instead of assuming one hidden item action',()=>{
 const r=adviseEngineTurn(sim,own,publicSix,{
   ourLead:'Hydreigon',opponentLead:'Golisopod',assumptions:1,
   opponentMoves:['Swords Dance'],seed:[2026,10,28,1]
 });
 assert.equal(r.decision,'conditional');
 assert.equal(r.commonMove,null);
 assert.equal(r.byScenario.length,2);
 const mega=r.byScenario.find(x=>x.assumedMega);
 const base=r.byScenario.find(x=>!x.assumedMega);
 assert.equal(mega.preferredMove,'Flamethrower');
 assert.equal(mega.evidence.foeFainted,true);
 assert.equal(base.preferredMove,'Draco Meteor');
 assert.equal(base.evidence.foeAttackBoost,0,'Emergency Exit denies the base form setup');
 assert.equal(base.evidence.foeFainted,false);
});
test('stated public six alone are accepted as opponent information, no opponent secret Battle state',()=>{
 const r=adviseEngineTurn(sim,own,publicSix,{
   ourLead:'Hydreigon',opponentLead:'Golisopod',assumptions:1,
   opponentMoves:['Swords Dance'],seed:[2026,10,28,1]
 });
 assert.deepEqual(r.publicSix,publicSix);
 assert.ok(r.epistemicWarning.includes('not sampled'));
});
