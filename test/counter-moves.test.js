'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {candidates}=require('../counter-move-variants');
const {validate,OPP}=require('../counter-move-audit');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
test('seven one-move sun counterplay variants and all 13 opposing sixes are legal M-C',()=>{
  const pool=candidates();
  assert.equal(Object.keys(pool).length,7);
  assert.equal(Object.keys(OPP).length,13);
  assert.doesNotThrow(()=>validate(sim,pool));
  assert.doesNotThrow(()=>validate(sim,OPP));
});
test('all Starmie Power Gem candidates modify exactly one move with no role drift',()=>{
  const x=candidates();
  const c=x.C0_standard,e=x.E0_standard;
  for(const [name,t]of Object.entries(x)){
    const parent=name.startsWith('C')?c:e;
    const diff=t.filter((p,i)=>JSON.stringify(p)!==JSON.stringify(parent[i]));
    assert.equal(diff.length,name.endsWith('standard')?0:1,name);
    if(!name.endsWith('standard')){
      assert.equal(diff[0].species,name.startsWith('C')?'Garchomp':'Starmie');
      assert.equal(diff[0].moves.includes(name.startsWith('C')?'Stone Edge':'Power Gem'),true);
    }
  }
});