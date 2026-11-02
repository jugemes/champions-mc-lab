'use strict';
// Audit executed public Showdown events, not Bot-issued choice requests.
// A |cant| event records a turn when a Pokemon could not execute a move.
// A switch event can be a replacement after fainting; it is NOT necessarily
// a freely chosen tactical pivot. Drag is forced, and is reported separately.
function executedEvents(log, ownSide, rivalSide, maxTurn=2) {
  if(!/^p[12]$/.test(ownSide)||!/^p[12]$/.test(rivalSide)||ownSide===rivalSide)
    throw Error('distinct own/rival Showdown sides required');
  const out={own:[],rival:[]};
  let turn=0;
  for(const line of String(log).split('\n')){
    const a=line.split('|');
    if(a[1]==='turn'){turn=Number(a[2])||0;continue;}
    if(turn<1||turn>maxTurn||!['move','switch','drag','cant'].includes(a[1]))continue;
    const match=String(a[2]||'').match(/^(p[12])[a-f]:\s*(.*)$/);
    if(!match)continue;
    const side=match[1]===ownSide?'own':match[1]===rivalSide?'rival':null;
    if(!side)continue;
    out[side].push({turn,kind:a[1],actor:match[2],detail:String(a[3]||'').split(',')[0]});
  }
  return out;
}
function eventSignature(events,turn,{onlyMoves=false,includeActor=true}={}){
  return events.filter(e=>e.turn===turn&&(!onlyMoves||e.kind==='move'))
    .map(e=>[e.kind,...(includeActor?[e.actor]:[]),e.detail].join(':')).join('|');
}

// Classify only what the PUBLIC battle protocol proves. In particular,
// |switch| alone is not evidence that the Bot chose a tactical pivot:
// replacements after fainting, pivoting moves, items and other effects exist.
// We deliberately do not label a non-faint switch "voluntary" without a
// corroborating request/choice trace. This is an observation audit, not a
// policy scorer.
function classifyPublicSwitches(log, ownSide, rivalSide, maxTurn=Infinity) {
  if(!/^p[12]$/.test(ownSide)||!/^p[12]$/.test(rivalSide)||ownSide===rivalSide)
    throw Error('distinct own/rival Showdown sides required');
  const out={own:[],rival:[]};
  const fainted=new Set();
  let turn=0;
  for(const line of String(log).split('\n')){
    const a=line.split('|'),kind=a[1];
    if(kind==='turn'){turn=Number(a[2])||0;continue;}
    if(!['faint','switch','drag'].includes(kind))continue;
    const match=String(a[2]||'').match(/^(p[12])([a-f]):\s*(.*)$/);
    if(!match)continue;
    const [_,side,slot,actor]=match;
    if(side!==ownSide&&side!==rivalSide)continue;
    const key=side+slot;
    if(kind==='faint'){fainted.add(key);continue;}
    const replacement=fainted.has(key);
    fainted.delete(key);
    // Initial preview leads are not a turn-1 switch decision.
    if(turn<1||turn>maxTurn)continue;
    const classification=kind==='drag'?'forced-drag':
      replacement?'faint-replacement':'nonfaint-switch-cause-unknown';
    out[side===ownSide?'own':'rival'].push({
      turn,actor,kind,classification,
      // This only establishes the absence of a prior faint, NOT a free choice.
      provenTacticalChoice:false
    });
  }
  return out;
}
module.exports={executedEvents,eventSignature,classifyPublicSwitches};
