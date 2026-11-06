'use strict';
// PR #88 (ChatGPT review #5720659334 of PR #87): DEV/FINAL disjointness through
// the SAME functions pr86-eval main() calls, the predeclared unseen sixes, and
// the guarded selector's decision rule / public-only input.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const H=require('../holdout-20261031-pr88');
const GP=require('../pr88-guarded-preview');
const root=path.join(__dirname,'..');
const rd=f=>JSON.parse(fs.readFileSync(path.join(root,'reports/data',f),'utf8'));
const haveSD=!!process.env.SHOWDOWN_DIR;

test('P0-1: eval cell path is disjoint on all 22 hypotheses; PR #86 cells reproduce the saved overlap',{skip:!haveSD&&'SHOWDOWN_DIR not set'},()=>{
  const {load}=require('../lab');const P=require('../pr86-eval');const E=require('../pr82-eval');
  const sim=load(),dex=sim.Dex.mod('champions'),own=require('../reported-live-roster-20261027').reportedLive();
  const CS=E.allCases(),teams=CS.map(c=>c.team);
  const meta=bug=>P.phaseCells(P.buildMeta(dex,own,CS,rd('pr82-eval.json'),rd('pr84-reaudit.json')),teams,{pr86Bug:bug});
  const nw=meta(false);assert.equal(nw.length,22);
  for(const m of nw){const all=[...m.trainTest,...m.hold,...m.dev.map(c=>c.foe),...m.final.map(c=>c.foe)].map(f=>f.join('/'));
    assert.equal(new Set(all).size,all.length,m.six+'/'+m.hyp);}
  // the old path reproduces the saved PR #86 DEV/FINAL cells, including the overlap
  const old=meta(true),sd=rd('pr86-dev.json').DEV.cells,sf=rd('pr86-final.json').FINAL.cells,lab=c=>c.src+':'+c.foe.join('/');
  for(const m of old){const h=m.six+'/'+m.hyp;assert.deepEqual(m.dev.map(lab),sd[h]);assert.deepEqual(m.final.map(lab),sf[h]);}
  const hx=old.find(m=>m.six==='HX_sand'&&m.hyp==='a');
  assert.throws(()=>P.assertDisjoint(hx,{dev:hx.dev.map(c=>c.foe),final:hx.final.map(c=>c.foe)}),/HX_sand\/a\|Rotom-Heat\/Excadrill\/Kingambit: dev and final/);
  // only HX_sand/a and HOLD_sun_balance/case get a different FINAL cell
  const changed=nw.filter((m,i)=>JSON.stringify(m.final)!==JSON.stringify(old[i].final)).map(m=>m.six+'/'+m.hyp);
  assert.deepEqual(changed.sort(),['HOLD_sun_balance/case','HX_sand/a']);
  // saved FINAL2 used the fixed cells and new seeds
  const f2=rd('pr88-final2.json');assert.equal(f2.finalSeedBase,H.FINAL2_SEED_BASE);
  for(const m of nw)assert.deepEqual(f2.FINAL.cells[m.six+'/'+m.hyp],m.final.map(lab));
});

test('predeclared PR #88 unseen sixes: species absent from every other repo .js, not ours, legal-shaped',()=>{
  const files=[...fs.readdirSync(root).filter(f=>f.endsWith('.js')&&!/pr88/.test(f)).map(f=>path.join(root,f)),
    ...fs.readdirSync(__dirname).filter(f=>f.endsWith('.js')&&!/pr88/.test(f)).map(f=>path.join(__dirname,f))];
  const src=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
  const own=['Metagross','Hydreigon','Primarina','Garchomp','Tyranitar','Rotom-Wash'];
  const U=H.unseenSixesPR88();assert.equal(Object.keys(U).length,3);
  for(const [id,x] of Object.entries(U)){const a=x.hypotheses.a.map(p=>p.species);
    assert.deepEqual(x.hypotheses.b.map(p=>p.species),a);assert.ok(a.includes(x.ace));
    for(const s of a){assert.ok(!own.includes(s));assert.ok(!src.includes("'"+s+"'"),id+' '+s+' appears in the repo');}
    assert.ok(x.hypotheses.a.find(p=>p.species===x.ace).item.endsWith('ite'),'a: ace Megas');
    assert.ok(!x.hypotheses.b.some(p=>/ite$/.test(p.item)),'b: nobody Megas');}
  const seeds=[H.FINAL2_SEED_BASE,H.SEL_FINAL_SEED_BASE,H.SEL_SEARCH_SEED_BASE,H.SEL_DEV_SEED_BASE];
  for(const b of seeds)assert.ok(!src.includes(String(b)),b+' used before');
});

test('guarded selector: legacy is replaced only past the margin, never on mean alone',()=>{
  const L={pick:'L>a/b',legacy:true,worst:0.5,mean:0.8};
  assert.equal(GP.decide([L,{pick:'Q>a/b',worst:0.55,mean:0.95}]).pick,'L>a/b');
  assert.equal(GP.decide([L,{pick:'Q>a/b',worst:0.6,mean:0.79}]).pick,'Q>a/b');
  assert.equal(GP.decide([L,{pick:'Q>a/b',worst:0.9,mean:0.7}]).pick,'L>a/b');// mean drops > slack
  assert.equal(GP.decide([{...L,worst:1},{pick:'Q>a/b',worst:1,mean:1}]).pick,'L>a/b');
});

test('guarded selector input: anything but six species strings throws before a battle',async()=>{
  const sim={Dex:{mod:()=>({})}};
  await assert.rejects(GP.guardedPreview({sim,own:[],publicSix:['A','B','C','D','E',{species:'F',item:'x'}],seedBase:1}),/species names/);
  await assert.rejects(GP.guardedPreview({sim,own:[],publicSix:['A','B','C'],seedBase:1}),/species names/);
});
