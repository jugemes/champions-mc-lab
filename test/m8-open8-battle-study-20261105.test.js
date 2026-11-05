'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {candidates,cases,choices,order,validate,runOne}=require('../m8-open8-battle-study-20261105');
const {load,hashSeed}=require('../lab');
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
