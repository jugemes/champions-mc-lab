'use strict';
// ChatGPT independent audit. This is a diagnostic test, not a policy fix.
// It drives a real pinned Champions Battle before inspecting ONLY public protocol.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,Bot,hashSeed}=require('../lab');
const {battle}=require('../encore-lead-audit');
const {caseList}=require('../legal-search-v2-compare');
const {reportedLive}=require('../reported-live-roster-20261027');
const {incomingRisk}=require('../damage');
const streamOf=content=>({async *[Symbol.asyncIterator](){yield content;}});
function publicLog(lines){
  const out=[];
  for(let i=0;i<lines.length;i++){
    if(lines[i].startsWith('|split|')){i++;continue;}
    out.push(lines[i]);
  }
  return out;
}
async function observe(lines,dex,team,options={}){
  const b=new Bot(streamOf(lines.join('\n')),dex,team,'p1',
    {choices:[],selections:[],errors:[]},null,null,{publicMegaAbility:true,...options});
  await b.run();
  return b;
}
const slot=(req,name)=>{
  const i=req.active?.[0]?.moves?.findIndex(m=>m.move===name&&!m.disabled&&m.pp>0)??-1;
  return i<0?null:i+1;
};
test('pinned real Battle: opt-in Mega move memory preserves publicly revealed moves, legacy remains unchanged',{
  skip:!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR not set'
},async t=>{
  const sim=load(),dex=sim.Dex.mod('champions'),own=reportedLive();
  const A=caseList().find(c=>c.id==='A_golisopod');
  assert.ok(A,'pre-existing legal A fixture');
  // T1 Sucker Punch is revealed (it can fail into Stealth Rock); T2 Mega+SD.
  // The rival script is an audit fixture, NOT a claim about human play.
  const rival=(req,bot,info)=>{
    const target=info.turn===1?'Sucker Punch':info.turn===2?'Swords Dance':null;
    if(!target)return null;
    const s=slot(req,target);
    return s?'move '+s+(info.turn===2&&req.active[0].canMegaEvo?' mega':''):null;
  };
  const ours=(req,bot,info)=>{
    if(info.turn>2)return null;
    const s=slot(req,'Stealth Rock');
    return s?'move '+s:null;
  };
  const g=await battle(sim,structuredClone(own),structuredClone(A.team),
    hashSeed(10200001),{
      ownThree:['Tyranitar','Metagross','Primarina'],
      foeThree:A.forcedA,reverse:false,script:rival,ownOptions:{script:ours}
    });
  assert.equal(g.errors,0,'no invalid engine choices');
  const lines=publicLog(g.log.split('\n'));
  const used=lines.findIndex(l=>/^\|move\|p2a: Golisopod\|Sucker Punch\|/.test(l));
  const mega=lines.findIndex(l=>/^\|detailschange\|p2a: Golisopod\|Golisopod-Mega/.test(l));
  if(used<0||mega<0||used>=mega){
    t.diagnostic('Observed no ordered pre-Mega move and Mega event: '+JSON.stringify({
      used,mega,events:lines.filter(l=>/Golisopod/.test(l)).slice(0,18)
    }));
    t.skip('battle did not reach the required public event sequence');
    return;
  }
  const before=await observe(lines.slice(0,mega),dex,own);
  const after=await observe(lines.slice(0,mega+1),dex,own);
  const fixed=await observe(lines.slice(0,mega+1),dex,own,{publicMoveMemory:true});
  assert.equal(before.foeActive,'Golisopod');
  assert.ok(before.seenMoves.Golisopod.includes('Sucker Punch'));
  assert.equal(after.foeActive,'Golisopod-Mega');
  assert.deepEqual(after.seenMoves[after.foeActive]||[],[],
    'baseline mode intentionally reproduces forgotten move');
  assert.deepEqual(fixed.seenMoves[fixed.foeActive],['Sucker Punch'],
    'opt-in mode transfers only the move actually revealed in the pinned Battle');
  assert.deepEqual(fixed.seenMoves.Golisopod,['Sucker Punch'],
    'the same publicly revealed move stays with the base species');
  assert.equal(fixed.seenMoves.Garchomp,undefined,
    'no knowledge may appear for an unrelated opponent');
  const defender=own.find(x=>x.species==='Metagross');
  const opts={attackerAbility:after.foeAbility,foeBoosts:after.foeBoosts};
  const current=incomingRisk(dex,defender,after.foeActive,{
    ...opts,seenMoves:after.seenMoves[after.foeActive]||[]
  });
  const remembered=incomingRisk(dex,defender,after.foeActive,{
    ...opts,seenMoves:before.seenMoves.Golisopod
  });
  const fixedRisk=incomingRisk(dex,defender,fixed.foeActive,{
    ...opts,seenMoves:fixed.seenMoves[fixed.foeActive]||[]
  });
  assert.ok(remembered>current,'public move must change the risk estimate');
  assert.equal(fixedRisk,remembered,'opt-in path must use exactly the previously public move');
  t.diagnostic(JSON.stringify({fixedShowdown:process.env.SHOWDOWN_DIR,
    seed:hashSeed(10200001),publicMove:'Sucker Punch',mega:'Golisopod-Mega',
    currentSeen:after.seenMoves[after.foeActive]||[],
    fixedSeen:fixed.seenMoves[fixed.foeActive],
    shouldRemember:before.seenMoves.Golisopod,
    incomingRiskCurrent:current,incomingRiskWithPublicMove:remembered,
    incomingRiskOptIn:fixedRisk,
    battleTurns:g.turns,engineChoiceErrors:g.errors}));
});


test('opt-in public Mega memory keeps subsequent observed moves, but never crosses species',{
  skip:!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR not set'
},async()=>{
  const dex=load().Dex.mod('champions'),own=reportedLive();
  // Synthetic PUBLIC protocol boundary test; this is not a separate Battle.
  const sequence=[
    '|switch|p2a: Golisopod|Golisopod, L50|100/100',
    '|move|p2a: Golisopod|Sucker Punch|p1a: Tyranitar',
    '|detailschange|p2a: Golisopod|Golisopod-Mega, L50',
    '|move|p2a: Golisopod|Leech Life|p1a: Tyranitar',
    '|switch|p2a: Garchomp|Garchomp, L50|100/100',
    '|switch|p2a: Golisopod|Golisopod-Mega, L50|100/100',
  ];
  const b=await observe(sequence,dex,own,{publicMoveMemory:true});
  assert.equal(b.foeActive,'Golisopod-Mega');
  assert.deepEqual(b.seenMoves.Golisopod,['Sucker Punch','Leech Life']);
  assert.deepEqual(b.seenMoves['Golisopod-Mega'],['Sucker Punch','Leech Life']);
  assert.equal(b.seenMoves.Garchomp,undefined);
  // Impossible cross-species detailschange must not transfer even if received.
  const invalidChange=await observe([
    '|switch|p2a: Golisopod|Golisopod, L50|100/100',
    '|move|p2a: Golisopod|Sucker Punch|p1a: Tyranitar',
    '|detailschange|p2a: Golisopod|Garchomp, L50',
  ],dex,own,{publicMoveMemory:true});
  assert.deepEqual(invalidChange.seenMoves.Garchomp||[],[]);
  assert.deepEqual(invalidChange.seenMoves.Golisopod,['Sucker Punch']);
});
