'use strict';
// PR #104 comment #6623251885 preregistered BEFORE this R9 comparison.
// R8 vs R9, SAME ten public-six cases and two rival-three hypotheses each.
// Pairwise match on seed, side, enemy team and 3/lead (equivalent role).
// Our selection is fixed by PUBLIC SIX and build, never by rival hidden 3.
// 2 builds * 10 public-six * 2 rival-three * 2 seeds * 2 sides = 160 Battles.
// Heuristic AI mirror match, NOT a human ladder win rate.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,normalize,prelim,hashSeed}=require('../lab');
const {build:r8}=require('../m8-r8-dual-setup-lucario');
const {build:r9,publicPlans:r9Plans,pairedR8Plans:r8Plans}=require('../m8-r9-wash-rotom');
const {groups}=require('../environment-m7-teams');
const {archetypes}=require('../fixtures');
const {battle,earlyLines}=require('../encore-lead-audit');
const copy=x=>structuredClone(x);
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
 {id:'charX',six:()=>groups[3].team,rival:[['Charizard','Garchomp','Mimikyu'],['Primarina','Baxcalibur','Gholdengo']]}
];
const builds={R8:r8,R9:r9},plans={R8:r8Plans,R9:r9Plans};
test('M8 R8/R9 Wash-vs-Heat comparison: both complete M-C teams and public 3 legal',{skip},()=>{
 const validate=load().TeamValidator.get('gen9championsbssregmc');
 const r8team=r8(),r9team=r9();
 assert.equal(cases.length,10);
 for(const [name,team] of Object.entries({R8:r8team,R9:r9team})){
  assert.equal(team.length,6);prelim(team,name);
  assert.ok(!validate.validateTeam(normalize(team))?.length,name+' team');
  assert.equal(new Set(team.map(x=>x.species)).size,6);
 }
 assert.deepEqual(r9team.filter(p=>p.species!=='Rotom-Wash'),r8team.filter(p=>p.species!=='Rotom-Heat'));
 assert.ok(r9team.some(p=>p.species==='Rotom-Wash'));
 assert.ok(!r9team.some(p=>p.species==='Rotom-Heat'));
 for(const c of cases){
  const six=c.six();assert.equal(six.length,6,c.id);
  assert.ok(!validate.validateTeam(normalize(six))?.length,c.id+' rival six');
  for(const enemy of c.rival){
   assert.equal(enemy.length,3);
   assert.ok(enemy.every(s=>six.some(p=>p.species===s)),c.id+' enemy trio');
  }
  for(const [name,team] of Object.entries({R8:r8team,R9:r9team})){
   const selection=plans[name][c.id];assert.ok(selection,c.id+'/'+name+' plan');
   if(name==='R9')assert.deepEqual(selection.map(s=>s==='Rotom-Wash'?'Rotom-Heat':s),plans.R8[c.id],c.id+' exact paired public selection');
   assert.equal(new Set(selection).size,3,c.id+'/'+name);
   assert.ok(selection.every(s=>team.some(p=>p.species===s)),c.id+'/'+name+' trio');
  }
 }
});
test('M8 R8/R9 preregistered 10 public-six paired 160 full Battles',{skip},async t=>{
 const sim=load(),own={R8:r8(),R9:r9()},rows=[];let games=0,errors=0;
 for(const [ci,c] of cases.entries())for(const [ei,foeThree] of c.rival.entries()){
  for(const [name,team] of Object.entries(own)){
   const ourThree=plans[name][c.id],observations=[];
   for(let si=0;si<2;si++)for(const reverse of [false,true]){
    const seed=hashSeed(11900900+ci*1000+ei*100+si);
    const r=await battle(sim,copy(team),copy(c.six()),seed,{
     ownThree:ourThree,foeThree,reverse,script:null,rivalImmuneAware:true,choiceAudit:true});
    games++;errors+=r.errors;assert.equal(r.errors,0,c.id+'/'+name+'/'+ei);
    const ownMoves=r.choiceTrace.filter(x=>x.side===r.ownSide&&x.requestKind==='normal'&&x.turn<=2)
      .slice(0,2).map(x=>({turn:x.turn,choice:x.choice}));
    observations.push({won:r.won,turns:r.turns,ownT1T2:ownMoves,
      firstLoss:r.won?undefined:earlyLines(r.log,r.ownSide,3).slice(0,18)});
   }
   rows.push({publicSix:c.id,rival3:ei,build:name,ownThree:ourThree,
    wins:observations.filter(o=>o.won).length,losses:observations.filter(o=>!o.won).length,
    decisions:observations.map(x=>x.ownT1T2),firstLoss:observations.find(x=>!x.won)?.firstLoss});
  }
 }
 assert.equal(games,160);assert.equal(errors,0);assert.equal(rows.length,40);
 t.diagnostic('M8_R9_VS_R8_TEN_PUBLIC_SIX '+JSON.stringify({
  preregistered:'PR #104 comment #6623251885',games,errors,rows,
  comparison:'Both builds fixed per same public-six; no opponent trio access during selection',
  caveat:'Opponent choices heuristic, not human rank performance; each cell 2 seeds x 2 side swaps.'}));
});
