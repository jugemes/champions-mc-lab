'use strict';
// P0-B1: transparent, public-only risk intervals. All opposing sets below are
// hypothesis sets used to check possibility, not observed items/moves.
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const validator=sim.TeamValidator.get('gen9championsbssregmc');
const {reportedLive}=require('../reported-live-roster-20261027');
const {speedInterval,speedOutlook,candidateCoverage,publicRiskBand}=require('../public-risk-bands');
const {incomingRisk}=require('../damage');
const {rankRationalPreview}=require('../preview-rational');

const live=reportedLive(), hyd=live.find(p=>p.species==='Hydreigon');
test('Indeedee public speed band: no scarf max 161, possible Scarf max 241; Hydreigon 165',()=>{
 const a=speedOutlook(dex,hyd,'Indeedee');
 assert.equal(a.ownSpeed,165);
 assert.equal(a.normal.max,161);
 assert.equal(a.scarfHypothesis.max,241);
 assert.equal(a.normalOutlook.alwaysSlowerThanUs,true);
 assert.equal(a.scarfOutlook.mayMoveFirst,true);
 // Scarf is only a scenario: the routine never asserts it is held.
 assert.equal(a.scarfHypothesis.scarfHypothesis,true);
});
test('live Scarf Garchomp can outspeed max-speed base Charizard/Y hypothesis',()=>{
 const chomp=live.find(p=>p.species==='Garchomp');
 const ownSpeed=Math.floor((102+32+20)*1.1);
 assert.equal(ownSpeed,169);
 assert.equal(Math.floor(ownSpeed*1.5),253);
 assert.equal(speedInterval(dex,'Charizard').max,167);
});
test('Dazzling Gleam is M-C legal possible coverage for Indeedee, not STAB',()=>{
 const covers=candidateCoverage(dex,'Indeedee',validator,{candidateMoveNames:['Dazzling Gleam','Splash','Psychic','unavailablemove']});
 assert.deepEqual(covers.map(m=>m.name),['Dazzling Gleam']);
});
test('unrevealed legal Dazzling Gleam exposes a potential lethal upper bound on Hydreigon',()=>{
 const old=incomingRisk(dex,hyd,'Indeedee',{});
 const next=publicRiskBand(dex,hyd,'Indeedee',validator,{candidateMoveNames:['Dazzling Gleam']});
 assert.equal(next.baselineStabUpper,old);
 assert.ok(old<1,'STAB-only incorrectly feels survivable');
 assert.ok(next.possibleCoverageUpper>=1,'legal Fairy coverage is potentially lethal');
 assert.ok(next.worstCoverageMoves.includes('Dazzling Gleam'));
 assert.equal(next.interpretation,'legal-possibility-only');
});
test('Rock Slide is possible non-STAB coverage for Garchomp, not a revealed move',()=>{
 const c=candidateCoverage(dex,'Garchomp',validator,{candidateMoveNames:['Rock Slide','Earthquake']});
 assert.deepEqual(c.map(m=>m.name),['Rock Slide']);
});
test('old rational preview remains unchanged by diagnostics; no opposing private sets read',()=>{
 const opponentSix=['Indeedee','Hippowdon','Garchomp','Umbreon','Gengar','Gyarados'];
 const before=rankRationalPreview(dex,live,opponentSix);
 publicRiskBand(dex,hyd,'Indeedee',validator,{candidateMoveNames:['Dazzling Gleam']});
 const after=rankRationalPreview(dex,live,opponentSix);
 assert.deepEqual(before,after);
 // Changing some private hypothesis about an Indeedee must not enter the API:
 // the diagnostic accepts only its public species name.
 assert.equal(typeof publicRiskBand(dex,hyd,'Indeedee',validator,{candidateMoveNames:[]}).possibleCoverageUpper,'number');
});
