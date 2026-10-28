'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Bot,load}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {groups}=require('../environment-m7-teams');
const sim=load(),dex=sim.Dex.mod('champions'),team=reportedLive();
const foe=groups.find(x=>x.name==='01_M7_golisopod_balance').team.map(x=>x.species);
function request(lead='Hydreigon'){
  const source=team.find(x=>x.species===lead);
  const side=team.map(p=>({active:p.species===lead,details:p.species+', L50',
    condition:p.species===lead?'169/169':'180/180'}));
  return {side:{pokemon:side},active:[{canMegaEvo:false,
    moves:source.moves.map((move,i)=>({move,id:move.toLowerCase().replace(/[^a-z]/g,''),pp:12,disabled:false}))}]};
}
function bot(turn=1){
 const trace={choices:[],selections:[],errors:[],engineAdvices:[]};
 const b=new Bot(null,dex,team,'p1',trace,null,null,
   {decisionPolicy:'engine-conditional',sim,megaAware:true});
 b.opp=foe.slice();b.foeActive='Golisopod';b.turn=turn;
 return {b,trace};
}
test('actual Bot consults Showdown hypothesis advisor and falls back when Mega choice is unknown',()=>{
 const {b,trace}=bot(1);
 const choice=b.decide(request());
 assert.match(choice,/^move [1-4]$/);
 assert.equal(trace.engineAdvices.length,1);
 assert.equal(trace.engineAdvices[0].status,'conditional');
 assert.equal(trace.engineAdvices[0].foe,'Golisopod');
});
test('turn-2 non-neutral context never reuses from-scratch turn-1 oracle',()=>{
 const {b,trace}=bot(2);
 const choice=b.decide(request());
 assert.match(choice,/^move [1-4]$/);
 assert.equal(trace.engineAdvices.length,1);
 assert.equal(trace.engineAdvices[0].status,'ineligible-current-state');
});
test('unknown public opponent species never makes Bot read actual hidden team',()=>{
 const {b,trace}=bot(1);
 b.opp=['Golisopod','Garchomp','Mimikyu','Hippowdon','Primarina','Magikarp'];
 const choice=b.decide(request());
 assert.match(choice,/^move [1-4]$/);
 assert.equal(trace.engineAdvices.length,1);
 assert.equal(trace.engineAdvices[0].status,'engine-fallback');
 assert.match(trace.engineAdvices[0].reason,/no explicitly documented synthetic sets/);
});
