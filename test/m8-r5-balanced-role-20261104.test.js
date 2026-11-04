'use strict';
// Predeclared R5 balance: PR #104 comment #6620917760 (before outcomes).\n// This full-team test is not a substitute for rational-opponent validation.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize,prelim,hashSeed}=require('../lab');
const {build,publicPlans}=require('../m8-r5-balanced-threat-rebuild');
const {groups}=require('../environment-m7-teams');
const {archetypes}=require('../fixtures');
const {engineBattle}=require('../hybrid01-audit');
const {battle,earlyLines}=require('../encore-lead-audit');
const clone=x=>structuredClone(x);
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const foes=[
 {id:'sun',team:groups[2].team,choices:[
  ['Charizard','Garchomp','Mimikyu'],['Garchomp','Primarina','Gholdengo']]},
 {id:'rain',team:archetypes.rain,choices:[
  ['Pelipper','Swampert','Archaludon'],['Pelipper','Gholdengo','Rillaboom']]},
 {id:'megaGolisopod',team:groups[0].team,choices:[
  ['Golisopod','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']]},
 {id:'megaSalamence',team:groups[4].team,choices:[
  ['Salamence','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']]},
 {id:'stall',team:archetypes.stall,choices:[
  ['Toxapex','Umbreon','Corviknight'],['Slowbro','Skarmory','Gholdengo']]}
];
test('M8 R5 full-six M-C legality and public preview plans including Bax Dragon Dance',{skip},()=>{
 const sim=load(),v=sim.TeamValidator.get('gen9championsbssregmc');
 const six=build();
 assert.deepEqual(six.map(p=>p.species),
  ['Metagross','Baxcalibur','Rotom-Heat','Rillaboom','Primarina','Gholdengo']);
 assert.doesNotThrow(()=>prelim(six,'R5'));
 const bad=v.validateTeam(normalize(six));
 assert.ok(!bad?.length,'R5 validation: '+JSON.stringify(bad));
 assert.equal(six.filter(p=>p.item.endsWith('ite')).length,1);
 assert.ok(six.find(p=>p.species==='Baxcalibur').moves.includes('Dragon Dance'));
 assert.ok(six.find(p=>p.species==='Gholdengo').moves.includes('Nasty Plot'));
 for(const x of foes){
  assert.ok(!v.validateTeam(normalize(x.team))?.length,x.id);
  const three=publicPlans[x.id];
  assert.equal(three.length,3);
  assert.equal(new Set(three).size,3);
  assert.ok(three.every(s=>six.some(p=>p.species===s)),x.id);
  for(const opponent of x.choices)
   assert.ok(opponent.every(s=>x.team.some(p=>p.species===s)),x.id+' rival');
 }
});
test('R5 Mega Metagross priority steel vs Mimikyu Disguise/SD and Ghost attack',{skip},t=>{
 const sim=load(),us=build(),rival=groups[4].team,rows=[];
 for(const [ourName,ourAction] of [['BulletPunch','move 3 mega'],['MeteorMash','move 1 mega']])
 for(const [foeName,foeAction] of [['SwordsDance','move 3'],['ShadowClaw','move 4']]){
  const observations=[];
  for(let s=0;s<2;s++)for(const reverse of [false,true]){
   const seed=hashSeed(11049720+s),
    ownMoves=[ourAction,'move 3'],theirMoves=[foeAction,'move 2'];
   const turns=[0,1].map(i=>reverse?[theirMoves[i],ownMoves[i]]:[ownMoves[i],theirMoves[i]]);
   const b=engineBattle(sim,reverse?clone(rival):clone(us),
    reverse?clone(us):clone(rival),seed,turns,
    reverse?'421':'123',reverse?'123':'421');
   const own=b.sides[reverse?1:0],opp=b.sides[reverse?0:1];
   const errors=b.log.filter(l=>l.startsWith('|error|'));
   assert.equal(errors.length,0,ourName+'/'+foeName+JSON.stringify(errors));
   const hp=z=>Math.round(1000*(z.active?.[0]?.hp||0)/(z.active?.[0]?.maxhp||1))/1000;
   observations.push({reverse,ownHP:hp(own),enemyHP:hp(opp),
    ownFaint:!!own.active?.[0]?.fainted,enemyFaint:!!opp.active?.[0]?.fainted,
    events:b.log.filter(l=>/^\|(move|faint|-damage|-mega|-activate|-immune|switch)\|/.test(l)).slice(-20)});
  }
  rows.push({ourName,foeName,observations});
 }
 assert.equal(rows.length,4);
 assert.ok(rows.every(x=>x.observations.length===4));
 t.diagnostic('M8_R5_META_MIMIKYU_TWO_TURNS '+JSON.stringify({rows,
  exactEngine:true,notHumanWinRate:true}));
});
test('M8 R5 balanced: 40 full-pinned Battles against same ten opponent trio branches',{skip},async t=>{
 const sim=load(),team=build(),rows=[];let games=0,errors=0;
 for(const [ci,x] of foes.entries())for(const [ei,foeThree] of x.choices.entries()){
  const ownThree=publicPlans[x.id],obs=[];
  for(let s=0;s<2;s++)for(const reverse of [false,true]){
   const seed=hashSeed(11049500+ci*1000+ei*100+s);
   const r=await battle(sim,clone(team),clone(x.team),seed,{
    ownThree,foeThree,reverse,script:null,rivalImmuneAware:true});
   games++;errors+=r.errors;
   assert.equal(r.errors,0,x.id+' '+JSON.stringify(foeThree));
   const l=r.log.split('\n');
   obs.push({won:r.won,turns:r.turns,reverse,
    ownKO:l.filter(z=>z.startsWith('|faint|'+r.ownSide+'a:')).length,
    foeKO:l.filter(z=>z.startsWith('|faint|'+r.foeSide+'a:')).length,
    early:!r.won?earlyLines(r.log,r.ownSide,2):undefined});
  }
  rows.push({preview:x.id,foeThree,ownThree,
   wins:obs.filter(x=>x.won).length,losses:obs.filter(x=>!x.won).length,
   observations:obs});
 }
 assert.equal(games,40);
 assert.equal(errors,0);
 assert.equal(rows.length,10);
 t.diagnostic('M8_R5_BALANCE_FULL '+JSON.stringify({games,errors,rows,
  fixedPublicPreview:true,botRationalityNotGuaranteed:true,
  notPerformanceRanking:true}));
});
