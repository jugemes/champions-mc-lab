#!/usr/bin/env node
'use strict';
/**
 * Independent switch-cap experiment; candidate switches only, adversary
 * retains the exact same v3 and the previous three-switch artificial cap.
 */
const {load,game,hashSeed}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const sim=load(),live=reportedLive();
async function main(){
 const rows=[];
 for(const name of ['01_M7_golisopod_balance','03_M7_charizardY_offense','13_M7_stall']){
  const g=groups.find(x=>x.name===name);
  for(let k=0;k<2;k++){
   const seed=hashSeed(910000+groups.indexOf(g)*1000+k),reverse=Boolean(k%2);
   for(const unlimited of [false,true]){
    const opts={
      candidatePreviewPolicy:'rational',opponentPreviewPolicy:'rational',
      candidateDecisionPolicy:'v3',opponentDecisionPolicy:'v3',
      opponentForced:g.forcedA,candidateUnlimitedSwitches:unlimited,
      opponentUnlimitedSwitches:false,megaAware:true
    };
    const result=await game(sim,reverse?g.team:live,reverse?live:g.team,seed,false,null,reverse,opts);
    const side=reverse?'p2':'p1';
    const moves=result.trace.choices.filter(x=>x.side===side);
    const row={name,k,unlimited,seed,win:result.winner===(reverse?'opponent':'candidate'),
      turns:result.turns,switches:moves.filter(x=>x.choice.startsWith('switch ')).length,
      ownFirstMoves:moves.slice(0,6).map(x=>x.choice),
      errors:result.trace.errors};
    if(row.errors.length)throw Error('Illegal choice: '+JSON.stringify(row));
    rows.push(row);
    console.log('SWITCH_AB '+JSON.stringify(row));
   }
  }
 }
 const paired=[];
 for(let i=0;i<rows.length;i+=2){
  const old=rows[i],candidate=rows[i+1];
  paired.push({name:old.name,seed:old.seed,oldSwitches:old.switches,
    uncappedSwitches:candidate.switches,
    oldWin:old.win,uncappedWin:candidate.win,
    choicesChanged:JSON.stringify(old.ownFirstMoves)!==JSON.stringify(candidate.ownFirstMoves)});
 }
 console.log('SWITCH_AB_SUMMARY '+JSON.stringify({pairs:paired.length,paired,
  warning:'Six constructed hypothetical matches only, heuristic adversary. No rank winrate or proof that unlimited switching improves strategy.'}));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
