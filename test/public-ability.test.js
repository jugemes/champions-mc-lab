'use strict';
// Minimal P0 public-knowledge regression tests, no private rival set access.
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const {provisional}=require('../provisional-rank-roster-20261018');
const {matchup}=require('../lab');
const {estimateDamage,incomingRisk}=require('../damage');
const {publicThreat}=require('../threat');
const {certainPublicAbility,possibleAbilities,isLevitateImmuneToGround}=require('../public-abilities');

test('a single possible ability is public, but ambiguous abilities are NOT guessed',()=>{
  assert.deepEqual(possibleAbilities(dex,'Rotom-Wash'),['Levitate']);
  assert.equal(certainPublicAbility(dex,'Rotom-Wash'),'Levitate');
  assert.equal(certainPublicAbility(dex,'Hydreigon'),'Levitate');
  assert.equal(certainPublicAbility(dex,'Garchomp'),'');
});
test('preview Ground attacks correctly rate Wash Rotom immune, without affecting other attacks',()=>{
  const chomp=provisional().find(p=>p.species==='Garchomp');
  assert.equal(matchup(dex,chomp,'Rotom-Wash','Earthquake'),0);
  assert.equal(estimateDamage(dex,chomp,'Rotom-Wash','Earthquake').max,0);
  assert.ok(estimateDamage(dex,chomp,'Rotom-Wash','Earthquake').immune);
  assert.ok(matchup(dex,chomp,'Rotom-Wash','Dragon Claw')>0);
  assert.ok(estimateDamage(dex,chomp,'Rotom-Wash','Dragon Claw').max>0);
});
test('public STAB exposure stops inventing a Garchomp Earthquake weakness',()=>{
  const rotom=provisional().find(p=>p.species==='Rotom-Wash');
  assert.ok(publicThreat(dex,'Rotom-Wash','Garchomp')<150);
  assert.ok(incomingRisk(dex,rotom,'Garchomp') < incomingRisk(dex,{...rotom,ability:''},'Garchomp'));
});
test('Mold Breaker bypass stays a real threat when known or possible',()=>{
  const meta={species:'Gyarados-Mega',ability:'Mold Breaker'};
  assert.ok(matchup(dex,meta,'Rotom-Wash','Earthquake')>0);
  assert.ok(isLevitateImmuneToGround(dex,'Rotom-Wash',{attackerAbility:'Mold Breaker'})===false);
  assert.ok(estimateDamage(dex,{...meta,nature:'Jolly',evs:{atk:32}},'Rotom-Wash','Earthquake').max>0);
  assert.ok(isLevitateImmuneToGround(dex,'Rotom-Wash',{gravity:true})===false);
});
test('revealed non-Levitate and ability uncertainty cannot be replaced with fake immunity',()=>{
  const chomp=provisional().find(p=>p.species==='Garchomp');
  // Multiple legal abilities mean no inferred immunity or move immunity.
  assert.equal(certainPublicAbility(dex,'Garchomp'),'');
  assert.ok(estimateDamage(dex,chomp,'Garchomp','Earthquake').max>0);
  // This function is scoped to public preview and does not infer unknown held items.
  assert.equal(isLevitateImmuneToGround(dex,'Garchomp'),false);
});
