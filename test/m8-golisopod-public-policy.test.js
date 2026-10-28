'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {load,normalize}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {FORMAT}=require('../engine-reference');
const {publicGolisopodHypothesis,allScenarios,customHoldouts}=require('../m8-golisopod-public-policy');
const sim=load(),ours=reportedLive();
test('holdout adversaries remain legal M-C six-member teams and distinct forced threes',()=>{
 const h=customHoldouts();
 assert.equal(h.length,4);
 for(const x of h){
  assert.equal(x.team.length,6);
  const errors=sim.TeamValidator.get(FORMAT).validateTeam(normalize(x.team));
  assert.ok(!errors||errors.length===0,'invalid '+x.name+' '+JSON.stringify(errors));
  for(const k of ['forcedA','forcedB']){
   assert.equal(x[k].length,3);
   assert.equal(new Set(x[k]).size,3);
   assert.ok(x[k].every(n=>x.team.some(p=>p.species===n)));
  }
 }
 assert.equal(h.some(x=>x.name.includes('base_golisopod')&&x.team[0].item!=='Golisopite'),true);
});
test('a preregistered own trio never receives nor depends on opponent hidden three',()=>{
 const candidates=allScenarios();
 assert.equal(candidates.length,7);
 for(const x of candidates){
  const six=x.team.map(m=>m.species);
  const pre=publicGolisopodHypothesis(ours,six);
  assert.deepEqual(pre,['Primarina','Metagross','Hydreigon']);
  const altered=structuredClone(x);
  altered.forcedA=[...altered.forcedB];
  altered.forcedB=[...x.forcedA];
  assert.deepEqual(publicGolisopodHypothesis(ours,altered.team.map(p=>p.species)),pre);
 }
});
test('no universal trio: absent Golisopod or changed own six yields no suggested pilot',()=>{
 assert.equal(publicGolisopodHypothesis(ours,[
  'Charizard','Mimikyu','Garchomp','Baxcalibur','Gholdengo','Primarina'
 ]),null);
 const other=structuredClone(ours);other[0].species='Lucario';
 assert.equal(publicGolisopodHypothesis(other,[
  'Golisopod','Mimikyu','Garchomp','Baxcalibur','Gholdengo','Primarina'
 ]),null);
});
