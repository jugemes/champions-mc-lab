'use strict';
// Full, awaited battles for tests: both bots' run() loops and the omniscient
// observer are awaited; a timeout ends the stream and rejects instead of
// leaving a half-finished BattleStream behind (PR #51 runT1 used void r1/r2).
const {Bot,normalize}=require('../lab');
async function playToEnd(sim,dex,{own,opp,ownPick,oppPick,seed,policy='rational2',timeoutMs=20000}){
  const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
  const trace={choices:[],selections:[],errors:[]};
  const a=new Bot(streams.p1,dex,own,'p1',trace,ownPick,null,{decisionPolicy:policy,seed});
  const b=new Bot(streams.p2,dex,opp,'p2',trace,oppPick,null,{decisionPolicy:'baseline',seed});
  let winner='';
  const obs=(async()=>{for await(const m of streams.omniscient)for(const l of m.split('\n'))if(l.startsWith('|win|')||l.startsWith('|tie'))winner=l;})();
  let timer;
  const done=Promise.all([obs,a.run(),b.run()]);
  const guard=new Promise((_,rej)=>{timer=setTimeout(()=>{streams.omniscient.writeEnd();rej(Error('battle did not finish in '+timeoutMs+'ms'));},timeoutMs);});
  try{
    await streams.omniscient.write('>start '+JSON.stringify({formatid:'gen9championsbssregmc',seed})+'\n>player p1 '+JSON.stringify({name:'a',team:normalize(own)})+'\n>player p2 '+JSON.stringify({name:'b',team:normalize(opp)}));
    await Promise.race([done,guard]);
  }finally{clearTimeout(timer);}
  if(!winner)throw Error('battle ended without a result');
  return trace;
}
function choiceAt(trace,side,turn){
  const c=trace.choices.find(x=>x.side===side&&x.turn===turn);
  if(!c)throw Error('no '+side+' choice at turn '+turn);
  return c.choice;
}
module.exports={playToEnd,choiceAt};
