#!/usr/bin/env node
'use strict';
// This is an independent 6v6 preview => 3v3 test, NOT the old forced-three
// stress harness and NOT a competitive win-rate estimator.
const fs=require('node:fs');
const path=require('node:path');
const {pool,candidates}=require('./optimize');
const {opponents}=require('./preview-opponents');
const {load,check,game,hashSeed,prelim,normalize}=require('./lab');
const CASES=Object.keys(opponents);
const OUT=path.join(__dirname,'output','preview-cycles');

function optionsFrom(args){
  let cycles=5,perCase=250;
  for(let i=0;i<args.length;i++){
    if(args[i]==='--cycles')cycles=Number(args[++i]);
    else if(args[i]==='--per-case')perCase=Number(args[++i]);
    else throw Error('Unknown option '+args[i]);
  }
  if(!Number.isInteger(cycles)||cycles<1||cycles>5||
     !Number.isInteger(perCase)||perCase<1||perCase>250)
    throw Error('Expected --cycles 1..5 --per-case 1..250');
  return {cycles,perCase};
}
function validate(sim,teams){
  const validator=sim.TeamValidator.get('gen9championsbssregmc');
  for(const [name,team] of Object.entries(teams)){
    prelim(team,name);
    const problems=validator.validateTeam(normalize(team));
    if(problems?.length)throw Error(name+': '+problems.join('; '));
  }
}
function rank(counts,n){
  const values=CASES.map(name=>counts[name]/n);
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  const worst=Math.min(...values);
  return {mean,worst,score:0.75*mean+0.25*worst,scenarioWins:counts};
}
function record(map,selection){
  const key=selection?.chosen?.join('/')||'UNRECORDED';
  map[key]=(map[key]||0)+1;
}
async function run(cfg){
  const sim=load();
  check(sim);
  const teams=pool();
  validate(sim,{...teams,...Object.fromEntries(CASES.map(k=>['opponent_'+k,opponents[k]]))});
  fs.mkdirSync(OUT,{recursive:true});
  const csv=fs.createWriteStream(path.join(OUT,'matches.csv'));
  csv.write('cycle,variant,lineup,index,seed,side,win,turns,candidate_selection,candidate_lead,opponent_selection,opponent_lead,errors\n');
  const report={
    mode:'INDEPENDENT_SIX_PREVIEW_THREE_PICK',
    disclaimer:'Synthetic six-species lineups, heuristic agents, not competitive win rate or authentic M-7 usage-frequency distribution.',
    engine:process.env.RESEARCH_SHOWDOWN_COMMIT||'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
    gamesPerRound:5*CASES.length*cfg.perCase,
    lineups:Object.fromEntries(Object.entries(opponents).map(([k,t])=>[k,t.map(x=>x.species)])),
    rounds:[],games:0
  };
  let last=[],seen=new Set();const prior={};
  for(let cycle=1;cycle<=cfg.cycles;cycle++){
    const trial=candidates(cycle,last,seen,prior,teams);
    if(trial.length!==5||new Set(trial).size!==5)throw Error('Invalid candidates '+cycle);
    const results=[];
    for(const name of trial){
      const winsBy={},distribution={};
      for(const [idx,lineup] of CASES.entries()){
        let wins=0,errors=0;
        const mySelections={},oppSelections={},myLeads={},oppLeads={};
        for(let i=0;i<cfg.perCase;i++){
          // Same PRNG seed and opposing public six for each candidate on this
          // exact trial. Selection RNG is independent from engine damage RNG.
          const seed=hashSeed(960000+cycle*300000+idx*35000+i);
          const reversed=Boolean(i%2);
          const trace=await game(sim,
            reversed?opponents[lineup]:teams[name],
            reversed?teams[name]:opponents[lineup],
            seed,cycle===1&&i===0,null,reversed,{previewPolicy:'stochastic'});
          const mine=reversed?'p2':'p1',theirs=reversed?'p1':'p2';
          const ownSel=trace.trace.selections.find(s=>s.side===mine);
          const oppSel=trace.trace.selections.find(s=>s.side===theirs);
          if(!ownSel||!oppSel||ownSel.chosen.length!==3||oppSel.chosen.length!==3)
            throw Error('Missing actual independent three-pick '+name+'/'+lineup+'/'+i);
          record(mySelections,ownSel);record(oppSelections,oppSel);
          myLeads[ownSel.lead]=(myLeads[ownSel.lead]||0)+1;
          oppLeads[oppSel.lead]=(oppLeads[oppSel.lead]||0)+1;
          const won=reversed?trace.winner==='opponent':trace.winner==='candidate';
          wins+=Number(won);errors+=trace.trace.errors.length;
          csv.write([cycle,name,lineup,i,seed.join('-'),mine,Number(won),trace.turns,
            ownSel.chosen.join('/'),ownSel.lead,oppSel.chosen.join('/'),oppSel.lead,trace.trace.errors.length].join(',')+'\n');
          if(trace.trace.errors.length)throw Error('Illegal choice '+name+'/'+lineup+'/'+i+':'+JSON.stringify(trace.trace.errors));
          if(i===0&&cycle===1){
            fs.writeFileSync(path.join(OUT,name+'_'+lineup+'.log'),
              trace.log+'\nPUBLIC_DECISIONS\n'+JSON.stringify(trace.trace,null,2));
          }
          report.games++;
        }
        if(errors)throw Error('Invalid decisions: '+errors);
        winsBy[lineup]=wins;
        distribution[lineup]={
          candidateSelections:mySelections,opponentSelections:oppSelections,
          candidateLeads:myLeads,opponentLeads:oppLeads
        };
      }
      seen.add(name);
      results.push({variant:name,...rank(winsBy,cfg.perCase),distribution});
    }
    results.sort((a,b)=>b.score-a.score||a.variant.localeCompare(b.variant));
    last=results.map(x=>x.variant);
    for(const r of results)prior[r.variant]=r;
    report.rounds.push({cycle,candidates:trial,games:trial.length*CASES.length*cfg.perCase,results});
    fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(report,null,2));
    console.log('PREVIEW CYCLE '+cycle+' completed '+report.games+' games (cumulative), leader '+last[0]+
      ' / '+(results[0].mean*100).toFixed(2)+'% synthetic score; worst '+(results[0].worst*100).toFixed(2)+'%');
    console.log('SELECTED COUNT '+last[0]+' '+JSON.stringify(Object.fromEntries(
      CASES.map(k=>[k, {
        candidate:Object.keys(results[0].distribution[k].candidateSelections).length,
        opponent:Object.keys(results[0].distribution[k].opponentSelections).length
      }]))));
  }
  report.syntheticLeader=last[0];
  fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(report,null,2));
  await new Promise((resolve,reject)=>csv.end(e=>e?reject(e):resolve()));
  console.log('INDEPENDENT PREVIEW COMPLETE '+report.games+' games');
  return report;
}
if(require.main===module)run(optionsFrom(process.argv.slice(2))).catch(err=>{
  console.error(err.stack||String(err));process.exitCode=1;
});
module.exports={run,optionsFrom,rank,CASES};
