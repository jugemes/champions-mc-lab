#!/usr/bin/env node
'use strict';
/**
 * Inspect public turn history of EXACT same counterfactual focus & holdout
 * battles to audit the OPPONENT's choices. Logs are postgame output only.
 * Human reviewers decide if turns were rational; do NOT automatically award
 * "correct" to a move just because the match was won.
 */
const fs=require('node:fs'),path=require('node:path');
const {game,load,hashSeed}=require('./lab');
const {publicTimeline}=require('./battle-loss-audit');
const {reportedLive}=require('./reported-live-roster-20261027');
const {allScenarios,publicGolisopodHypothesis}=require('./m8-golisopod-public-policy');
const sim=load(),own=reportedLive();
function publicTurns(log){
 const keep=new Set([
  'move','switch','drag','faint','cant','detailschange','-mega',
  '-boost','-unboost','-damage','-heal','-status','-curestatus',
  '-immune','-fail','-miss','-ability','-weather','-activate','-fieldstart'
 ]);
 const timeline=publicTimeline(log);
 return timeline.turns.slice(0,16).map(t=>({
  turn:t.number,events:t.events.filter(x=>keep.has(x.kind)).map(x=>x.line).slice(0,28)
 }));
}
async function main(){
 const groups=allScenarios();
 const result=[];
 for(let i=0;i<groups.length;i++){
  const g=groups[i],publicSix=g.team.map(x=>x.species);
  const proposed=publicGolisopodHypothesis(own,publicSix);
  for(const forcedKind of ['forcedA','forcedB']){
   const forced=g[forcedKind];
   // Match the first seed and p1 side of the original holdout A/B.
   const seed=hashSeed(1900000+i*300+(forcedKind==='forcedA'?0:100));
   for(const policy of ['rational-public-six','fairy-steel-dragon']){
    const opts={
     megaAware:true,candidatePreviewPolicy:'rational-top',
     opponentPreviewPolicy:'rational',
     candidateDecisionPolicy:'v3-public-immunity',
     opponentDecisionPolicy:'v3-public-immunity',
     opponentForced:forced
    };
    if(policy==='fairy-steel-dragon')opts.candidateForced=proposed;
    const battle=await game(sim,own,g.team,seed,true,null,false,opts);
    if(battle.trace.errors.length)throw Error('Invalid actions '+JSON.stringify(battle.trace.errors));
    const a=battle.trace.selections.find(x=>x.side==='p1');
    const b=battle.trace.selections.find(x=>x.side==='p2');
    const events=publicTurns(battle.log);
    const status={
     group:g.name,forcedKind,seed,policy,
     winner:battle.winner,won:battle.winner==='candidate',
     ourThree:a.chosen,ourLead:a.lead,
     enemyThreePostGame:b.chosen,enemyLeadPostGame:b.lead,
     turns:battle.turns,
     actualPublicTurnEvents:events,
     observedImmunityCount:battle.trace.immuneObservations.length,
     note:'Postgame public actions; manual inspection of whether opponent reacted rationally is mandatory.'
    };
    result.push(status);
    console.log('M8_HUMAN_AUDIT '+JSON.stringify({
     group:g.name,kind:forcedKind,policy,won:status.won,ourLead:a.lead,
     enemyLead:b.lead,turns:battle.turns,
     opening:events.slice(0,5)
    }));
   }
  }
 }
 const d=path.join('output','m8-preseason');fs.mkdirSync(d,{recursive:true});
 fs.writeFileSync(path.join(d,'opponent-human-rationality-audit.json'),JSON.stringify(result,null,2));
 console.log('M8_HUMAN_AUDIT_SUMMARY '+JSON.stringify({
  pairs:result.length/2,
  originalCases:result.filter(x=>x.group.startsWith('0')).length/2,
  heldOutCases:result.filter(x=>x.group.startsWith('HO_')).length/2,
  baselineWins:result.filter(x=>x.policy==='rational-public-six'&&x.won).length,
  alternativeWins:result.filter(x=>x.policy==='fairy-steel-dragon'&&x.won).length,
  note:'Human-rationality quality is not mechanically certified; inspect events before changing live recommendations.'
 }));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
