#!/usr/bin/env node
'use strict';
/**
 * True two-turn Showdown counterfactual against a sensible immediate Mega
 * Iron Head, with own trio chosen BEFORE opponent hidden three. Keep the
 * line of play observable: HP, move, item, actual switch, fainting.
 */
const {load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {allScenarios}=require('./m8-golisopod-public-policy');
const {twoTurnBranch}=require('./engine-three-branch');
const sim=load(),ours=reportedLive();
const ourThree=['Primarina','Metagross','Hydreigon'];
const secondActions=[
 'Moonblast','Encore','switch:Metagross','switch:Hydreigon'
];
function twoTurnIronHead(){
 const rows=[];
 for(const group of allScenarios().filter(g=>g.team.some(x=>
  x.species==='Golisopod'&&x.item==='Golisopite'))){
  const foeThree=group.forcedA;
  if(foeThree[0]!=='Golisopod')throw Error('First actor must be Mega Golisopod');
  for(const action of secondActions){
   const r=twoTurnBranch(sim,ours,group.team,{
    ownThree:ourThree,foeThree,
    seed:[2026,10,28,2],
    first:{own:'Moonblast',foe:'Iron Head',foeMega:true},
    second:{own:action,foe:'Iron Head'}
   });
   const current=r.secondAfter||r.firstAfter;
   rows.push({
    group:group.name,
    ownThree,assumedEnemyThreeAfterwards:foeThree,
    first:'Moonblast versus Mega Golisopod Iron Head',
    secondAction:action,secondExecuted:r.second?.executed,
    unresolved:r.second?.notExecutedReason||'',
    primarinaHP:current.own.pokemon.find(x=>x.species==='Primarina')?.hp,
    metagrossHP:current.own.pokemon.find(x=>x.species==='Metagross')?.hp,
    hydreigonHP:current.own.pokemon.find(x=>x.species==='Hydreigon')?.hp,
    primarinaFainted:current.own.pokemon.find(x=>x.species==='Primarina')?.fainted,
    activeAfter:current.own.active,
    goliHP:current.assumedFoe.pokemon[0].hp,
    ownFaints:current.own.pokemon.filter(x=>x.fainted).length,
    events:r.events
   });
  }
 }
 return {
  rows,scenarioCount:rows.length,distinctGroups:new Set(rows.map(x=>x.group)).size,
  warning:'Counterfactual two-turn fixed Golisopod Iron Head only. Rival may attack differently, switch, Mega or not Mega. Not a human-play win probability.'
 };
}
module.exports={twoTurnIronHead};
if(require.main===module){
 try{
  const r=twoTurnIronHead();
  console.log('M8_GOLI_TWO_TURN_IRONHEAD '+JSON.stringify({
   n:r.scenarioCount,groups:r.distinctGroups,
   results:r.rows.map(x=>({
    group:x.group,ownSecond:x.secondAction,
    resolved:x.secondExecuted,
    primarinaHP:x.primarinaHP,primarinaFainted:x.primarinaFainted,
    activeAfter:x.activeAfter,metagrossHP:x.metagrossHP,
    hydreigonHP:x.hydreigonHP,unresolved:x.unresolved
   })),
   warning:r.warning
  }));
 }catch(e){console.error(e.stack||e);process.exitCode=1;}
}
