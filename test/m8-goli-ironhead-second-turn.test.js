'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {twoTurnIronHead}=require('../m8-goli-ironhead-second-turn');
test('second turn is simulated with actual showdown HP/switch state, not assumed free Encore',()=>{
 const res=twoTurnIronHead();
 assert.equal(res.distinctGroups,6);
 assert.equal(res.scenarioCount,24);
 for(const group of new Set(res.rows.map(x=>x.group))){
  const rows=res.rows.filter(x=>x.group===group);
  assert.equal(rows.length,4);
  assert.ok(rows.some(x=>x.secondAction==='switch:Metagross'&&x.secondExecuted));
  assert.ok(rows.some(x=>x.secondAction==='Moonblast'));
  for(const row of rows){
   assert.ok(row.primarinaHP>=0);
   assert.ok(row.goliHP>=0);
  }
 }
});
