'use strict';
// M-8 R5 public-six selection-only counterfactual.
// Predeclared before any result: PR #104 comment #6621059231.
// This test is a fixed selector audit, not a team ranking.
// Actual rival trio is test-only; same self-selected own trio is used against
// both rival trios arising from exactly the same publicly visible six.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize,hashSeed}=require('../lab');
const {build}=require('../m8-r5-balanced-threat-rebuild');
const {archetypes}=require('../fixtures');
const {groups}=require('../environment-m7-teams');
const {battle,earlyLines}=require('../encore-lead-audit');
const copy=x=>structuredClone(x);
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const scenarios=[
 {id:'RAIN',preview:()=>archetypes.rain,priorCIIndex:1,
  rival:[
   ['Pelipper','Swampert','Archaludon'],
   ['Pelipper','Gholdengo','Rillaboom']],
  own:{
   RAIN_BASE:['Rotom-Heat','Rillaboom','Primarina'],
   RAIN_GOLD:['Rotom-Heat','Rillaboom','Gholdengo'],
   RAIN_PRIM_GOLD:['Rotom-Heat','Gholdengo','Primarina']
  }},
 {id:'MENCE',preview:()=>groups[4].team,priorCIIndex:3,
  rival:[
   ['Salamence','Garchomp','Mimikyu'],
   ['Hippowdon','Primarina','Gholdengo']],
  own:{
   MENCE_BASE:['Baxcalibur','Metagross','Primarina'],
   MENCE_GOLD:['Baxcalibur','Metagross','Gholdengo'],
   MENCE_PRIM_GOLD:['Baxcalibur','Primarina','Gholdengo']
  }}
];
test('M8 R5 preview selection choices are all legal and never read rival hidden trio',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc'),team=build();
 assert.ok(!v.validateTeam(normalize(team))?.length,'R5 M-C legal');
 assert.equal(scenarios.length,2);
 for(const c of scenarios){
  const rival=c.preview();
  assert.equal(rival.length,6,c.id);
  assert.ok(!v.validateTeam(normalize(rival))?.length,c.id);
  assert.equal(c.rival.length,2);
  assert.equal(Object.keys(c.own).length,3);
  for(const three of c.rival)
   assert.ok(three.every(s=>rival.some(p=>p.species===s)),c.id+' enemy');
  for(const [label,three] of Object.entries(c.own)){
   assert.equal(new Set(three).size,3,c.id+'/'+label);
   assert.ok(three.every(s=>team.some(p=>p.species===s)),c.id+'/'+label);
   assert.equal(c.rival.some(x=>x===three),false);
  }
 }
});
test('M8 R5 public-six-only trios: frozen 48 full battle comparisons across independent rival branches',{skip},async t=>{
 const sim=load(),team=build(),rows=[];let games=0,errors=0;
 for(const c of scenarios)for(const [ei,enemyThree] of c.rival.entries()){
  for(const [label,ownThree] of Object.entries(c.own)){
   const obs=[];
   for(let s=0;s<2;s++)for(const reverse of [false,true]){
    // Identical seed and side to earlier R5 baseline #41761321121.
    const seed=hashSeed(11049500+c.priorCIIndex*1000+ei*100+s);
    const r=await battle(sim,copy(team),copy(c.preview()),seed,{
     ownThree,foeThree:enemyThree,reverse,script:null,rivalImmuneAware:true});
    games++;errors+=r.errors;
    assert.equal(r.errors,0,c.id+'/'+label+'/'+enemyThree.join('/'));
    const lines=r.log.split('\n');
    obs.push({won:r.won,reverse,turns:r.turns,
     ownFaints:lines.filter(z=>z.startsWith('|faint|'+r.ownSide+'a:')).length,
     foeFaints:lines.filter(z=>z.startsWith('|faint|'+r.foeSide+'a:')).length,
     early:earlyLines(r.log,r.ownSide,3),
     choiceTraceAvailable:false});
   }
   rows.push({publicSix:c.id,rivalThree:enemyThree,
    ourSelectionLabel:label,ourThree:ownThree,lead:ownThree[0],
    wins:obs.filter(v=>v.won).length,losses:obs.filter(v=>!v.won).length,
    lossExample:obs.find(v=>!v.won)?.early?.slice(0,32),
    winExample:obs.find(v=>v.won)?.early?.slice(0,32)});
  }
 }
 assert.equal(games,48);
 assert.equal(errors,0);
 assert.equal(rows.length,12);
 t.diagnostic('M8_R5_SAME_PUBLIC6_SELECTION_HOLDOUT '+JSON.stringify({
  declared:'PR104 comment #6621059231',
  fixedSixOnly:true,
  noHiddenOpponentTrioAtSelection:true,
  syntheticFoeSetNotHumanRationalityProof:true,
  eachCellTwoSeedsTwoSidesNotIndependentHumanStrategies:true,
  games,errors,rows
 }));
});
