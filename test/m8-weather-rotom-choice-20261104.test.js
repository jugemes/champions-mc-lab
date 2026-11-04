'use strict';
// M8 radical followup: PR104 issuecomment-6620657980 fixed before outcomes.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize,prelim,hashSeed}=require('../lab');
const {engineBattle}=require('../hybrid01-audit');
const {candidates,publicPlans}=require('../m8-weather-resilient-candidates');
const {groups}=require('../environment-m7-teams');
const {archetypes}=require('../fixtures');
const {battle,earlyLines}=require('../encore-lead-audit');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const cp=x=>structuredClone(x);
const cases=[
 {id:'sun',foe:()=>groups[2].team,threes:[
  ['Charizard','Garchomp','Mimikyu'],['Garchomp','Primarina','Gholdengo']]},
 {id:'rain',foe:()=>archetypes.rain,threes:[
  ['Pelipper','Swampert','Archaludon'],['Pelipper','Gholdengo','Rillaboom']]},
 {id:'megaGolisopod',foe:()=>groups[0].team,threes:[
  ['Golisopod','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']]},
 {id:'megaSalamence',foe:()=>groups[4].team,threes:[
  ['Salamence','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']]},
 {id:'stall',foe:()=>archetypes.stall,threes:[
  ['Toxapex','Umbreon','Corviknight'],['Slowbro','Skarmory','Gholdengo']]}
];
test('M8 Heat/Wash full-team alternatives and their public-preview trios validate',{skip},()=>{
 const sim=load(),v=sim.TeamValidator.get('gen9championsbssregmc');
 const own=candidates();
 assert.equal(Object.keys(own).length,2);
 for(const [id,team] of Object.entries(own)){
  assert.equal(team.length,6);
  assert.doesNotThrow(()=>prelim(team,id),id);
  const problems=v.validateTeam(normalize(team));
  assert.ok(!problems?.length,id+': '+JSON.stringify(problems));
  assert.equal(team.some(p=>p.ability==='Sand Stream'),false);
  assert.equal(team.filter(p=>p.item==='Leftovers').length,1);
  assert.ok(team.some(p=>p.item==='Garchompite Z'));
 }
 for(const x of cases){
  const foe=x.foe();
  assert.equal(foe.length,6);
  assert.ok(!v.validateTeam(normalize(foe))?.length,x.id+' foe legality');
  for(const trio of x.threes){
   assert.ok(trio.every(s=>foe.some(p=>p.species===s)),x.id+' chosen rival three');
  }
  for(const [id,team] of Object.entries(own)){
   const trio=publicPlans[x.id][id];
   assert.equal(trio.length,3);
   assert.equal(new Set(trio).size,3);
   assert.ok(trio.every(s=>team.some(p=>p.species===s)),x.id+'/'+id);
  }
 }
});
test('M8 Heat vs Wash Rotom: T1 engine damage under CharY sun and Pelipper rain',{skip},t=>{
 const sim=load(),own=candidates(),rows=[];
 const battles=[
  {id:'sun',foe:cases[0].foe,ownTeam:'614',foeTeam:'124',
   foeBranches:[['Y_solar','move 2 mega'],['Y_flame','move 1 mega']]},
  {id:'rain',foe:cases[1].foe,ownTeam:'651',foeTeam:'123',
   foeBranches:[['Pel_hurricane','move 1'],['Pel_uturn','move 3']]}
 ];
 for(const [i,x]of battles.entries())for(const [id,team] of Object.entries(own))
 for(const [enemyName,enemyMove]of x.foeBranches){
  const observations=[];
  for(let s=0;s<2;s++)for(const reverse of [false,true]){
   const seed=hashSeed(11049800+i*100+s),opp=x.foe();
   const b=engineBattle(sim,reverse?cp(opp):cp(team),reverse?cp(team):cp(opp),seed,
    [reverse?[enemyMove,'move 3']:['move 3',enemyMove]],
    reverse?x.foeTeam:x.ownTeam,reverse?x.ownTeam:x.foeTeam);
   const ownSide=b.sides[reverse?1:0],enemySide=b.sides[reverse?0:1];
   const problems=b.log.filter(l=>l.startsWith('|error|'));
   assert.equal(problems.length,0,id+'/'+x.id+': '+JSON.stringify(problems));
   const hp=side=>Math.round(1000*(side.active?.[0]?.hp||0)/(side.active?.[0]?.maxhp||1))/1000;
   observations.push({reverse,ownHP:hp(ownSide),enemyHP:hp(enemySide),
    ownFainted:!!ownSide.active?.[0]?.fainted,
    rivalFainted:!!enemySide.active?.[0]?.fainted,
    turn:b.turn,weather:b.field.weather||'',
    events:b.log.filter(l=>/^\|(move|faint|-damage|-mega|-weather|-immune|switch)\|/.test(l)).slice(-12)});
  }
  rows.push({case:x.id,build:id,enemy:enemyName,ourAction:'Thunderbolt',
   observations});
 }
 assert.equal(rows.length,8);
 assert.ok(rows.every(r=>r.observations.length===4));
 t.diagnostic('M8_ROTOM_FORM_T1 '+JSON.stringify({rows,
  notLadderWinRate:true,opponentHypothesesAreNotActualHiddenSets:true}));
});
test('M8 Heat vs Wash: same ten predeclared rival trios, 80 full Battles',{skip},async t=>{
 const sim=load(),own=candidates(),rows=[];let games=0,errors=0;
 for(const [ci,x]of cases.entries())for(const [ei,foeThree]of x.threes.entries())
 for(const [id,team]of Object.entries(own)){
  const ownThree=publicPlans[x.id][id],obs=[];
  for(let s=0;s<2;s++)for(const reverse of [false,true]){
   const seed=hashSeed(11049500+ci*1000+ei*100+s);
   const r=await battle(sim,cp(team),cp(x.foe()),seed,{
    ownThree,foeThree,reverse,script:null,rivalImmuneAware:true});
   games++;errors+=r.errors;
   assert.equal(r.errors,0,x.id+'/'+id);
   const log=r.log.split('\n');
   obs.push({won:r.won,reverse,turns:r.turns,
    ownFainted:log.filter(l=>l.startsWith('|faint|'+r.ownSide+'a:')).length,
    foeFainted:log.filter(l=>l.startsWith('|faint|'+r.foeSide+'a:')).length,
    firstTurns:!r.won?earlyLines(r.log,r.ownSide,2):undefined});
  }
  rows.push({preview:x.id,foeThree,ownBuild:id,ownThree,
   wins:obs.filter(x=>x.won).length,losses:obs.filter(x=>!x.won).length,obs});
 }
 assert.equal(games,80);
 assert.equal(errors,0);
 assert.equal(rows.length,20);
 t.diagnostic('M8_ROTOM_FORM_FULL '+JSON.stringify({games,errors,rows,
  rivalAiRationalityUncertified:true,notPerformanceRanking:true,
  samePublicPreviewForBothForms:true}));
});
