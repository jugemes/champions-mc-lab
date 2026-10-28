#!/usr/bin/env node
'use strict';
/**
 * PRE-registered six-visible lead+trio pilot vs old rational-top, both
 * Turn bots with public immunity learning and same seeds.
 * Opponent hidden three is assigned by the offline harness AFTER the
 * policy returns its own 3, never provided as a policy argument.
 *
 * Compare original 3 synthetic Golisopod families against 4 holdout sixes
 * that deliberately include sun/rain/fighting/base-form Golisopod branches.
 */
const fs=require('node:fs'),path=require('node:path');
const {game,load,hashSeed,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {publicGolisopodHypothesis,allScenarios}=require('./m8-golisopod-public-policy');
const {FORMAT}=require('./engine-reference');
const sim=load(),own=reportedLive();
function verifyTeam(six,label){
 const messages=sim.TeamValidator.get(FORMAT).validateTeam(normalize(six))||[];
 if(messages.length)throw Error(label+' is not legal '+FORMAT+': '+messages.join('; '));
}
async function main(){
 verifyTeam(own,'own live six');
 const records=[],groups=allScenarios();
 for(const g of groups){
  verifyTeam(g.team,g.name);
  const publicSix=g.team.map(x=>x.species);
  // Preselect BEFORE reading any forced rival 3 in this function.
  const prechosen=Object.fromEntries(['fairy-steel-dragon','fairy-steel-ground'].map(k=>[
   k,publicGolisopodHypothesis(own,publicSix,k)
  ]));
  if(Object.values(prechosen).some(s=>!s||s.length!==3))
    throw Error('No public-only pilot choice on '+g.name);
  for(const forcedKind of ['forcedA','forcedB'])for(const reverse of [false,true]){
   for(let seedIndex=0;seedIndex<2;seedIndex++){
    // Fully declared adversarial treatment, chosen independently of own policy.
    const foeSelected=g[forcedKind];
    const seed=hashSeed(1900000+groups.indexOf(g)*300+
      (forcedKind==='forcedA'?0:100)+(reverse?25:0)+seedIndex);
    const scores={};
    for(const treatment of ['rational-public-six','fairy-steel-dragon','fairy-steel-ground']){
     const options={
      candidatePreviewPolicy:'rational-top',
      opponentPreviewPolicy:'rational',
      candidateDecisionPolicy:'v3-public-immunity',
      opponentDecisionPolicy:'v3-public-immunity',
      opponentForced:foeSelected,megaAware:true
     };
     if(treatment!=='rational-public-six')options.candidateForced=prechosen[treatment];
     const match=await game(sim,
      reverse?g.team:own,reverse?own:g.team,
      seed,false,null,reverse,options);
     if(match.trace.errors.length)throw Error(
      'Rejected battle input '+g.name+': '+JSON.stringify(match.trace.errors));
     const side=reverse?'p2':'p1';
     const sel=match.trace.selections.find(s=>s.side===side);
     const opp=match.trace.selections.find(s=>s.side!==(reverse?'p1':'p2'));
     // Check own choice equals preregistered policy regardless of enemy hidden 3.
     if(treatment!=='rational-public-six'&&
       sel.chosen.join('/')!==prechosen[treatment].join('/'))
      throw Error('Public-only preview treatment mutated');
     scores[treatment]={
      won:match.winner===(reverse?'opponent':'candidate'),
      selected:sel.chosen,lead:sel.lead,turns:match.turns,
      ownObservedImmunities:match.trace.immuneObservations
       .filter(x=>x.side===side).length
     };
    }
    records.push({group:g.name,isHoldout:g.isHoldout,
      reason:g.holdoutReason||null,
      publicSix,enemyThreeAfterwards:[...foeSelected],
      forcedKind,reverse,seed,scores});
   }
  }
 }
 const names=['rational-public-six','fairy-steel-dragon','fairy-steel-ground'];
 const table=groups.map(g=>{
  const rs=records.filter(r=>r.group===g.name);
  return {group:g.name,holdout:g.isHoldout,reason:g.holdoutReason||null,
   n:rs.length,
   wins:Object.fromEntries(names.map(k=>[k,rs.filter(x=>x.scores[k].won).length])),
   winsByOpponentThree:Object.fromEntries(['forcedA','forcedB'].map(k=>[
    k,Object.fromEntries(names.map(p=>[p,rs.filter(x=>
      x.forcedKind===k&&x.scores[p].won).length]))
   ]))
  };
 });
 const totals=filter=>Object.fromEntries(names.map(name=>[
  name,records.filter(filter).filter(r=>r.scores[name].won).length
 ]));
 const answer={
  n:records.length,focusGroups:table.filter(x=>!x.holdout).length,
  holdoutGroups:table.filter(x=>x.holdout).length,
  originalTotals:totals(x=>!x.isHoldout),
  holdoutTotals:totals(x=>x.isHoldout),
  overallTotals:totals(()=>true),table,
  warning:'These are constructed opponents and AI behaviors only; posthoc false positives and selection overfitting remain. A matchup with two distinct possible Mega stones may require completely different own leads.'
 };
 const output=path.join('output','m8-preseason');fs.mkdirSync(output,{recursive:true});
 fs.writeFileSync(path.join(output,'golisopod-public-rule-holdout.json'),
  JSON.stringify({answer,records},null,2));
 console.log('M8_GOLISOPOD_HOLDOUT_SUMMARY '+JSON.stringify(answer));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
