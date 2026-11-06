'use strict';
// Frozen U-L example from PR #104: verify research-only nonprogress observer
// against a FULL pinned Showdown Battle, not just handcrafted protocol lines.
// Reuses previously inspected U-L fixture, so it is NOT a new holdout.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,hashSeed,normalize}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes}=require('../fixtures');
const {battle}=require('../encore-lead-audit');
const {auditRepeatedHealing}=require('../nonprogress-audit');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const from=(team,s)=>structuredClone(team.find(x=>x.species===s));
test('M-7 U-L stall-loop audit observes actual repeated attack/heal without declaring a misplay',{skip},async t=>{
 const sim=load(),own=reportedLive();
 const foe=[from(archetypes.setup,'Salamence'),from(archetypes.setup,'Volcarona'),
  from(archetypes.setup,'Gholdengo'),from(archetypes.stall,'Toxapex'),
  from(archetypes.stall,'Skarmory'),from(archetypes.setup,'Rillaboom')];
 const validator=sim.TeamValidator.get('gen9championsbssregmc');
 assert.ok(!validator.validateTeam(normalize(own))?.length);
 assert.ok(!validator.validateTeam(normalize(foe))?.length);
 const b=await battle(sim,structuredClone(own),structuredClone(foe),hashSeed(11027000),{
  ownThree:['Metagross','Hydreigon','Rotom-Wash'],
  foeThree:['Salamence','Volcarona','Gholdengo'],reverse:false,
  rivalImmuneAware:true
 });
 assert.equal(b.errors,0,'all selected choices executed legally');
 const audit=auditRepeatedHealing(b.log,{ownSide:b.ownSide});
 t.diagnostic('M7_NONPROGRESS_HEALING_LOOP '+JSON.stringify({
   source:'reused U-L; not holdout',battleErrors:b.errors,win:b.won,
   turnsObserved:audit.turnsObserved,ppKnown:audit.ppKnown,
   findings:audit.findings
 }));
 const hit=audit.findings.find(f=>f.attackSide===b.ownSide &&
   /Metagross/.test(f.attackActor)&&f.repeatedMove==='Psychic Fangs');
 assert.ok(hit,'expected the reused U-L repeated attack + enemy recovery counterexample');
 assert.ok(hit.attackTurns>=8);
 assert.ok(hit.healingTurns>=6);
 assert.ok(hit.recoveryMoveTurns>=6,'actual Showdown Roost decisions, not just residual healing');
 assert.equal(hit.recoveryMoveLoopCandidate,true);
 assert.equal(hit.defenderEncoreObserved,false,'public Encore did not force the recovery moves');
 assert.equal(hit.ppKnown,false,'never infer private PP from public logs');
 assert.match(hit.classification,/candidate-only/);
});
