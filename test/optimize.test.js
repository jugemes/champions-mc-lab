'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {pool,candidates,score,args,CASES}=require('../optimize');
const {prelim,scenarios,archetypes}=require('../fixtures').variants?
  {prelim:require('../lab').prelim,...require('../fixtures')}:
  {prelim:require('../lab').prelim,...require('../fixtures')};
test('eight distinct fixed stress matchup definitions are wired',()=>{
  assert.equal(CASES.length,8);
  for(const s of CASES){
    assert.ok(archetypes[s]&&scenarios[s]);
    assert.equal(scenarios[s].chosen.length,3);
  }
});
test('all curated team tweaks keep 6 unique species and items and 66 stat points',()=>{
  const teams=pool();
  assert.equal(Object.keys(teams).length,14);
  for(const [name,team] of Object.entries(teams)){
    assert.doesNotThrow(()=>prelim(team,name));
    assert.equal(new Set(team.map(p=>p.species)).size,6);
    assert.equal(new Set(team.map(p=>p.item)).size,6);
  }
});
test('five candidates selected per cycle and prioritizes prior leaders',()=>{
  const teams=pool(),first=candidates(1,[],new Set(),{},teams);
  assert.equal(first.length,5);
  const seen=new Set(first);
  const next=candidates(2,['C_master','A_rillaboom'],seen,{},teams);
  assert.deepEqual(next.slice(0,2),['C_master','A_rillaboom']);
  assert.equal(new Set(next).size,5);
});
test('round sizing and scoring penalizes worst synthetic matchup',()=>{
  const wins=Object.fromEntries(CASES.map((s,i)=>[s,i?125:0]));
  const result=score(wins,250);
  assert.equal(result.worst,0);
  assert.ok(result.score<result.mean);
  assert.deepEqual(args([]),{cycles:5,perCase:250});
  assert.throws(()=>args(['--per-case','251']));
});
