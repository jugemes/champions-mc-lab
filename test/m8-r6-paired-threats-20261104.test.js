'use strict';
// Preregistered before results at PR104 comment #6621479933.\n// R6 is not adopted based on synthetic opponents alone.
// Same five public sixes, each paired under two rival hidden trios fixed by
// the test; own three never changes based on hidden enemy selection.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,prelim,normalize,hashSeed}=require('../lab');
const {build:r5,publicPlans:r5Plans}=require('../m8-r5-balanced-threat-rebuild');
const {build:r6,publicPlans:r6Plans}=require('../m8-r6-speed-control');
const {groups}=require('../environment-m7-teams');
const {archetypes}=require('../fixtures');
const {battle,earlyLines}=require('../encore-lead-audit');
const clone=x=>structuredClone(x);
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const cases=[
 {id:'sun',team:()=>groups[2].team,foe:[['Charizard','Garchomp','Mimikyu'],['Garchomp','Primarina','Gholdengo']]},
 {id:'rain',team:()=>archetypes.rain,foe:[['Pelipper','Swampert','Archaludon'],['Pelipper','Gholdengo','Rillaboom']]},
 {id:'mence',team:()=>groups[4].team,foe:[['Salamence','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']]},
 {id:'lucarioZ',team:()=>groups[1].team,foe:[['Lucario','Garchomp','Mimikyu'],['Corviknight','Primarina','Archaludon']]},
 {id:'gyarados',team:()=>groups[8].team,foe:[['Gyarados','Garchomp','Mimikyu'],['Mimikyu','Gholdengo','Corviknight']]}
];
const builds={R5:r5,R6:r6};
const plans={
 R5:{...r5Plans,lucarioZ:['Primarina','Metagross','Rotom-Heat'],gyarados:['Metagross','Baxcalibur','Rotom-Heat'],mence:['Baxcalibur','Metagross','Gholdengo'],rain:['Rotom-Heat','Rillaboom','Gholdengo']},
 R6:r6Plans
};
test('R6 Scarf/Meowscarada reconstruction, R5 pair, and all public six previews validate',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc');
 const own=Object.fromEntries(Object.entries(builds).map(([k,b])=>[k,b()]));
 for(const [name,team] of Object.entries(own)){
  assert.equal(team.length,6);
  assert.doesNotThrow(()=>prelim(team,name));
  assert.ok(!v.validateTeam(normalize(team))?.length,name+': '+JSON.stringify(v.validateTeam(normalize(team))));
  assert.equal(new Set(team.map(p=>p.species)).size,6,name);
 }
 assert.ok(own.R6.some(x=>x.species==='Garchomp'&&x.item==='Choice Scarf'));
 assert.ok(own.R6.some(x=>x.species==='Meowscarada'));
 assert.ok(!own.R6.some(x=>x.ability==='Grassy Surge'),'No terrain-nerfed Scarf Earthquake');
 assert.ok(own.R6.some(x=>x.species==='Gholdengo'&&x.moves.includes('Nasty Plot')));
 assert.equal(cases.length,5);
 for(const c of cases){
  const rival=c.team();
  assert.ok(!v.validateTeam(normalize(rival))?.length,c.id+' enemy legal');
  for(const enemy of c.foe)assert.ok(enemy.every(s=>rival.some(p=>p.species===s)),c.id+' enemy names');
  for(const [name,team] of Object.entries(own)){
   const three=plans[name][c.id];
   assert.equal(new Set(three).size,3,name+' '+c.id);
   assert.ok(three.every(s=>team.some(p=>p.species===s)),name+' '+c.id);
  }
 }
});
test('R6 versus R5 across fixed 80 actual Battle; compare opponent trios not mean Bot win rate',{skip},async t=>{
 const sim=load(),data=[],own=Object.fromEntries(Object.entries(builds).map(([k,b])=>[k,b()]));let games=0,errors=0;
 for(const [ci,c] of cases.entries())
 for(const [ei,foeThree] of c.foe.entries())
 for(const [buildId,team] of Object.entries(own)){
  const ownThree=plans[buildId][c.id],obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(11049800+ci*1000+ei*100+si);
   const r=await battle(sim,clone(team),clone(c.team()),seed,{
    ownThree,foeThree,reverse,script:null,rivalImmuneAware:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,c.id+buildId);
   obs.push({won:r.won,turns:r.turns,early:earlyLines(r.log,r.ownSide,3)});
  }
  data.push({publicSix:c.id,foeThree,buildId,ownThree,
   wins:obs.filter(x=>x.won).length,losses:obs.filter(x=>!x.won).length,
   sampleLoss:obs.find(x=>!x.won)?.early?.slice(0,38)});
 }
 assert.equal(games,80);assert.equal(errors,0);
 t.diagnostic('M8_R5_R6_PAIRED '+JSON.stringify({registered:'PR104 #6621479933',
  games,errors,data,notHumanWinRate:true,heuristicRivalNotCertified:true}));
});
