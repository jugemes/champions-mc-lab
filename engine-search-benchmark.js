#!/usr/bin/env node
'use strict';
// Benchmark of the engine-search turn AI against the heuristic Bot.
// (1) MIRROR: identical six and identical fixed three/lead on both sides, so
//     only the turn AI differs; seats alternate. Measures decision quality.
// (2) OPEN8/9 0/4 BRANCHES: the frozen O2 selections that went 0/4 on new
//     seeds, replayed with heuristic-vs-heuristic, search-vs-heuristic and
//     search-vs-search on two disjoint seed sets (stability check).
// Opposing sets are the existing research hypotheses. Heuristic AI and
// engine-search AI only: these are NOT ladder win rates.
//   SHOWDOWN_DIR=... node engine-search-benchmark.js [--games 10] [--out file]
const fs=require('node:fs'),path=require('node:path');
const {load,hashSeed}=require('./lab');
const {searchBattle}=require('./engine-search-battle');
const {rolePool}=require('./engine-search-bot');
const {reportedLive}=require('./reported-live-roster-20261027');
const {builders}=require('./m8-open1-20261104');
const {cases}=require('./m8-open8-battle-study-20261105');
const {opponents:threat}=require('./threat-scenarios-20261014');
function args(argv){
  let games=10,out='output/engine-search-benchmark.json',only=null;
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--games')games=Number(argv[++i]);
    else if(argv[i]==='--out')out=argv[++i];
    // --only mirror:<team id> | branch:<case>/<branch>  (one CI matrix cell)
    else if(argv[i]==='--only')only=argv[++i];
    else throw Error('Unknown option '+argv[i]);
  }
  if(!Number.isInteger(games)||games<2||games%2)throw Error('--games must be an even integer >= 2');
  return {games,out,only};
}
const MIRRORS=()=>[
  {id:'live_A',team:reportedLive(),three:['Metagross','Garchomp','Rotom-Wash']},
  {id:'O2',team:builders.O2_megaMetagross_unaware(),three:['Baxcalibur','Metagross','Gholdengo']},
  {id:'sun_charizard_y',team:threat.sun_charizard_y,three:['Charizard','Garchomp','Primarina']}
];
const BRANCHES=[
  {case:'sun',branch:'A',own:['Baxcalibur','Metagross','Rotom-Wash']},
  {case:'sun',branch:'Y_back_Mimikyu',own:['Baxcalibur','Metagross','Rotom-Wash']},
  {case:'mixedElectric',branch:'A',own:['Metagross','Rillaboom','Gholdengo']}
];
const POLICY={
  heuristic:{search:false,decisionPolicy:'baseline'},
  v3:{search:false,decisionPolicy:'v3'},
  search:{search:true}
};
async function series(sim,pool,{ownTeam,ownThree,foeTeam,foeThree,ownPolicy,foePolicy,seeds}){
  let wins=0;const rows=[];
  for(let i=0;i<seeds.length;i++){
    const reverse=Boolean(i%2);
    const own={...POLICY[ownPolicy],forced:ownThree},foe={...POLICY[foePolicy],forced:foeThree};
    const r=await searchBattle(sim,{pool,seed:seeds[i],
      p1:reverse?foeTeam:ownTeam,p2:reverse?ownTeam:foeTeam,
      p1Opts:reverse?foe:own,p2Opts:reverse?own:foe});
    if(r.trace.errors.length)throw Error('choice errors '+JSON.stringify(r.trace.errors));
    const ownSide=reverse?'p2':'p1';
    const won=r.winner===ownSide;wins+=Number(won);
    const errs=[...(r.searchLog.p1||[]),...(r.searchLog.p2||[])].filter(x=>x.error);
    if(errs.length)throw Error('search errors '+JSON.stringify(errs.slice(0,3)));
    rows.push({seed:seeds[i].join('-'),ownSide,won,turns:r.turns});
  }
  return {wins,games:seeds.length,rows};
}
async function main(){
  const cfg=args(process.argv.slice(2));
  const sim=load(),pool=rolePool(sim);
  const seedSet=(base,n)=>Array.from({length:n},(_,i)=>hashSeed(base+i));
  const result={engine:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:'gen9championsbssregmc',
    note:'Heuristic/engine-search AI vs AI. Not ladder win rates.',mirror:[],branches:[]};
  for(const m of MIRRORS()){
    if(cfg.only&&cfg.only!=='mirror:'+m.id)continue;
    for(const foePolicy of ['heuristic','v3']){
      const s=await series(sim,pool,{ownTeam:m.team,ownThree:m.three,foeTeam:m.team,foeThree:m.three,
        ownPolicy:'search',foePolicy,seeds:seedSet(8800000,cfg.games)});
      result.mirror.push({team:m.id,three:m.three,own:'search',foe:foePolicy,...s});
      console.log(`MIRROR ${m.id} search vs ${foePolicy}: ${s.wins}/${s.games}`);
    }
  }
  const all=cases(),O2=builders.O2_megaMetagross_unaware();
  for(const b of BRANCHES){
    if(cfg.only&&cfg.only!=='branch:'+b.case+'/'+b.branch)continue;
    const c=all.find(x=>x.id===b.case),br=c.branches.find(x=>x.id===b.branch);
    for(const [ownPolicy,foePolicy] of [['heuristic','heuristic'],['search','heuristic'],['search','search']]){
      for(const [label,base] of [['seedsA',8900000],['seedsB',8950000]]){
        const s=await series(sim,pool,{ownTeam:O2,ownThree:b.own,foeTeam:c.team,foeThree:br.three,
          ownPolicy,foePolicy,seeds:seedSet(base,cfg.games)});
        result.branches.push({case:b.case,branch:b.branch,ownThree:b.own,foeThree:br.three,own:ownPolicy,foe:foePolicy,seedSet:label,...s});
        console.log(`BRANCH O2 vs ${b.case}/${b.branch} own=${ownPolicy} foe=${foePolicy} ${label}: ${s.wins}/${s.games}`);
      }
    }
  }
  fs.mkdirSync(path.dirname(cfg.out),{recursive:true});
  fs.writeFileSync(cfg.out,JSON.stringify(result,null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
module.exports={args,MIRRORS,BRANCHES,series};
