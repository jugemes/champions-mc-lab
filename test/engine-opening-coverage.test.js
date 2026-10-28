'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {load,Bot}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {groups}=require('../environment-m7-teams');
const {opponentLeadHypotheses}=require('../engine-opening-branches');
const {rankCoverageOpening}=require('../engine-opening-coverage');
const sim=load(),dex=sim.Dex.mod('champions'),own=reportedLive();
const g=groups.find(x=>x.name==='01_M7_golisopod_balance');
const publicSix=g.team.map(x=>x.species);
test('rival lead generator covers every one of six visible species, not just heuristic top and Mega',()=>{
 const cases=opponentLeadHypotheses(sim,own,publicSix,{maxScenes:6});
 assert.deepEqual(cases.map(c=>c.assumedLead),publicSix);
 assert.ok(cases.some(c=>c.assumedLead==='Mimikyu'));
 assert.ok(cases.every(c=>c.assumedThree.includes(c.assumedLead)));
});
test('Showdown Mega coverage gate prevents trio with no documented strong Mega Golisopod answer',()=>{
 const result=rankCoverageOpening(sim,own,publicSix,{maxScenes:6});
 assert.equal(result.inspected,60);
 assert.ok(result.possibleMegaThreats.some(x=>x.species==='Golisopod'));
 if(result.selected){
  assert.ok(result.selected.comparable);
  assert.ok(result.selected.megaCoverage>=1);
  assert.ok(result.selected.scenarioLeads.length===6);
 }
 const bad=result.alternatives.filter(x=>x.comparable&&!x.megaCoveragePassed);
 assert.equal(bad.length<=10,true);
});
test('actual Battle Bot can opt in; recommendation from public six only or unchanged deterministic fallback',()=>{
 const trace={choices:[],selections:[],errors:[],engineAdvices:[],enginePreviews:[]};
 const b=new Bot(null,dex,own,'p1',trace,null,null,{sim,previewPolicy:'engine-two-turn-coverage'});
 b.opp=publicSix.slice();
 const choice=b.decide({teamPreview:true});
 assert.match(choice,/^team [1-6][1-6][1-6]$/);
 assert.equal(new Set(choice.slice(5).split('')).size,3);
 assert.equal(trace.enginePreviews[0].policy,'engine-two-turn-coverage');
});

test('identical public-six searches are memoized without leaking mutable result state across matches',()=>{
 const first=rankCoverageOpening(sim,own,publicSix,{maxScenes:6});
 const second=rankCoverageOpening(sim,own,publicSix,{maxScenes:6});
 assert.deepEqual(first,second);
 if(first.selected){
  const expected=first.selected.ownThree[0];
  first.selected.ownThree[0]='MUTATED_TEST_ONLY';
  const third=rankCoverageOpening(sim,own,publicSix,{maxScenes:6});
  assert.equal(third.selected.ownThree[0],expected);
 }
});
