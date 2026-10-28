#!/usr/bin/env node
'use strict';
/**
 * Adversarial REBUTTAL to the favorable Encore-on-Swords-Dance AI line.
 * Real Showdown engine, public six + fully specified SYNTHETIC Mega Goli set.
 * Compare Goli's immediate Steel hit vs setup; do NOT assume opponent
 * would willingly Swords Dance into a revealed/possible Encore Primarina.
 */
const {load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {allScenarios}=require('./m8-golisopod-public-policy');
const {engineTurnSample,engineDamageSample}=require('./engine-reference');
const sim=load(),ours=reportedLive();
const focus=allScenarios().filter(g=>g.team.some(x=>
 x.species==='Golisopod'&&x.item==='Golisopite'));
function mechanics(){
 const rows=[];
 for(const g of focus){
  const publicSix=g.team.map(x=>x.species);
  const representative={
   group:g.name,publicSix,knownOpponentChoiceStatus:'unobserved hypothetical moves only',
   incoming:engineDamageSample(sim,g.team,ours,{
    ourLead:'Golisopod',opponentLead:'Primarina',
    move:'Iron Head',ourMega:true,
    seed:[2026,10,28,2]
   }),outcomes:[]
  };
  for(const ownMove of ['Moonblast','Sparkling Aria','Encore']){
   for(const foeMove of ['Iron Head','Swords Dance','Sucker Punch','Leech Life']){
    const turn=engineTurnSample(sim,ours,g.team,{
     ourLead:'Primarina',opponentLead:'Golisopod',
     ourMove:ownMove,opponentMove:foeMove,opponentMega:true,
     seed:[2026,10,28,2]
    });
    representative.outcomes.push({
     ownMove,enemyMove:foeMove,
     ourHPAfter:turn.ourAfter.hp,
     ourMaxHP:turn.ourAfter.maxhp,
     ourFainted:turn.ourAfter.fainted,
     theirHPAfter:turn.opponentAfter.hp,
     theirBoostAfter:turn.opponentAfter.boosts.atk,
     events:turn.events
    });
   }
  }
  rows.push(representative);
 }
 return {cases:rows.length,results:rows,
  warning:'This is only a one-turn counteraction to a single explicitly assumed Mega set; human opponent may switch or use other legal set/lead. Previous favorable Encore+Swords Dance AI script is not a reliable guarantee.'};
}
module.exports={mechanics};
if(require.main===module){
 try{
  const x=mechanics();
  console.log('M8_GOLISOPOD_IRON_HEAD_ADVERSARIAL '+JSON.stringify({
   cases:x.cases,
   summary:x.results.map(r=>({group:r.group,
    incomingFraction:r.incoming.fraction,
    attacks:r.outcomes.filter(o=>o.enemyMove==='Iron Head').map(o=>({
     ownMove:o.ownMove,ourHPAfter:o.ourHPAfter,
     ourMaxHP:o.ourMaxHP,fainted:o.ourFainted
    })),
    setup:r.outcomes.filter(o=>o.enemyMove==='Swords Dance').map(o=>({
     ownMove:o.ownMove,ourHPAfter:o.ourHPAfter,
     theirBoostAfter:o.theirBoostAfter
    }))
   })),
   warning:x.warning
  }));
 }catch(e){console.error(e.stack||e);process.exitCode=1;}
}
