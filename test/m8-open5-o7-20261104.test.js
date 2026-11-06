'use strict';
// PR #104 comment #6627129388 preregistered before O7 outcomes.
// Fifteen public sixes, TWO rival selected3 each; own selected3/lead is fixed
// from public six and not from actual rival3 or hidden items or moves.
// O7 15*2*2seed*2side = 120 full Battles; Y-in-back + rational Gyara swap
// 3 cases*2seed*2side = 12 separate full Battles, no p-hacking.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,normalize,prelim,hashSeed}=require('../lab');
const {build,plans}=require('../m8-open5-o7-rain-pivot-20261104');
const {groups}=require('../environment-m7-teams');
const {archetypes}=require('../fixtures');
const {opponents}=require('../holdout-opponents');
const {battle,rivalScript,earlyLines}=require('../encore-lead-audit');
const clone=x=>structuredClone(x),skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
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
test('M8 O7 six and preregistered 15 public plans legal in pinned M-C',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc'),ours=build();
 assert.doesNotThrow(()=>prelim(ours,'O7'));assert.equal(ours.length,6);
 const issues=v.validateTeam(normalize(ours));assert.ok(!issues?.length,JSON.stringify(issues));
 assert.equal(new Set(ours.map(x=>x.species)).size,6);
 assert.equal(new Set(ours.map(x=>x.item)).size,6);
 assert.equal(cases.length,15);
 for(const [id,source,a,b] of cases){
  const six=source(),plan=plans[id];
  assert.ok(!v.validateTeam(normalize(six))?.length,'enemy6 '+id);
  assert.ok(plan&&plan.length===3,id+' plan');
  assert.equal(new Set(plan).size,3,id+' own distinct');
  assert.ok(plan.every(s=>ours.some(x=>x.species===s)),id+' our3');
  for(const foe3 of [a,b]){
   assert.equal(new Set(foe3).size,3,id+' foe distinct');
   assert.ok(foe3.every(s=>six.some(x=>x.species===s)),id+' foe3');
  }
 }
});
test('M8 O7 same 15 public six and rival3 as O6: 120 full Battles',{skip},async t=>{
 const sim=load(),rows=[];let games=0,errors=0;
 for(const [ci,[id,fn,a,b]] of cases.entries())for(const [ei,foeThree] of [a,b].entries()){
  const trials=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(12541104+ci*1000+ei*100+si);
   const r=await battle(sim,clone(build()),clone(fn()),seed,{
    ownThree:plans[id],foeThree,reverse,script:null,rivalImmuneAware:true,choiceAudit:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,id+'/'+ei);
   trials.push({won:r.won,firstLoss:r.won?undefined:earlyLines(r.log,r.ownSide,7).slice(0,35)});
  }
  rows.push({publicSix:id,foe3:ei,our3:plans[id],wins:trials.filter(x=>x.won).length,
   firstLoss:trials.find(x=>!x.won)?.firstLoss});
 }
 assert.equal(games,120);assert.equal(errors,0);assert.equal(rows.length,30);
 t.diagnostic('M8_OPEN5_O7_120 '+JSON.stringify({preregistered:'PR#104#issuecomment-6627129388',
  games,errors,rows,notHumanWinRate:true,opponentBotRationalityUnverified:true}));
});
test('M8 O7 Y-in-back and Gyara-to-GarchZ fixed adverse stress: 12 full Battles',{skip},async t=>{
 const sim=load(),dex=sim.Dex.mod('champions'),rows=[];let games=0,errors=0;
 const scenarios=[
  {id:'YbackGarchLead',fn:cases[0][1],foeThree:['Garchomp','Charizard','Mimikyu'],ourId:'sun',script:null},
  {id:'YbackMimiLead',fn:cases[0][1],foeThree:['Mimikyu','Charizard','Garchomp'],ourId:'sun',script:null},
  {id:'gyaraT1GarchSwitch',fn:cases[4][1],foeThree:['Gyarados','Garchomp','Mimikyu'],ourId:'gyarados',script:rivalScript('switch','stay',dex)}
 ];
 for(const [ci,c] of scenarios.entries()){
  const obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(12661104+ci*1000+si);
   const r=await battle(sim,clone(build()),clone(c.fn()),seed,{
    ownThree:plans[c.ourId],foeThree:c.foeThree,reverse,script:c.script,
    rivalImmuneAware:true,choiceAudit:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,c.id);
   obs.push({won:r.won,opening:earlyLines(r.log,r.ownSide,8).slice(0,38)});
  }
  rows.push({scenario:c.id,own3:plans[c.ourId],wins:obs.filter(x=>x.won).length,
   firstLoss:obs.find(x=>!x.won)?.opening,firstWin:obs.find(x=>x.won)?.opening});
 }
 assert.equal(games,12);assert.equal(errors,0);
 t.diagnostic('M8_OPEN5_O7_RATIONAL_12 '+JSON.stringify({games,errors,rows,notHumanWinRate:true}));
});
