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
async function observe(lines,dex,team){
  const b=new Bot(streamOf(lines.join('\n')),dex,team,'p1',
    {choices:[],selections:[],errors:[]},null,null,{publicMegaAbility:true});
  await b.run();
  return b;
}
const slot=(req,name)=>{
  const i=req.active?.[0]?.moves?.findIndex(m=>m.move===name&&!m.disabled&&m.pp>0)??-1;
  return i<0?null:i+1;
};
test('pinned real Battle: a revealed move is forgotten at Mega detailschange (public-only audit)',{
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
  assert.equal(before.foeActive,'Golisopod');
  assert.ok(before.seenMoves.Golisopod.includes('Sucker Punch'));
  assert.equal(after.foeActive,'Golisopod-Mega');
  assert.deepEqual(after.seenMoves[after.foeActive]||[],[],
    'observed current implementation loses the public move after Mega');
  const defender=own.find(x=>x.species==='Metagross');
  const opts={attackerAbility:after.foeAbility,foeBoosts:after.foeBoosts};
  const current=incomingRisk(dex,defender,after.foeActive,{
    ...opts,seenMoves:after.seenMoves[after.foeActive]||[]
  });
  const remembered=incomingRisk(dex,defender,after.foeActive,{
    ...opts,seenMoves:before.seenMoves.Golisopod
  });
  assert.ok(remembered>=current);
  t.diagnostic(JSON.stringify({fixedShowdown:process.env.SHOWDOWN_DIR,
    seed:hashSeed(10200001),publicMove:'Sucker Punch',mega:'Golisopod-Mega',
    currentSeen:after.seenMoves[after.foeActive]||[],
    shouldRemember:before.seenMoves.Golisopod,
    incomingRiskCurrent:current,incomingRiskWithPublicMove:remembered,
    battleTurns:g.turns,engineChoiceErrors:g.errors}));
});
