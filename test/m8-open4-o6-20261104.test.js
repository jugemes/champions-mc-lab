'use strict';
// PR #104 comment #6626512535 preregistered BEFORE outcomes.
// O6 complete structural rebuild: 15 public six, each 2 plausible enemy3,
// 2 seed and both sides = 120 full battles; +12 rational Yback/Gyara-switch.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,normalize,prelim,hashSeed}=require('../lab');
const {build,plans}=require('../m8-open4-o6-balanced-20261104');
const {groups}=require('../environment-m7-teams');
const {archetypes}=require('../fixtures');
const {opponents}=require('../holdout-opponents');
const {battle,rivalScript,earlyLines}=require('../encore-lead-audit');
const copy=x=>structuredClone(x),skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const cases=[
 ['sun',()=>groups[2].team,['Charizard','Garchomp','Mimikyu'],['Garchomp','Primarina','Gholdengo']],
 ['rain',()=>archetypes.rain,['Pelipper','Swampert','Archaludon'],['Pelipper','Gholdengo','Rillaboom']],
 ['mence',()=>groups[4].team,['Salamence','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']],
 ['lucarioZ',()=>groups[1].team,['Lucario','Garchomp','Mimikyu'],['Corviknight','Primarina','Archaludon']],
 ['gyarados',()=>groups[8].team,['Gyarados','Garchomp','Mimikyu'],['Mimikyu','Gholdengo','Corviknight']],
 ['megaGolisopod',()=>groups[0].team,['Golisopod','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']],
 ['psychic',()=>groups[10].team,['Indeedee','Gengar','Dragonite'],['Gholdengo','Volcarona','Rillaboom']],
 ['volcarona',()=>groups[13].team,['Salamence','Volcarona','Dragonite'],['Gholdengo','Skeledirge','Rillaboom']],
 ['stall',()=>groups[12].team,['Toxapex','Umbreon','Corviknight'],['Slowbro','Skarmory','Gholdengo']],
 ['charX',()=>groups[3].team,['Charizard','Garchomp','Mimikyu'],['Primarina','Baxcalibur','Gholdengo']],
 ['steelBunker',()=>opponents.steel_bunker,['Gholdengo','Archaludon','Corviknight'],['Skeledirge','Garchomp','Gengar']],
 ['hazardShift',()=>opponents.hazard_shift,['Toxapex','Skarmory','Dragonite'],['Slowbro','Gholdengo','Lucario']],
 ['multiMega',()=>opponents.multi_mega_offense,['Gengar','Lucario','Golisopod'],['Starmie','Volcarona','Rillaboom']],
 ['rainPivot',()=>opponents.rain_pivot,['Pelipper','Swampert','Archaludon'],['Toxapex','Volcarona','Starmie']],
 ['mixedElectric',()=>opponents.mixed_electric,['Eelektross','Garchomp','Volcarona'],['Primarina','Rillaboom','Gholdengo']]
];
test('M8 O6 complete six + 15 public opponent previews + own plans legal M-C',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc'),own=build();
 assert.doesNotThrow(()=>prelim(own,'O6 full team'));
 assert.equal(new Set(own.map(p=>p.item)).size,6);
 assert.ok(!v.validateTeam(normalize(own))?.length,'O6 complete M-C legal');
 assert.equal(cases.length,15);
 for(const [id,fn,a,b] of cases){
  assert.ok(!v.validateTeam(normalize(fn()))?.length,id+' foe');
  const three=plans[id];assert.equal(new Set(three).size,3);
  assert.ok(three.every(s=>own.some(p=>p.species===s)),id+' own');
  for(const enemy of [a,b])assert.ok(enemy.every(s=>fn().some(p=>p.species===s)),id+' enemy');
 }
});
test('M8 O6 same 15 public six and 2 enemy3 as OPEN1: 120 full Battles',{skip},async t=>{
 const sim=load(),rows=[];let games=0,errors=0;
 for(const [ci,[id,fn,a,b]] of cases.entries())for(const [ei,enemy] of [a,b].entries()){
  const obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(12161104+ci*1000+ei*100+si);
   const r=await battle(sim,copy(build()),copy(fn()),seed,{
    ownThree:plans[id],foeThree:enemy,reverse,script:null,rivalImmuneAware:true,choiceAudit:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,id+'/'+ei);
   obs.push({won:r.won,loss:r.won?null:earlyLines(r.log,r.ownSide,7).slice(0,30)});
  }
  rows.push({id,enemy3:ei,enemy,own3:plans[id],wins:obs.filter(o=>o.won).length,
   firstLoss:obs.find(o=>!o.won)?.loss});
 }
 assert.equal(games,120);assert.equal(errors,0);
 t.diagnostic('M8_OPEN4_O6_120 '+JSON.stringify({games,errors,rows,
  preregistered:'PR#104 issuecomment #6626512535',notHumanWinRate:true}));
});
test('M8 O6 independent structural Y-in-back and Gyarados→GarchompZ stress 12 full Battles',{skip},async t=>{
 const sim=load(),dex=sim.Dex.mod('champions'),rows=[];let games=0,errors=0;
 const scenarios=[
  {id:'YbackGarchLead',fn:cases[0][1],three:['Garchomp','Charizard','Mimikyu'],plan:'sun',script:null},
  {id:'YbackMimiLead',fn:cases[0][1],three:['Mimikyu','Charizard','Garchomp'],plan:'sun',script:null},
  {id:'gyaraT1GarchSwitch',fn:cases[4][1],three:['Gyarados','Garchomp','Mimikyu'],plan:'gyarados',script:rivalScript('switch','stay',dex)}
 ];
 for(const [ci,c] of scenarios.entries()){
  const obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(12281200+ci*1000+si);
   const r=await battle(sim,copy(build()),copy(c.fn()),seed,{
    ownThree:plans[c.plan],foeThree:c.three,reverse,script:c.script,rivalImmuneAware:true,choiceAudit:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,c.id);
   obs.push({won:r.won,opening:earlyLines(r.log,r.ownSide,8).slice(0,36)});
  }
  rows.push({scenario:c.id,own3:plans[c.plan],wins:obs.filter(o=>o.won).length,
   firstLoss:obs.find(o=>!o.won)?.opening,firstWin:obs.find(o=>o.won)?.opening});
 }
 assert.equal(games,12);assert.equal(errors,0);
 t.diagnostic('M8_OPEN4_O6_RATIONAL_12 '+JSON.stringify({games,errors,rows,notHumanWinRate:true}));
});
