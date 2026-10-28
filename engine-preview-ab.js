#!/usr/bin/env node
'use strict';
/**
 * Small opt-in engine Mega coverage preview pilot, old deterministic top
 * rational preview vs coverage-screened. Both see the same public six.
 * The extra damage evidence does not imply the selected three is viable.
 */
const {load,game,hashSeed}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const sim=load(),own=reportedLive(),rows=[];
async function main(){
 for(const name of ['01_M7_golisopod_balance','03_M7_charizardY_offense','07_M7_baxcalibur_offense']){
  const grp=groups.find(g=>g.name===name);
  for(let i=0;i<2;i++){
   const reverse=Boolean(i%2),seed=hashSeed(980000+groups.indexOf(grp)*1000+i);
   for(const policy of ['rational-top','engine-mega-cover']){
    const result=await game(sim,reverse?grp.team:own,reverse?own:grp.team,seed,
      false,null,reverse,{
        megaAware:true,candidatePreviewPolicy:policy,opponentPreviewPolicy:'rational',
        candidateDecisionPolicy:'v3',opponentDecisionPolicy:'v3',opponentForced:grp.forcedA});
    const side=reverse?'p2':'p1',sel=result.trace.selections.find(x=>x.side===side);
    const x={name,seed,policy,won:result.winner===(reverse?'opponent':'candidate'),
      selected:sel.chosen,lead:sel.lead,turns:result.turns,
      first:result.trace.choices.filter(c=>c.side===side).slice(0,6).map(c=>c.choice),
      enginePreview:result.trace.enginePreviews.filter(e=>e.side===side),
      errors:result.trace.errors};
    if(x.errors.length)throw Error('Illegal move '+JSON.stringify(x.errors));
    rows.push(x);console.log('ENGINE_PREVIEW_AB '+JSON.stringify(x));
   }
  }
 }
 const comparisons=[];
 for(let i=0;i<rows.length;i+=2){
  const a=rows[i],b=rows[i+1];
  comparisons.push({name:a.name,seed:a.seed,oldWin:a.won,newWin:b.won,
    oldThree:a.selected,screenedThree:b.selected,oldLead:a.lead,newLead:b.lead,
    selectionChanged:a.selected.join('/')!==b.selected.join('/'),
    firstMovesChanged:a.first.join('/')!==b.first.join('/'),
    screen:b.enginePreview});
 }
 console.log('ENGINE_PREVIEW_AB_SUMMARY '+JSON.stringify({
  n:comparisons.length,changedSelections:comparisons.filter(x=>x.selectionChanged).length,
  oldWins:comparisons.filter(x=>x.oldWin).length,newWins:comparisons.filter(x=>x.newWin).length,
  comparisons,
  warning:'Six fixed adversary-three, unweighted synthetic matches. Not a rank winrate or independently validated strategy.'}));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
