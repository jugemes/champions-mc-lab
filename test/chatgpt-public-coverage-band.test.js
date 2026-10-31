'use strict';
// This is a diagnostic for public-six risk, NOT a ladder policy or win-rate claim.
// All rival sets are legality hypotheses. No hidden opposing three or actual set.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {incomingRisk}=require('../damage');
const {candidates,publicCoverageBand,upperHit}=require('../public-coverage-band');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';

test('public six: legal Fairy coverage and possible Scarf speed expose Hydreigon lead risk',{skip},t=>{
  const sim=load(),dex=sim.Dex.mod('champions');
  const own=reportedLive().find(p=>p.species==='Hydreigon');
  const band=publicCoverageBand(sim,own,'Indeedee');
  const fairy=band.coverage.find(m=>m.move==='Dazzling Gleam');
  assert.ok(fairy,'Dazzling Gleam must be legal in a coherent four-move M-C set');
  assert.ok(fairy.upperRatio>=1,'possible Fairy attack can KO: '+JSON.stringify(fairy));
  assert.ok(incomingRisk(dex,own,'Indeedee',{})<1,'old STAB-only baseline misses the threat');
  assert.equal(band.ownSpeed,165);
  assert.equal(band.speed.scarfPossible,true);
  assert.ok(band.speed.scarfMax>band.ownSpeed);
  t.diagnostic('PUBLIC COVERAGE B: '+JSON.stringify({fairy,old:incomingRisk(dex,own,'Indeedee',{}),speed:band.speed}));
});
test('public six: known Levitate prevents Ground coverage false positive',{skip},()=>{
  const sim=load(),dex=sim.Dex.mod('champions');
  const own=reportedLive().find(p=>p.species==='Rotom-Wash');
  const legal=candidates(sim,'Garchomp').legal;
  const ground=legal.find(x=>x.type==='Ground'&&x.move==='Earthquake');
  assert.ok(ground,'legal Ground move exists in the public Garchomp hypothesis pool');
  assert.equal(upperHit(dex,own,ground.form,ground),0,'known Levitate must not be scored as a hit');
});
test('public six: distinct weather/physical archetype can be evaluated without rival private sets',{skip},t=>{
  const sim=load(),own=reportedLive();
  const pairs=[['Metagross','Charizard'],['Primarina','Heracross'],['Tyranitar','Gyarados']];
  const rows=pairs.map(([ours,foe])=>{
    const band=publicCoverageBand(sim,own.find(p=>p.species===ours),foe);
    assert.ok(band.coverage.length>0,foe+' must have legal attacking candidates');
    assert.ok(band.coverage.every(x=>Number.isFinite(x.upperRatio)));
    return {ours,foe,top:band.coverage.slice(0,2),speed:band.speed};
  });
  t.diagnostic('PUBLIC COVERAGE CROSS ARCHETYPE '+JSON.stringify(rows));
});
