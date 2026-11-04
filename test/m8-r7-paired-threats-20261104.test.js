'use strict';
// R7 vs R5/R6, pre-registered before results at PR104 comment #6622249073.
// These are constructed legal opponent sixes, NOT ladder-representative games.
// Opponent hidden 3 is NEVER used to choose own 3. No side effects to bot policy.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,prelim,normalize,hashSeed}=require('../lab');
const {build:r5,publicPlans:r5Plans}=require('../m8-r5-balanced-threat-rebuild');
const {build:r6,publicPlans:r6Plans}=require('../m8-r6-speed-control');
const {candidates:r7Candidates,publicPlans:r7Plans}=require('../m8-r7-grassy-scarf');
const {groups}=require('../environment-m7-teams');
const {archetypes}=require('../fixtures');
const {battle,earlyLines}=require('../encore-lead-audit');
const clone=x=>structuredClone(x);
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const foes=[
 {id:'sun',six:()=>groups[2].team,threes:[['Charizard','Garchomp','Mimikyu'],['Garchomp','Primarina','Gholdengo']]},
 {id:'rain',six:()=>archetypes.rain,threes:[['Pelipper','Swampert','Archaludon'],['Pelipper','Gholdengo','Rillaboom']]},
 {id:'mence',six:()=>groups[4].team,threes:[['Salamence','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']]},
 {id:'lucarioZ',six:()=>groups[1].team,threes:[['Lucario','Garchomp','Mimikyu'],['Corviknight','Primarina','Archaludon']]},
 {id:'gyarados',six:()=>groups[8].team,threes:[['Gyarados','Garchomp','Mimikyu'],['Mimikyu','Gholdengo','Corviknight']]}
];
const builders={R5:r5,R6:r6,...r7Candidates};
const plans={
 R5:{...r5Plans,mence:['Baxcalibur','Metagross','Gholdengo'],rain:['Rotom-Heat','Rillaboom','Gholdengo'],lucarioZ:['Primarina','Metagross','Rotom-Heat'],gyarados:['Metagross','Baxcalibur','Rotom-Heat']},
 R6:r6Plans,R7T_grassyScarfTantrum:r7Plans,R7E_grassyScarfEarthquake:r7Plans
};
test('R7 two Ground moves and R5/R6 full six legal in Champions M-C',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc');
 assert.equal(foes.length,5);assert.equal(Object.keys(builders).length,4);
 const teams=Object.fromEntries(Object.entries(builders).map(([name,fn])=>[name,fn()]));
 for(const [name,team] of Object.entries(teams)){
  assert.equal(team.length,6,name);
  assert.doesNotThrow(()=>prelim(team,name),name);
  const errors=v.validateTeam(normalize(team));
  assert.ok(!errors?.length,name+': '+JSON.stringify(errors));
 }
 for(const [name,team] of Object.entries(teams)){
  if(!name.startsWith('R7'))continue;
  assert.ok(team.some(p=>p.ability==='Grassy Surge'),name+' Grass');
  assert.ok(team.some(p=>p.species==='Garchomp'&&p.item==='Choice Scarf'),name+' Scarf');
  const g=team.find(p=>p.species==='Garchomp');
  assert.equal(g.moves.includes('Stomping Tantrum'),name.startsWith('R7T'));
  assert.equal(g.moves.includes('Earthquake'),name.startsWith('R7E'));
  assert.ok(team.some(p=>p.species==='Gholdengo'&&p.moves.includes('Nasty Plot')),'Special setup');
 }
 for(const c of foes){
  const six=c.six();
  assert.ok(!v.validateTeam(normalize(six))?.length,c.id+' rival');
  for(const enemy of c.threes){
   assert.equal(new Set(enemy).size,3);
   assert.ok(enemy.every(s=>six.some(p=>p.species===s)),c.id+' enemy');
  }
  for(const [name,team] of Object.entries(teams)){
   const three=plans[name][c.id];
   assert.equal(new Set(three).size,3,name+'/'+c.id);
   assert.ok(three.every(s=>team.some(p=>p.species===s)),name+'/'+c.id);
  }
 }
});
test('M8 R7-T/R7-E versus R5/R6: 160 pinned matched full Battles',{skip},async t=>{
 const sim=load(),teams=Object.fromEntries(Object.entries(builders).map(([k,fn])=>[k,fn()])),rows=[];
 let games=0,errors=0;
 for(const [fi,c] of foes.entries())for(const [ei,foeThree] of c.threes.entries())
 for(const [name,team] of Object.entries(teams)){
  const ownThree=plans[name][c.id],obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(11049800+fi*1000+ei*100+si); // same seed as R5/R6 run #41765555473
   const r=await battle(sim,clone(team),clone(c.six()),seed,{
    ownThree,foeThree,reverse,script:null,rivalImmuneAware:true});
   games++;errors+=r.errors;
   assert.equal(r.errors,0,c.id+'/'+name+' illegal choices');
   obs.push({won:r.won,turns:r.turns,early:!r.won?earlyLines(r.log,r.ownSide,4):undefined});
  }
  rows.push({publicSix:c.id,foeThree,name,ownThree,
   wins:obs.filter(v=>v.won).length,losses:obs.filter(v=>!v.won).length,
   exampleLoss:obs.find(v=>!v.won)?.early?.slice(0,30)});
 }
 assert.equal(games,160);assert.equal(errors,0);assert.equal(rows.length,40);
 t.diagnostic('M8_R7_FIVE_PUBLIC_SIX '+JSON.stringify({
  preregistered:'PR #104 comment #6622249073',
  games,errors,rows,notRankedWinRate:true,
  botReasoningNotValidated:true,perCellTwoSeedsTwoSides:true}));
});
test('R7-T vs R7-E with real Grassy Terrain and both enemy trios: 16 full Battles',{skip},async t=>{
 const sim=load(),rows=[];let games=0,errors=0;
 const c=foes[1]; // rain is public six, not opponent hidden 3
 for(const [name,fn] of Object.entries(r7Candidates))
 for(const [ei,foeThree] of c.threes.entries()){
  const ownThree=r7Plans.rain_ground_grass,obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(11049900+ei*100+si);
   const r=await battle(sim,clone(fn()),clone(c.six()),seed,{
    ownThree,foeThree,reverse,script:null,rivalImmuneAware:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,name+' Grassy run');
   obs.push({won:r.won,turns:r.turns,early:earlyLines(r.log,r.ownSide,4)});
  }
  rows.push({name,foeThree,ownThree,wins:obs.filter(x=>x.won).length,
   losses:obs.filter(x=>!x.won).length,
   lossExample:obs.find(x=>!x.won)?.early?.slice(0,30)});
 }
 assert.equal(games,16);assert.equal(errors,0);assert.equal(rows.length,4);
 t.diagnostic('M8_R7_TERRAIN_CHOICES '+JSON.stringify({
  games,errors,rows,notRankedWinRate:true,artificialBot:true}));
});
