#!/usr/bin/env node
'use strict';
// Compare actual candidate decision versions to baseline under identical seeds,
// candidate team and public six, with opposing baseline policy held fixed.
// To distinguish AI improvement from roster improvement, NO roster is changed.
const fs=require('node:fs');
const path=require('node:path');
const {pool,validatePool}=require('./optimize');
const {opponents}=require('./preview-opponents');
const {load,check,game,hashSeed,prelim,normalize}=require('./lab');
const CANDIDATES=['A_rillaboom','B_eelektross','C_master','E_megagolisopod','J_eelektross_for_gold'];
const CASES=Object.keys(opponents);
const OUT=path.join(__dirname,'output','policy-ab');
function args(argv){
  let perCase=50;
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--per-case')perCase=Number(argv[++i]);
    else throw Error('Unknown arg '+argv[i]);
  }
  if(!Number.isInteger(perCase)||perCase<1||perCase>250)throw Error('1..250');
  return {perCase};
}
async function run({perCase}){
  const sim=load();check(sim);
  const teams=pool();validatePool(sim,teams);
  fs.mkdirSync(OUT,{recursive:true});
  const csv=fs.createWriteStream(path.join(OUT,'games.csv'));
  csv.write('candidate,foe,policy,game,seed,side,win,turns,selected,foe_selected,errors\n');
  const results=[],policies=['baseline','v2'];
  for(const name of CANDIDATES){
    const by=Object.fromEntries(policies.map(x=>[x,{wins:0,games:0,cases:{}}]));
    for(const caseName of CASES){
      for(let i=0;i<perCase;i++){
        const seed=hashSeed(2000000+CASES.indexOf(caseName)*100000+i);
        const reversed=Boolean(i%2);
        for(const version of policies){
          const g=await game(sim,
            reversed?opponents[caseName]:teams[name],
            reversed?teams[name]:opponents[caseName],
            seed,false,null,reversed,{
              previewPolicy:'stochastic',candidateDecisionPolicy:version,opponentDecisionPolicy:'baseline'
            });
          if(g.trace.errors.length)throw Error('Illegal choice '+name+'/'+caseName+'/'+version+':'+JSON.stringify(g.trace.errors));
          const own=reversed?'p2':'p1',foe=reversed?'p1':'p2';
          const mySel=g.trace.selections.find(x=>x.side===own);
          const opponentSel=g.trace.selections.find(x=>x.side===foe);
          const won=reversed?g.winner==='opponent':g.winner==='candidate';
          by[version].wins+=Number(won);by[version].games++;
          by[version].cases[caseName]=(by[version].cases[caseName]||0)+Number(won);
          csv.write([name,caseName,version,i,seed.join('-'),own,Number(won),g.turns,
            mySel.chosen.join('/'),opponentSel.chosen.join('/'),g.trace.errors.length].join(',')+'\n');
          if(i===0){
            fs.writeFileSync(path.join(OUT,name+'_'+caseName+'_'+version+'.json'),
              JSON.stringify({seed,winner:g.winner,selections:g.trace.selections,choices:g.trace.choices},null,2));
          }
        }
      }
    }
    const baseline=by.baseline,v2=by.v2;
    results.push({candidate:name,baseline,v2,differenceWins:v2.wins-baseline.wins,
      differencePoints:(v2.wins-baseline.wins)/v2.games*100});
    console.log('AI-POLICY '+name+' baseline '+baseline.wins+'/'+baseline.games+' -> v2 '+v2.wins+'/'+v2.games+
      ' Δ '+(v2.wins-baseline.wins)+'; cases '+JSON.stringify(Object.fromEntries(
        CASES.map(k=>[k,[baseline.cases[k],v2.cases[k]]]))));
  }
  const summary={mode:'SAME_ROSTER_CANDIDATE_POLICY_ONLY_AB',
    expected:CANDIDATES.length*CASES.length*perCase*2,perCase,results,
    engine:process.env.RESEARCH_SHOWDOWN_COMMIT||'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
    warning:'Opposing policy fixed, synthetic population; win fraction is not ranked ladder win fraction.'};
  fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,2));
  await new Promise((ok,no)=>csv.end(e=>e?no(e):ok()));
  console.log('AI-POLICY A/B COMPLETED '+summary.expected);
  return summary;
}
if(require.main===module)run(args(process.argv.slice(2))).catch(e=>{console.error(e.stack||e);process.exitCode=1});
module.exports={run,args,CANDIDATES,CASES};
