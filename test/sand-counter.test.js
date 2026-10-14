'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {candidates}=require('../sand-counter-variants');
const {validate,OPP}=require('../sand-counter-audit');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
test('single-slot sand teams and same 13 public-six enemies are all M-C legal',()=>{
 const teams=candidates();
 assert.equal(Object.keys(teams).length,7);
 assert.doesNotThrow(()=>validate(sim,teams));
 assert.doesNotThrow(()=>validate(sim,OPP));
 for(const [name,t]of Object.entries(teams)){
  const base=teams[name.startsWith('C')?'C0_standard':'E0_standard'];
  const changed=t.filter((p,i)=>JSON.stringify(p)!==JSON.stringify(base[i]));
  assert.equal(changed.length,name.endsWith('standard')?0:1,name);
  if(!name.endsWith('standard'))assert.equal(changed[0].species,'Tyranitar');
 }
});