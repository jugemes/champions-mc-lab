#!/usr/bin/env node
'use strict';
// Five rounds of genuine Showdown BattleStream games. Not a ladder estimator.
// Five candidates x eight synthetic scenario-trios x 250 seeded games = 10k/round.
const fs=require('node:fs');
const path=require('node:path');
const {variants,archetypes,scenarios}=require('./fixtures');
const {prelim,normalize,load,check,game,hashSeed}=require('./lab');
const CASES=Object.keys(scenarios);
const OUT=path.join(__dirname,'output','cycles');
function pool(){
  const a=variants.A_rillaboom,c=variants.C_master,b=variants.B_eelektross;
  const get=s=>c.find(p=>p.species===s)||b.find(p=>p.species===s);
  const swap=(i,s)=>a.map((p,j)=>structuredClone(j===i?get(s):p));
  return {
    A_rillaboom:structuredClone(a),
    B_eelektross:structuredClone(b),
    C_master:structuredClone(c),
    D_starmieS29:structuredClone(variants.D_starmieS29),
    E_megagolisopod:swap(2,'Golisopod'),
    F_megagengar:swap(2,'Gengar'),
    G_corviknight_for_mega:swap(2,'Corviknight'),
    H_eelektross_for_mega:swap(2,'Eelektross'),
    I_corviknight_for_gold:swap(3,'Corviknight'),
    J_eelektross_for_gold:swap(3,'Eelektross'),
    K_corviknight_for_dirge:swap(4,'Corviknight'),
    L_eelektross_for_dirge:swap(4,'Eelektross'),
    M_corviknight_for_prim:swap(5,'Corviknight'),
    N_eelektross_for_prim:swap(5,'Eelektross'),
  };
}
function validatePool(sim,teams){
  const v=sim.TeamValidator.get('gen9championsbssregmc');
  for(const [name,team] of Object.entries(teams)){
    prelim(team,name);
    const problems=v.validateTeam(normalize(team));
    if(problems?.length)throw Error('Illegal '+name+': '+problems.join('; '));
    // Two Mega stones on a team are legal; only one can be used per battle.
  }
}
function candidates(cycle,previous,seen,records,teams){
  const names=Object.keys(teams);
  if(cycle===1)return names.slice(0,5);
  const leaders=previous.slice(0,2);
  const unseen=names.filter(n=>!seen.has(n)&&!leaders.includes(n));
  const historical=names.filter(n=>seen.has(n)&&!leaders.includes(n))
    .sort((a,b)=>(records[b]?.score??-Infinity)-(records[a]?.score??-Infinity));
  return leaders.concat((cycle===5?historical.concat(unseen):unseen.concat(historical)).slice(0,3));
}
function score(counts,n){
  const fractions=CASES.map(s=>counts[s]/n);
  const mean=fractions.reduce((a,b)=>a+b,0)/fractions.length,worst=Math.min(...fractions);
  return {score:0.75*mean+0.25*worst,mean,worst,scenarioWins:counts};
}
function args(a){
  let cycles=5,perCase=250;
  for(let i=0;i<a.length;i++){
    if(a[i]==='--cycles')cycles=Number(a[++i]);
    else if(a[i]==='--per-case')perCase=Number(a[++i]);
    else throw Error('Unknown argument: '+a[i]);
  }
  if(!Number.isInteger(cycles)||cycles<1||cycles>5||!Number.isInteger(perCase)||perCase<1||perCase>250)
    throw Error('cycles must be 1..5 and per-case 1..250');
  return {cycles,perCase};
}
async function run(options){
  const sim=load();
  check(sim);
  const teams=pool();
  validatePool(sim,teams);
  fs.mkdirSync(OUT,{recursive:true});
  const rows=fs.createWriteStream(path.join(OUT,'matches.csv'));
  rows.write('cycle,variant,scenario,index,seed,side,win,turns,lead,selection,errors,opponent_setup,opponent_toxicspikes,opponent_regens\n');
  const summary={
    note:'Fixed synthetic opponent three-member stress tests. Not ranked battle rates.',
    format:'gen9championsbssregmc',
    showDownCommit:process.env.RESEARCH_SHOWDOWN_COMMIT||'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
    matchesPerCycle:5*CASES.length*options.perCase,
    pool:Object.fromEntries(Object.entries(teams).map(([n,t])=>[n,t.map(p=>({species:p.species,item:p.item,ability:p.ability,nature:p.nature,moves:p.moves,evs:p.evs}))])),
    cycles:[]
  };
  let last=[],total=0;
  const seen=new Set(),records={};
  for(let cycle=1;cycle<=options.cycles;cycle++){
    const trial=candidates(cycle,last,seen,records,teams);
    if(trial.length!==5||new Set(trial).size!==5)throw Error('Nonunique candidates at cycle '+cycle);
    const results=[],samples=[];
    for(const name of trial){
      const winsBy={};let errors=0;
      for(const [ix,scenario] of CASES.entries()){
        let wins=0,setupMoves=0,rainCount=0;
        for(let i=0;i<options.perCase;i++){
          const seed=hashSeed(800000+cycle*250000+ix*30000+i);
          const reverse=Boolean(i%2),capture=cycle===1&&i===0;
          const g=reverse?
            await game(sim,archetypes[scenario],teams[name],seed,capture,scenario,true):
            await game(sim,teams[name],archetypes[scenario],seed,capture,scenario,false);
          const own=reverse?'p2':'p1';
          const won=reverse?g.winner==='opponent':g.winner==='candidate';
          wins+=Number(won);errors+=g.trace.errors.length;
          if(g.trace.errors.length){
            const detail={cycle,variant:name,scenario,index:i,seed,errors:g.trace.errors,
              selections:g.trace.selections,choices:g.trace.choices};
            fs.writeFileSync(path.join(OUT,'invalid-choice.json'),JSON.stringify(detail,null,2));
            throw Error('Invalid Showdown choice: '+JSON.stringify(detail));
          }
          setupMoves+=g.opponentSetupMoves;rainCount+=Number(g.rainObserved);
          const sel=g.trace.selections.find(s=>s.side===own);
          rows.write([cycle,name,scenario,i,seed.join('-'),own,Number(won),g.turns,sel?.lead||'',
            sel?.chosen?.join('/')||'',g.trace.errors.length,g.opponentSetupMoves,
            g.opponentToxicSpikes,g.regenSwitchOuts].join(',')+'\n');
          if(i===0){
            samples.push({variant:name,scenario,chosen:sel?.chosen,lead:sel?.lead,won,
              choices:g.trace.choices.slice(0,12)});
            if(capture)fs.writeFileSync(path.join(OUT,name+'_'+scenario+'_c1.log'),g.log);
          }
          total++;
        }
        if(options.perCase>=10&&scenarios[scenario].mustSeeSetup&&!setupMoves)
          throw Error('Setup absent for '+name+'/'+scenario);
        if(options.perCase>=10&&scenarios[scenario].mustSeeRain&&rainCount!==options.perCase)
          throw Error('Rain absent for '+name+'/'+scenario);
        winsBy[scenario]=wins;
      }
      if(errors)throw Error(name+': illegal inputs '+errors);
      seen.add(name);
      results.push({variant:name,...score(winsBy,options.perCase)});
    }
    results.sort((a,b)=>b.score-a.score||a.variant.localeCompare(b.variant));
    last=results.map(r=>r.variant);
    for(const r of results)records[r.variant]=r;
    summary.cycles.push({cycle,games:trial.length*CASES.length*options.perCase,candidates:trial,results,samples});
    summary.completed=total;
    fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,2));
    console.log('CYCLE '+cycle+' completed '+summary.cycles.at(-1).games+' games; stress leaders: '+
      results.map(r=>r.variant+':'+(100*r.mean).toFixed(1)+'%;min'+(100*r.worst).toFixed(1)+'%').join(' ; '));
  }
  summary.stressLeader=last[0];
  summary.warning='This is a biased scripted AI comparison, not ladder winning probability; verify against human play.';
  fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,2));
  await new Promise((resolve,reject)=>rows.end(err=>err?reject(err):resolve()));
  console.log('FIVE-CYCLE TOTAL '+total+' games completed; stress leader: '+summary.stressLeader);
  return summary;
}
if(require.main===module)run(args(process.argv.slice(2))).catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={pool,validatePool,candidates,score,args,run,CASES};
