'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {getCandidates}=require('../e-unaware-variants');
const {assertLegal,trialId,args}=require('../e-unaware-audit');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
test('E anti-setup candidates are legitimate M-C teams',()=>{
 const teams=getCandidates();
 assert.equal(Object.keys(teams).length,6);
 assert.doesNotThrow(()=>assertLegal(sim,teams));
});
test('each E restoration changes one and only one roster member',()=>{
 const teams=getCandidates(),base=teams.E0_noUnaware;
 for(const [name,team] of Object.entries(teams)){
  if(name==='E0_noUnaware'||name==='C_reference')continue;
  const changed=team.filter((p,i)=>p.species!==base[i].species);
  assert.equal(changed.length,1,name);
  assert.equal(changed[0].species,'Skeledirge');
  assert.equal(team.filter(p=>p.species==='Skeledirge').length,1);
  for(const p of team){
   if(p.species==='Skeledirge')continue;
   assert.deepEqual(p,base.find(x=>x.species===p.species));
  }
 }
 assert.deepEqual(args(['--per-case','75']),{count:75});
 assert.notEqual(trialId('development','v2','rain',3),trialId('holdout','v2','rain',3));
});