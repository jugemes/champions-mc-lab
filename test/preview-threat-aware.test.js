'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {rankThreatAwarePreview,chooseThreatAwarePreview,explainThreatAwarePreview,
  rivalHypotheses,publicVariants,duel}=require('../preview-threat-aware');
const {chooseThree,game,hashSeed}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {groups}=require('../environment-m7-teams');
const {SCENARIOS}=require('../preview-threat-audit');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const names=(team,idx)=>idx.map(i=>team[i-1].species);
const G=n=>structuredClone(groups.find(g=>g.name===n));

test('threat-aware preview accepts only six public species names, never rival set objects',()=>{
  const team=reportedLive(),foe=G('02_M7_lucarioZ_offense').team;
  assert.throws(()=>chooseThreatAwarePreview(dex,team,foe),/public rival species names/);
  assert.throws(()=>chooseThreatAwarePreview(dex,team,foe.slice(0,3).map(p=>p.species)),/exactly six/);
  // Same species, any hidden sets: identical ranking and explanation.
  const tampered=foe.map(p=>({...p,item:'Leftovers',moves:['Splash'],evs:{hp:32}}));
  assert.deepEqual(explainThreatAwarePreview(dex,team,foe.map(p=>p.species)),
    explainThreatAwarePreview(dex,team,tampered.map(p=>p.species)));
});
test('rival hypotheses read only our public species names, so our private sets cannot leak',()=>{
  const team=reportedLive(),six=SCENARIOS.B_lucario_z_corviknight;
  const a=rivalHypotheses(dex,team.map(p=>p.species),six);
  const other=team.map(p=>({...p,moves:['Splash','Splash','Splash','Splash'],item:'Leftovers'}));
  assert.deepEqual(a,rivalHypotheses(dex,other.map(p=>p.species),six));
  assert.ok(a.length>=6);
  assert.ok(Math.abs(a.reduce((s,h)=>s+h.weight,0)-1)<1e-9);
  for(const h of a){
    assert.equal(new Set(h.three).size,3);
    assert.ok(h.three.every(n=>six.includes(n)));
    assert.ok(h.likelyMega===null||h.three.includes(h.likelyMega),'at most one Mega and inside the three');
  }
});
test('all 20 threes x 3 leads (60) are scored, deterministically',()=>{
  const team=reportedLive(),six=SCENARIOS.C_charizard_x_y;
  const r=rankThreatAwarePreview(dex,team,six);
  assert.equal(r.ranked.length,20);
  assert.equal(r.ranked.reduce((n,c)=>n+c.leads.length,0),60);
  const pick=chooseThreatAwarePreview(dex,team,six);
  assert.deepEqual(pick,chooseThreatAwarePreview(dex,team,six));
  assert.equal(new Set(pick).size,3);
  assert.equal(pick[0]-1,r.ranked[0].leads[0].i,'first slot is the chosen lead');
});
test('public variants: Charizard has X and Y, Lucario has Mega and Mega-Z, Scarf only on non-Mega',()=>{
  const forms=n=>publicVariants(dex,n).filter(v=>v.mega).map(v=>v.form).sort();
  assert.deepEqual(forms('Charizard'),['Charizard-Mega-X','Charizard-Mega-Y']);
  assert.deepEqual(forms('Lucario'),['Lucario-Mega','Lucario-Mega-Z']);
  assert.ok(publicVariants(dex,'Indeedee').some(v=>v.scarf&&!v.mega));
  assert.ok(publicVariants(dex,'Charizard').every(v=>!(v.scarf&&v.mega)));
});
test('real case B counterexample: Hydreigon is not a safe Indeedee answer once Scarf is possible',()=>{
  const team=reportedLive(),hyd=team.find(p=>p.species==='Hydreigon');
  const [plain,scarf]=['plain','scarf'].map(k=>publicVariants(dex,'Indeedee').find(v=>v.scarf===(k==='scarf')&&!v.mega));
  assert.ok(duel(dex,hyd,plain).value>duel(dex,hyd,scarf).value+0.2);
  assert.ok(duel(dex,hyd,scarf).value<0.5);
  const pick=names(team,chooseThreatAwarePreview(dex,team,SCENARIOS.real_B_indeedee));
  assert.notEqual(pick[0],'Hydreigon','do not repeat the reported Hydreigon lead');
});
test('B counterexample: in every Lucario hypothesis one member is assigned to Lucario with value >= 0.5',()=>{
  const team=reportedLive();
  const x=explainThreatAwarePreview(dex,team,SCENARIOS.B_lucario_z_corviknight,{top:1}).ranked[0];
  const lucario=x.answers.filter(a=>a.rival.split('/').includes('Lucario'));
  assert.ok(lucario.length>0);
  for(const a of lucario){
    const m=a.answers.match(/Lucario<-([A-Za-z-]+)\(([\d.]+)\)/);
    assert.ok(m&&Number(m[2])>=0.5,a.answers);
  }
});
test('legacy preview is unchanged by the opt-in branch (PR #53 snapshot)',()=>{
  const team=reportedLive();
  assert.deepEqual(names(team,chooseThree(dex,team,SCENARIOS.A_golisopod_mimikyu)),['Hydreigon','Primarina','Metagross']);
  assert.deepEqual(names(team,chooseThree(dex,team,SCENARIOS.B_lucario_z_corviknight)),['Garchomp','Hydreigon','Metagross']);
  assert.deepEqual(names(team,chooseThree(dex,team,SCENARIOS.C_charizard_x_y)),['Tyranitar','Hydreigon','Metagross']);
});
test('Bot with previewPolicy threat-aware selects from |poke| species only in a real Battle',async()=>{
  const team=reportedLive(),foe=G('02_M7_lucarioZ_offense').team;
  const g=await game(sim,team,foe,hashSeed(5656),false,null,false,{candidatePreviewPolicy:'threat-aware',opponentPreviewPolicy:'legacy'});
  assert.equal(g.trace.errors.length,0);
  const mine=g.trace.selections.find(s=>s.side==='p1');
  assert.deepEqual(mine.chosen,names(team,chooseThreatAwarePreview(dex,team,foe.map(p=>p.species))));
});
// Known open failure found by preview-threat-audit.js: same three as legacy,
// but leading Mega Metagross into Golisopod (Swords Dance + Sucker Punch)
// lost 0/12 vs forcedA, while legacy's Hydreigon lead won 10/12.
test('A counterexample: do not lead Metagross into a public Golisopod six',{todo:'open: lead model'},()=>{
  const team=reportedLive();
  assert.notEqual(names(team,chooseThreatAwarePreview(dex,team,SCENARIOS.A_golisopod_mimikyu))[0],'Metagross');
});
