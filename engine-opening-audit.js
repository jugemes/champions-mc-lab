#!/usr/bin/env node
'use strict';
/**
 * Hypothetical two-turn opening branch audit, NOT a ladder simulation,
 * not evidence the bot has yet learned to select the right three.
 */
const {load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {checkOpeningBranches}=require('./engine-opening-branches');
const sim=load(),own=reportedLive();
async function main(){
 for(const gname of ['01_M7_golisopod_balance','03_M7_charizardY_offense','07_M7_baxcalibur_offense']){
  const g=groups.find(x=>x.name===gname),publicSix=g.team.map(x=>x.species);
  const openings=[
    ['Rotom-Wash','Metagross','Hydreigon'],
    ['Hydreigon','Garchomp','Tyranitar'],
    ['Tyranitar','Hydreigon','Garchomp'],
    ['Metagross','Hydreigon','Garchomp']
  ];
  for(const three of openings){
   const result=checkOpeningBranches(sim,own,publicSix,{
     ownLead:three[0],ownThree:three,maxScenes:4
   });
   const focused=result.results.filter(x=>
     x.assumedEnemyLead==='Golisopod'&&x.enemyMega&&x.enemyFirstMove==='Swords Dance');
   const best=[...focused].sort((a,b)=>
     Number(b.foeLeadFainted)-Number(a.foeLeadFainted)
     ||Number(a.ownLeadFainted)-Number(b.ownLeadFainted)
     ||a.foeAttackBoost-b.foeAttackBoost
     ||b.ownRemaining-a.ownRemaining)[0];
   console.log('BRANCH_OPENING '+JSON.stringify({
     group:gname,ownThree:three,scenarios:result.opponentScenes,
     branchCount:result.results.length,
     megaGolisopodSetup:{
       tested:focused.length,
       ownMove:best?.ourFirstMove||null,
       opposingFainted:best?.foeLeadFainted??null,
       ourFainted:best?.ownLeadFainted??null,
       foeAttackBoost:best?.foeAttackBoost??null,
       secondExecuted:best?.secondExecuted??null
     },
     explicit:'All enemy trio/items/moves and branches are synthetic; no opponent picked-three leak.'
   }));
  }
 }
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
