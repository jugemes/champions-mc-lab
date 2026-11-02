'use strict';
// Research-only executed-immunity audit. A move into an opponent's SAME-TURN
// switch is not a known-immune move against the target visible at choice time.
// A logged immunity is an observed effect, not proof of an avoidable misplay.
// This is for singles, with distinct p1/p2 sides and requestInfo snapshots.
function classifyExecutedImmunities(log,attackerSide,defenderSide,requests=[]){
 if(!/^p[12]$/.test(attackerSide)||!/^p[12]$/.test(defenderSide)||attackerSide===defenderSide)
  throw Error('distinct p1/p2 sides required');
 let turn=0,lastMove=null,defenderChanged=false,changeKind=null;
 const events=[];
 for(const line of String(log).split('\n')){
  const a=line.split('|'),kind=a[1],actor=a[2]||'';
  if(kind==='turn'){turn=Number(a[2])||0;lastMove=null;defenderChanged=false;changeKind=null;continue;}
  if(turn<1)continue;
  if(['switch','drag'].includes(kind)&&actor.startsWith(defenderSide+'a:')){
   defenderChanged=true;changeKind=kind;
  }
  if(kind==='move'){
   lastMove=actor.startsWith(attackerSide+'a:')?
    {actor,move:a[3],target:a[4],turn,defenderChanged,changeKind}:null;
  }
  if(kind!=='-immune'||!actor.startsWith(defenderSide+'a:')||!lastMove)continue;
  const req=requests.find(q=>q.side===attackerSide&&q.turn===turn);
  const forced=!!(req&&(req.locked||req.lockReason));
  const classification=lastMove.defenderChanged?
   'defender-changed-this-turn':forced?'forced-request':
    req?'unchanged-target-unforced-request':'unchanged-target-request-unknown';
  events.push({turn,move:lastMove.move,attacker:lastMove.actor,
   target:actor,reason:a.slice(3).join('|')||null,
   classification,defenderChangeKind:lastMove.changeKind,
   locked:req?.locked??null,lockReason:req?.lockReason??null,
   canSwitch:req?.canSwitch??null});
  lastMove=null;
 }
 return events;
}
module.exports={classifyExecutedImmunities};
