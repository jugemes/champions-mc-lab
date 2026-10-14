'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {variants,archetypes}=require('../fixtures');
const lab=require('../lab');
test('all fixtures satisfy preliminary 66-point and item clauses',()=>{
  for(const [key,team] of Object.entries({...variants,...archetypes}))
    assert.doesNotThrow(()=>lab.prelim(team,key));
});
test('Assault Vest is excluded',()=>{
  const t=structuredClone(variants.A_rillaboom);
  t[0].item='Assault Vest';
  assert.throws(()=>lab.prelim(t,'illegal'),/Assault Vest/);
});
test('seeds deterministic and differ',()=>{
  assert.deepEqual(lab.hashSeed(7),lab.hashSeed(7));
  assert.notDeepEqual(lab.hashSeed(7),lab.hashSeed(8));
  assert.ok(lab.hashSeed(7).every(x=>x>=0&&x<65536));
});
test('each set has four moves and no item duplication',()=>{
  for(const team of Object.values({...variants,...archetypes})){
    assert.equal(team.length,6);
    assert.equal(new Set(team.map(x=>x.item)).size,6);
    assert.ok(team.every(x=>x.moves.length===4));
  }
});
