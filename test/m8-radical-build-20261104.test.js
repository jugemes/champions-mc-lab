'use strict';
// M-8 fundamental rebuilding, preregistered before result in PR #104 comment
// #6620330707. No artificial test outcomes may rank human ladder teams.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize,prelim,hashSeed}=require('../lab');
const {candidates,publicPreviewPlans}=require('../m8-rebuild-candidates');
const {groups}=require('../environment-m7-teams');
const {archetypes}=require('../fixtures');
const {battle,earlyLines}=require('../encore-lead-audit');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const copy=x=>structuredClone(x);
const foes=[
 {id:'sun',team:groups[2].team,threes:[
  ['Charizard','Garchomp','Mimikyu'],
  ['Garchomp','Primarina','Gholdengo']]},
 {id:'rain',team:archetypes.rain,threes:[
  ['Pelipper','Swampert','Archaludon'],
  ['Pelipper','Gholdengo','Rillaboom']]},
 {id:'megaGolisopod',team:groups[0].team,threes:[
  ['Golisopod','Garchomp','Mimikyu'],
  ['Hippowdon','Primarina','Gholdengo']]},
 {id:'megaSalamence',team:groups[4].team,threes:[
  ['Salamence','Garchomp','Mimikyu'],
  ['Hippowdon','Primarina','Gholdengo']]},
 {id:'stall',team:archetypes.stall,threes:[
  ['Toxapex','Umbreon','Corviknight'],
  ['Slowbro','Skarmory','Gholdengo']]}
];
test('M8 radical teams and ten public-preview selection plans are Champions M-C legal',{skip},()=>{
 const sim=load(),v=sim.TeamValidator.get('gen9championsbssregmc'),own=candidates();
 assert.equal(Object.keys(own).length,2);
 for(const [id,team] of Object.entries(own)){
  assert.equal(team.length,6,id);
  assert.doesNotThrow(()=>prelim(team,id),id);
  assert.ok(!v.validateTeam(normalize(team))?.length,id+': '+JSON.stringify(v.validateTeam(normalize(team))));
  const noMega=team.filter(p=>/ite(?: [XYZ])?$/.test(p.item));
  assert.equal(noMega.length,1,id+' single Mega route, no double mega conflicts');
  assert.ok(team.some(p=>p.ability==='Sand Stream'),id+' should control weather');
  assert.ok(team.filter(p=>p.moves.some(m=>['Swords Dance','Nasty Plot','Dragon Dance'].includes(m))).length>=2,id+' two setup routes');
 }
 assert.equal(foes.length,5);
 for(const x of foes){
  assert.equal(x.team.length,6);
  assert.equal(new Set(x.team.map(p=>p.item)).size,6,x.id+' unique items');
  assert.ok(!v.validateTeam(normalize(x.team))?.length,x.id+' foe legal');
  for(const trio of x.threes){
   assert.equal(new Set(trio).size,3,x.id);
   assert.ok(trio.every(s=>x.team.some(p=>p.species===s)),x.id);
  }
  for(const [id,team] of Object.entries(own)){
   const three=publicPreviewPlans[x.id][id];
   assert.equal(new Set(three).size,3);
   assert.ok(three.every(s=>team.some(p=>p.species===s)),x.id+'/'+id);
  }
 }
 // R1 GarchZ uses Earth Power, not Earthquake, under ally Grassy Surge.
 const r1=own.R1_megaGarchZ_sand_doubleSetup;
 assert.ok(r1.find(x=>x.species==='Garchomp').moves.includes('Earth Power'));
 assert.equal(r1.find(x=>x.species==='Garchomp').moves.includes('Earthquake'),false);
 // R2 Hippowdon Earthquake team lacks Rillaboom's field setter.
 const r2=own.R2_megaCharX_hippo_setup;
 assert.ok(r2.find(x=>x.species==='Hippowdon').moves.includes('Earthquake'));
 assert.equal(r2.some(x=>x.ability==='Grassy Surge'),false);
});
test('M8 radical teams: preregistered 80 pinned full battles; report strategy branches without artificial win ranking',{skip},async t=>{
 const sim=load(),own=candidates(),observations=[];
 let battles=0,errors=0;
 for(const [fi,x] of foes.entries())
 for(const [ei,foeThree] of x.threes.entries())
 for(const [ci,[id,team]] of Object.entries(own).entries()){
  const ourThree=publicPreviewPlans[x.id][id], rows=[];
  for(let s=0;s<2;s++)for(const reverse of [false,true]){
   const seed=hashSeed(11049000+fi*1000+ei*100+s);
   const r=await battle(sim,copy(team),copy(x.team),seed,{
    ownThree:ourThree,foeThree,reverse,script:null,rivalImmuneAware:true});
   battles++;errors+=r.errors;
   assert.equal(r.errors,0,x.id+'/'+id+' invalid action');
   const l=r.log.split('\n');
   rows.push({won:r.won,turns:r.turns,reverse,
    ownFainted:l.filter(z=>z.startsWith('|faint|'+r.ownSide+'a:')).length,
    foeFainted:l.filter(z=>z.startsWith('|faint|'+r.foeSide+'a:')).length,
    firstTurns:!r.won?earlyLines(r.log,r.ownSide,2):undefined});
  }
  observations.push({preview:x.id,foeThree,ownBuild:id,ownThree:ourThree,
   wins:rows.filter(z=>z.won).length,losses:rows.filter(z=>!z.won).length,
   chosenOpponentStrategyCount:1,rows});
 }
 assert.equal(battles,80);
 assert.equal(errors,0);
 assert.equal(observations.length,20);
 t.diagnostic('M8_RADICAL_BUILD_PREDECLARED '+JSON.stringify({
  source:'synthetic M-C legal hypotheses; PR104 #6620330707',
  notLadderWinRate:true,opponentAiRationalityUncertified:true,
  pairedSeedCount:2,sideReversals:2,
  battles,errors,observations}));
});
