'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {treatments,presets,focus}=require('../m8-counterfactual-selection');
const {groups}=require('../environment-m7-teams');
test('counterfactual treatments depend on own six and enemy PUBLIC six, not hidden enemy three',()=>{
 assert.equal(focus.length,4);
 for(const name of focus){
  const team=groups.find(g=>g.name===name);
  const before=treatments(team);
  const changed=structuredClone(team);
  changed.forcedA=[...team.forcedB];
  changed.forcedB=[...team.forcedA];
  assert.deepEqual(treatments(changed),before,
    'Treatment must not change just because real synthetic opponent picks different three');
  assert.ok(before.length>=15);
  for(const t of before){
   assert.equal(t.three.length,3);assert.equal(new Set(t.three).size,3);
   assert.ok(t.three.every(n=>[
     'Metagross','Hydreigon','Primarina','Garchomp','Tyranitar','Rotom-Wash'
   ].includes(n)));
  }
 }
});
test('every declared option is same six, with three leads per fixed trio',()=>{
 for(const trio of presets){
  assert.equal(trio.length,3);assert.equal(new Set(trio).size,3);
 }
 for(const g of groups.filter(x=>focus.includes(x.name))){
  const entries=treatments(g),by=new Map();
  for(const t of entries){
    const k=[...t.three].sort().join('/');
    by.set(k,(by.get(k)||0)+1);
  }
  assert.ok([...by.values()].every(n=>n===3));
 }
});
