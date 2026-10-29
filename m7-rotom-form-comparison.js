#!/usr/bin/env node
'use strict';
/**
 * Compare one species-form slot using actual Showdown M-C validation and
 * its own attack/defence mechanics, not bot win counts. No live-team edits.
 */
const fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
const {load,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {engineDamageSample,engineTurnSample,FORMAT}=require('./engine-reference');
const sim=load(),baseline=reportedLive(),fingerprint=JSON.stringify(baseline);
const forms=[
 {name:'Rotom-Wash',mainMove:'Hydro Pump'},
 {name:'Rotom-Heat',mainMove:'Overheat'}
];
const scenarios=[
 ['01_M7_golisopod_balance','Golisopod',true,['Iron Head','Leech Life','Sucker Punch']],
 ['01_M7_golisopod_balance','Golisopod',false,['Iron Head','Leech Life']],
 ['01_M7_golisopod_balance','Hippowdon',false,['Earthquake']],
 ['01_M7_golisopod_balance','Mimikyu',false,['Play Rough','Shadow Claw']],
 ['01_M7_golisopod_balance','Garchomp',false,['Earthquake','Rock Slide']],
 ['02_M7_lucarioZ_offense','Lucario',true,['Aura Sphere','Dark Pulse']],
 ['03_M7_charizardY_offense','Charizard',true,['Solar Beam','Flamethrower']],
 ['04_M7_charizardX_offense','Charizard',true,['Flare Blitz','Dragon Claw','Earthquake']],
 ['07_M7_baxcalibur_offense','Baxcalibur',false,['Earthquake','Icicle Crash']],
 ['09_M7_gyarados_megagarchompZ','Gyarados',false,['Waterfall','Earthquake']],
 ['09_M7_gyarados_megagarchompZ','Gholdengo',false,['Shadow Ball']],
 ['12_M7_rain','Pelipper',false,['Hurricane','Weather Ball']],
 ['12_M7_rain','Swampert',true,['Liquidation','Earthquake','Ice Punch']],
 ['12_M7_rain','Archaludon',false,['Electro Shot','Draco Meteor']],
 ['13_M7_stall','Toxapex',false,['Chilling Water']],
 ['14_M7_salamence_setup','Volcarona',false,['Fiery Dance','Bug Buzz']]
];
function teamForm(name,move){
 const own=structuredClone(baseline);
 const i=own.findIndex(x=>x.species==='Rotom-Wash');
 assert.ok(i>=0);
 own[i].species=name;
 own[i].moves=['Volt Switch','Thunderbolt','Will-O-Wisp',move];
 return own;
}
function valid(team){return sim.TeamValidator.get(FORMAT).validateTeam(normalize(team))||[];}
const rnd=n=>Number(n.toFixed(3));
function build(){
 const out=[],legality={},turns=[];
 for(const {name,mainMove} of forms){
  const own=teamForm(name,mainMove);legality[name]=valid(own);
  if(legality[name].length)continue;
  for(const [groupName,species,mega,foeMoves] of scenarios){
   const foe=groups.find(g=>g.name===groupName)?.team;
   if(!foe)throw Error('No opponent group '+groupName);
   const source=foe.find(x=>x.species===species);
   if(!source)throw Error('Target missing: '+species);
   const outgoing=['Volt Switch','Thunderbolt',mainMove].map(move=>
    engineDamageSample(sim,own,foe,{ourLead:name,opponentLead:species,
      move,opponentMega:mega,seed:[2026,10,28,18]}));
   const incoming=foeMoves.filter(x=>source.moves.includes(x)).map(move=>
    engineDamageSample(sim,foe,own,{ourLead:species,opponentLead:name,
      move,ourMega:mega,seed:[2026,10,28,18]}));
   out.push({
    variant:name,against:species,group:groupName,assumedMega:mega,
    ownSpeed:outgoing[0].ourSpeed,foeSpeed:outgoing[0].opponentSpeed,
    outgoing:outgoing.map(x=>({move:x.move,damage:x.rawDamage,foeHP:x.opponentMaxHP,
      fraction:rnd(x.fraction),immune:x.immune})),
    incoming:incoming.map(x=>({move:x.move,damage:x.rawDamage,ourHP:x.opponentMaxHP,
      fraction:rnd(x.fraction),immune:x.immune}))
   });
  }
  const goli=groups.find(g=>g.name==='01_M7_golisopod_balance').team;
  for(const foeMove of ['Iron Head','Sucker Punch','Leech Life','Swords Dance']){
   const t=engineTurnSample(sim,own,goli,{
    ourLead:name,opponentLead:'Golisopod',
    ourMove:mainMove,opponentMove:foeMove,opponentMega:true,
    seed:[2026,10,28,18]});
   turns.push({variant:name,foeMove,ownAfter:t.ourAfter,
     foeAfter:t.opponentAfter,events:t.events});
  }
 }
 assert.equal(JSON.stringify(baseline),fingerprint);
 return {
  legality:Object.fromEntries(Object.entries(legality).map(([k,e])=>[k,e.length?'illegal: '+e.join('; '):'legal'])),
  rows:out,turns,format:FORMAT,
  pinnedShowdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
  warning:'Synthetic enemy sets. Exact damage snapshot not ranked winrate. No switch AI, Overheat Special Attack drop over longer battle, coverage of real item uncertainty or independent player rationality. Never overwrite live 6.'
 };
}
function main(){
 const r=build();const dir='output/m7-rotom-form';fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'comparison.json'),JSON.stringify(r,null,2));
 console.log('M7_ROTOM_LEGAL '+JSON.stringify(r.legality));
 console.log('M7_ROTOM_DAMAGE '+JSON.stringify(r.rows.map(x=>({
  variant:x.variant,foe:x.against,group:x.group,mega:x.assumedMega,
  offense:x.outgoing.map(y=>({move:y.move,pct:Math.round(y.fraction*100)})),
  defense:x.incoming.map(y=>({move:y.move,pct:Math.round(y.fraction*100),immune:y.immune})),
  speeds:[x.ownSpeed,x.foeSpeed]
 }))));
 console.log('M7_ROTOM_GOLI_TURN '+JSON.stringify(r.turns.map(x=>({
  variant:x.variant,foeMove:x.foeMove,
  ownHP:x.ownAfter.hp,ownMaxHP:x.ownAfter.maxhp,
  foeHP:x.foeAfter.hp,foeMaxHP:x.foeAfter.maxhp,
  ownFainted:x.ownAfter.fainted,foeFainted:x.foeAfter.fainted
 }))));
}
main();
