'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {load,Bot}=require('../lab');
const {groups}=require('../environment-m7-teams');
const {reportedLive}=require('../reported-live-roster-20261027');
const sim=load(),dex=sim.Dex.mod('champions'),own=reportedLive();
const publicSix=groups.find(x=>x.name==='01_M7_golisopod_balance').team.map(x=>x.species);
test('opt-in real Bot preview uses complete two-turn public-six scenarios, no hidden opponent actual three',()=>{
 const trace={choices:[],selections:[],errors:[],engineAdvices:[],enginePreviews:[]};
 const bot=new Bot(null,dex,own,'p1',trace,null,null,{
   sim,previewPolicy:'engine-two-turn'});
 bot.opp=[...publicSix];
 const decision=bot.decide({teamPreview:true});
 assert.match(decision,/^team [1-6][1-6][1-6]$/);
 assert.equal(new Set(decision.slice(5).split('')).size,3);
 assert.equal(trace.enginePreviews.length,1);
 assert.equal(trace.enginePreviews[0].policy,'engine-two-turn');
 assert.equal(trace.enginePreviews[0].status,undefined,'test must not silently fallback');
 assert.equal(trace.enginePreviews[0].hypotheses.length>=1,true);
 assert.deepEqual(trace.selections[0].chosen,trace.enginePreviews[0].chosen);
});
