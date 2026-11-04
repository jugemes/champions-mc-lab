'use strict';
// PR #104 comment #6622358063 preregistration BEFORE any results.
// R5 vs R7T vs R8 against SAME ten public sixes, two enemy trios each.
// Own team preview is fixed per public six and cannot observe enemy trio.
// 240 Battle attempts = 3 builds * 10 public six * 2 rival trios * 2 seeds * 2 sides.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,normalize,prelim,hashSeed}=require('../lab');
const {build:r5}=require('../m8-r5-balanced-threat-rebuild');
const {build:r7}=require('../m8-r7-grassy-scarf');
const {build:r8,publicPlans:r8Plans}=require('../m8-r8-dual-setup-lucario');
const {groups}=require('../environment-m7-teams');
const {archetypes}=require('../fixtures');
const {battle,earlyLines}=require('../encore-lead-audit');
const copy=x=>structuredClone(x);
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const foes=[
 {id:'sun',six:()=>groups[2].team,rival:[['Charizard','Garchomp','Mimikyu'],['Garchomp','Primarina','Gholdengo']],
  R5:['Rotom-Heat','Baxcalibur','Metagross'],R7:['Rotom-Heat','Garchomp','Metagross']},
 {id:'rain',six:()=>archetypes.rain,rival:[['Pelipper','Swampert','Archaludon'],['Pelipper','Gholdengo','Rillaboom']],
  R5:['Rotom-Heat','Rillaboom','Gholdengo'],R7:['Rotom-Heat','Rillaboom','Gholdengo']},
 {id:'mence',six:()=>groups[4].team,rival:[['Salamence','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']],
  R5:['Baxcalibur','Metagross','Gholdengo'],R7:['Garchomp','Metagross','Gholdengo']},
 {id:'lucarioZ',six:()=>groups[1].team,rival:[['Lucario','Garchomp','Mimikyu'],['Corviknight','Primarina','Archaludon']],
  R5:['Primarina','Metagross','Rotom-Heat'],R7:['Garchomp','Primarina','Metagross']},
 {id:'gyarados',six:()=>groups[8].team,rival:[['Gyarados','Garchomp','Mimikyu'],['Mimikyu','Gholdengo','Corviknight']],
  R5:['Metagross','Baxcalibur','Rotom-Heat'],R7:['Rotom-Heat','Garchomp','Metagross']},
 {id:'megaGolisopod',six:()=>groups[0].team,rival:[['Golisopod','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']],
  R5:['Primarina','Rotom-Heat','Metagross'],R7:['Rotom-Heat','Garchomp','Metagross']},
 {id:'psychic',six:()=>groups[10].team,rival:[['Indeedee','Gengar','Dragonite'],['Gholdengo','Volcarona','Rillaboom']],
  R5:['Gholdengo','Primarina','Baxcalibur'],R7:['Gholdengo','Primarina','Garchomp']},
 {id:'volcarona',six:()=>groups[13].team,rival:[['Salamence','Volcarona','Dragonite'],['Gholdengo','Skeledirge','Rillaboom']],
  R5:['Baxcalibur','Rotom-Heat','Metagross'],R7:['Garchomp','Rotom-Heat','Metagross']},
 {id:'stall',six:()=>groups[12].team,rival:[['Toxapex','Umbreon','Corviknight'],['Slowbro','Skarmory','Gholdengo']],
  R5:['Gholdengo','Rotom-Heat','Rillaboom'],R7:['Gholdengo','Rotom-Heat','Rillaboom']},
 {id:'charX',six:()=>groups[3].team,rival:[['Charizard','Garchomp','Mimikyu'],['Primarina','Baxcalibur','Gholdengo']],
  R5:['Rotom-Heat','Baxcalibur','Primarina'],R7:['Rotom-Heat','Garchomp','Primarina']}
];
const builds={R5:r5,R7:()=>r7(true),R8:r8};
function trio(c,label){return label==='R8'?r8Plans[c.id]:c[label];}
test('R8 Mega LucarioZ + Mimikyu dual setup and 10 public sixes legal in pinned M-C',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc');
 const own=Object.fromEntries(Object.entries(builds).map(([k,b])=>[k,b()]));
 assert.equal(foes.length,10);assert.equal(Object.keys(own).length,3);
 for(const [name,team] of Object.entries(own)){
  assert.equal(team.length,6,name);
  assert.doesNotThrow(()=>prelim(team,name),name);
  const errors=v.validateTeam(normalize(team));
  assert.ok(!errors?.length,name+': '+JSON.stringify(errors));
  assert.equal(new Set(team.map(p=>p.species)).size,6,name);
 }
 const r8team=own.R8;
 assert.ok(r8team.some(p=>p.species==='Lucario'&&p.item==='Lucarionite Z'&&p.moves.includes('Nasty Plot')),'Special setup');
 assert.ok(r8team.some(p=>p.species==='Mimikyu'&&p.moves.includes('Swords Dance')),'Physical setup');
 assert.ok(r8team.some(p=>p.species==='Garchomp'&&p.item==='Choice Scarf'&&p.moves.includes('Stomping Tantrum')),'Ground');
 assert.ok(r8team.some(p=>p.ability==='Grassy Surge'),'Rain grass');
 for(const c of foes){
  const six=c.six(),errors=v.validateTeam(normalize(six));
  assert.ok(!errors?.length,c.id+' foe:'+JSON.stringify(errors));
  for(const t of c.rival){
   assert.equal(new Set(t).size,3,c.id+' foeThree');
   assert.ok(t.every(s=>six.some(p=>p.species===s)),c.id+' foe member');
  }
  for(const [name,team] of Object.entries(own)){
   const t=trio(c,name);
   assert.equal(new Set(t).size,3,c.id+'/'+name+' own trio');
   assert.ok(t.every(s=>team.some(p=>p.species===s)),c.id+'/'+name+' own member');
  }
 }
});
test('R8 vs R5/R7T ten predeclared public sixes and two opponent 3s: 240 full Battles',{skip},async t=>{
 const sim=load(),own=Object.fromEntries(Object.entries(builds).map(([k,b])=>[k,b()])),rows=[];
 let games=0,errors=0;
 for(const [ci,c] of foes.entries())for(const [ei,foeThree] of c.rival.entries())
 for(const [name,team] of Object.entries(own)){
  const ourThree=trio(c,name),obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(11050100+ci*1000+ei*100+si);
   const r=await battle(sim,copy(team),copy(c.six()),seed,{
    ownThree:ourThree,foeThree,reverse,script:null,rivalImmuneAware:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,c.id+'/'+name);
   obs.push({won:r.won,turns:r.turns,early:!r.won?earlyLines(r.log,r.ownSide,4):undefined});
  }
  rows.push({publicSix:c.id,foeThree,build:name,ownThree:ourThree,
   wins:obs.filter(x=>x.won).length,losses:obs.filter(x=>!x.won).length,
   firstLoss:obs.find(x=>!x.won)?.early?.slice(0,33)});
 }
 assert.equal(games,240);assert.equal(errors,0);assert.equal(rows.length,60);
 t.diagnostic('M8_R8_TEN_PUBLIC_SIX '+JSON.stringify({
  preregistered:'PR #104 comment #6622358063',games,errors,rows,
  noOpponentHiddenTrioAtSelection:true,notHumanWinRate:true,
  heuristicBotRationalityNotVerified:true,perCellTwoSeedsAndSideSwaps:true}));
});
