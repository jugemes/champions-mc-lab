'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {teamsForMoveAudit}=require('../garchomp-move-variants');
const {assertLegal,CASES,POLICIES,trialId,args}=require('../garchomp-move-audit');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
test('all proposed moves are legal in the fixed Champions M-C engine',()=>{
 const t=teamsForMoveAudit(),names=Object.keys(t);
 assert.equal(names.length,5);
 assert.doesNotThrow(()=>assertLegal(sim,t));
});
test('all C variants modify exactly one attack with all other set properties equal',()=>{
 const t=teamsForMoveAudit();
 const base=t.C0_Earthquake;
 const g=base.find(p=>p.species==='Garchomp');
 assert.deepEqual(g.moves,['Earthquake','Dragon Claw','Rock Slide','Poison Jab']);
 for(const [name,team] of Object.entries(t)){
  if(name==='E_reference')continue;
  const b=structuredClone(base),candidate=structuredClone(team);
  const gl=b.find(p=>p.species==='Garchomp'),gc=candidate.find(p=>p.species==='Garchomp');
  assert.deepEqual({...gl,moves:[]},{...gc,moves:[]},name);
  assert.equal(gl.moves.filter(m=>!gc.moves.includes(m)).length,name==='C0_Earthquake'?0:1,name);
  assert.equal(gc.moves.filter(m=>!gl.moves.includes(m)).length,name==='C0_Earthquake'?0:1,name);
  for(const p of candidate){
   if(p.species==='Garchomp')continue;
   assert.deepEqual(p,base.find(x=>x.species===p.species),name);
  }
 }
});
test('all opponent six lineups are legal and each seed is paired by pool-policy-scenario-index',()=>{
 for(const [pool,opps] of Object.entries(CASES)){
  assert.doesNotThrow(()=>assertLegal(sim,Object.fromEntries(Object.entries(opps).map(([n,t])=>[pool+n,t]))));
 }
 assert.equal(POLICIES.length,2);
 assert.notEqual(trialId('development','baseline','rain',4),trialId('holdout','baseline','rain',4));
 assert.deepEqual(args(['--per-case','100']),{count:100});
 assert.throws(()=>args(['--per-case','251']));
});