#!/usr/bin/env node
'use strict';
/**
 * Out-of-focus archetype regression for three exploratory trio treatments
 * chosen after ONLY the 01/03/06/07 focus results.
 * The remaining ten were already designed/used as regression fixtures,
 * so they are not an independent real ladder sample. All enemy threes are
 * specified EXTERNALLY and never passed to our preview-policy scorer.
 */
const fs=require('node:fs'),path=require('node:path');
const {load,game,hashSeed}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {createCases}=require('./m8-baseline-core');
const {focus}=require('./m8-counterfactual-selection');
const sim=load(),own=reportedLive();
const treatments=[
 {name:'rational-public-six',fixed:null},
 {name:'primarina-steel-dragon',fixed:['Primarina','Metagross','Hydreigon']},
 {name:'scarf-dragon-fairy',fixed:['Garchomp','Metagross','Primarina']},
 {name:'sand-dark-dragon',fixed:['Tyranitar','Hydreigon','Garchomp']}
];
async function main(){
 const cases=createCases(groups).map((x,index)=>({...x,index}))
   .filter(x=>!focus.includes(x.group));
 if(cases.length!==40)throw Error('Expected 10 non-focus sixes x 4 forced/order conditions');
 const items=[];
 for(const config of cases){
  const scores={};
  for(const t of treatments){
   const seed=hashSeed(1500000+config.index*37); // identical baseline seeds
   const options={
     megaAware:true,candidatePreviewPolicy:'rational-top',
     opponentPreviewPolicy:'rational',
     candidateDecisionPolicy:'v3-public-immunity',
     opponentDecisionPolicy:'v3-public-immunity',
     opponentForced:config.enemyThree
   };
   if(t.fixed)options.candidateForced=[...t.fixed];
   const battle=await game(sim,
     config.reversed?config.enemySix:own,
     config.reversed?own:config.enemySix,
     seed,false,null,config.reversed,options);
   if(battle.trace.errors.length)throw Error('illegal action: '+config.group+
     ' '+t.name+' '+JSON.stringify(battle.trace.errors));
   const side=config.reversed?'p2':'p1';
   const chosen=battle.trace.selections.find(x=>x.side===side);
   if(t.fixed&&chosen.chosen.join('/')!==t.fixed.join('/'))
     throw Error('Counterfactual own trio changed based on opponent hidden three');
   scores[t.name]={
    won:battle.winner===(config.reversed?'opponent':'candidate'),
    chosen:chosen.chosen,lead:chosen.lead,
    turns:battle.turns
   };
  }
  items.push({group:config.group,
   forcedKind:config.forcedKind,reversed:config.reversed,
   enemyThreePostGame:config.enemyThree,
   publicSix:config.publicSix,scores});
 }
 const summaries=[];
 for(const g of groups.filter(g=>!focus.includes(g.name))){
  const rows=items.filter(x=>x.group===g.name);
  summaries.push({group:g.name,scores:Object.fromEntries(treatments.map(t=>[
    t.name,rows.filter(x=>x.scores[t.name].won).length
  ])),risk:'constructed-rival-three and v3-public-immunity Bot, not actual ranked meta'});
 }
 const baseline=summaries.reduce((s,x)=>s+x.scores['rational-public-six'],0);
 const r={total:items.length,groups:summaries.length,
  baselineWins:baseline,candidateWins:Object.fromEntries(treatments.slice(1).map(t=>[
   t.name,summaries.reduce((s,x)=>s+x.scores[t.name],0)
  ])),summaries,
  limitation:'Post-hoc candidates from four focus groups and ten synthetic off-focus groups; no actual ladder data, no rank winrate, opponent AI still imperfect'};
 const dir=path.join('output','m8-preseason');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'cross-archetype-report.json'),JSON.stringify({
  treatments,summary:r,rows:items
 },null,2));
 const markdown=[
  '# Next-season cross-archetype regression for proposed fixed trios',
  '',
  'The 01/03/06/07 focus groups suggested these trios. This file checks them unchanged against the other TEN constructed opponent sixes. Outcomes are **not** M-8 rank win probabilities.',
  '',
  '| Opponent group | rational-top | Primarina/Metagross/Hydreigon | Garchomp/Metagross/Primarina | Tyranitar/Hydreigon/Garchomp |',
  '|---|---:|---:|---:|---:|',
  ...summaries.map(x=>'| '+x.group+' | '+
    ['rational-public-six','primarina-steel-dragon','scarf-dragon-fairy','sand-dark-dragon'].map(k=>x.scores[k]+'/4').join(' | ')+' |'),
  '',
  'Totals: '+JSON.stringify(r.candidateWins)+' versus rational-top '+r.baselineWins+'/40.',
  '',
  '**NEVER** train a preview using the actual opponent chosen three. Those threes appear in postgame metrics only.',
  'Promotion requires turn-level opponent-rationality review, varied independent human battle cases, and user approval. These fixed-three trials are diagnostics, not blanket recommendations.'
 ].join('\n');
 fs.writeFileSync(path.join(dir,'cross-archetype-report.md'),markdown);
 console.log('M8_CROSS_ARCHETYPE_SUMMARY '+JSON.stringify(r));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
