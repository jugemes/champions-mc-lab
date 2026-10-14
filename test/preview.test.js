'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {seededRandom,rankPreview,choosePreview}=require('../preview-policy');
const {opponents}=require('../preview-opponents');
const {variants}=require('../fixtures');
const {matchup,game,hashSeed,normalize,prelim}=require('../lab');
const {CASES,optionsFrom}=require('../optimize-preview');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
test('each opponent lineup is distinct, legal six species with legal held items',()=>{
  assert.equal(CASES.length,8);
  const seen=new Set(),v=sim.TeamValidator.get('gen9championsbssregmc');
  for(const [name,team] of Object.entries(opponents)){
    assert.doesNotThrow(()=>prelim(team,name));
    assert.ok(!v.validateTeam(normalize(team)),name+' is legal');
    const key=team.map(p=>p.species).sort().join('/');
    assert.ok(!seen.has(key),name+' is unique six');
    seen.add(key);
  }
});
test('rankPreview evaluates all 20 possible triples using public opponent six',()=>{
  const team=variants.A_rillaboom;
  const publicSix=opponents.setup.map(p=>p.species);
  assert.equal(rankPreview(dex,team,publicSix,matchup).length,20);
  assert.throws(()=>rankPreview(dex,team,[],matchup),/exactly six/);
});
test('preview sampling is seed reproducible, both team and lead may vary in genuine ties',()=>{
  const original=variants.A_rillaboom[0];
  const tied=Array.from({length:6},()=>({...original}));
  const publicSix=opponents.setup.map(p=>p.species);
  const one=choosePreview(dex,tied,publicSix,seededRandom(hashSeed(12)),matchup);
  const again=choosePreview(dex,tied,publicSix,seededRandom(hashSeed(12)),matchup);
  assert.deepEqual(one,again);
  const picks=new Set();
  for(let n=0;n<100;n++){
    const s=choosePreview(dex,tied,publicSix,seededRandom(hashSeed(n)),matchup);
    assert.equal(new Set(s).size,3);
    picks.add(s.slice().sort().join('/'));
  }
  assert.ok(picks.size>1,'stochastic choices must be possible among equally rated options');
});
test('opponent private EVs, items and moves cannot affect preview selection',()=>{
  const team=variants.A_rillaboom,other=opponents.setup.map(p=>p.species);
  const tampered=structuredClone(opponents.setup);
  for(const x of tampered){x.moves=['Splash','Splash','Splash','Splash'];x.item='Leftovers';x.evs={hp:0};}
  const first=choosePreview(dex,team,other,seededRandom(hashSeed(313)),matchup);
  const second=choosePreview(dex,team,tampered.map(x=>x.species),seededRandom(hashSeed(313)),matchup);
  assert.deepEqual(first,second);
});
test('actual battle without stress uses two independently selected teams, not fixed opponent chosen',async()=>{
  const g=await game(sim,variants.A_rillaboom,opponents.setup,hashSeed(928),false,null,false,{previewPolicy:'stochastic'});
  assert.equal(g.trace.selections.length,2);
  for(const item of g.trace.selections)assert.equal(new Set(item.chosen).size,3);
  assert.equal(g.trace.errors.length,0);
});
test('preview simulation exposes small preflight and rejects invalid trial sizes',()=>{
  assert.deepEqual(optionsFrom(['--cycles','1','--per-case','2']),{cycles:1,perCase:2});
  assert.throws(()=>optionsFrom(['--per-case','300']));
});
