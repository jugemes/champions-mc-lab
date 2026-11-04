'use strict';
// M-8 R4-Bax fixed BEFORE outcomes in PR #104 issuecomment-6620782432.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,prelim,normalize,hashSeed}=require('../lab');
const {engineBattle}=require('../hybrid01-audit');
const {candidates:old,publicPlans:oldPlans}=require('../m8-weather-resilient-candidates');
const {build,publicPlans}=require('../m8-baxcalibur-rebuild');
const {groups}=require('../environment-m7-teams');
const {archetypes}=require('../fixtures');
const {battle,earlyLines}=require('../encore-lead-audit');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const clone=x=>structuredClone(x);
const cases=[
 {id:'sun',team:groups[2].team,foe:[
  ['Charizard','Garchomp','Mimikyu'],['Garchomp','Primarina','Gholdengo']]},
 {id:'rain',team:archetypes.rain,foe:[
  ['Pelipper','Swampert','Archaludon'],['Pelipper','Gholdengo','Rillaboom']]},
 {id:'megaGolisopod',team:groups[0].team,foe:[
  ['Golisopod','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']]},
 {id:'megaSalamence',team:groups[4].team,foe:[
  ['Salamence','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']]},
 {id:'stall',team:archetypes.stall,foe:[
  ['Toxapex','Umbreon','Corviknight'],['Slowbro','Skarmory','Gholdengo']]}
];
test('M-8 R4 Baxcalibur: full-six legal, anti-Dragon and multi-weather roles',{skip},()=>{
 const sim=load(),v=sim.TeamValidator.get('gen9championsbssregmc');
 const team=build(),oldTeam=old().R3_heat_noSand;
 assert.equal(team.length,6);
 assert.doesNotThrow(()=>prelim(team,'R4Bax'));
 assert.ok(!v.validateTeam(normalize(team))?.length,'R4 full legal');
 assert.equal(team.filter(x=>x.item==='Focus Sash').length,1);
 assert.ok(team.find(x=>x.species==='Baxcalibur').moves.includes('Ice Shard'));
 assert.equal(team.some(x=>x.species==='Primarina'),false);
 assert.ok(oldTeam.some(x=>x.species==='Primarina'));
 for(const x of cases){assert.ok(!v.validateTeam(normalize(x.team))?.length,x.id);
  assert.ok(publicPlans[x.id].every(s=>team.some(y=>y.species===s)),x.id);
  assert.ok(oldPlans[x.id].R3_heat_noSand.every(s=>oldTeam.some(y=>y.species===s)),x.id);
  for(const trio of x.foe)assert.ok(trio.every(s=>x.team.some(y=>y.species===s)),x.id);
 }
});
test('R4 Baxcalibur executed Ice priority/crash vs Mega Salamence and Scarf Garchomp',{skip},t=>{
 const sim=load(),ours=build(),arr=[];
 const scenarios=[
  {id:'MegaMence',foe:groups[4].team,enemyTeam:'124',
   enemies:[['dragonDance','move 1 mega'],['doubleEdge','move 2 mega'],['GarchompPivot','switch 2']]},
  {id:'ScarfGarch',foe:groups[4].team,enemyTeam:'214',
   enemies:[['dragonClaw','move 2'],['poisonJab','move 4'],['MimikyuPivot','switch 3']]}
 ];
 for(const [ci,x]of scenarios.entries())
 for(const [action,ownChoice]of [['iceShard','move 1'],['icicleCrash','move 4']])
 for(const [enemyName,enemyChoice]of x.enemies){
  const rows=[];
  for(let s=0;s<2;s++)for(const reverse of [false,true]){
   const b=engineBattle(sim,
    reverse?clone(x.foe):clone(ours),reverse?clone(ours):clone(x.foe),
    hashSeed(11049600+ci*300+s),
    [reverse?[enemyChoice,ownChoice]:[ownChoice,enemyChoice]],
    reverse?x.enemyTeam:'436',reverse?'436':x.enemyTeam);
   const o=b.sides[reverse?1:0],enemy=b.sides[reverse?0:1];
   const errs=b.log.filter(l=>l.startsWith('|error|'));
   assert.equal(errs.length,0,x.id+'/'+action+'/'+enemyName+JSON.stringify(errs));
   const hp=z=>Math.round(1000*(z.active?.[0]?.hp||0)/(z.active?.[0]?.maxhp||1))/1000;
   rows.push({reverse,ownHP:hp(o),enemyHP:hp(enemy),
    ownFaint:!!o.active?.[0]?.fainted,enemyFaint:!!enemy.active?.[0]?.fainted,
    events:b.log.filter(l=>/^\|(move|faint|-damage|-mega|-activate|-immune|switch)\|/.test(l)).slice(-12)});
  }
  arr.push({case:x.id,action,enemy:enemyName,rows});
 }
 assert.equal(arr.length,12);
 assert.ok(arr.every(x=>x.rows.length===4));
 t.diagnostic('M8_BAX_ICE_T1 '+JSON.stringify({rows:arr,
  engineTrials:48,foeSetsHypothetical:true,notPerformanceEvidence:true}));
});
test('R3H vs R4Bax: same 10 predeclared rational-trio hypotheses, 80 full Battles',{skip},async t=>{
 const sim=load(),oldTeam=old().R3_heat_noSand,newTeam=build();
 const builds=[
  {id:'R3H_Pri',team:oldTeam,plan:Object.fromEntries(cases.map(x=>[x.id,oldPlans[x.id].R3_heat_noSand]))},
  {id:'R4Bax',team:newTeam,plan:publicPlans}
 ];
 const rows=[];let games=0,errors=0;
 for(const [ci,x]of cases.entries())
 for(const [ei,foeThree]of x.foe.entries())
 for(const b of builds){
  const ownThree=b.plan[x.id],obs=[];
  for(let s=0;s<2;s++)for(const reverse of [false,true]){
   const seed=hashSeed(11049500+ci*1000+ei*100+s);
   const r=await battle(sim,clone(b.team),clone(x.team),seed,{
    ownThree,foeThree,reverse,script:null,rivalImmuneAware:true});
   games++;errors+=r.errors;
   assert.equal(r.errors,0,x.id+'/'+b.id);
   const log=r.log.split('\n');
   obs.push({won:r.won,turns:r.turns,reverse,
    ownFaints:log.filter(z=>z.startsWith('|faint|'+r.ownSide+'a:')).length,
    rivalFaints:log.filter(z=>z.startsWith('|faint|'+r.foeSide+'a:')).length,
    early:!r.won?earlyLines(r.log,r.ownSide,2):undefined});
  }
  rows.push({preview:x.id,foeThree,ownBuild:b.id,ownThree,
   wins:obs.filter(o=>o.won).length,losses:obs.filter(o=>!o.won).length,obs});
 }
 assert.equal(games,80);
 assert.equal(errors,0);
 assert.equal(rows.length,20);
 t.diagnostic('M8_R4BAX_HOLDOUT '+JSON.stringify({games,errors,rows,
  opponentAIRationalityUncertified:true,noHumanWinRateClaim:true}));
});
