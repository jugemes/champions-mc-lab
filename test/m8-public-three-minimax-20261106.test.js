'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {choices,chooseRobust}=require('../m8-public-three-minimax-20261106');
const six=['a','b','c','d','e','f'];
test('enumerates 20 triples and 60 ordered leads',()=>{
 const all=choices(six);assert.equal(all.length,60);
 assert.equal(new Set(all.map(x=>x.three.join(','))).size,20);
 assert.ok(all.every(x=>x.three.includes(x.lead)));
});
test('maximin chooses one public-three+lead for every hidden branch, not hindsight',()=>{
 const scenarios=[{id:'A',enemyThree:[0,1,2]},{id:'B',enemyThree:[3,4,5]}];
 const result=chooseRobust(six,six,scenarios,({choice,scenario})=>{
  if(choice.three.join(',')==='0,1,2'&&choice.lead===0)return scenario.id==='A'?1:0;
  if(choice.three.join(',')==='0,1,3'&&choice.lead===0)return .6;
  return .2;
 });
 assert.deepEqual(result.selected.three,[0,1,3]);
 assert.equal(result.selected.lead,0);
 assert.equal(result.selected.worst,.6);
 assert.equal(result.alternatives.length,60);
});
test('rejects missing hypotheses and invalid scores',()=>{
 assert.throws(()=>chooseRobust(six,six,[],()=>.5));
 assert.throws(()=>chooseRobust(six,six,[{}],()=>NaN));
});
