#!/usr/bin/env node
'use strict';
/**
 * Six-member functional-alternative comparison:
 * - Hold Rotom-Wash to preserve water/ground matchups, replace Hydreigon with
 *   Unaware Skeledirge or physically defensive Corviknight.
 * - Compare both versions with/without Rotom-Heat too.
 * All sixes are M-C legal hypotheses; changing the real live team is forbidden.
 */
const fs=require('node:fs'),path=require('node:path');
const {game,load,hashSeed,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {archetypes,variants}=require('./fixtures');
const {createCases}=require('./m8-baseline-core');
const {engineTurnSample,FORMAT}=require('./engine-reference');
const sim=load(),live=reportedLive(),liveSnapshot=JSON.stringify(live);
function replace(team,oldName,pokemon){
 const i=team.findIndex(x=>x.species===oldName);
 if(i<0)throw Error('missing '+oldName);team[i]=structuredClone(pokemon);
}
const sk=structuredClone(archetypes.setup.find(x=>x.species==='Skeledirge'));
if(!sk)throw Error('missing prior audited Skeledirge fixture');
sk.item='Rocky Helmet';
const co=structuredClone(variants.C_master.find(x=>x.species==='Corviknight'));
if(!co)throw Error('missing prior audited Corviknight fixture');
function heat(team){
 const rot=team.find(x=>x.species==='Rotom-Wash');
 rot.species='Rotom-Heat';
 rot.moves=['Overheat','Volt Switch','Thunderbolt','Will-O-Wisp'];
}
function make(){
 const options=[
  {name:'original-wash',heat:false,replacement:null},
  {name:'heat-only',heat:true,replacement:null},
  {name:'wash-skeledirge',heat:false,replacement:sk},
  {name:'wash-corviknight',heat:false,replacement:co},
  {name:'heat-skeledirge',heat:true,replacement:sk},
  {name:'heat-corviknight',heat:true,replacement:co}
 ];
 for(const x of options){
  x.team=structuredClone(live);
  if(x.heat)heat(x.team);
  if(x.replacement)replace(x.team,'Hydreigon',x.replacement);
  const e=sim.TeamValidator.get(FORMAT).validateTeam(normalize(x.team))||[];
  if(e.length)throw Error('illegal candidate '+x.name+': '+e.join(' | '));
 }
 return options;
}
async function main(){
 const options=make(),cases=createCases(groups),rows=[];
 for(let i=0;i<cases.length;i++){
  const c=cases[i],seed=hashSeed(3800000+i*31);
  for(const o of options){
   const policy={megaAware:true,candidatePreviewPolicy:'rational-top',
     opponentPreviewPolicy:'rational',
     candidateDecisionPolicy:'v3-public-immunity',opponentDecisionPolicy:'v3-public-immunity',
     opponentForced:c.enemyThree};
   const result=await game(sim,c.reversed?c.enemySix:o.team,
     c.reversed?o.team:c.enemySix,seed,false,null,c.reversed,policy);
   if(result.trace.errors.length)throw Error('game errors '+o.name+' '+JSON.stringify(result.trace.errors));
   const side=c.reversed?'p2':'p1';
   const chosen=result.trace.selections.find(x=>x.side===side);
   const other=result.trace.selections.find(x=>x.side!==(c.reversed?'p2':'p1'));
   if(!chosen||!other||other.chosen.join('/')!==c.enemyThree.join('/'))
    throw Error('preview selected opponent hidden three was unexpectedly changed');
   rows.push({group:c.group,publicSix:c.publicSix,forcedKind:c.forcedKind,
     opponentThreePosthoc:c.enemyThree,seed,reversed:c.reversed,
     treatment:o.name,ownSelected:chosen.chosen,lead:chosen.lead,
     won:result.winner===(c.reversed?'opponent':'candidate'),turns:result.turns,
     firstOwnMoves:result.trace.choices.filter(x=>x.side===side).slice(0,5),
     firstEnemyMoves:result.trace.choices.filter(x=>x.side!==side).slice(0,5)});
  }
 }
 const table=options.map(o=>{
  const subset=rows.filter(r=>r.treatment===o.name);
  const byGroup=groups.map(g=>{
   const rs=subset.filter(r=>r.group===g.name);
   return {group:g.name,wins:rs.filter(r=>r.won).length,
     n:rs.length,selections:[...new Set(rs.map(r=>r.ownSelected.join('/')+' | '+r.lead))]};
  });
  return {name:o.name,wins:subset.filter(r=>r.won).length,total:subset.length,
    top8Wins:byGroup.slice(0,8).reduce((n,x)=>n+x.wins,0),
    byGroup};
 });
 const firstGoli=structuredClone(groups.find(g=>g.name==='01_M7_golisopod_balance').team);
 const goli=firstGoli.find(x=>x.species==='Golisopod');
 goli.moves[goli.moves.indexOf('Swords Dance')]='First Impression';
 const fErr=sim.TeamValidator.get(FORMAT).validateTeam(normalize(firstGoli))||[];
 if(fErr.length)throw Error('First Impression counterexample illegal: '+fErr.join(' | '));
 const turnResults=[];
 for(const candidateName of ['wash-skeledirge','wash-corviknight','heat-skeledirge','heat-corviknight']){
  const team=options.find(o=>o.name===candidateName).team;
  const species=candidateName.includes('skeledirge')?'Skeledirge':'Corviknight';
  const ourMove=species==='Skeledirge'?'Torch Song':'Body Press';
  for(const foeMove of ['First Impression','Iron Head','Sucker Punch'])
   for(let i=0;i<8;i++){
    const r=engineTurnSample(sim,team,firstGoli,{
     ourLead:species,opponentLead:'Golisopod',ourMove,opponentMove:foeMove,
     opponentMega:true,seed:[2026,10,28,140+i]});
    turnResults.push({candidateName,species,foeMove,seed:140+i,
     ownHP:r.ourAfter.hp,ownMaxHP:r.ourAfter.maxhp,
     goliHP:r.opponentAfter.hp,goliMaxHP:r.opponentAfter.maxhp,
     goliFainted:r.opponentAfter.fainted,ownFainted:r.ourAfter.fainted});
   }
 }
 if(JSON.stringify(live)!==liveSnapshot)throw Error('changed live roster');
 const out={method:'four constructed archetypes families with same six opponents, opponent forced A/B and sides',
  note:'Existing 14 CONSTRUCTED teams, not actual ladder sample, own and foe bot rationality unverified',
  pinnedShowdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
  format:FORMAT,candidates:options.map(({name,team})=>({name,team})),
  results:table,raw:rows,
  firstImpressionCounter:turnResults,
  caveat:'Synthetic conditions; immediate move OHKO is not a 3v3 win or an overall team recommendation; losing Hydreigon loses fast Dark/Dragon special and an existing Fire move. Opponent selected three are after-preview stress only.'};
 fs.mkdirSync('output/m7-roster-deltas',{recursive:true});
 fs.writeFileSync(path.join('output/m7-roster-deltas','fire-defensive-cores.json'),JSON.stringify(out,null,2));
 console.log('M7_DEFENSIVE_CORES '+JSON.stringify(table));
 console.log('M7_DEFENSIVE_GOLI '+JSON.stringify(
  [...new Set(turnResults.map(x=>x.candidateName+'|'+x.foeMove))].map(k=>{
   const a=turnResults.filter(x=>x.candidateName+'|'+x.foeMove===k);
   return {candidateName:a[0].candidateName,foeMove:a[0].foeMove,
    ownKO:a.filter(x=>x.ownFainted).length,goliKO:a.filter(x=>x.goliFainted).length,
    ownHPMin:Math.min(...a.map(x=>x.ownHP)),
    ownHPMax:Math.max(...a.map(x=>x.ownHP))};
  })
 ));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
