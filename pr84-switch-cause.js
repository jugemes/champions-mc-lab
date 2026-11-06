'use strict';
// PR #84 request (ChatGPT review #5719818884 of PR #83). Opt-in research module,
// NOT adopted. pr82-switch-utility-t1t2.js stays byte-identical so the saved
// PR #83 numbers stay reproducible; everything new is here.
//   1 switchEvents      every same-side |switch| of a turn with its CAUSE:
//                         voluntary    the side's own pre-move switch choice
//                         forcedExit   Emergency Exit / Wimp Out (ability) or
//                                      Eject Button / Eject Pack (item)
//                         pivot        after the side's own U-turn / Volt Switch /
//                                      Flip Turn / Parting Shot / Teleport /
//                                      Baton Pass / Shed Tail / Chilly Reception
//                         replacement  after the side's |faint| (post-KO)
//                         unattributed a mid-turn switch with no cause in the log
//                       (|drag| = phazing / Red Card, reported as cause 'drag').
//                       Showdown (sim/battle-queue.ts) resolves every chosen
//                       switch (order 103) before Mega (104) and every move
//                       (200); so a VOLUNTARY switch can only precede the first
//                       |move| line of either side. Anything later needs a cause.
//   2 checkRequestedV3  PR #83 checkRequestedV2 with the switch branch reading
//                       switchEvents: a forced exit to the requested species is
//                       'forcedExit', not 'executed'. Move branch unchanged except
//                       an own forced exit before moving -> 'forcedOut'.
//   3 executedOwnV3     own executed pre-action at a turn; a forced exit before
//                       our move is 'forcedOut:<cause>' instead of 'switch:X'.
// Heuristic AI vs heuristic AI. NOT a ladder win rate.
const V2=require('./pr82-switch-utility-t1t2');
const {splitTurns,moveEffect,baseName}=V2;

const PIVOT=new Set(['U-turn','Volt Switch','Flip Turn','Parting Shot','Teleport','Baton Pass','Shed Tail','Chilly Reception']);
const EXIT_ABILITY=/ability: (Emergency Exit|Wimp Out)$/;
const EXIT_ITEM=/^(Eject Button|Eject Pack)$/;
const who=l=>(l.split('|')[2]||'').slice(0,5);   // 'p1a: '

function switchEvents(L,me){
  const out=[];let anyMove=false,pending=null;
  for(const l of L){
    const a=l.split('|'),mine=who(l)===me;
    if(a[1]==='move'){anyMove=true;if(mine&&PIVOT.has(a[3]))pending={cause:'pivot',by:a[3]};continue;}
    if(!mine)continue;
    if(a[1]==='faint'){pending={cause:'replacement',by:'faint'};continue;}
    if(a[1]==='-activate'&&EXIT_ABILITY.test(a[3]||'')){pending={cause:'forcedExit',by:a[3].replace('ability: ','')};continue;}
    if(a[1]==='-enditem'&&EXIT_ITEM.test(a[3]||'')){pending={cause:'forcedExit',by:a[3]};continue;}
    if(a[1]==='drag'){out.push({species:baseName(a[3]),cause:'drag',by:null});continue;}
    if(a[1]==='switch'){
      const ev={species:baseName(a[3]),cause:null,by:null};
      const from=(l.match(/\|\[from\] ?(.*)$/)||[])[1];
      if(from!==undefined)Object.assign(ev,PIVOT.has(from)?{cause:'pivot',by:from}:{cause:'unattributed',by:'[from] '+from});
      else if(pending)Object.assign(ev,pending);
      else if(!anyMove)ev.cause='voluntary';
      else ev.cause='unattributed';
      pending=null;out.push(ev);
    }
  }
  return out;
}
function voluntarySwitchV3(L,me){
  // a voluntary switch must come before the side's own move/faint (PR #83 rule)
  // AND be the first switch event of the side with cause 'voluntary'
  const ev=switchEvents(L,me)[0];
  return ev&&ev.cause==='voluntary'?ev.species:null;
}
function checkRequestedV3(log,foeSide,requested,opts={}){
  const turns=splitTurns(log),me=foeSide+'a: ';
  return requested.map(r=>{
    const L=turns[r.turn]||[],ev=switchEvents(L,me);
    if(r.move){
      const i=L.findIndex(l=>l.startsWith('|move|'+me)&&l.split('|')[3]===r.move);
      if(i>=0)return {result:'executed',effect:moveEffect(L,i)};
      if(L.some(l=>l.startsWith('|faint|'+me)||l.startsWith('|cant|'+me)))return {result:'preempted',effect:null};
      const out=L.findIndex(l=>/^\|(switch|drag)\|/.test(l)&&who(l)===me);
      if(out>=0&&!L.slice(0,out).some(l=>l.startsWith('|move|'+me)))return {result:'forcedOut',effect:null,cause:ev[0]?.cause||null};
      return {result:'mismatch',effect:null};
    }
    const slot=Number(String(r.choice).split(' ')[1]);
    const target=r.target||(opts.rival3&&r.turn===1?opts.rival3[slot-1]:null);
    const vol=ev.find(e=>e.cause==='voluntary');
    if(vol){
      if(!target)return {result:'unverifiable',effect:null,actual:vol.species};
      return {result:vol.species===baseName(target)?'executed':'wrongTarget',effect:null,actual:vol.species,target};
    }
    const forced=ev.find(e=>e.cause==='forcedExit'||e.cause==='pivot');
    if(forced)return {result:'forcedExit',effect:null,cause:forced.cause,by:forced.by,actual:forced.species,target:target||null};
    if(L.some(l=>l.startsWith('|faint|'+me)))return {result:'preempted',effect:null};
    if(ev.some(e=>e.cause==='drag'))return {result:'dragged',effect:null};
    if(ev.length)return {result:'unattributed',effect:null,actual:ev[0].species};
    return {result:'mismatch',effect:null};
  });
}
function executedOwnV3(log,ownSide,turn){
  const L=splitTurns(log)[turn]||[],me=ownSide+'a: ';
  const ev=switchEvents(L,me);
  if(ev[0]&&ev[0].cause==='voluntary')return 'switch:'+ev[0].species;
  const mi=L.findIndex(l=>l.startsWith('|move|'+me));
  const first=L.findIndex(l=>/^\|(switch|drag)\|/.test(l)&&who(l)===me);
  // KO before acting stays 'none' (as PR #83); a forced exit / drag before our
  // move is not our choice and not a voluntary switch.
  if(first>=0&&(mi<0||first<mi)&&ev[0]?.cause!=='replacement')return 'forcedOut:'+(ev[0]?.cause||'unknown');
  return mi>=0?'move:'+L[mi].split('|')[3]:'none';
}
module.exports={PIVOT,switchEvents,voluntarySwitchV3,checkRequestedV3,executedOwnV3};
