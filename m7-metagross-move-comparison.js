#!/usr/bin/env node
'use strict';
/**
 * Decision-support: one-move, same-six Mega Metagross comparison.
 * Do not change the user's live roster or promote a candidate on AI win count.
 * Every opponent set is an explicitly CONSTRUCTED M-C hypothesis.
 */
const fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
const {load,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {engineDamageSample,engineTurnSample,FORMAT}=require('./engine-reference');
const sim=load(),live=reportedLive(),fingerprint=JSON.stringify(live);
const variants=[
  {name:'live-psychic-fangs',move:'Psychic Fangs'},
  {name:'fire-punch',move:'Fire Punch'},
  {name:'earthquake',move:'Earthquake'},
  {name:'ice-punch',move:'Ice Punch'}
];
const targets=[
 ['01_M7_golisopod_balance','Golisopod',true,'mega-bugsteel'],
 ['01_M7_golisopod_balance','Golisopod',false,'base-bugwater'],
 ['01_M7_golisopod_balance','Mimikyu',false,'disguise-not-covered-by-damage-oracle'],
 ['01_M7_golisopod_balance','Garchomp',false,'scarf-garchomp'],
 ['02_M7_lucarioZ_offense','Lucario',true,'mega-lucario-z'],
 ['02_M7_lucarioZ_offense','Corviknight',false,'corviknight'],
 ['03_M7_charizardY_offense','Charizard',true,'mega-charizard-y'],
 ['04_M7_charizardX_offense','Charizard',true,'mega-charizard-x'],
 ['05_M7_salamence_balance','Salamence',true,'mega-salamence'],
 ['07_M7_baxcalibur_offense','Baxcalibur',false,'baxcalibur'],
 ['08_M7_metagross_balance','Metagross',true,'mega-metagross'],
 ['09_M7_gyarados_megagarchompZ','Gyarados',false,'gyarados'],
 ['09_M7_gyarados_megagarchompZ','Gholdengo',false,'gholdengo'],
 ['02_M7_lucarioZ_offense','Archaludon',false,'archaludon'],
 ['13_M7_stall','Toxapex',false,'toxapex'],
 ['13_M7_stall','Skarmory',false,'skarmory'],
 ['14_M7_salamence_setup','Volcarona',false,'volcarona'],
 ['01_M7_golisopod_balance','Primarina',false,'primarina']
];
function memberVariant(move){
 const team=structuredClone(live);
 assert.equal(team[0].moves[1],'Psychic Fangs');
 team[0].moves[1]=move;
 return team;
}
function valid(team){
 return sim.TeamValidator.get(FORMAT).validateTeam(normalize(team))||[];
}
function q(n){return Number(n.toFixed(3));}
async function main(){
 assert.equal(targets.length,18);
 const rows=[],legal={};
 for(const v of variants){
  const team=memberVariant(v.move);
  legal[v.name]=valid(team);
  if(legal[v.name].length)continue;
  for(const [groupName,species,opponentMega,tag] of targets){
   const opponent=groups.find(g=>g.name===groupName)?.team;
   if(!opponent||!opponent.some(x=>x.species===species))
     throw Error('Invalid predeclared public opponent: '+groupName+'/'+species);
   const moves=team[0].moves.map(move=>engineDamageSample(sim,team,opponent,{
    ourLead:'Metagross',opponentLead:species,move,ourMega:true,opponentMega,
    seed:[2026,10,28,7]}));
   rows.push({
    treatment:v.name,target:tag,group:groupName,foe:species,
    targetMega:opponentMega,
    megaMetaSpeed:moves[0].ourSpeed,assumedFoeSpeed:moves[0].opponentSpeed,
    sameOrFaster:moves[0].ourSpeed>=moves[0].opponentSpeed,
    foeForm:moves[0].opponentForm,
    comparisons:moves.map(m=>({move:m.move,rawDamage:m.rawDamage,
     maxHP:m.opponentMaxHP,fraction:q(m.fraction),immune:m.immune})),
    maxSingleHit:Math.max(...moves.map(m=>m.fraction)),
    bestOneHit:moves.reduce((a,b)=>a.fraction>=b.fraction?a:b).move
   });
  }
 }
 const turns=[];
 for(const v of variants.filter(x=>legal[x.name].length===0&&['live-psychic-fangs','fire-punch'].includes(x.name))){
  const goli=groups.find(g=>g.name==='01_M7_golisopod_balance').team;
  for(const foeMove of ['Iron Head','Sucker Punch','Swords Dance']){
   const turn=engineTurnSample(sim,memberVariant(v.move),goli,{
     ourLead:'Metagross',opponentLead:'Golisopod',
     ourMove:v.move,opponentMove:foeMove,ourMega:true,opponentMega:true,
     seed:[2026,10,28,7]});
   turns.push({treatment:v.name,foeMove,
     ownHP:turn.ourAfter.hp,ownMaxHP:turn.ourAfter.maxhp,ownFaint:turn.ourAfter.fainted,
     opponentHP:turn.opponentAfter.hp,opponentMaxHP:turn.opponentAfter.maxhp,
     foeFaint:turn.opponentAfter.fainted,events:turn.events});
  }
 }
 assert.equal(JSON.stringify(live),fingerprint,'do not mutate live roster');
 const summary={
  date:'2026-10-28',format:FORMAT,
  showdownSHA:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
  legal: Object.fromEntries(Object.entries(legal).map(([k,e])=>[k,e.length===0?'legal':e])),
  cases:targets.length,
  damage:rows,turns,
  limits:[
   'Opponents are specified synthetic sets; the true rival item/moves/points are unknown at preview',
   'Single-hit noncritical damage is not a full damage roll or a win rate',
   'Damage-only readouts do not model Disguise, held defensive items, weather changes, accuracy or opponent switches',
   'For turn tests, fixed opponent first-turn moves are hypothetical, not an AI policy',
   'A move swap loses other coverage; never recommend on the top matchup alone'
  ]
 };
 const dir=path.join('output','m7-mega-metagross');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'coverage.json'),JSON.stringify(summary,null,2));
 const focus=rows.filter(r=>[
  'mega-bugsteel','base-bugwater','mega-lucario-z','gholdengo','toxapex',
  'mega-charizard-y','mega-charizard-x','scarf-garchomp','gyarados',
  'corviknight','mega-salamence','baxcalibur','volcarona','primarina'
 ].includes(r.target));
 console.log('M7_META_MOVE_LEGALITY '+JSON.stringify(summary.legal));
 console.log('M7_META_MOVE_MATRIX '+JSON.stringify(focus.map(x=>({
  candidate:x.treatment,target:x.target,
  faster:x.sameOrFaster,ownSpeed:x.megaMetaSpeed,foeSpeed:x.assumedFoeSpeed,
  hit:x.comparisons.find(m=>m.move===variants.find(y=>y.name===x.treatment).move),
  best:x.bestOneHit,bestFraction:q(x.maxSingleHit)
 }))));
 console.log('M7_META_V_GOLI_TURNS '+JSON.stringify(turns.map(x=>({
  variant:x.treatment,foeMove:x.foeMove,ourHP:x.ownHP,
  ourFaint:x.ownFaint,foeHP:x.opponentHP,foeFaint:x.foeFaint
 }))));
 console.log('M7_META_MOVE_OUTPUT output/m7-mega-metagross/coverage.json');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
