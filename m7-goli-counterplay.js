#!/usr/bin/env node
'use strict';
/**
 * M-7 team improvement: realistic COUNTERPLAY to an advertised Rotom-Heat.
 *
 * Exact pinned Showdown Battle, fully specified *synthetic* opponent six.
 * Preview trio is declared BEFORE enemy hidden three is assigned for tests.
 * Never call a 1-turn KO against a passive Golisopod proof of ladder strength.
 */
const fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
const {load,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {twoTurnBranch}=require('./engine-three-branch');
const {FORMAT}=require('./engine-reference');
const sim=load(),reported=reportedLive();
function ownTeam(form){
 const six=structuredClone(reported),rotom=six.find(x=>x.species==='Rotom-Wash');
 assert.ok(rotom);
 if(form==='heat'){
  rotom.species='Rotom-Heat';
  rotom.moves=['Overheat','Volt Switch','Thunderbolt','Will-O-Wisp'];
 }
 const errors=sim.TeamValidator.get(FORMAT).validateTeam(normalize(six))||[];
 if(errors.length)throw Error('M-C illegal '+form+': '+errors.join('; '));
 return six;
}
function snapshot(result,species,who='own'){
 const a=result.secondAfter||result.firstAfter;
 return a[who].pokemon.find(p=>p.species===species)||
   null;
}
const group=groups.find(g=>g.name==='01_M7_golisopod_balance');
assert.ok(group);
const strategies=[
 {name:'opponent-immediate-iron-head',foeThree:['Golisopod','Garchomp','Mimikyu'],
  firstEnemy:'Iron Head',firstMega:true,secondEnemy:'Iron Head',
  secondOwn:'switch:Metagross'},
 {name:'opponent-sucker-punch',foeThree:['Golisopod','Garchomp','Mimikyu'],
  firstEnemy:'Sucker Punch',firstMega:true,secondEnemy:'Leech Life',
  secondOwn:'switch:Metagross'},
 {name:'opponent-switch-mimikyu-bait',foeThree:['Golisopod','Garchomp','Mimikyu'],
  firstEnemy:'switch:Mimikyu',firstMega:false,secondEnemy:'Play Rough',
  secondOwn:'Volt Switch'},
 {name:'opponent-switch-mimikyu-keep-steel',foeThree:['Golisopod','Garchomp','Mimikyu'],
  firstEnemy:'switch:Mimikyu',firstMega:false,secondEnemy:'Play Rough',
  secondOwn:'switch:Metagross'},
 {name:'opponent-switch-mimikyu-follow-up-attack',foeThree:['Golisopod','Garchomp','Mimikyu'],
  firstEnemy:'switch:Mimikyu',firstMega:false,secondEnemy:'Play Rough',
  secondOwn:null},
 {name:'opponent-switch-scarf-garchomp',foeThree:['Golisopod','Garchomp','Mimikyu'],
  firstEnemy:'switch:Garchomp',firstMega:false,secondEnemy:'Dragon Claw',
  secondOwn:'switch:Metagross'},
 {name:'opponent-switch-scarf-garchomp-attack',foeThree:['Golisopod','Garchomp','Mimikyu'],
  firstEnemy:'switch:Garchomp',firstMega:false,secondEnemy:'Dragon Claw',
  secondOwn:null}
];
function testScenario(variant,plan){
 const ourSix=ownTeam(variant),ownName=variant==='heat'?'Rotom-Heat':'Rotom-Wash';
 const ourThree=[ownName,'Metagross','Primarina'];
 const ownMain=variant==='heat'?'Overheat':'Hydro Pump';
 const secondOwn=plan.secondOwn===null?ownMain:plan.secondOwn;
 const result=twoTurnBranch(sim,ourSix,group.team,{
  ownThree:ourThree,foeThree:[...plan.foeThree],
  seed:[2026,10,28,21],
  first:{own:ownMain,foe:plan.firstEnemy,foeMega:plan.firstMega},
  second:{own:secondOwn,foe:plan.secondEnemy}
 });
 const end=result.secondAfter||result.firstAfter;
 return {plan:plan.name,variant,ownThree,enemyThreePosthoc:plan.foeThree,
  firstOwn:ownMain,firstEnemy:plan.firstEnemy,secondOwn,secondEnemy:plan.secondEnemy,
  firstAfter:result.firstAfter,secondAfter:result.secondAfter,
  executedSecond:result.second?.executed||false,
  reasonSecondNotExecuted:result.second?.notExecutedReason||'',
  ownActive:end.own.active,foeActive:end.assumedFoe.active,
  rotomAfter:snapshot(result,ownName),
  metagrossAfter:snapshot(result,'Metagross'),
  mimikyuAfter:snapshot(result,'Mimikyu','assumedFoe'),
  garchompAfter:snapshot(result,'Garchomp','assumedFoe'),
  goliAfter:snapshot(result,'Golisopod','assumedFoe'),
  firstPublicEvents:result.events.first.filter(x=>
    /\|move\||\|switch\||\|-damage\||\|-end\||\|-start\||\|faint\||\|-boost\||\|detailschange\|/.test(x)),
  secondPublicEvents:result.events.second.filter(x=>
    /\|move\||\|switch\||\|-damage\||\|-start\||\|faint\|/.test(x))
 };
}
function main(){
 const rows=[];
 for(const variant of ['wash','heat'])
  for(const plan of strategies)rows.push(testScenario(variant,plan));
 assert.equal(rows.length,14);
 for(const row of rows){
  if(row.plan.startsWith('opponent-switch-mimikyu')){
   assert.ok(row.firstPublicEvents.some(s=>s.includes('|switch|')&&s.includes('Mimikyu')),
    'Mimikyu switch must actually happen; no simulated free knockout');
   assert.ok(row.firstPublicEvents.some(s=>s.includes('|move|')&&s.includes(row.firstOwn)),
    'Our move must actually execute after the rival switch');
  }
 }
 const result={
  format:FORMAT,pinnedShowdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
  opponentPublicSix:group.team.map(x=>x.species),
  opponentThreeOnlyPostSelection:strategies[0].foeThree,
  ownPolicy:'fixed first Rotom + Metagross + Primarina, not enemy hidden three',
  rows,
  limitations:[
   'All tests share one explicitly synthetic Golisopod/Mimikyu/Garchomp set and fixed seeded action choices',
   'Mimikyu switch-and-bait is deliberately adversarial. Do not assume its opponent will always switch',
   'Even if a two-turn response executes, no actual three-v-three human win is established',
   'A strategy where the first attack KOs or induces forced switching may not have a legal second action yet',
   'Overheat accuracy, special-attack drop, Disguise, pivoting and own weather are only represented by Showdown events when actually executed'
  ]};
 const dir='output/m7-roster-deltas';fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'golisopod-adversarial-switches.json'),
  JSON.stringify(result,null,2));
 console.log('M7_GOLI_COUNTERPLAY '+JSON.stringify(rows.map(x=>({
  plan:x.plan,form:x.variant,firstOwn:x.firstOwn,firstEnemy:x.firstEnemy,
  nextOwn:x.secondOwn,nextEnemy:x.secondEnemy,
  secondExecuted:x.executedSecond,secondReason:x.reasonSecondNotExecuted,
  ownActive:x.ownActive,foeActive:x.foeActive,
  rotomHP:x.rotomAfter?.hp,metagrossHP:x.metagrossAfter?.hp,
  mimikyuHP:x.mimikyuAfter?.hp,mimikyuDisguiseEvents:x.firstPublicEvents
   .filter(s=>s.includes('Disguise')||s.includes('|-end|')||s.includes('disguise')),
  goliHP:x.goliAfter?.hp,garchompHP:x.garchompAfter?.hp
 }))));
}
try{main();}catch(e){console.error(e.stack||e);process.exitCode=1;}
