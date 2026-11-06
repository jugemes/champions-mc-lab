'use strict';
// PR #104 issuecomment #6625760347: preregistered BEFORE results.
// Four new full-six structures vs 15 publicly fixed sixes, two opposing
// hidden-three hypotheses each, two independent seeds and both sides.
// 4 x 15 x 2 x 2 x 2 = 480 pinned M-C full Battles.
// 'public plan' is selected using the public six ONLY; never enemy actual 3.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,normalize,prelim,hashSeed}=require('../lab');
const {builders,plans}=require('../m8-open1-20261104');
const {groups}=require('../environment-m7-teams');
const {archetypes}=require('../fixtures');
const {opponents}=require('../holdout-opponents');
const {battle,rivalScript,earlyLines}=require('../encore-lead-audit');
const clone=x=>structuredClone(x);
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const cases=[
 {id:'sun',six:()=>groups[2].team,rival:[['Charizard','Garchomp','Mimikyu'],['Garchomp','Primarina','Gholdengo']]},
 {id:'rain',six:()=>archetypes.rain,rival:[['Pelipper','Swampert','Archaludon'],['Pelipper','Gholdengo','Rillaboom']]},
 {id:'mence',six:()=>groups[4].team,rival:[['Salamence','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']]},
 {id:'lucarioZ',six:()=>groups[1].team,rival:[['Lucario','Garchomp','Mimikyu'],['Corviknight','Primarina','Archaludon']]},
 {id:'gyarados',six:()=>groups[8].team,rival:[['Gyarados','Garchomp','Mimikyu'],['Mimikyu','Gholdengo','Corviknight']]},
 {id:'megaGolisopod',six:()=>groups[0].team,rival:[['Golisopod','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']]},
 {id:'psychic',six:()=>groups[10].team,rival:[['Indeedee','Gengar','Dragonite'],['Gholdengo','Volcarona','Rillaboom']]},
 {id:'volcarona',six:()=>groups[13].team,rival:[['Salamence','Volcarona','Dragonite'],['Gholdengo','Skeledirge','Rillaboom']]},
 {id:'stall',six:()=>groups[12].team,rival:[['Toxapex','Umbreon','Corviknight'],['Slowbro','Skarmory','Gholdengo']]},
 {id:'charX',six:()=>groups[3].team,rival:[['Charizard','Garchomp','Mimikyu'],['Primarina','Baxcalibur','Gholdengo']]},
 // Independent prior holdout compositions, not training-size-ranked.
 {id:'steelBunker',six:()=>opponents.steel_bunker,rival:[['Gholdengo','Archaludon','Corviknight'],['Skeledirge','Garchomp','Gengar']]},
 {id:'hazardShift',six:()=>opponents.hazard_shift,rival:[['Toxapex','Skarmory','Dragonite'],['Slowbro','Gholdengo','Lucario']]},
 {id:'multiMega',six:()=>opponents.multi_mega_offense,rival:[['Gengar','Lucario','Golisopod'],['Starmie','Volcarona','Rillaboom']]},
 {id:'rainPivot',six:()=>opponents.rain_pivot,rival:[['Pelipper','Swampert','Archaludon'],['Toxapex','Volcarona','Starmie']]},
 {id:'mixedElectric',six:()=>opponents.mixed_electric,rival:[['Eelektross','Garchomp','Volcarona'],['Primarina','Rillaboom','Gholdengo']]}
];
const names=Object.keys(builders);
test('M8 OPEN1 four new complete sixes, opponent sixes, 60 own-three plans legal on pinned M-C',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc');
 assert.equal(names.length,4);assert.equal(cases.length,15);
 const builds=Object.fromEntries(Object.entries(builders).map(([k,f])=>[k,f()]));
 for(const [n,t] of Object.entries(builds)){
  assert.doesNotThrow(()=>prelim(t,n),n);
  const errs=v.validateTeam(normalize(t));assert.ok(!errs?.length,n+': '+JSON.stringify(errs));
  assert.equal(t.length,6);assert.equal(new Set(t.map(p=>p.species)).size,6);
  assert.equal(t.filter(p=>load().Dex.mod('champions').items.get(p.item).megaStone).length,1,n+' one Mega stone');
 }
 for(const c of cases){
  const opponent=c.six();
  assert.equal(opponent.length,6,c.id);
  assert.ok(!v.validateTeam(normalize(opponent))?.length,c.id+' foe six');
  for(const trio of c.rival){
   assert.equal(new Set(trio).size,3,c.id+' foe 3');
   assert.ok(trio.every(s=>opponent.some(p=>p.species===s)),c.id+' foe 3 member');
  }
  for(const n of names){
   const sel=plans[c.id]?.[n];
   assert.ok(sel,c.id+' '+n+' missing selection');
   assert.equal(new Set(sel).size,3,c.id+' '+n+' duplicate selection');
   assert.ok(sel.every(s=>builds[n].some(p=>p.species===s)),c.id+' '+n+' wrong selection');
  }
 }
});
test('M8 OPEN1 four builds x fifteen public sixes x two rival 3s: 480 full Battles',{skip},async t=>{
 const sim=load(),builds=Object.fromEntries(Object.entries(builders).map(([n,f])=>[n,f()])),rows=[];
 let games=0,errors=0;
 for(const [ci,c] of cases.entries())for(const [ei,foeThree] of c.rival.entries())for(const n of names){
  const team=builds[n],ourThree=plans[c.id][n],obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(12161104+ci*1000+ei*100+si);
   const r=await battle(sim,clone(team),clone(c.six()),seed,{
    ownThree:ourThree,foeThree,reverse,script:null,rivalImmuneAware:true,choiceAudit:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,c.id+'/'+n+'/'+ei);
   const choices=r.choiceTrace.filter(x=>x.side===r.ownSide&&x.requestKind==='normal'&&x.turn<=2)
     .slice(0,2).map(x=>({turn:x.turn,choice:x.choice}));
   obs.push({won:r.won,turns:r.turns,choices,
    firstLoss:!r.won?earlyLines(r.log,r.ownSide,5).slice(0,28):undefined});
  }
  rows.push({publicSix:c.id,rivalThree:foeThree,build:n,ownThree:ourThree,
   wins:obs.filter(o=>o.won).length,losses:obs.filter(o=>!o.won).length,
   exampleLoss:obs.find(o=>!o.won)?.firstLoss,
   t1t2Example:obs[0].choices,
   distinctT1T2:[...new Set(obs.map(o=>JSON.stringify(o.choices)))].length});
 }
 assert.equal(games,480);assert.equal(errors,0);assert.equal(rows.length,120);
 t.diagnostic('M8_OPEN1_480 '+JSON.stringify({
  preregistration:'PR #104 issuecomment #6625760347',games,errors,rows,
  publicSixOnlySelection:true,notHumanWinRate:true,
  caveat:'heuristic opposing bots; 2 seeds and side reversal, not 4 independent tactics'}));
});
test('M8 OPEN1 PRE-REGISTERED rational lead/switch stress: Y in back and Gyarados -> Mega Garch Z',{skip},async t=>{
 const sim=load(),dex=sim.Dex.mod('champions'),rows=[];let games=0;
 const scenarios=[
  {id:'YbackGarchLead',six:cases[0].six,foeThree:['Garchomp','Charizard','Mimikyu'],planId:'sun',script:null},
  {id:'YbackMimiLead',six:cases[0].six,foeThree:['Mimikyu','Charizard','Garchomp'],planId:'sun',script:null},
  {id:'gyaraT1GarchSwitch',six:cases[4].six,foeThree:['Gyarados','Garchomp','Mimikyu'],planId:'gyarados',script:rivalScript('switch','stay',dex)}
 ];
 for(const [ci,c] of scenarios.entries())for(const n of names){
  const ourThree=plans[c.planId][n],obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(12281200+ci*1000+si);
   const r=await battle(sim,clone(builders[n]()),clone(c.six()),seed,{
    ownThree:ourThree,foeThree:c.foeThree,reverse,script:c.script,rivalImmuneAware:true,choiceAudit:true});
   games++;assert.equal(r.errors,0,c.id+'/'+n);
   obs.push({won:r.won,firstLoss:r.won?undefined:earlyLines(r.log,r.ownSide,7).slice(0,32)});
  }
  rows.push({scenario:c.id,build:n,ourThree,wins:obs.filter(x=>x.won).length,
    firstLoss:obs.find(x=>!x.won)?.firstLoss});
 }
 assert.equal(games,48);assert.equal(rows.length,12);
 t.diagnostic('M8_OPEN1_RATIONAL_48 '+JSON.stringify({
  preregistration:'PR #104 issuecomment #6625760347',games,rows,
  notHumanWinRate:true,enemyPostPreviewHiddenDataExcluded:true}));
});
