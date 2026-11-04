'use strict';
// M8: preregistered PR104 comment #6620591402; exact engine T1 counterfactuals,
// not a new opponent distribution, optimal policy, or ranked win-rate metric.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize,hashSeed}=require('../lab');
const {engineBattle}=require('../hybrid01-audit');
const {candidates}=require('../m8-rebuild-candidates');
const {groups}=require('../environment-m7-teams');
const {archetypes}=require('../fixtures');
const clone=x=>structuredClone(x);
const defs=[
 {id:'sun_CharizardY_plus_Garch_Mimikyu',enemy:()=>groups[2].team,
  enemyTeam:'124', ownTeam:'164',
  ownCases:[
   ['mega_draco','move 2 mega'],
   ['mega_flamethrower','move 3 mega'],
   ['pivot_to_sand','switch 2']],
  foeCases:[
   ['Y_solarbeam','move 2 mega'],
   ['Y_flamethrower','move 1 mega'],
   ['pivot_Mimikyu','switch 3']]},
 {id:'rain_Pelipper_Swampert_Archaludon',enemy:()=>archetypes.rain,
  enemyTeam:'123',
  ownCases:[
   ['Tyranitar_rock','651','move 1'],
   ['Tyranitar_to_Rillaboom','651','switch 2'],
   ['Rillaboom_grassyGlide','561','move 1'],
   ['Rillaboom_to_Tyranitar','561','switch 2']],
  foeCases:[
   ['Pelipper_hurricane','move 1'],
   ['Pelipper_uturn','move 3'],
   ['switch_to_Swampert','switch 2']]},
 {id:'megaSalamence_Garchomp_Mimikyu',enemy:()=>groups[4].team,
  enemyTeam:'124',ownTeam:'213',
  ownCases:[
   ['Mimikyu_playRough','move 1'],
   ['Mimikyu_swordsDance','move 3'],
   ['Mimikyu_shadowSneak','move 2']],
  foeCases:[
   ['Mence_dragonDance','move 1 mega'],
   ['Mence_doubleEdge','move 2 mega'],
   ['switch_to_Garchomp','switch 2']]}
];
test('R1 T1 branch preregistration 9+12+9, legal sets and moves',{skip:!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable'},()=>{
 const sim=load(),v=sim.TeamValidator.get('gen9championsbssregmc');
 const ours=candidates().R1_megaGarchZ_sand_doubleSetup;
 assert.equal(defs.length,3);
 assert.deepEqual(defs.map(d=>d.ownCases.length*d.foeCases.length),[9,12,9]);
 assert.ok(!v.validateTeam(normalize(ours))?.length);
 for(const d of defs){const foe=d.enemy();
  assert.equal(foe.length,6);
  assert.ok(!v.validateTeam(normalize(foe))?.length,d.id);
  for(const a of d.ownCases)assert.match(a.at(-1),/^(move [1-4]( mega)?|switch [1-3])$/);
  for(const a of d.foeCases)assert.match(a[1],/^(move [1-4]( mega)?|switch [1-3])$/);
 }
});
test('R1 fixed T1: 120 exact Showdown engine branches including enemy switches',{skip:!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable'},t=>{
 const sim=load(),ours=candidates().R1_megaGarchZ_sand_doubleSetup,results=[];
 let observations=0;
 for(const [di,d] of defs.entries())for(const [oi,our]of d.ownCases.entries())for(const [fi,foe]of d.foeCases.entries()){
  const [ourName,ourTeam,ourChoice]=our.length===3?our:[our[0],d.ownTeam,our[1]];
  const rows=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(11049990+di*500+oi*100+fi*10+si),their=d.enemy();
   const b=engineBattle(sim,
      reverse?clone(their):clone(ours),reverse?clone(ours):clone(their),seed,
      [reverse?[foe[1],ourChoice]:[ourChoice,foe[1]]],
      reverse?d.enemyTeam:ourTeam,reverse?ourTeam:d.enemyTeam);
   const ownSide=b.sides[reverse?1:0],rivalSide=b.sides[reverse?0:1];
   const moves=b.log.filter(x=>x.startsWith('|move|'));
   const err=b.log.filter(x=>x.startsWith('|error|'));
   assert.equal(err.length,0,d.id+'/'+ourName+'/'+foe[0]+': '+JSON.stringify(err));
   assert.ok(b.turn>=1,d.id+'/'+ourName+'/'+foe[0]+' turn never advanced');
   const part=s=>({mon:s.active?.[0]?.species?.name||s.active?.[0]?.name||'',
      hp:Math.round(1000*(s.active?.[0]?.hp||0)/(s.active?.[0]?.maxhp||1))/1000,
      fainted:!!s.active?.[0]?.fainted});
   rows.push({reverse,own:part(ownSide),foe:part(rivalSide),
    moves:moves.map(x=>x.split('|').slice(2,5).join(':')),
    weather:b.field?.weather||null,
    immunity:b.log.filter(x=>x.startsWith('|-immune|')).slice(0,2),
    log:b.log.filter(x=>/^\|(switch|move|faint|-mega|-weather|-immune)\|/.test(x)).slice(-13)});
   observations++;
  }
  results.push({id:d.id,own:ourName,foe:foe[0],ourChoice,foeChoice:foe[1],rows});
 }
 assert.equal(results.length,30);
 assert.equal(observations,120);
 t.diagnostic('M8_R1_T1_COUNTERFACTUAL '+JSON.stringify({branches:30,
  randomizedSideSeedExecutions:120,notPerformanceRanking:true,
  enemyRealThreeKnownOnlyToOracle:true,results}));
});
