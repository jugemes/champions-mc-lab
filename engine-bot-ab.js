#!/usr/bin/env node
'use strict';
// Small A/B to verify whether direct-engine turn advice actually changes a
// 3v3 battle, not just whether its unit test passes. Equal constructed games,
// NOT a ladder win-rate estimate or a guarantee of reasonable rival actions.
const {load,game,hashSeed}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const sim=load(),own=reportedLive();
const result=[];
async function run(){
 for(const name of ['01_M7_golisopod_balance','06_M7_golisopod_basculegion','07_M7_baxcalibur_offense']){
  const grp=groups.find(g=>g.name===name);
  for(let k=0;k<2;k++){
   const seed=hashSeed(850000+groups.indexOf(grp)*1000+k);
   const reverse=Boolean(k%2);
   for(const mode of ['v3','engine-conditional']){
    const opts={megaAware:true,
     candidatePreviewPolicy:'rational',opponentPreviewPolicy:'rational',
     candidateDecisionPolicy:mode,opponentDecisionPolicy:'v3',
     opponentForced:grp.forcedA};
    const trial=await game(sim,reverse?grp.team:own,reverse?own:grp.team,
      seed,k===0,null,reverse,opts);
    const mine=reverse?'p2':'p1';
    const selected=trial.trace.selections.find(x=>x.side===mine);
    const entries=trial.trace.engineAdvices.filter(x=>x.side===mine);
    const errors=trial.trace.errors;
    if(errors.length)throw Error('invalid choice '+name+' '+mode+': '+JSON.stringify(errors));
    const row={team:name,seed,reverse,mode,won:trial.winner===(reverse?'opponent':'candidate'),
      selected:selected.chosen,lead:selected.lead,turns:trial.turns,
      firstActions:trial.trace.choices.filter(x=>x.side===mine).slice(0,5),
      engineAdvice:entries.map(x=>({turn:x.turn,status:x.status,foe:x.foe,
        own:x.own,commonMove:x.commonMove})),
      applied:entries.filter(x=>x.status==='engine-applied').length};
    result.push(row);
    console.log('BOT_AB '+JSON.stringify(row));
   }
  }
 }
 const pairs=[];
 for(let i=0;i<result.length;i+=2){
  const a=result[i],b=result[i+1];
  pairs.push({team:a.team,seed:a.seed,oldWin:a.won,newWin:b.won,
    sameChoices:JSON.stringify(a.firstActions)===JSON.stringify(b.firstActions),
    newApplied:b.applied,newAdvice:b.engineAdvice,
    changed:{old:a.firstActions,new:b.firstActions}});
 }
 console.log('BOT_AB_SUMMARY '+JSON.stringify({
   pairs:pairs.length,
   changedFirstFiveActionSequences:pairs.filter(p=>!p.sameChoices).length,
   engineApplications:pairs.reduce((s,p)=>s+p.newApplied,0),
   winsOld:pairs.filter(p=>p.oldWin).length,winsNew:pairs.filter(p=>p.newWin).length,
   warning:'six constructed opponent stress games; non-independent heuristic bots; no ladder win rate'}));
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
