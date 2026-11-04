'use strict';
// PR #104 comment #6627620285 preregistered before 6v3 outcomes.
// Two deterministic full-Dex proxy-generated rosters. The three and lead
// are selected by a public-six-only baseline and not tuned after outcome.
// 2 teams x15 public six x2 rival 3 x2 seeds x2 sides = 240 full battles.
// +2 teams x(2 sun Y-in-back +1 Gyara rational switch)x2x2=24 Battles.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,normalize,prelim,hashSeed,chooseThree}=require('../lab');
const {discover}=require('../m8-open6-universe-minimax-20261104');
const {groups}=require('../environment-m7-teams');
const {archetypes}=require('../fixtures');
const {opponents}=require('../holdout-opponents');
const {battle,rivalScript,earlyLines}=require('../encore-lead-audit');
const clone=x=>structuredClone(x);
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
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
function seedTeams(sim){
 const r=discover(sim,{seed:1543,rounds:5,samples:90});
 return r.candidates.map(c=>c.team);
}
function publicThree(sim,team,foe){
 const indexes=chooseThree(sim.Dex.mod('champions'),team,foe.map(p=>p.species));
 const selected=indexes.map(i=>team[i-1].species);
 assert.equal(selected.length,3);
 assert.equal(new Set(selected).size,3);
 assert.ok(selected.every(s=>team.some(p=>p.species===s)));
 return selected;
}
test('M8 OPEN6 minimax A/B: derived team and public-six-only lead always legal',{skip},()=>{
 const sim=load(),v=sim.TeamValidator.get('gen9championsbssregmc'),teams=seedTeams(sim);
 assert.equal(teams.length,2);
 for(const [i,team] of teams.entries()){
  prelim(team,'OPEN6/BATTLE '+i);
  assert.ok(!v.validateTeam(normalize(team))?.length,'own legal '+i);
  for(const [id,make,a,b] of cases){
   const foe=make(),three=publicThree(sim,team,foe);
   assert.equal(three.length,3,id);
   assert.ok(!v.validateTeam(normalize(foe))?.length,id+' foe');
   for(const select of [a,b])assert.ok(select.every(s=>foe.some(x=>x.species===s)),id+' rival3');
  }
 }
});
test('M8 OPEN6 two proxy-generated rosters, 15 public sixes x 2 hidden 3: 240 full battles',{skip},async t=>{
 const sim=load(),teams=seedTeams(sim),rows=[];let games=0,errors=0;
 for(const [ci,[id,make,a,b]] of cases.entries())for(const [ei,foeThree] of [a,b].entries())
 for(const [ti,team] of teams.entries()){
  const ownThree=publicThree(sim,team,make()),obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(12770400+ci*1000+ei*100+si);
   const r=await battle(sim,clone(team),clone(make()),seed,{
    ownThree,foeThree,reverse,script:null,rivalImmuneAware:true,choiceAudit:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,id+'/'+ti+'/'+ei);
   obs.push({won:r.won,firstLoss:r.won?null:earlyLines(r.log,r.ownSide,6).slice(0,24)});
  }
  rows.push({candidate:ti,publicSix:id,enemy3:ei,ownThree,wins:obs.filter(x=>x.won).length,
   firstLoss:obs.find(x=>!x.won)?.firstLoss});
 }
 assert.equal(games,240);assert.equal(errors,0);assert.equal(rows.length,60);
 t.diagnostic('M8_OPEN6_MINIMAX_240 '+JSON.stringify({
  prereg:'PR104#6627620285',games,errors,rows,notHumanWinRate:true,
  publicSixOnlySelection:true,selectionHeuristicNotCertified:true}));
});
test('M8 OPEN6 both proxy-generated rosters: Y-in-back and Gyara rational switch x24 Battles',{skip},async t=>{
 const sim=load(),dex=sim.Dex.mod('champions'),teams=seedTeams(sim),rows=[];let games=0,errors=0;
 const scenarios=[
  {id:'YbackGarchLead',make:cases[0][1],foeThree:['Garchomp','Charizard','Mimikyu'],script:null},
  {id:'YbackMimiLead',make:cases[0][1],foeThree:['Mimikyu','Charizard','Garchomp'],script:null},
  {id:'gyaraT1GarchSwitch',make:cases[4][1],foeThree:['Gyarados','Garchomp','Mimikyu'],script:rivalScript('switch','stay',dex)}
 ];
 for(const [ti,team] of teams.entries())for(const [ci,c] of scenarios.entries()){
  const ownThree=publicThree(sim,team,c.make()),obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(12880500+ci*1000+si);
   const r=await battle(sim,clone(team),clone(c.make()),seed,{
    ownThree,foeThree:c.foeThree,reverse,script:c.script,rivalImmuneAware:true,choiceAudit:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,ci+'/'+ti);
   obs.push({won:r.won,early:earlyLines(r.log,r.ownSide,8).slice(0,32)});
  }
  rows.push({candidate:ti,scenario:c.id,ownThree,wins:obs.filter(x=>x.won).length,
   firstLoss:obs.find(x=>!x.won)?.early});
 }
 assert.equal(games,24);assert.equal(errors,0);
 t.diagnostic('M8_OPEN6_MINIMAX_RATIONAL_24 '+JSON.stringify({games,errors,rows,
  seedNotReusedFromO1toO7:true,notHumanWinRate:true}));
});
