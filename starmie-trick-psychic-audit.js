#!/usr/bin/env node
'use strict';
// Audit full actual Starmie Trick/Scarf interactions, not just AI team win ratios.
// Only E team's Scarf Starmie 4th move differs: Trick vs Psychic.
// Identical public sixes, seeds, side assignments, and opponent policy; no
// forced opponent three, no privately known opponent sets on acting agent.
const fs=require('node:fs'),path=require('node:path');
const {variants}=require('./starmie-trick-psychic-variants');
const {opponents:dev}=require('./preview-opponents');
const {opponents:holdout}=require('./holdout-opponents');
const {opponents:threats}=require('./threat-scenarios-20261014');
const {load,check,prelim,normalize,hashSeed,game}=require('./lab');
const OUT=path.join(__dirname,'output','starmie-trick-psychic');
const CASES={
 ...Object.fromEntries(Object.entries(dev).map(([k,v])=>['dev_'+k,v])),
 ...Object.fromEntries(Object.entries(holdout).map(([k,v])=>['holdout_'+k,v])),
 ...Object.fromEntries(Object.entries(threats).map(([k,v])=>['threat_'+k,v]))
};
const POLICIES=['baseline','v2'];
function args(v){
 let perPair=100;
 for(let i=0;i<v.length;i++){
  if(v[i]==='--per-pair')perPair=Number(v[++i]);
  else throw Error('Unknown argument '+v[i]);
 }
 if(!Number.isInteger(perPair)||perPair<1||perPair>200)throw Error('Expected --per-pair between 1 and 200');
 return {perPair};
}
function validate(sim,pool){
 const validator=sim.TeamValidator.get('gen9championsbssregmc');
 for(const [name,team]of Object.entries(pool)){
  prelim(team,name);
  const issue=validator.validateTeam(normalize(team));
  if(issue?.length)throw Error(name+' illegal: '+issue.join('; '));
 }
}
function extractStarmieUse(log,side){
 const lines=log.split('\n');let trick=0,swap=0,failed=0,psychic=0,targets=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i],parts=line.split('|');
  if(parts[1]!=='move'||!parts[2]?.startsWith(side+'a: Starmie'))continue;
  if(parts[3]==='Trick'){
   trick++;targets.push(String(parts[4]||'').trim());
   // The same turn must show two explicit Trick item exchanges.
   const tail=lines.slice(i+1,i+10).join('\n');
   if(/\|-item\|[^|\n]+\|Choice Scarf\|\[from\] move: Trick/.test(tail))swap++;
   if(/\|-fail\|/.test(tail))failed++;
  }
  if(parts[3]==='Psychic')psychic++;
 }
 return {trick,swap,failed,psychic,targets};
}
function summarize(r){
 return {games:r.games,wins:r.wins,starmieSelected:r.starmieSelected,
  actualTrickUses:r.actualTrickUses,actualTrickSuccesses:r.actualTrickSuccesses,
  actualTrickFailed:r.actualTrickFailed,trickUsedGames:r.trickUsedGames,
  trickUsedWins:r.trickUsedWins,psychicUses:r.psychicUses,
  psychicUsedGames:r.psychicUsedGames,psychicUsedWins:r.psychicUsedWins};
}
async function run({perPair}){
 const sim=load();check(sim);
 const sets=variants();
 validate(sim,sets);validate(sim,CASES);
 fs.mkdirSync(OUT,{recursive:true});
 const csv=fs.createWriteStream(path.join(OUT,'matches.csv'));
 csv.write('variant,public_enemy_six,enemy_policy,index,seed,side,win,our_three,enemy_three,lead,turns,trick_uses,trick_swaps,trick_fails,trick_target,psychic_uses,errors\n');
 const summary={mode:'ONE_MOVE_MATCHED_TEAM_SCARF_STARMIE_TRICK_VS_PSYCHIC',
  engine:process.env.RESEARCH_SHOWDOWN_COMMIT||'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
  disclaimer:'All outcomes are artificial independent six-to-three AI matches, not human ladder probabilities.',
  perPair,opponentPacks:['dev','holdout','threat'],
  caseNames:Object.keys(CASES),policies:POLICIES,results:{},byCase:{},pairedFlips:[],pairedDetailed:[],completed:0};
 const outcomes={},caseNames=Object.keys(CASES),saveLogs=[];
 for(const [name,team]of Object.entries(sets)){
  const r={games:0,wins:0,starmieSelected:0,actualTrickUses:0,actualTrickSuccesses:0,
   actualTrickFailed:0,trickUsedGames:0,trickUsedWins:0,psychicUses:0,
   psychicUsedGames:0,psychicUsedWins:0};
  summary.byCase[name]={};outcomes[name]={};
  for(const [idx,scenario]of caseNames.entries())for(const enemyPolicy of POLICIES){
   let caseWins=0,caseStarmie=0,caseTricks=0,caseSwaps=0,caseTrickWins=0,casePsychic=0,casePsychicWins=0;
   for(let i=0;i<perPair;i++){
    const seed=hashSeed(13300000+idx*20000+(enemyPolicy==='v2'?1000000:0)+i);
    const reversed=Boolean(i%2),ownSide=reversed?'p2':'p1';
    const g=await game(sim,reversed?CASES[scenario]:team,reversed?team:CASES[scenario],
      seed,true,null,reversed,{
        previewPolicy:'strategic',
        candidatePreviewPolicy:'strategic',opponentPreviewPolicy:'strategic',
        candidateDecisionPolicy:'v3',opponentDecisionPolicy:enemyPolicy
      });
    if(g.trace.errors.length)throw Error('Invalid move '+name+'/'+scenario+'/'+i+JSON.stringify(g.trace.errors));
    const selected=g.trace.selections.find(x=>x.side===ownSide);
    const opponent=g.trace.selections.find(x=>x.side===(reversed?'p1':'p2'));
    if(!selected||!opponent||selected.chosen.length!==3||opponent.chosen.length!==3)
      throw Error('Selection failed');
    const win=reversed?g.winner==='opponent':g.winner==='candidate';
    const actual=extractStarmieUse(g.log,ownSide);
    const chosen=Number(selected.chosen.includes('Starmie'));
    r.games++;r.wins+=Number(win);
    r.starmieSelected+=chosen;caseStarmie+=chosen;
    r.actualTrickUses+=actual.trick;r.actualTrickSuccesses+=actual.swap;
    r.actualTrickFailed+=actual.failed;
    r.trickUsedGames+=Number(actual.trick>0);r.trickUsedWins+=Number(actual.trick>0&&win);
    r.psychicUses+=actual.psychic;
    r.psychicUsedGames+=Number(actual.psychic>0);r.psychicUsedWins+=Number(actual.psychic>0&&win);
    caseWins+=Number(win);caseTricks+=actual.trick;caseSwaps+=actual.swap;
    caseTrickWins+=Number(actual.trick>0&&win);
    casePsychic+=actual.psychic;casePsychicWins+=Number(actual.psychic>0&&win);
    const key=scenario+'|'+enemyPolicy+'|'+i;
    outcomes[name][key]={win:Number(win),log:g.log,selected:selected.chosen,enemySelected:opponent.chosen,
      actual,seed,side:ownSide};
    csv.write([name,scenario,enemyPolicy,i,seed.join('-'),ownSide,Number(win),
     selected.chosen.join('/'),opponent.chosen.join('/'),selected.lead,g.turns,
     actual.trick,actual.swap,actual.failed,actual.targets.join('/'),actual.psychic,g.trace.errors.length].join(',')+'\n');
    if(actual.trick>0&&saveLogs.length<32)saveLogs.push({name,scenario,enemyPolicy,i,log:g.log});
    summary.completed++;
   }
   const label=scenario+'|'+enemyPolicy;
   summary.byCase[name][label]={wins:caseWins,total:perPair,starmieSelected:caseStarmie,
     trickUses:caseTricks,successfulSwaps:caseSwaps,winAfterTrick:caseTrickWins,
     psychicUses:casePsychic,winAfterPsychic:casePsychicWins};
  }
  summary.results[name]=summarize(r);
  console.log('STARMIE A/B '+name+': '+r.wins+'/'+r.games+'; selected '+r.starmieSelected+
    ', Trick '+r.actualTrickUses+' ('+r.actualTrickSuccesses+' item swaps; '+r.trickUsedWins+
    ' won among Trick-using games); Psychic '+r.psychicUses);
  fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,2));
 }
 let trickWinPsychicLose=0,trickLosePsychicWin=0,pairedTrickUseWon=0,pairedTrickUseLost=0;
 for(const [key,base]of Object.entries(outcomes.E_trick)){
  const replacement=outcomes.E_psychic[key];
  if(!replacement)throw Error('Missing paired trial '+key);
  if(base.win===1&&replacement.win===0){
    trickWinPsychicLose++;
    if(base.actual.trick>0){
      pairedTrickUseWon++;
      if(saveLogs.length<50)saveLogs.push({name:'E_trick_win_Psychic_loss',key,log:base.log+
        '\n========PSYCHIC COUNTERFACTUAL========\n'+replacement.log});
    }
  }
  if(base.win===0&&replacement.win===1){
    trickLosePsychicWin++;
    if(base.actual.trick>0){
      pairedTrickUseLost++;
      if(saveLogs.length<50)saveLogs.push({name:'E_trick_loss_Psychic_win',key,log:base.log+
        '\n========PSYCHIC COUNTERFACTUAL========\n'+replacement.log});
    }
  }
 }
 summary.pairedFlips={trickWinPsychicLose,trickLosePsychicWin,
  trickUsedAndTrickVariantOnlyWon:pairedTrickUseWon,trickUsedAndPsychicVariantOnlyWon:pairedTrickUseLost};
 for(const sample of saveLogs){
  const safe=[sample.name,sample.scenario,sample.enemyPolicy,sample.i].filter(x=>x!==undefined).join('_').replace(/[^a-zA-Z0-9_-]/g,'_');
  fs.writeFileSync(path.join(OUT,'case_'+safe+'.log'),sample.log);
 }
 await new Promise((ok,fail)=>csv.end(err=>err?fail(err):ok()));
 fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify(summary,null,2));
 console.log('STARMIE A/B COMPLETED '+summary.completed+' actual battles. '+JSON.stringify(summary.pairedFlips));
 return summary;
}
if(require.main===module)run(args(process.argv.slice(2))).catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={run,args,extractStarmieUse,validate};
