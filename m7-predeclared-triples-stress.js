#!/usr/bin/env node
'use strict';
/**
 * PREDECLARED human-readable triple/lead choices for observed top-six classes.
 * Selection is fixed by the enemy PUBLIC SIX group and own legal six, not by
 * the enemy hidden selected three. We stress both opponent triples only after.
 */
const fs=require('node:fs'),path=require('node:path');
const {game,load,hashSeed,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {FORMAT}=require('./engine-reference');
const sim=load(),own=reportedLive();
const rotom=own.find(x=>x.species==='Rotom-Wash');rotom.species='Rotom-Heat';
rotom.moves=['Overheat','Volt Switch','Thunderbolt','Will-O-Wisp'];
const errors=sim.TeamValidator.get(FORMAT).validateTeam(normalize(own))||[];
if(errors.length)throw Error(errors.join('; '));
const presets={
 '01_M7_golisopod_balance':[
   ['Rotom-Heat','Metagross','Primarina'],
   ['Metagross','Rotom-Heat','Primarina'],
   ['Primarina','Metagross','Rotom-Heat']
 ],
 '02_M7_lucarioZ_offense':[
   ['Garchomp','Metagross','Primarina'],
   ['Rotom-Heat','Metagross','Primarina'],
   ['Garchomp','Metagross','Hydreigon']
 ],
 '06_M7_golisopod_basculegion':[
   ['Rotom-Heat','Metagross','Primarina'],
   ['Primarina','Metagross','Rotom-Heat'],
   ['Rotom-Heat','Metagross','Garchomp']
 ],
 '07_M7_baxcalibur_offense':[
   ['Metagross','Rotom-Heat','Primarina'],
   ['Rotom-Heat','Metagross','Primarina'],
   ['Metagross','Hydreigon','Rotom-Heat']
 ]
};
async function main(){
 const rows=[];
 for(const [groupName,ownTrioOptions] of Object.entries(presets)){
  const g=groups.find(x=>x.name===groupName);
  const ownNames=own.map(x=>x.species);
  for(const trio of ownTrioOptions)
   if(trio.some(x=>!ownNames.includes(x)))throw Error('Invalid own3 '+trio);
  for(const forcedKind of ['forcedA','forcedB'])for(const reversed of [false,true]){
   const foeThree=g[forcedKind],seed=hashSeed(2900000+groups.indexOf(g)*400+
     (forcedKind==='forcedA'?0:100)+(reversed?50:0));
   for(const [index,trio] of ownTrioOptions.entries()){
    const opts={candidatePreviewPolicy:'rational-top',opponentPreviewPolicy:'rational',
     candidateDecisionPolicy:'v3-public-immunity',opponentDecisionPolicy:'v3-public-immunity',
     megaAware:true,opponentForced:foeThree,candidateForced:trio};
    const m=await game(sim,reversed?g.team:own,reversed?own:g.team,
     seed,false,null,reversed,opts);
    if(m.trace.errors.length)throw Error('Invalid action '+JSON.stringify(m.trace.errors));
    const sel=m.trace.selections.find(x=>x.side=== (reversed?'p2':'p1'));
    if(sel.chosen.join('/')!==trio.join('/'))throw Error('Forced own three mismatch');
    rows.push({group:groupName,publicSix:g.team.map(x=>x.species),
     ownThree:trio,rivalThreePosthoc:foeThree,
     forcedKind,reversed,seed,won:m.winner===(reversed?'opponent':'candidate'),
     turns:m.turns});
   }
  }
 }
 const summary=Object.entries(presets).map(([name,options])=>({
  group:name,
  options:options.map(trio=>{
   const rs=rows.filter(x=>x.group===name&&x.ownThree.join('/')===trio.join('/'));
   return {lead:trio[0],trio,winSynthetic:rs.filter(x=>x.won).length,
    n:rs.length,forcedA:rs.filter(x=>x.forcedKind==='forcedA'&&x.won).length,
    forcedB:rs.filter(x=>x.forcedKind==='forcedB'&&x.won).length};
  })
 }));
 const dir='output/m7-roster-deltas';fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'predeclared-human-triples.json'),
  JSON.stringify({summary,rows,warning:'This is a constructed same-seed battle-bot diagnostic, NOT an optimal human lead recommendation or ladder success rate. Enemy forced trios are not passed to own public-six policy.'},null,2));
 console.log('M7_PREDECLARED_TRIO_SUMMARY '+JSON.stringify(summary));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
