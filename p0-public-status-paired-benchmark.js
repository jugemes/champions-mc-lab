#!/usr/bin/env node
'use strict';
/**
 * Honest AI status-quality benchmark (M-C): identical synthetic public 6,
 * post-preview opposing forced A/B three, sides and random seeds for
 * legacy v3-public-immunity versus opt-in v4-public-status.
 * Assess public failed status-action rates; no private enemy info to bot.
 * A lower failed action rate is a rationality signal, NOT human win rate.
 */
const fs=require('node:fs'),path=require('node:path');
const {game,load,hashSeed}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {createCases}=require('./m8-baseline-core');
const sim=load(),six=reportedLive(),baseline=JSON.stringify(six);
function publicActionFailures(log){
 const out={total:0,encore:0,statusFailures:0,immunities:0,statusMoves:0,encoreUses:0};
 let lastOwn='',lastEnemy='';
 for(const raw of String(log).split('\n')){
  const a=raw.split('|');
  if(a[1]==='move'){
   const foe=a[2]?.startsWith('p2a:'),own=a[2]?.startsWith('p1a:');
   if(foe||own){
    const move=a[3],side=foe?'p2':'p1';
    out.total++;
    if(move==='Encore')out.encoreUses++;
    if(['Encore','Swords Dance','Nasty Plot','Dragon Dance','Quiver Dance','Will-O-Wisp'].includes(move))out.statusMoves++;
    if(side==='p1')lastOwn=move;
    else lastEnemy=move;
   }
  }
  if(a[1]==='-fail'){
   out.statusFailures++;
   if(lastOwn==='Encore'||lastEnemy==='Encore')out.encore++;
  }
  if(a[1]==='-immune')out.immunities++;
 }
 return out;
}
async function main(){
 const rows=[];
 for(const [i,c]of createCases(groups).entries()){
  const seed=hashSeed(4100000+i*17);
  const outcomes={};
  for(const label of ['v3-public-immunity','v4-public-status']){
   const opts={megaAware:true,candidatePreviewPolicy:'rational-top',
    opponentPreviewPolicy:'rational',
    candidateDecisionPolicy:label,opponentDecisionPolicy:label,
    opponentForced:c.enemyThree};
   const g=await game(sim,c.reversed?c.enemySix:six,
    c.reversed?six:c.enemySix,seed,true,null,c.reversed,opts);
   if(g.trace.errors.length)throw Error('Bot invalid action '+label+' '+c.group+':'+JSON.stringify(g.trace.errors));
   const ownSide=c.reversed?'p2':'p1';
   const own=g.trace.selections.find(x=>x.side===ownSide);
   const foe=g.trace.selections.find(x=>x.side!==ownSide);
   if(!own||!foe||foe.chosen.join('/')!==c.enemyThree.join('/'))
    throw Error('Invalid selection / forced stress issue');
   outcomes[label]={won:g.winner===(c.reversed?'opponent':'candidate'),
    ownThree:own.chosen,ownLead:own.lead,
    opponentThreePosthoc:foe.chosen,foeLead:foe.lead,
    turns:g.turns,failedActions:publicActionFailures(g.log),
    ownChoices:g.trace.choices.filter(x=>x.side===ownSide).slice(0,10),
    enemyChoices:g.trace.choices.filter(x=>x.side!==ownSide).slice(0,10)};
  }
  if(JSON.stringify(outcomes['v3-public-immunity'].ownThree)!==
     JSON.stringify(outcomes['v4-public-status'].ownThree))
   throw Error('Different preview with only a turn policy change');
  rows.push({group:c.group,seed,reverse:c.reversed,forcedKind:c.forcedKind,
   publicSix:c.publicSix,assumedFoeThreeAfterSelection:c.enemyThree,
   old:outcomes['v3-public-immunity'],v4:outcomes['v4-public-status']});
 }
 if(JSON.stringify(reportedLive())!==baseline)throw Error('live roster changed');
 const summarize=k=>({
  wins:rows.filter(x=>x[k].won).length,
  matches:rows.length,
  failedStatusActions:rows.reduce((a,r)=>a+r[k].failedActions.statusFailures,0),
  failedEncoreEvents:rows.reduce((a,r)=>a+r[k].failedActions.encore,0),
  encoreUses:rows.reduce((a,r)=>a+r[k].failedActions.encoreUses,0),
  publicImmunityEvents:rows.reduce((a,r)=>a+r[k].failedActions.immunities,0),
  statusUses:rows.reduce((a,r)=>a+r[k].failedActions.statusMoves,0)
 });
 const summary={
  baseline:summarize('old'),statusAware:summarize('v4'),
  changedOutcome:rows.filter(r=>r.old.won!==r.v4.won).length,
  groups:groups.map(g=>({
   group:g.name,
   baseline:rows.filter(r=>r.group===g.name&&r.old.won).length,
   statusAware:rows.filter(r=>r.group===g.name&&r.v4.won).length
  })),
  limitations:[
   'Opponent A/B threes and all 14 public sixes are fully constructed; no real human 3v3 observations',
   'The bot never receives opponent private three/items/moves; the audit parses battle output AFTER the game',
   'A zero Encore failure count may mean no AI ever selected Encore; it does NOT prove realistic Encore timing',
   'Status-fail count includes failed damage/status interactions; inspect traces before attributing a change',
   'Even success in pinned Showdown mechanics and all AI trials is not evidence of ladder performance',
   'No user real ranked six was changed; no adoption decision is implied'
  ]
 };
 fs.mkdirSync('output/p0-public-status',{recursive:true});
 fs.writeFileSync('output/p0-public-status/paired-report.json',JSON.stringify({summary,rows},null,2));
 console.log('P0_PUBLIC_STATUS_COMPARE '+JSON.stringify(summary));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
