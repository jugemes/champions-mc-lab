#!/usr/bin/env node
'use strict';
/**
 * One-turn real M-C engine stress for the EXISTING Hydreigon Fire answer,
 * explicitly adding plausible priority First Impression on Golisopod.
 * Do not assume a Golisopod exposes Swords Dance instead of First Impression.
 */
const fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
const {load,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {engineTurnSample,FORMAT}=require('./engine-reference');
const {twoTurnBranch}=require('./engine-three-branch');
const sim=load(),ownCurrent=reportedLive();
const original=groups.find(x=>x.name==='01_M7_golisopod_balance');assert.ok(original);
const enemySD=structuredClone(original.team),enemyFirst=structuredClone(original.team);
const goli=enemyFirst.find(x=>x.species==='Golisopod');
assert.ok(goli);
const replaced=goli.moves.indexOf('Swords Dance');assert.ok(replaced>=0);
goli.moves[replaced]='First Impression';
for(const [name,team] of [['SD',enemySD],['FI',enemyFirst]]){
 const bad=sim.TeamValidator.get(FORMAT).validateTeam(normalize(team))||[];
 if(bad.length)throw Error(name+' synthetic Golisopod illegal: '+bad.join('; '));
}
function team(form){
 const s=structuredClone(ownCurrent);
 if(form==='heat'){
  const rot=s.find(x=>x.species==='Rotom-Wash');
  rot.species='Rotom-Heat';
  rot.moves=['Overheat','Volt Switch','Thunderbolt','Will-O-Wisp'];
 }
 return s;
}
const leads=[
 {name:'live-hydreigon',form:'wash',pokemon:'Hydreigon',move:'Flamethrower'},
 {name:'live-wash-rotom',form:'wash',pokemon:'Rotom-Wash',move:'Hydro Pump'},
 {name:'proposed-heat-rotom',form:'heat',pokemon:'Rotom-Heat',move:'Overheat'}
];
const replies=[
 {move:'First Impression',team:enemyFirst,mega:true},
 {move:'Sucker Punch',team:enemySD,mega:true},
 {move:'Leech Life',team:enemySD,mega:true},
 {move:'Iron Head',team:enemySD,mega:true},
 {move:'Swords Dance',team:enemySD,mega:true},
 {move:'First Impression',team:enemyFirst,mega:false}
];
const results=[];
for(const lead of leads){
 for(const reply of replies)for(let i=0;i<8;i++){
  const seed=[2026,10,28,70+i];
  const r=engineTurnSample(sim,team(lead.form),reply.team,{
   ourLead:lead.pokemon,opponentLead:'Golisopod',
   ourMove:lead.move,opponentMove:reply.move,opponentMega:reply.mega,seed});
  results.push({lead:lead.name,ownMove:lead.move,
   foeMove:reply.move,assumedGoliMega:reply.mega,seed:seed[3],
   ownHP:r.ourAfter.hp,ownMaxHP:r.ourAfter.maxhp,
   ownFainted:r.ourAfter.fainted,
   goliHP:r.opponentAfter.hp,goliMaxHP:r.opponentAfter.maxhp,
   goliFainted:r.opponentAfter.fainted,
   events:r.events});
 }
}
const switches=[];
for(const lead of leads){
 for(const foeSwitch of [
  {name:'mimikyu',species:'Mimikyu',follow:'Play Rough'},
  {name:'garchomp',species:'Garchomp',follow:'Dragon Claw'}
 ])for(let i=0;i<8;i++){
  const enemy=enemyFirst,seed=[2026,10,28,90+i],ourSix=team(lead.form);
  const ownThree=[lead.pokemon,'Metagross','Primarina'];
  const f3=['Golisopod','Mimikyu','Garchomp'];
  const result=twoTurnBranch(sim,ourSix,enemy,{
   ownThree,foeThree:f3,seed,
   first:{own:lead.move,foe:'switch:'+foeSwitch.species},
   second:{own:'switch:Metagross',foe:foeSwitch.follow}
  });
  const final=result.secondAfter||result.firstAfter;
  switches.push({lead:lead.name,foeSwitch:foeSwitch.species,seed:seed[3],
   turn2:result.second.executed,reason:result.second.notExecutedReason,
   ownLeadHP:final.own.pokemon.find(x=>x.species===lead.pokemon)?.hp,
   metaHP:final.own.pokemon.find(x=>x.species==='Metagross')?.hp,
   goliHP:final.assumedFoe.pokemon.find(x=>x.species==='Golisopod')?.hp,
   switchHP:final.assumedFoe.pokemon.find(x=>x.species===foeSwitch.species||
     x.species.startsWith(foeSwitch.species+'-'))?.hp
  });
 }
}
const summary=leads.map(l=>({
 lead:l.name,replies:replies.map(q=>{
  const m=results.filter(x=>x.lead===l.name&&x.foeMove===q.move&&x.assumedGoliMega===q.mega);
  return {foeMove:q.move,foeMega:q.mega,samples:m.length,
   ownKOs:m.filter(x=>x.ownFainted).length,goliKOs:m.filter(x=>x.goliFainted).length,
   minOwnHP:Math.min(...m.map(x=>x.ownHP)),maxOwnHP:Math.max(...m.map(x=>x.ownHP)),
   minGoliHP:Math.min(...m.map(x=>x.goliHP)),maxGoliHP:Math.max(...m.map(x=>x.goliHP))};
 }),switches:['Mimikyu','Garchomp'].map(s=>{
  const m=switches.filter(x=>x.lead===l.name&&x.foeSwitch===s);
  return {foeSwitch:s,executedTurn2:m.filter(x=>x.turn2).length,
   ownLeadHP:m.map(x=>x.ownLeadHP),metaHP:m.map(x=>x.metaHP),
   foeAfterHP:m.map(x=>x.switchHP)};
 })}));
const out={summary,oneTurnRows:results,opponentSwitches:switches,
  publicSix:original.team.map(x=>x.species),format:FORMAT,
  engineSHA:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
  syntheticGoliMovesSD:enemySD.find(x=>x.species==='Golisopod').moves,
  syntheticGoliMovesFI:goli.moves,
  caveats:['Constructed enemy sets, fixed seeds and independent one-turn scripts, not actual player action rates',
  'First Impression is legal only on first active turn; real Showdown validates this in initial lead only',
  'The live Hydreigon item/ability details have unverified fields; set follows documented proposed live six',
  'Two-turn switch summaries stop after user-specified second action; no completed 3v3 match or winrate']};
 fs.mkdirSync('output/m7-roster-deltas',{recursive:true});
 fs.writeFileSync(path.join('output/m7-roster-deltas','goli-first-impression-lead.json'),JSON.stringify(out,null,2));
 console.log('M7_FIRST_IMPRESSION_LEAD '+JSON.stringify(summary));
