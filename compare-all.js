#!/usr/bin/env node
'use strict';
// Fair complete candidate comparison (separate from adaptive subset tournament).
// All 14 candidates play every same eight PUBLIC six-preview lineups with the
// identical match seed and side assignment. No opposing forced chosen-three.
// NOT ladder rank win rate or realistic distribution.
const fs=require('node:fs');
const path=require('node:path');
const {pool,validatePool}=require('./optimize');
const {opponents}=require('./preview-opponents');
const {prelim,normalize,load,check,game,hashSeed}=require('./lab');
const OUT=path.join(__dirname,'output','fair-compare');
function parseArgs(argv){
  let count=250;
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--per-pair')count=Number(argv[++i]);
    else throw Error('Unknown option '+argv[i]);
  }
  if(!Number.isInteger(count)||count<1||count>250)throw Error('per-pair must be integer 1..250');
  return {count};
}
function matrix(count,names,caseNames){
  const all=[];
  for(const caseName of caseNames){
    const index=caseNames.indexOf(caseName);
    for(let i=0;i<count;i++){
      const seed=hashSeed(1540000+index*100000+i);
      all.push({caseName,index,i,seed,reverse:Boolean(i%2)});
    }
  }
  return all;
}
function resultRow(name,winsBy,counts,errors,selectedBy,opponentBy){
  const cases=Object.keys(winsBy);
  const rates=cases.map(c=>winsBy[c]/counts[c]);
  const mean=rates.reduce((a,b)=>a+b,0)/rates.length;
  return {variant:name,games:Object.values(counts).reduce((a,b)=>a+b,0),mean,wins:Object.values(winsBy).reduce((a,b)=>a+b,0),
    worst:Math.min(...rates),best:Math.max(...rates),scenarioWins:winsBy,
    scenarioCounts:counts,errors,ownSelections:selectedBy,opponentSelections:opponentBy};
}
async function main(cfg){
  const sim=load();
  check(sim);
  const teams=pool();
  validatePool(sim,teams);
  const v=sim.TeamValidator.get('gen9championsbssregmc');
  for(const [k,t] of Object.entries(opponents)){
    prelim(t,'opp-'+k);
    const issues=v.validateTeam(normalize(t));
    if(issues?.length)throw Error('Illegal opponent '+k+': '+issues.join('; '));
  }
  fs.mkdirSync(OUT,{recursive:true});
  const raw=fs.createWriteStream(path.join(OUT,'matches.csv'));
  raw.write('variant,opponent_six,index,seed,own_side,win,turns,own_three,own_lead,opponent_three,opponent_lead,errors\n');
  const caseNames=Object.keys(opponents),names=Object.keys(teams),schedule=matrix(cfg.count,names,caseNames);
  const summary={mode:'ALL_CANDIDATES_SAME_MATCH_SEEDS_INDEPENDENT_PREVIEW',
    engine:process.env.RESEARCH_SHOWDOWN_COMMIT||'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
    note:'Fourteen curated candidate teams, eight synthetic public-six opponents, identical seeds and seat parity. Neither ranked win rates nor a representative meta population.',
    cases:caseNames,names,cfg,totalExpected:names.length*caseNames.length*cfg.count,completed:0,results:[]};
  for(const name of names){
    const winBy={},countBy={},ourSelections={},theirSelections={};let errors=0;
    for(const c of caseNames){winBy[c]=0;countBy[c]=0;ourSelections[c]={};theirSelections[c]={};}
    for(const cell of schedule){
      const opponent=opponents[cell.caseName];
      const g=cell.reverse?
        await game(sim,opponent,teams[name],cell.seed,false,null,true,{previewPolicy:'stochastic'}):
        await game(sim,teams[name],opponent,cell.seed,false,null,false,{previewPolicy:'stochastic'});
      const side=cell.reverse?'p2':'p1',foe=cell.reverse?'p1':'p2';
      const own=g.trace.selections.find(x=>x.side===side);
      const rival=g.trace.selections.find(x=>x.side===foe);
      if(!own||!rival||own.chosen.length!==3||rival.chosen.length!==3)
        throw Error('Missing 6v3 choice '+name+'/'+cell.caseName+'/'+cell.i);
      if(g.trace.errors.length)throw Error('Invalid action '+name+'/'+cell.caseName+'/'+cell.i+': '+JSON.stringify(g.trace.errors));
      const winner=cell.reverse?g.winner==='opponent':g.winner==='candidate';
      winBy[cell.caseName]+=Number(winner);
      countBy[cell.caseName]++;
      for(const [bucket,record] of [[ourSelections[cell.caseName],own],[theirSelections[cell.caseName],rival]]){
        const key=record.chosen.slice().sort().join('/');
        bucket[key]=(bucket[key]||0)+1;
      }
      raw.write([name,cell.caseName,cell.i,cell.seed.join('-'),side,Number(winner),g.turns,
        own.chosen.join('/'),own.lead,rival.chosen.join('/'),rival.lead,g.trace.errors.length].join(',')+'\n');
      summary.completed++;
    }
    const row=resultRow(name,winBy,countBy,errors,ourSelections,theirSelections);
    summary.results.push(row);
    summary.results.sort((a,b)=>b.mean-a.mean||b.worst-a.worst||a.variant.localeCompare(b.variant));
    fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,2));
    console.log('FAIR COMPARED '+name+' '+row.wins+'/'+row.games+' = '+(100*row.mean).toFixed(2)+
      '%; worst '+(row.worst*100).toFixed(2)+'%, '+summary.completed+'/'+summary.totalExpected+' complete');
  }
  await new Promise((ok,fail)=>raw.end(e=>e?fail(e):ok()));
  console.log('FAIR HEAD-TO-HEAD CONDITIONS COMPLETE: '+summary.completed+' games, '+summary.results.length+' candidates');
  return summary;
}
if(require.main===module)main(parseArgs(process.argv.slice(2))).catch(e=>{console.error(e.stack||String(e));process.exitCode=1});
module.exports={parseArgs,matrix,resultRow,main};
