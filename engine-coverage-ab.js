#!/usr/bin/env node
'use strict';
/**
 * Test of a structural correction, NOT tuning on outcomes.
 * Same seed/own team/opponent six/turn bot. The actual enemy three appear
 * only in the post-game audit, never in preview inputs.
 */
const {load,game,hashSeed}=require('./lab');
const {groups}=require('./environment-m7-teams');
const {reportedLive}=require('./reported-live-roster-20261027');
const sim=load(),ourSix=reportedLive(),rows=[];
async function run(){
 for(const groupName of ['01_M7_golisopod_balance','03_M7_charizardY_offense','07_M7_baxcalibur_offense']){
  const group=groups.find(x=>x.name===groupName);
  for(const mode of ['forced-pressure','rational-opponent']){
   for(let i=0;i<2;i++){
    const reverse=Boolean(i%2);
    const seed=hashSeed(1200000+groups.indexOf(group)*10000+
      (mode==='forced-pressure'?1000:0)+i); // IDENTICAL to first A/B
    for(const policy of ['rational-top','engine-two-turn-coverage']){
     const options={megaAware:true,
       candidatePreviewPolicy:policy,opponentPreviewPolicy:'rational',
       candidateDecisionPolicy:'v3',opponentDecisionPolicy:'v3'};
     if(mode==='forced-pressure')options.opponentForced=group.forcedA;
     const g=await game(sim,reverse?group.team:ourSix,reverse?ourSix:group.team,
       seed,false,null,reverse,options);
     if(g.trace.errors.length)throw Error('invalid move choices '+JSON.stringify(g.trace.errors));
     const side=reverse?'p2':'p1',foe=reverse?'p1':'p2';
     const ours=g.trace.selections.find(x=>x.side===side);
     const theirs=g.trace.selections.find(x=>x.side===foe);
     const preview=g.trace.enginePreviews.filter(x=>x.side===side);
     rows.push({groupName,mode,seed,policy,won:g.winner===(reverse?'opponent':'candidate'),
       ourThree:ours.chosen,ourLead:ours.lead,
       opponentActualThreeAfterwards:theirs.chosen,foeLeadAfterwards:theirs.lead,
       turnCount:g.turns,previewStatus:preview[0]?.status||'applied',
       megaCoverage:preview[0]?.megaCoverage??null,
       allSixCovered:preview[0]?.opponentsConsidered?.length===6});
    }
   }
  }
 }
 const pairs=[];
 for(let i=0;i<rows.length;i+=2){
  const x=rows[i],y=rows[i+1];
  pairs.push({group:x.groupName,mode:x.mode,seed:x.seed,
   before:x.ourThree,after:y.ourThree,oldLead:x.ourLead,newLead:y.ourLead,
   changed:x.ourThree.join('/')!==y.ourThree.join('/'),
   oldWin:x.won,newWin:y.won,applied:y.previewStatus==='applied',
   enemyAfterwards:x.opponentActualThreeAfterwards,
   testedAllSix:y.allSixCovered,megaCoverage:y.megaCoverage});
 }
 console.log('COVERAGE_AB_SUMMARY '+JSON.stringify({
   n:pairs.length,changes:pairs.filter(x=>x.changed).length,
   applied:pairs.filter(x=>x.applied).length,
   winsOld:pairs.filter(x=>x.oldWin).length,winsNew:pairs.filter(x=>x.newWin).length,
   pairs,
   warning:'Only synthetic controlled heuristic games; opponent hidden 3 is logged AFTERWARDS, never consumed in preview. No claim of real ladder winrate.'
 }));
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
