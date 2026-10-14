#!/usr/bin/env node
'use strict';
// One-move tech A/B for both C and E, all opponents independently select 3.
// A new-threat development set plus existing eight public-six holdout lineups.
// Synthetic adversarial AI only; cannot infer ranked-play win probability.
const fs=require('node:fs'),path=require('node:path');
const {candidates}=require('./sand-counter-variants');
const {opponents:newThreats}=require('./threat-scenarios-20261014');
const {opponents:otherOpponents}=require('./holdout-opponents');
const {game,load,check,hashSeed,prelim,normalize}=require('./lab');
const OUT=path.join(__dirname,'output','sand-counter');
const OPP={...newThreats,...otherOpponents};
function args(argv){
 let perCase=80;
 for(let i=0;i<argv.length;i++){
  if(argv[i]==='--per-case')perCase=Number(argv[++i]);
  else throw Error('Unknown arg '+argv[i]);
 }
 if(!Number.isInteger(perCase)||perCase<1||perCase>200)throw Error('Expected per-case 1..200');
 return {perCase};
}
function validate(sim,pool){
 const validator=sim.TeamValidator.get('gen9championsbssregmc');
 for(const [name,team]of Object.entries(pool)){
  prelim(team,name);
  const issues=validator.validateTeam(normalize(team));
  if(issues?.length)throw Error(name+' illegal '+issues.join('; '));
 }
}
async function run({perCase}){
 const sim=load();check(sim);
 const pool=candidates(),caseNames=Object.keys(OPP),names=Object.keys(pool);
 validate(sim,pool);validate(sim,OPP);
 fs.mkdirSync(OUT,{recursive:true});
 const csv=fs.createWriteStream(path.join(OUT,'matches.csv'));
 csv.write('candidate,opponent_six,round,seed,side,win,our_three,opponent_three,lead,sun,psychic,mega_y,priority_blocked,turns,errors\n');
 const report={
  note:'7 roster configurations, each exactly one candidate species replaced with Tyranitar, 13 synthetic public-six opponents including two new threats; opponent may choose any three using public six.',
  codeVersion:process.env.GITHUB_SHA||'unknown',
  pinnedShowdown:process.env.RESEARCH_SHOWDOWN_COMMIT||'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
  perCase,cases:caseNames,results:[],pairFlips:[],completed:0,
  disclaimer:'Not real M-7 rank win rates or match-up probabilities.'
 };
 const rawByName={};
 for(const name of names){
  const team=pool[name],by={},raw={};rawByName[name]=raw;
  let wins=0,chooseScarf=0,sunBattles=0,winsSun=0,psyBattles=0,winsPsy=0,priorityBlocked=0;
  for(const [idx,scenario]of caseNames.entries()){
   let count=0,oppSelections={},ownSelections={},selectedTarget=0,activeSun=0,activePsychic=0,winSun=0,winPsychic=0;
   for(let i=0;i<perCase;i++){
    const seed=hashSeed(11400000+idx*40000+i),reversed=Boolean(i%2),full=i===0;
    const g=await game(sim,reversed?OPP[scenario]:team,reversed?team:OPP[scenario],
     seed,full,null,reversed,{previewPolicy:'strategic',candidateDecisionPolicy:'v3',opponentDecisionPolicy:'v2'});
    if(g.trace.errors.length)throw Error('Invalid action '+name+'/'+scenario+'/'+i+JSON.stringify(g.trace.errors));
    const own=reversed?'p2':'p1',theirs=reversed?'p1':'p2';
    const a=g.trace.selections.find(x=>x.side===own),b=g.trace.selections.find(x=>x.side===theirs);
    if(!a||!b||a.chosen.length!==3||b.chosen.length!==3)throw Error('Missing preview '+scenario);
    const win=reversed?g.winner==='opponent':g.winner==='candidate';
    wins+=Number(win);count+=Number(win);
    const target='Tyranitar';
    selectedTarget+=Number(a.chosen.includes(target));chooseScarf+=Number(a.chosen.includes(target));
    if(g.sunObserved){sunBattles++;activeSun++;winsSun+=Number(win);winSun+=Number(win);}
    if(g.psychicTerrainObserved){psyBattles++;activePsychic++;winsPsy+=Number(win);winPsychic+=Number(win);}
    priorityBlocked+=g.priorityBlocked;
    const mine=a.chosen.slice().sort().join('/'),their=b.chosen.slice().sort().join('/');
    ownSelections[mine]=(ownSelections[mine]||0)+1;oppSelections[their]=(oppSelections[their]||0)+1;
    raw[scenario+'|'+i]=Number(win);
    csv.write([name,scenario,i,seed.join('-'),own,Number(win),a.chosen.join('/'),b.chosen.join('/'),a.lead,
      Number(g.sunObserved),Number(g.psychicTerrainObserved),Number(g.megaCharizardObserved),
      g.priorityBlocked,g.turns,g.trace.errors.length].join(',')+'\n');
    if(full)fs.writeFileSync(path.join(OUT,name+'_'+scenario+'.log'),g.log+'\nDECISIONS\n'+JSON.stringify(g.trace,null,2));
    report.completed++;
   }
   by[scenario]={wins:count,total:perCase,chosenTarget:selectedTarget,sunBattles:activeSun,sunWins:winSun,
    psychicBattles:activePsychic,psychicWins:winPsychic,ownSelections,opponentSelections:oppSelections};
  }
  const row={name,wins,games:caseNames.length*perCase,rate:wins/(caseNames.length*perCase),
    tyranitarSelected:chooseScarf,sunBattles,winsSun,psyBattles,winsPsy,priorityBlocked,by};
  report.results.push(row);
  fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(report,null,2));
  console.log('SAND COUNTER '+name+' '+wins+'/'+row.games+' rate '+(row.rate*100).toFixed(2)+
    '% sun '+winsSun+'/'+sunBattles+' psychic '+winsPsy+'/'+psyBattles+' tyranitarChosen '+chooseScarf+
    ' charY '+by.sun_charizard_y.wins+' psychCredible '+by.psychic_terrain_credible.wins);
 }
 for(const name of names){
  const base=name.startsWith('C')?'C0_standard':'E0_standard';
  if(name===base)continue;
  let loseToWin=0,winToLose=0;
  for(const [key,win]of Object.entries(rawByName[name])){
   const old=rawByName[base][key];
   if(old===0&&win===1)loseToWin++;
   if(old===1&&win===0)winToLose++;
  }
  report.pairFlips.push({name,control:base,loseToWin,winToLose,net:loseToWin-winToLose});
 }
 await new Promise((resolve,reject)=>csv.end(e=>e?reject(e):resolve()));
 fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(report,null,2));
 console.log('SAND COUNTER TOTAL '+report.completed+' games, pair flips '+JSON.stringify(report.pairFlips));
 return report;
}
if(require.main===module)run(args(process.argv.slice(2))).catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
module.exports={run,args,validate,OPP};
