'use strict';
// PR #59 independent probe of PR #57 (public Mega ability on re-entry):
// real BattleStream, the observing Bot reads only ITS player stream. p1 is
// scripted: Garchomp Mega-Z evolves, switches out, re-enters. Records the p2
// Bot's public foe form/ability and its choice at every request. Without the
// PR #57 lab.js change foeAbility stays '' (rational2 needs PR #57 code).
// Usage: SHOWDOWN_DIR=... [PROBE_POLICIES=baseline,rational2] node pr57-reentry-probe.js
const {Bot,normalize,load}=require('./lab');
const {padTo6,FILLER}=require('./hybrid01-audit');
const {reportedLive}=require('./reported-live-roster-20261027');
async function probe(policy,seed){
  const sim=load(),dex=sim.Dex.mod('champions');
  const own=reportedLive();
  const base=own.find(x=>x.species==='Garchomp');
  const zchomp={...base,item:'Garchompite Z',ability:'Rough Skin',moves:['Earthquake','Dragon Claw','Swords Dance','Rock Slide']};
  const p1=padTo6(zchomp,FILLER());
  const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
  const trace={choices:[],selections:[],errors:[]};
  const bot=new Bot(streams.p2,dex,structuredClone(own),'p2',trace,['Metagross','Tyranitar','Rotom-Wash'],null,{decisionPolicy:policy,seed});
  const states=[];
  const origDecide=bot.decide.bind(bot);
  bot.decide=req=>{const c=origDecide(req);if(!req.teamPreview)states.push({turn:bot.turn,foeActive:bot.foeActive,foeAbility:bot.foeAbility,choice:c,
    active:req.side?.pokemon.find(p=>p.active)?.details});return c;};
  const script=['move 1 mega','switch 2','switch 1','move 1','move 1','move 1'];
  let k=0;const p1log=[];
  const drive=(async()=>{for await(const chunk of streams.p1){
    for(const line of chunk.split('\n')){
      if(!line.startsWith('|request|'))continue;
      const req=JSON.parse(line.slice(9));if(req.wait)continue;
      if(req.teamPreview){await streams.p1.write('team 123');continue;}
      if(req.forceSwitch){const i=req.side.pokemon.findIndex((p,j)=>j>0&&!p.condition.endsWith(' fnt'));await streams.p1.write('switch '+(i+1));continue;}
      let c=script[k++]||'move 1';
      if(c==='switch 1'){const i=req.side.pokemon.findIndex(p=>p.details.startsWith('Garchomp'));c='switch '+(i+1);}
      p1log.push(bot.turn+':'+c);await streams.p1.write(c);
    }}})();
  const obs=(async()=>{for await(const m of streams.omniscient){}})();
  const r=bot.run();
  await streams.omniscient.write('>start '+JSON.stringify({formatid:'gen9championsbssregmc',seed})+'\n>player p1 '+JSON.stringify({name:'a',team:normalize(p1)})+'\n>player p2 '+JSON.stringify({name:'b',team:normalize(own)}));
  await Promise.all([r,drive,obs]);
  return {policy,p1log,states:states.slice(0,6),errors:trace.errors};
}
(async()=>{for(const p of (process.env.PROBE_POLICIES||'baseline').split(','))console.log(JSON.stringify(await probe(p,[2026,10,30,59]),null,0));})().catch(e=>{console.error(e);process.exitCode=1;});
