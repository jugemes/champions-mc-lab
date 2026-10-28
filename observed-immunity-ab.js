#!/usr/bin/env node
'use strict';
/**
 * After-the-fact opposing-AI and own-turn-AI sanity check.
 * A/B/C has the same own six, preview policy, opposing six, seed and
 * opponent selection policy. Both bots may learn ONLY public immune logs.
 */
const {load,game,hashSeed}=require('./lab');
const {groups}=require('./environment-m7-teams');
const {reportedLive}=require('./reported-live-roster-20261027');
const {publicTimeline}=require('./battle-loss-audit');
const sim=load(),own=reportedLive();
const cases=[
 ['07_M7_baxcalibur_offense','rational-opponent',0],
 ['07_M7_baxcalibur_offense','rational-opponent',1],
 ['07_M7_baxcalibur_offense','forced-pressure',1],
 ['01_M7_golisopod_balance','forced-pressure',0]
];
async function main(){
 const rows=[];
 for(const [name,mode,i] of cases){
  const grp=groups.find(g=>g.name===name),reverse=Boolean(i%2);
  const seed=hashSeed(1200000+groups.indexOf(grp)*10000+
    (mode==='forced-pressure'?1000:0)+i);
  for(const [label,candidate,opponent]of [
    ['v3-v3','v3','v3'],
    ['learn-own','v3-public-immunity','v3'],
    ['learn-both','v3-public-immunity','v3-public-immunity']
  ]){
   const options={
     megaAware:true,candidatePreviewPolicy:'engine-two-turn-coverage',
     opponentPreviewPolicy:'rational',candidateDecisionPolicy:candidate,
     opponentDecisionPolicy:opponent
   };
   if(mode==='forced-pressure')options.opponentForced=grp.forcedA;
   const g=await game(sim,reverse?grp.team:own,reverse?own:grp.team,seed,
     true,null,reverse,options);
   if(g.trace.errors.length)throw Error('illegal moves '+JSON.stringify(g.trace.errors));
   const side=reverse?'p2':'p1',foeSide=reverse?'p1':'p2';
   const immuneEvents=publicTimeline(g.log).all.filter(e=>e.kind==='-immune');
   const therm=immuneEvents.filter(e=>e.line.includes('Thermal Exchange')).length;
   const lev=immuneEvents.filter(e=>e.line.includes('Levitate')).length;
   const ours=g.trace.selections.find(s=>s.side===side);
   const row={name,mode,i,seed,label,
     won:g.winner===(reverse?'opponent':'candidate'),
     turns:g.turns,ownThree:ours.chosen,lead:ours.lead,
     publiclyObservedThermalExchangeImmune:therm,
     publiclyObservedLevitateImmune:lev,
     confirmedOwnImmunities:g.trace.immuneObservations.filter(e=>e.side===side),
     confirmedFoeImmunities:g.trace.immuneObservations.filter(e=>e.side===foeSide),
     ownFirstMoves:g.trace.choices.filter(e=>e.side===side).slice(0,7),
     foeFirstMoves:g.trace.choices.filter(e=>e.side===foeSide).slice(0,7)};
   rows.push(row);
   console.log('IMMUNITY_AB '+JSON.stringify(row));
  }
 }
 const comparisons=[];
 for(let i=0;i<rows.length;i+=3){
  const x=rows.slice(i,i+3);
  comparisons.push({
   name:x[0].name,mode:x[0].mode,seed:x[0].seed,
   samePreview:x.every(y=>JSON.stringify(y.ownThree)===JSON.stringify(x[0].ownThree)),
   outcomes:x.map(y=>({policy:y.label,win:y.won,turns:y.turns,
     thermalImmune:y.publiclyObservedThermalExchangeImmune,
     levitateImmune:y.publiclyObservedLevitateImmune,
     learnedOwn:y.confirmedOwnImmunities.length,
     learnedFoe:y.confirmedFoeImmunities.length})),
  });
 }
 const totals=label=>rows.filter(r=>r.label===label).filter(r=>r.won).length;
 console.log('IMMUNITY_AB_SUMMARY '+JSON.stringify({
  cases:comparisons.length,oldWins:totals('v3-v3'),learnOwnWins:totals('learn-own'),
  learnBothWins:totals('learn-both'),comparisons,
  warning:'Four synthetic seeds; no ladder win-rate estimate. A rational opponent policy requires independent human review, even if both Bots learn observed immunities. No private rival move/item/three is read.'
 }));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
