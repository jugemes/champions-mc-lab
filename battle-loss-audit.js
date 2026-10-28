'use strict';
/**
 * Post-match only public action timeline. This module NEVER runs inside a
 * selection / turn Bot. It processes observed Showdown logs from *completed*
 * synthetic matches. Actual rival selected three are separated from inputs.
 */
const publicEvents=new Set([
  'turn','move','switch','drag','replace','detailschange','faint','win','cant',
  '-damage','-heal','-boost','-unboost','-setboost','-clearboost',
  '-status','-curestatus','-weather','-fieldstart','-fieldend',
  '-sidestart','-sideend','-formechange','-mega','-activate','-fail',
  '-miss','-immune','-item','-enditem','-ability','-crit','-supereffective',
  '-resisted','-hitcount'
]);
function publicTimeline(text){
  const turns=[],all=[];let current={number:0,events:[]};
  for(const line of String(text||'').split('\n')){
    if(!line.startsWith('|'))continue;
    const kind=line.split('|')[1];
    if(!publicEvents.has(kind))continue;
    if(kind==='turn'){
      if(current.events.length)turns.push(current);
      current={number:Number(line.split('|')[2])||0,events:[]};
    }
    const entry={kind,line};
    current.events.push(entry);all.push(entry);
  }
  if(current.events.length)turns.push(current);
  return {turns,all};
}
function actionSummary(trace,side){
  return (trace?.choices||[]).filter(x=>x.side===side).map(x=>({
    turn:x.turn,action:x.choice
  }));
}
function observedEvents(timeline,side){
  const counts={moves:0,switches:0,faints:0,setupMoves:[],mega:0};
  for(const {kind,line} of timeline.all){
    const a=line.split('|'),actor=a[2]||'';
    if(!actor.startsWith(side+'a:'))continue;
    if(kind==='move'){counts.moves++;if([
      'Swords Dance','Dragon Dance','Quiver Dance','Nasty Plot',
      'Calm Mind','Bulk Up','Shell Smash'
    ].includes(a[3]))counts.setupMoves.push(a[3]);}
    if(['switch','drag','replace'].includes(kind))counts.switches++;
    if(kind==='faint')counts.faints++;
    if(['-mega','detailschange'].includes(kind)&&line.includes('-Mega'))counts.mega++;
  }
  return counts;
}
function comparePair(oldMatch,newMatch,side){
  const oldEvents=publicTimeline(oldMatch.log),newEvents=publicTimeline(newMatch.log);
  const oldActions=actionSummary(oldMatch.trace,side),newActions=actionSummary(newMatch.trace,side);
  const before=oldMatch.trace.selections.find(x=>x.side===side);
  const after=newMatch.trace.selections.find(x=>x.side===side);
  const foeSide=side==='p1'?'p2':'p1';
  const foeOld=oldMatch.trace.selections.find(x=>x.side===foeSide);
  const foeNew=newMatch.trace.selections.find(x=>x.side===foeSide);
  const max=Math.max(oldActions.length,newActions.length);
  let firstDifferentAction=null;
  for(let i=0;i<max;i++){
    if(oldActions[i]?.action!==newActions[i]?.action){
      firstDifferentAction={actionIndex:i,old:oldActions[i]||null,new:newActions[i]||null};break;
    }
  }
  return {
    before:{selected:before?.chosen,lead:before?.lead,
      foeSelectedOnlyKnownPostGame:foeOld?.chosen,foeLeadPostGame:foeOld?.lead,
      actions:oldActions,ownObserved:observedEvents(oldEvents,side),
      foeObserved:observedEvents(oldEvents,foeSide),turns:oldMatch.turns},
    after:{selected:after?.chosen,lead:after?.lead,
      foeSelectedOnlyKnownPostGame:foeNew?.chosen,foeLeadPostGame:foeNew?.lead,
      actions:newActions,ownObserved:observedEvents(newEvents,side),
      foeObserved:observedEvents(newEvents,foeSide),turns:newMatch.turns},
    firstDifferentAction,
    causes:{
      selectionAssessment:'requires six-only counterfactual human review',
      ownTurnMistakes:'undetermined until turn and Showdown alternatives audited',
      opponentRationality:'undetermined; do not credit irrational rival errors',
      teamInherentWeakness:'undetermined; hold constant both sides strategies',
      forcedSwitchValidity:'undetermined; inspect full public timeline'
    },
    timeline:{old:oldEvents.turns,new:newEvents.turns},
    leakPrevention:'Actual opponent 3 appears only in post-game output. Neither preview Bot input nor action scorer receives it.'
  };
}
module.exports={publicEvents,publicTimeline,actionSummary,observedEvents,comparePair};
