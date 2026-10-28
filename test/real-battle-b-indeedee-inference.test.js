'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {hypotheticalEnemySix,publicSix,publicTurnOrdering,runInference}=require('../real-battle-b-indeedee-inference');
test('actual human reported public six matches synthetic placeholders but never asserts rival item',()=>{
 assert.deepEqual(publicSix,[
  'Indeedee','Hippowdon','Garchomp','Umbreon','Gengar','Gyarados']);
 for(const item of ['Focus Sash','Choice Scarf']){
  const six=hypotheticalEnemySix(item);
  assert.deepEqual(six.map(p=>p.species),publicSix);
  assert.equal(six[0].item,item);
  assert.ok(six[0].moves.includes('Dazzling Gleam'));
 }
});
test('Showdown separates Timid Indeedee move order and 4x Dazzling Gleam from unobserved Scarf item',()=>{
 const r=runInference();
 const sash=r.results['Focus Sash'],scarf=r.results['Choice Scarf'];
 assert.equal(r.results['unknown'],undefined);
 assert.equal(sash.incomingDazzlingGleamFraction>0,true);
 assert.equal(scarf.incomingDazzlingGleamFraction>0,true);
 assert.equal(scarf.speedOfIndeedee>sash.speedOfIndeedee,true);
 assert.equal(scarf.speedOfHydreigon,sash.speedOfHydreigon);
 assert.equal(scarf.speedOfIndeedee>scarf.speedOfHydreigon,true);
 // A faint at END of turn is NOT a faint before our move. The old
 // audit mislabeled these and falsely certified incompatible hypotheses.
 assert.equal(scarf.hydreigonFaintedBeforeActing,true);
 assert.equal(sash.hydreigonFaintedBeforeActing,false);
 assert.equal(sash.hydreigonMoveSeen,true);
 assert.equal(scarf.hydreigonMoveSeen,false);
 assert.equal(scarf.hydreigonActedBeforeKO,false);
 assert.equal(scarf.indeedeeMovedBeforeHydreigon,true);
 assert.equal(scarf.compatibleWithObservedFirstMoveAndKO,true);
 assert.equal(sash.hydreigonFaintedByTurnEnd,true);
 assert.equal(sash.hydreigonActedBeforeKO,true);
 assert.equal(sash.hydreigonFaintedBeforeActing,false);
 assert.equal(sash.indeedeeMovedBeforeHydreigon,false);
 assert.equal(sash.compatibleWithObservedFirstMoveAndKO,false);
 // Without Scarf, Timid Hydreigon moves first under these explicitly
 // declared bare-start, no external speed modifications assumptions.
 assert.equal(sash.speedOfIndeedee<sash.speedOfHydreigon,true);
});

test('turn chronology does not invent move execution after an actual first-turn KO',()=>{
 const noMove=publicTurnOrdering([
  '|move|p2a: Indeedee|Dazzling Gleam|p1a: Hydreigon',
  '|-damage|p1a: Hydreigon|0 fnt',
  '|faint|p1a: Hydreigon'
 ]);
 assert.equal(noMove.hydreigonActedBeforeKO,false);
 assert.equal(noMove.hydreigonFaintedBeforeActing,true);
 const acted=publicTurnOrdering([
  '|move|p1a: Hydreigon|Dark Pulse|p2a: Indeedee',
  '|move|p2a: Indeedee|Dazzling Gleam|p1a: Hydreigon',
  '|faint|p1a: Hydreigon'
 ]);
 assert.equal(acted.hydreigonFaintedBeforeActing,false);
 assert.equal(acted.hydreigonActedBeforeKO,true);
});
