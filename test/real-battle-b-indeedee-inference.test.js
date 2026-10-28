'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {hypotheticalEnemySix,publicSix,runInference}=require('../real-battle-b-indeedee-inference');
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
 assert.equal(scarf.hydreigonFaintedBeforeActing,true);
 // Without Scarf, Timid Hydreigon should act first at equal points/IV
 assert.equal(sash.speedOfIndeedee<sash.speedOfHydreigon,true);
});
