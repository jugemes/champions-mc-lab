#!/usr/bin/env node
'use strict';
// Second ACTUAL improvement cycle: hold old candidates and AI ablations as
// controls, test matchup-motivated roster modifications at identical seeds.
const fs=require('node:fs'),path=require('node:path');
const {teams}=require('./cycle3-teams');
const {validatePool}=require('./optimize');
const {opponents}=require('./holdout-opponents');
const {game,load,check,hashSeed}=require('./lab');
const OUT=path.join(__dirname,'output','holdout4');
function args(v){
 let n=75;for(let i=0;i<v.length;i++){
  if(v[i]==='--per-case')n=Number(v[++i]);else throw Error('Unknown option '+v[i]);
 }
 if(!Number.isInteger(n)||n<1||n>250)throw Error('Expected 1..250');
 return {perCase:n};
}
async function run({perCase}){
 const sim=load();check(sim);
 const candidates=teams();
 const original=require('./cycle2-teams').teams();
 candidates.C_original=original.C_control;
 candidates.E_original=original.E_control;
 candidates.B_original=original.B_control;
 validatePool(sim,candidates);
 const cases=Object.keys(opponents),names=Object.keys(candidates);
 const configurations=names.map(name=>({name,team:name,policy:'v2'}));
 fs.mkdirSync(OUT,{recursive:true});
 const csv=fs.createWriteStream(path.join(OUT,'games.csv'));
 csv.write('experiment,opponent_six,game,seed,own_side,win,turns,own_three,opponent_three,errors\n');
 const results=[];
 for(const config of configurations){
  const by={};let wins=0,errors=0;
  for(const [idx,scene]of cases.entries()){
   let count=0;let ownPicks={};let oppPicks={};
   for(let i=0;i<perCase;i++){
    const seed=hashSeed(4800000+idx*100000+i),rev=Boolean(i%2);
    const result=await game(sim,rev?opponents[scene]:candidates[config.team],
      rev?candidates[config.team]:opponents[scene],seed,i===0,null,rev,
      {previewPolicy:'stochastic',candidateDecisionPolicy:config.policy,opponentDecisionPolicy:'baseline'});
    const side=rev?'p2':'p1',foe=rev?'p1':'p2';
    const own=result.trace.selections.find(x=>x.side===side),theirs=result.trace.selections.find(x=>x.side===foe);
    if(!own||!theirs||result.trace.errors.length)throw Error(config.name+'/'+scene+': '+JSON.stringify(result.trace.errors));
    const win=rev?result.winner==='opponent':result.winner==='candidate';
    count+=Number(win);wins+=Number(win);
    const key=own.chosen.slice().sort().join('/'),other=theirs.chosen.slice().sort().join('/');
    ownPicks[key]=(ownPicks[key]||0)+1;oppPicks[other]=(oppPicks[other]||0)+1;
    csv.write([config.name,scene,i,seed.join('-'),side,Number(win),result.turns,
     own.chosen.join('/'),theirs.chosen.join('/'),result.trace.errors.length].join(',')+'\n');
    if(i===0)fs.writeFileSync(path.join(OUT,config.name+'_'+scene+'.log'),
     result.log+'\nDECISIONS\n'+JSON.stringify(result.trace,null,2));
   }
   by[scene]={wins:count,total:perCase,ownPicks,oppPicks};
  }
  const lowest=Math.min(...Object.values(by).map(x=>x.wins/perCase));
  const total=perCase*cases.length;
  const row={...config,wins,total,rate:wins/total,worst:lowest,by};
  results.push(row);
  console.log('HOLDOUT-4 '+config.name+': '+wins+'/'+total+' ('+(row.rate*100).toFixed(2)+
   '%) min '+(lowest*100).toFixed(1)+'%; '+cases.map(x=>x+':'+by[x].wins).join(','));
 }
 const summary={engine:process.env.RESEARCH_SHOWDOWN_COMMIT||'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
   mode:'RESEARCH_ROSTER_CHANGES_SAME_PUBLIC_6_SEEDS_SAME_OPPONENT_BASELINE',
   opponents:cases,perCase,results:results.sort((a,b)=>b.rate-a.rate),
   disclaimer:'Synthetic AI pool, not an empirical ladder win-rate, roster effect tested with unchanged AI.'};
 fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,2));
 await new Promise((ok,no)=>csv.end(err=>err?no(err):ok()));
 console.log('HOLDOUT-4 COMPLETED '+(results.length*cases.length*perCase)+' Showdown games');
 return summary;
}
if(require.main===module)run(args(process.argv.slice(2))).catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={run,args};