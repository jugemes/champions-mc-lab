'use strict';
// Audit executed public Showdown events, not Bot-issued choice requests.
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
    if(turn<1||turn>maxTurn||!['move','switch','drag'].includes(a[1]))continue;
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
module.exports={executedEvents,eventSignature};
