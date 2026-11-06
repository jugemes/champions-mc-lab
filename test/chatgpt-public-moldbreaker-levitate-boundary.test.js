'use strict';
// Characterize a cross-species public-risk boundary, not a rank policy.
// A legal rival hypothesis is NOT a claim about an observed private set.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const A=require('../hybrid01-audit');
const {upperHit}=require('../public-coverage-band');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';

test('pinned Showdown: Mold Breaker Mega Earthquake hits Levitate Rotom, unlike current public risk upper bound',{skip},()=>{
  const sim=load(),dex=sim.Dex.mod('champions');
  const validator=sim.TeamValidator.get('gen9championsbssregmc');
  const rotom=reportedLive().find(p=>p.species==='Rotom-Wash');
  const gyara=A.set('Gyarados','Gyaradosite','Intimidate','Jolly',
    {hp:2,atk:32,spe:32},['Earthquake','Waterfall','Crunch','Dragon Dance']);
  const errors=validator.validateSet(normalize([gyara])[0],{});
  assert.ok(!errors?.length,'legal M-C hypothesis: '+JSON.stringify(errors));
  assert.equal(dex.species.get('Gyarados-Mega').abilities['0'],'Mold Breaker');
  const b=A.engineBattle(sim,A.padTo6(rotom,A.FILLER()),A.padTo6(gyara,A.FILLER()),
    [104,11,1,9],[['move 4','move 1 mega']]);
  assert.ok(b.log.length>0,'the pinned engine must emit a battle protocol');
  assert.ok(b.log.some(l=>l.includes('Gyarados-Mega')),'Mega must actually occur');
  assert.ok(b.log.some(l=>l.startsWith('|move|p2a: Gyarados|Earthquake')),'Earthquake must execute');
  assert.ok(b.log.some(l=>l.startsWith('|-damage|p1a: Rotom')),'engine must show a hit');
  assert.ok(!b.log.some(l=>l.startsWith('|-immune|p1a: Rotom')),'no Levitate immunity');
  const naive=upperHit(dex,rotom,'Gyarados-Mega',{move:'Earthquake',weather:'none'});
  // Existing bug characterization: when corrected, assert >0 instead.
  assert.equal(naive,0,'current upper-bound model incorrectly says impossible');
});
