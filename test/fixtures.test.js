'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {variants,archetypes,scenarios}=require('../fixtures');
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

test('stress tests force three unique opponent members from public six',()=>{
  for(const [key,scenario] of Object.entries(scenarios)){
    const choices=archetypes[key].map(x=>x.species);
    assert.equal(scenario.chosen.length,3);
    assert.equal(new Set(scenario.chosen).size,3);
    assert.equal(scenario.chosen[0],scenario.lead);
    for(const member of scenario.chosen)assert.ok(choices.includes(member),key+'/'+member);
  }
});
test('rain stress test leads with Drizzle user and mandates weather assertion',()=>{
  assert.equal(scenarios.rain.lead,'Pelipper');
  assert.equal(archetypes.rain.find(x=>x.species==='Pelipper').ability,'Drizzle');
  assert.equal(scenarios.rain.mustSeeRain,true);
});
test('S29 and S31 variants differ only in Starmie stat points',()=>{
  const a=structuredClone(variants.A_rillaboom),d=structuredClone(variants.D_starmieS29);
  assert.deepEqual(a.slice(1),d.slice(1));
  assert.equal(a[0].evs.spe,31);
  assert.equal(d[0].evs.spe,29);
  assert.equal(a[0].evs.hp,3);
  assert.equal(d[0].evs.hp,5);
});
