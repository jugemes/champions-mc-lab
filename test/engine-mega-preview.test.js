'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {load,Bot}=require('../lab');
const {groups}=require('../environment-m7-teams');
const {reportedLive}=require('../reported-live-roster-20261027');
const {screenMegaCoverage}=require('../engine-mega-preview');
const sim=load(),dex=sim.Dex.mod('champions'),own=reportedLive();
const group=groups.find(g=>g.name==='01_M7_golisopod_balance');
const six=group.team.map(x=>x.species);
test('engine Mega coverage sees a documented prospective Mega, never accepts actual chosen 3',()=>{
 const x=screenMegaCoverage(sim,own,six,{sampleLimit:2});
 assert.ok(x.perFoe.some(f=>f.species==='Golisopod'&&f.item==='Golisopite'));
 const mega=x.perFoe.find(f=>f.species==='Golisopod');
 const hydra=mega.byMember.find(m=>m.member==='Hydreigon');
 const rotom=mega.byMember.find(m=>m.member==='Rotom-Wash');
 assert.equal(hydra.move,'Flamethrower');
 assert.ok(hydra.damage>1);
 assert.ok(rotom.damage<hydra.damage);
 assert.ok(x.consideredTrioCount>=1);
 assert.ok(x.coverage>=x.baselineCoverage-1e-7,
   'Screen must never claim lower maximum Mega damage when filtering to covered trio');
});
test('actual Bot opt-in preview is legal 3 distinct own members and traces its public-only hypothesis',()=>{
 const trace={choices:[],selections:[],errors:[],engineAdvices:[],enginePreviews:[]};
 const b=new Bot(null,dex,own,'p1',trace,null,null,{sim,previewPolicy:'engine-mega-cover'});
 b.opp=six.slice();
 const choice=b.decide({teamPreview:true});
 assert.match(choice,/^team [1-6][1-6][1-6]$/);
 assert.equal(new Set(choice.slice(5).split('')).size,3);
 assert.equal(trace.enginePreviews.length,1);
 assert.equal(trace.selections.length,1);
 assert.deepEqual(trace.enginePreviews[0].chosen,trace.selections[0].chosen);
});
