#!/usr/bin/env node
'use strict';
/**
 * A/B: old deterministic top-scored preview vs new Showdown two-turn
 * opt-in ranking, with SAME candidate six, enemy six, seed, opponent policy.
 * Opponent's actual selected 3 are used only for AFTER-THE-FACT validation.
 * Six synthetic opponent rosters are NOT sampled from ladder, no winrate claim.
 */
const {load,game,hashSeed}=require('./lab');
const {groups}=require('./environment-m7-teams');
const {reportedLive}=require('./reported-live-roster-20261027');
const sim=load(),own=reportedLive(),rows=[];
async function main(){
 for(const groupName of ['01_M7_golisopod_balance','03_M7_charizardY_offense','07_M7_baxcalibur_offense']){
  const grp=groups.find(g=>g.name===groupName);
  for(const mode of ['forced-pressure','rational-opponent']){
   for(let i=0;i<2;i++){
    const seed=hashSeed(1200000+groups.indexOf(grp)*10000+
      (mode==='forced-pressure'?1000:0)+i);
    const reverse=Boolean(i%2);
    for(const policy of ['rational-top','engine-two-turn']){
      const opts={megaAware:true,
        candidatePreviewPolicy:policy,opponentPreviewPolicy:'rational',
        candidateDecisionPolicy:'v3',opponentDecisionPolicy:'v3'};
      if(mode==='forced-pressure')opts.opponentForced=grp.forcedA;
      const g=await game(sim,reverse?grp.team:own,reverse?own:grp.team,seed,
        false,null,reverse,opts);
      if(g.trace.errors.length)throw Error('invalid battle choices '+JSON.stringify(g.trace.errors));
      const side=reverse?'p2':'p1',enemy=reverse?'p1':'p2';
      const mine=g.trace.selections.find(x=>x.side===side);
      const theirs=g.trace.selections.find(x=>x.side===enemy);
      const previews=g.trace.enginePreviews.filter(x=>x.side===side);
      const x={team:groupName,mode,seed,reverse,policy,
        won:g.winner===(reverse?'opponent':'candidate'),
        selected:mine.chosen,lead:mine.lead,
        opponentActualSelectedAfterwards:theirs.chosen,opponentLeadAfterwards:theirs.lead,
        decisions:g.trace.choices.filter(x=>x.side===side).slice(0,6),
        turnCount:g.turns,previews};
      if(policy==='engine-two-turn'&&(!previews.length||
          previews[0].status==='fallback'))throw Error('new preview was not actually used: '+JSON.stringify(previews));
      rows.push(x);
      console.log('OPENING_AB '+JSON.stringify({...x,decisions:x.decisions.slice(0,4),
        previews:x.previews.map(t=>({chosen:t.chosen,lead:t.lead,riskScore:t.riskScore,
          scenarioLeads:t.scenarioLeads}))}));
    }
   }
  }
 }
 const pairs=[];
 for(let i=0;i<rows.length;i+=2){
   const a=rows[i],b=rows[i+1];
   pairs.push({team:a.team,mode:a.mode,seed:a.seed,
     before:a.selected,after:b.selected,oldLead:a.lead,newLead:b.lead,
     selectedChanged:a.selected.join('/')!==b.selected.join('/'),
     winsOld:a.won,winsNew:b.won,
     opponentActualSelectedAfterwards:a.opponentActualSelectedAfterwards,
     opponentLeadAfterwards:a.opponentLeadAfterwards,
     firstDecisionsOld:a.decisions.slice(0,4),firstDecisionsNew:b.decisions.slice(0,4)});
 }
 console.log('OPENING_AB_SUMMARY '+JSON.stringify({
   n:pairs.length,
   selectionChanges:pairs.filter(x=>x.selectedChanged).length,
   leadChanges:pairs.filter(x=>x.oldLead!==x.newLead).length,
   winsOld:pairs.filter(x=>x.winsOld).length,
   winsNew:pairs.filter(x=>x.winsNew).length,
   pairs,
   warning:'12 constructed same-seed A/B battles; actual opponent 3 is AFTERWARDS reporting only. No demonstrated real-ladder winrate or guarantee rational adversarial moves.'
 }));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
