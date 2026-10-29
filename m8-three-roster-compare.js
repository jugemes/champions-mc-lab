#!/usr/bin/env node
'use strict';
/**
 * M-8 L/H/S three-roster diagnostic (derived from m7-roster-delta-comparison.js): no user live sets modified, identical synthetic
 * opponent public six / forced rival three / seed / side across proposals.
 * Both bots are still immature; never infer actual human ladder win rate.
 */
const fs=require('node:fs'),path=require('node:path');
const {load,game,hashSeed,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const A=require('./hybrid01-audit');
const {groups}=require('./environment-m7-teams');
const {createCases}=require('./m8-baseline-core');
const {FORMAT}=require('./engine-reference');
const sim=load(),live=reportedLive(),fingerprint=JSON.stringify(live);
function replace(team,species,replacement){
 const i=team.findIndex(x=>x.species===species);
 if(i<0)throw Error('Live species missing: '+species);
 team[i]=structuredClone(replacement);
}
function buildCandidates(){
 const h=structuredClone(live);
 const rotom=h.find(x=>x.species==='Rotom-Wash');
 rotom.species='Rotom-Heat';
 rotom.moves=['Overheat','Volt Switch','Thunderbolt','Will-O-Wisp'];
 const s=structuredClone(live);
 // Nature is NOT specified in the request; Bold is an assumption (H32/B32/D2).
 replace(s,'Hydreigon',A.set('Skeledirge','Rocky Helmet','Unaware','Bold',{hp:32,def:32,spd:2},
  ['Torch Song','Shadow Ball','Will-O-Wisp','Slack Off']));
 return [
  {name:'L-live-wash',team:structuredClone(live),changes:[]},
  {name:'H-heat',team:h,changes:['Rotom Wash -> Heat']},
  {name:'S-skeledirge',team:s,changes:['Hydreigon -> Skeledirge']}
 ];
}
function check(team,name){
 const errs=sim.TeamValidator.get(FORMAT).validateTeam(normalize(team))||[];
 if(errs.length)throw Error('Invalid team '+name+': '+errs.join('; '));
}
async function main(){
 const cand=buildCandidates();cand.forEach(c=>check(c.team,c.name));
 const cases=createCases(groups),rows=[];
 for(let i=0;i<cases.length;i++){
  const conf=cases[i],seed=hashSeed(2500000+i*19);
  for(const c of cand){
   const options={
    megaAware:true,candidatePreviewPolicy:'rational-top',
    opponentPreviewPolicy:'rational',
    candidateDecisionPolicy:'v3-public-immunity',
    opponentDecisionPolicy:'v3-public-immunity',
    opponentForced:conf.enemyThree
   };
   const battle=await game(sim,conf.reversed?conf.enemySix:c.team,
    conf.reversed?c.team:conf.enemySix,seed,false,null,conf.reversed,options);
   if(battle.trace.errors.length)throw Error('battle input error '+c.name+' '+conf.group+' '+JSON.stringify(battle.trace.errors));
   const side=conf.reversed?'p2':'p1',sel=battle.trace.selections.find(x=>x.side===side);
   const enemySide=conf.reversed?'p1':'p2',theirs=battle.trace.selections.find(x=>x.side===enemySide);
   if(!sel||!theirs||theirs.chosen.join('/')!==conf.enemyThree.join('/'))
    throw Error('Missing choices or rival forced three mismatch');
   rows.push({candidate:c.name,group:conf.group,
    rivalPublicSix:conf.publicSix,rivalThreeAfterwards:conf.enemyThree,
    forcedKind:conf.forcedKind,reversed:conf.reversed,seed,
    won:battle.winner===(conf.reversed?'opponent':'candidate'),
    chosen:sel.chosen,lead:sel.lead,enemyLeadAfterwards:theirs.lead,
    turns:battle.turns
   });
  }
 }
 const aggregate=cand.map(c=>{
  const own=rows.filter(x=>x.candidate===c.name);
  const s=groups.map(g=>{
   const r=own.filter(x=>x.group===g.name);
   return {group:g.name,wins:r.filter(x=>x.won).length,n:r.length,
    selection:r.map(x=>x.lead+'/'+x.chosen.join('/'))};
  });
  return {name:c.name,changes:c.changes,wins:own.filter(x=>x.won).length,
   n:own.length,top8:s.slice(0,8).reduce((n,x)=>n+x.wins,0),top8N:32,
   byGroup:s};
 });
 if(JSON.stringify(live)!==fingerprint)throw Error('Live six must remain unchanged');
 const output={date:'2026-10-28',format:FORMAT,
  pinnedShowdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
  opponentType:'constructed 14 opponent sixes x forced A/B x two sides',
  selectionPolicy:'rational-top public six only',
  turnPolicy:'both v3-public-immunity',
  caveats:[
   'Not independently collected M-7 human battles; not a ranked win-rate estimate',
   'Opponent AI can misplay, including bad setup/Encore; inspect specific battle logs before adoption',
   'Rillaboom Grassy Terrain may halve the users own grounded Garchomp Earthquake damage; bot does not prove coordinated play',
   'Check Golisopod/Mimikyu, Hippowdon, Charizard X/Y, rain Swampert separately, never trust only aggregate'
  ],
  summary:aggregate,rawRows:rows};
 const dir='output/m8-three-roster';fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'three-candidates.json'),JSON.stringify(output,null,2));
 console.log('M7_6_TEAM_LEGAL '+JSON.stringify(cand.map(x=>x.name)));
 console.log('M7_6_TEAM_SUMMARY '+JSON.stringify(aggregate.map(x=>({
  name:x.name,wins:x.wins,total:x.n,top8Wins:x.top8,
  byGroup:x.byGroup.map(g=>({group:g.group,wins:g.wins,n:g.n,leads:g.selection}))
 }))));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
