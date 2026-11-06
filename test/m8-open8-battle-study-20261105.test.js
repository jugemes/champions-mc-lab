'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {candidates,cases,choices,order,validate,runOne}=require('../m8-open8-battle-study-20261105');
const {load,hashSeed,chooseThree}=require('../lab');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
test('OPEN8 Battle study validates all full sixes and registered branches',{skip},()=>{
 const sim=load();
 assert.equal(Object.keys(candidates()).length,5);
 assert.equal(cases().length,15);
 assert.equal(cases().reduce((n,c)=>n+c.branches.length,0),33);
 for(const [id,team] of Object.entries(candidates())){
  validate(sim,team,id);const all=choices(team);
  assert.equal(all.length,60);
  assert.equal(new Set(all.map(x=>JSON.stringify(order(x)))).size,60);
 }
 for(const c of cases()){
  validate(sim,c.team,c.id);
  for(const b of c.branches){
   assert.equal(new Set(b.three).size,3);
   assert.ok(b.three.every(s=>c.team.some(p=>p.species===s)));
  }
 }
});
test('OPEN8 adapter plays real 3v3, reversed sides and registered rival switch',{skip},async()=>{
 const sim=load(),team=candidates().A_reported,c=cases().find(c=>c.id==='gyarados');
 const choice={three:['Rotom-Wash','Garchomp','Primarina'],lead:'Rotom-Wash'};
 const b=c.branches.find(b=>b.policy==='switch');
 for(const reverse of [false,true]){
  const r=await runOne(sim,team,c,choice,b,hashSeed(38083300),reverse);
  assert.equal(typeof r.won,'boolean');assert.ok(r.turns>0);
  assert.deepEqual(r.actualFoe,b.three);
  const side=reverse?'p1':'p2';
  assert.ok(r.choices.some(x=>x.side===side&&x.turn===1&&x.choice.startsWith('switch ')&&x.chosenSpecies==='Garchomp'));
 }
});
test('OPEN9 substitution preserves the old O2 and validates both complete sixes',{skip},()=>{
 const sim=load(),{candidates:build}=require('../m8-open9-sand-bridge-20261105');
 const x=build();
 for(const [id,t] of Object.entries(x))validate(sim,t,id);
 assert.deepEqual(x.O2_control,candidates().O2_selection_retest);
 const old=x.O2_control,newTeam=x.O8_sand_bridge;
 assert.equal(newTeam.filter(p=>p.species==='Tyranitar').length,1);
 assert.equal(newTeam.filter(p=>p.species==='Gholdengo').length,0);
 assert.deepEqual(old.filter(p=>p.species!=='Gholdengo'),newTeam.filter(p=>p.species!=='Tyranitar'));
});
test('Supplementary gimmick branches are legal and scripted setup really starts',{skip},async()=>{
 const sim=load(),{scenarios,script}=require('../m8-open8-gimmick-diagnostics-20261105');
 const {battle}=require('../encore-lead-audit');
 const team=candidates().O2_selection_retest;
 for(const c of scenarios())validate(sim,c.team,c.id);
 for(const id of ['snowVeil','trickRoom','screens']){
  const c=scenarios().find(c=>c.id===id);
  const r=await battle(sim,structuredClone(team),c.team,hashSeed(48084400),{
   ownThree:chooseThree(sim.Dex.mod('champions'),team,c.team.map(p=>p.species)).map(i=>team[i-1].species),foeThree:c.threes[0],reverse:false,
   script:script(c.move),rivalImmuneAware:true,choiceAudit:true});
  assert.equal(r.errors,0);
  assert.ok(new RegExp('\\|-(?:sidestart|fieldstart)\\|[^\\n]*'+c.move).test(r.log),id+' actual field/side condition');
 }
});
