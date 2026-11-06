'use strict';
// PR #104 issuecomment #6627434262 preregistered BEFORE optimizer outcome.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,normalize,prelim}=require('../lab');
const {discover}=require('../m8-open6-universe-minimax-20261104');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
test('M8 OPEN6 all-index lower-tail structure search yields two DISTINCT complete legal teams',{skip},t=>{
 const sim=load(),x=discover(sim,{seed:1543,rounds:5,samples:90});
 assert.ok(x.coverage.formsConsidered>=1000);
 assert.ok(x.coverage.validatedSpeciesLowerBound>=300);
 assert.equal(x.candidates.length,2);
 const [a,b]=x.candidates;
 for(const [name,c] of [['A',a],['B',b]]){
  prelim(c.team,'OPEN6 '+name);
  assert.equal(c.team.length,6);
  assert.equal(new Set(c.team.map(y=>y.item)).size,6);
  assert.equal(new Set(c.team.map(y=>y.species)).size,6);
  const e=sim.TeamValidator.get('gen9championsbssregmc').validateTeam(normalize(c.team));
  assert.ok(!e?.length,JSON.stringify(e));
  assert.ok(c.score.qAvg>-4&&c.score.mean>-4,'finite lower-tail score');
 }
 const overlap=a.team.filter(p=>b.team.some(q=>q.species===p.species)).length;
 assert.ok(overlap<=2,'two different structures have at most 2 species overlap');
 t.diagnostic('M8_OPEN6_MINIMAX '+JSON.stringify({...x,overlap,
  notHumanWinRate:true,notTeamBattlePerformance:true,
  preregistered:'PR104 comment #6627434262'}));
});
