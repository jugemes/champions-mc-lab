#!/usr/bin/env node
'use strict';
// Identical public six, exact Showdown revision, seeds and player-side parity.
// Opponent chooses own 3 from our public six (NO fixed opponent 3).
// Compare each move replacement against C0 without retuning the bot or team.
const fs=require('node:fs');
const path=require('node:path');
const {teamsForMoveAudit}=require('./garchomp-move-variants');
const {opponents:development}=require('./preview-opponents');
const {opponents:holdout}=require('./holdout-opponents');
const {load,check,game,hashSeed,prelim,normalize}=require('./lab');
const OUT=path.join(__dirname,'output','garchomp-move-audit');
const CASES={development,holdout};
const POLICIES=['baseline','v2'];
function args(argv){
 let count=100;
 for(let i=0;i<argv.length;i++){
  if(argv[i]==='--per-case')count=Number(argv[++i]);
  else throw Error('Unknown option: '+argv[i]);
 }
 if(!Number.isInteger(count)||count<1||count>200)throw Error('--per-case must be 1..200');
 return {count};
}
function assertLegal(sim,teams){
 const v=sim.TeamValidator.get('gen9championsbssregmc');
 for(const [name,team] of Object.entries(teams)){
  prelim(team,name);
  const errors=v.validateTeam(normalize(team));
  if(errors?.length)throw Error('Invalid '+name+': '+errors.join('; '));
 }
}
function trialId(pool,policy,caseName,i){return [pool,policy,caseName,i].join('|');}
async function run({count}){
 const sim=load();check(sim);
 const candidates=teamsForMoveAudit();
 assertLegal(sim,candidates);
 for(const [pool,opponents] of Object.entries(CASES))
  assertLegal(sim,Object.fromEntries(Object.entries(opponents).map(([n,t])=>[pool+'_'+n,t])));
 fs.mkdirSync(OUT,{recursive:true});
 const csv=fs.createWriteStream(path.join(OUT,'games.csv'));
 csv.write('candidate,pool,enemy_policy,public_opponent_six,index,seed,seat,win,turns,own_three,opponent_three,own_lead,opponent_lead,errors\n');
 const records={},summary={engine:process.env.RESEARCH_SHOWDOWN_COMMIT||
  '3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
  rules:'gen9championsbssregmc',
  note:'Synthetic public-six / independent-three decision AI. This is NOT ranked-play win rate. Holdout lineups were previously tested during C/E design.',
  countPerPair:count,policies:POLICIES,
  pools:Object.fromEntries(Object.entries(CASES).map(([pool,cases])=>[pool,Object.fromEntries(
    Object.entries(cases).map(([name,team])=>[name,team.map(p=>p.species)]))])),
  results:[],comparisons:[],completed:0};
 for(const [name,team] of Object.entries(candidates)){
  let allWins=0,allGames=0,allGarchomp=0;
  const by={};records[name]={};
  for(const [pool,opponents] of Object.entries(CASES)){
   for(const oppPolicy of POLICIES){
    for(const [idx,caseName] of Object.keys(opponents).entries()){
     let wins=0,garchompSelections=0,ownCombos=new Set(),opponentCombos=new Set(),errors=0;
     for(let i=0;i<count;i++){
      const seed=hashSeed(6900000+
       (pool==='holdout'?1000000:0)+(oppPolicy==='v2'?500000:0)+idx*30000+i);
      const reverse=Boolean(i%2),capture=i===0;
      const g=await game(sim,
        reverse?opponents[caseName]:team,
        reverse?team:opponents[caseName],
        seed,capture,null,reverse,{
         previewPolicy:'stochastic',
         candidateDecisionPolicy:'v2',
         opponentDecisionPolicy:oppPolicy
        });
      const mySide=reverse?'p2':'p1',theirSide=reverse?'p1':'p2';
      const selected=g.trace.selections.find(x=>x.side===mySide);
      const enemy=g.trace.selections.find(x=>x.side===theirSide);
      if(!selected||!enemy||g.trace.errors.length)throw Error('Invalid experiment '+name+' '+pool+
       ' '+caseName+' '+i+' '+JSON.stringify(g.trace.errors));
      const win=reverse?g.winner==='opponent':g.winner==='candidate';
      wins+=Number(win);
      allWins+=Number(win);allGames++;
      const isGarchomp=selected.chosen.includes('Garchomp');
      if(isGarchomp)garchompSelections++;
      allGarchomp+=Number(isGarchomp);
      ownCombos.add(selected.chosen.slice().sort().join('/'));
      opponentCombos.add(enemy.chosen.slice().sort().join('/'));
      records[name][trialId(pool,oppPolicy,caseName,i)]=Number(win);
      csv.write([name,pool,oppPolicy,caseName,i,seed.join('-'),mySide,Number(win),
       g.turns,selected.chosen.join('/'),enemy.chosen.join('/'),selected.lead,enemy.lead,0].join(',')+'\n');
      if(capture){
        const id=[name,pool,oppPolicy,caseName].join('_');
        fs.writeFileSync(path.join(OUT,id+'.log'),g.log+'\nCHOICES\n'+JSON.stringify(g.trace,null,2));
      }
      summary.completed++;
     }
     const key=pool+'|'+oppPolicy+'|'+caseName;
     by[key]={wins,total:count,usedGarchomp:garchompSelections,
       ownSelectionCombinations:ownCombos.size,enemySelectionCombinations:opponentCombos.size};
    }
   }
  }
  const row={candidate:name,wins:allWins,games:allGames,rate:allWins/allGames,
   garchompSelected:allGarchomp,by};
  summary.results.push(row);
  fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,2));
  console.log('GARCHOMP TECH '+name+' '+allWins+'/'+allGames+' ('+(row.rate*100).toFixed(2)+
   '% synthetic), Garchomp picked '+allGarchomp+'/'+allGames);
 }
 const base=records.C0_Earthquake;
 for(const row of summary.results){
  if(row.candidate==='C0_Earthquake')continue;
  let loseToWin=0,winToLose=0,ties=0;
  for(const [key,win] of Object.entries(records[row.candidate])){
    if(!(key in base))throw Error('Unpaired seed '+key);
    if(base[key]===0&&win===1)loseToWin++;
    else if(base[key]===1&&win===0)winToLose++;
    else ties++;
  }
  summary.comparisons.push({against:'C0_Earthquake',candidate:row.candidate,
   loseToWin,winToLose,sameOutcome:ties,differenceWins:loseToWin-winToLose});
 }
 summary.results.sort((a,b)=>b.wins-a.wins||a.candidate.localeCompare(b.candidate));
 fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,2));
 await new Promise((resolve,reject)=>csv.end(err=>err?reject(err):resolve()));
 console.log('GARCHOMP MOVE AUDIT FINISHED '+summary.completed+' real BattleStream games.');
 console.log('PAIRED COMPARISONS '+JSON.stringify(summary.comparisons));
 return summary;
}
if(require.main===module)run(args(process.argv.slice(2))).catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={run,args,assertLegal,trialId,CASES,POLICIES};
