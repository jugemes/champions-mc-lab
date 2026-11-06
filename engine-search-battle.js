'use strict';
// Full pinned-Showdown battle runner where either side may use the engine
// search turn AI. Each side's bot reads only its own player stream; a search
// bot additionally gets battleSource, which it passes to determinize() only.
const {Bot,normalize}=require('./lab');
const {EngineSearchBot,rolePool}=require('./engine-search-bot');
const FORMAT='gen9championsbssregmc';
// opts per side: {search:boolean, forced:[species lead first]|null,
//   previewPolicy, decisionPolicy, searchConfig}
async function searchBattle(sim,{p1,p2,seed,p1Opts={},p2Opts={},pool,captureLog=false}){
  const bs=new sim.BattleStream({noCatch:true});
  const streams=sim.getPlayerStreams(bs);
  const dex=sim.Dex.mod('champions');
  const trace={choices:[],selections:[],errors:[]};
  const hyp=pool||rolePool(sim);
  const mk=(stream,team,side,o)=>{
    const Cls=o.search?EngineSearchBot:Bot;
    return new Cls(stream,dex,team,side,trace,o.forced||null,null,{
      previewPolicy:o.previewPolicy||'legacy',decisionPolicy:o.decisionPolicy||'v2',seed,
      sim,battleSource:o.search?()=>bs.battle:undefined,pool:hyp,search:o.searchConfig});
  };
  const b1=mk(streams.p1,p1,'p1',p1Opts),b2=mk(streams.p2,p2,'p2',p2Opts);
  let winner='',turns=0;const log=[];
  const watch=(async()=>{for await(const msg of streams.omniscient){
    if(captureLog)log.push(msg);
    for(const line of msg.split('\n')){
      if(line.startsWith('|win|'))winner=line.slice(5);
      if(line.startsWith('|turn|'))turns=Number(line.slice(6));
    }
  }})();
  const r1=b1.run(),r2=b2.run();
  await streams.omniscient.write('>start '+JSON.stringify({formatid:FORMAT,seed})+
    '\n>player p1 '+JSON.stringify({name:'p1',team:normalize(p1)})+
    '\n>player p2 '+JSON.stringify({name:'p2',team:normalize(p2)}));
  await Promise.all([watch,r1,r2]);
  if(!winner)throw Error('Game had no winner. Errors: '+JSON.stringify(trace.errors));
  return {winner,turns,trace,log:log.join('\n'),
    searchLog:{p1:b1.searchLog||null,p2:b2.searchLog||null}};
}
module.exports={searchBattle};
