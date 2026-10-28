#!/usr/bin/env node
'use strict';
/**
 * Reg M-C lasts through 2026-12-02; this M-8 readiness benchmark is a
 * reproducible stress regression, NOT an M-8 usage sample or a ladder
 * win-probability model. The live six MUST remain unchanged.
 */
const fs=require('node:fs'),path=require('node:path');
const {game,load,hashSeed}=require('./lab');
const {reportedLive,UNVERIFIED}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {rankRationalPreview}=require('./preview-rational');
const {screenMegaCoverage}=require('./engine-mega-preview');
const {createCases,summarize}=require('./m8-baseline-core');
const sim=load(),ownSix=reportedLive(),fingerprint=JSON.stringify(ownSix);
async function run(){
 const cases=createCases(groups);
 const rows=[],threats=[];
 for(const g of groups){
  const ranks=rankRationalPreview(sim.Dex.mod('champions'),ownSix,g.team.map(x=>x.species));
  const top=ranks[0];
  const mega=screenMegaCoverage(sim,ownSix,g.team.map(x=>x.species),{sampleLimit:1});
  threats.push({group:g.name,tags:g.tags,
   publicSix:g.team.map(x=>x.species),
   defaultThree:top.three.map(i=>ownSix[i].species),
   defaultLead:ownSix[top.leads[0].i].species,
   hypotheticalMegas:mega.perFoe.map(foe=>({
     species:foe.species,item:foe.item,againstAssumedMega:foe.byMember
       .map(x=>({ourSpecies:x.member,bestDamageFraction:+x.damage.toFixed(3),
         move:x.move})).sort((a,b)=>b.bestDamageFraction-a.bestDamageFraction)
   }))});
 }
 for(let c=0;c<cases.length;c++){
  const conf=cases[c],seed=hashSeed(1500000+c*37),ownSide=conf.reversed?'p2':'p1';
  const policies=[
   ['old','v3'],
   ['mutualLearning','v3-public-immunity']
  ],results={};
  for(const [label,policy]of policies){
   const options={
    megaAware:true,candidatePreviewPolicy:'rational-top',
    opponentPreviewPolicy:'rational',
    candidateDecisionPolicy:policy,opponentDecisionPolicy:policy,
    opponentForced:conf.enemyThree
   };
   const one=conf.reversed?conf.enemySix:ownSix;
   const two=conf.reversed?ownSix:conf.enemySix;
   const battle=await game(sim,one,two,seed,false,null,conf.reversed,options);
   if(battle.trace.errors.length)throw Error(
     conf.group+' '+label+' rejected a legal action: '+JSON.stringify(battle.trace.errors));
   const selection=battle.trace.selections.find(s=>s.side===ownSide);
   if(!selection)throw Error('No own selection recorded');
   const foeSide=ownSide==='p1'?'p2':'p1';
   const oppSelection=battle.trace.selections.find(s=>s.side===foeSide);
   if(!oppSelection||oppSelection.chosen.join('/')!==conf.enemyThree.join('/'))
    throw Error('Forced enemy selection mismatch');
   results[label]={
    won:battle.winner===(conf.reversed?'opponent':'candidate'),
    selected:[...selection.chosen],lead:selection.lead,turns:battle.turns,
    ownLearned:battle.trace.immuneObservations.filter(x=>x.side===ownSide).length,
    foeLearned:battle.trace.immuneObservations.filter(x=>x.side===foeSide).length,
    ownFirstActions:battle.trace.choices.filter(x=>x.side===ownSide).slice(0,6),
    foeFirstActions:battle.trace.choices.filter(x=>x.side===foeSide).slice(0,6)
   };
  }
  if(results.old.selected.join('/')!==results.mutualLearning.selected.join('/')||
     results.old.lead!==results.mutualLearning.lead)
    throw Error('Turn decision policy unexpectedly changed preview selection');
  const row={group:conf.group,tags:conf.tags,
   forcedKind:conf.forcedKind,reversed:conf.reversed,seed,
   publicSix:conf.publicSix,enemyThreeAfterwards:conf.enemyThree,
   old:results.old,mutualLearning:results.mutualLearning};
  rows.push(row);
  console.log('M8_BASELINE_CASE '+JSON.stringify({
   group:row.group,forcedKind:row.forcedKind,reversed:row.reversed,seed,
   ownThree:row.old.selected,lead:row.old.lead,
   oldWon:row.old.won,mutualLearningWon:row.mutualLearning.won,
   mutualLearningOwnEvents:row.mutualLearning.ownLearned,
   mutualLearningFoeEvents:row.mutualLearning.foeLearned
  }));
 }
 if(JSON.stringify(reportedLive())!==fingerprint)throw Error('Live roster mutated during research');
 const summary=summarize(rows);
 const dir=path.join('output','m8-preseason');
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'baseline-summary.json'),JSON.stringify({
  dated:'2026-10-28',format:'gen9championsbssregmc',
  pinnedShowdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
  liveSix:ownSix,unverifiedFields:UNVERIFIED,summary
 },null,2));
 fs.writeFileSync(path.join(dir,'case-results.json'),JSON.stringify(rows,null,2));
 fs.writeFileSync(path.join(dir,'hypothetical-mega-matrix.json'),JSON.stringify(threats,null,2));
 const md=[
  '# Next season M-C baseline: 14 constructed adversary archetypes',
  '',
  '> Not new M-8 ladder data. Regulation M-C lasts until Dec 2, 2026, but real usage may change in the new season.',
  '> Live six is unchanged. Each matchup uses two constructed forced opponent threes, both player orders and the same seed for old v3 vs both agents with public immunity awareness.',
  '',
  '| Synthetic group | Old Bot wins / 4 | Both publicly immunity-aware wins / 4 | Divergent outcomes | Top own 3 (rational heuristic) |',
  '|---|---:|---:|---:|---|',
  ...summary.groupsRankedForReview.map(g=>{
    const t=threats.find(x=>x.group===g.group);
    return '| '+g.group+' | '+g.oldWins+'/4 | '+g.mutualLearningWins+'/4 | '+g.changedResults+' | '+t.defaultThree.join(', ')+' |';
  }),
  '',
  '**Aggregate**: old '+summary.winOld+'/'+summary.cases+
   ', both agents public-immunity-aware '+summary.winBoth+'/'+summary.cases+'.',
  '**NOT** ladder win rates, real use frequency, opponent AI rationality proof or statistical validation.',
  '',
  '## Priority for human review',
  ...summary.groupsRankedForReview.slice(0,7).map(g=>'- '+g.group+
    ': both sides improved='+g.mutualLearningWins+'/4, old='+g.oldWins+
    '/4, selection='+g.selections.map(x=>x.three+' ('+x.n+')').join('; ')),
  '',
  '## Specific missing evidence for accepting a team change',
  '1. Actual human battle case or reliable ladder composition supporting the threat, not invented opposing three.',
  '2. Both rival and own action AI choose reasonable attacks, setup and switches under public information.',
  '3. Identical-opponent, identical-seed tests for a **single** proposed change with opposite-side replay.',
  '4. Holdout archetypes and opponent-Mega/base branch coverage, plus scenario logs explaining a real win line.',
  '5. No changes to live sets/points until the user explicitly approves.',
  '',
  '## Known uncertain reported-live properties',
  ...UNVERIFIED.map(x=>'- '+x.species+' '+x.field+': '+x.value+' (unverified)'),
  ''
 ].join('\n');
 fs.writeFileSync(path.join(dir,'review.md'),md);
 console.log('M8_BASELINE_SUMMARY '+JSON.stringify({
  n:summary.cases,groups:summary.groups,
  oldWins:summary.winOld,mutualLearningWins:summary.winBoth,
  changedResults:summary.changedResults,
  weakest:summary.groupsRankedForReview.slice(0,7).map(x=>({
   name:x.group,oldWins:x.oldWins,bothWins:x.mutualLearningWins
  }))
 }));
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
