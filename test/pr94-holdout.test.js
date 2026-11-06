'use strict';
// PR #94: the predeclared unseen sixes, rival models, seeds and verdict rule
// (committed before any PR #94 FINAL battle).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const H=require('../holdout-20261031-pr94');
const root=path.join(__dirname,'..');
const haveSD=!!process.env.SHOWDOWN_DIR;

test('predeclared PR #94 unseen sixes: species absent from every non-pr94 repo .js, not ours',()=>{
  const files=[...fs.readdirSync(root).filter(f=>f.endsWith('.js')&&!/pr94/.test(f)).map(f=>path.join(root,f)),
    ...fs.readdirSync(__dirname).filter(f=>f.endsWith('.js')&&!/pr94/.test(f)).map(f=>path.join(__dirname,f))];
  const src=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
  const own=['Metagross','Hydreigon','Primarina','Garchomp','Tyranitar','Rotom-Wash'];
  const U=H.unseenSixesPR94();assert.equal(Object.keys(U).length,2);
  for(const [id,x] of Object.entries(U)){const a=x.hypotheses.a.map(p=>p.species);
    assert.deepEqual(x.hypotheses.b.map(p=>p.species),a);assert.ok(a.includes(x.ace));
    for(const s of a){assert.ok(!own.includes(s));assert.ok(!src.includes("'"+s+"'")&&!src.includes('"'+s+'"'),id+' '+s+' appears in the repo');}
    assert.ok(x.hypotheses.a.find(p=>p.species===x.ace).item.endsWith('ite'),'a: ace Megas');
    assert.ok(!x.hypotheses.b.some(p=>/ite$/.test(p.item)),'b: nobody Megas');}
  for(const b of [H.FINAL_SEED_BASE,H.SEARCH_SEED_BASE,H.DEV_SEED_BASE,H.DEV_SEARCH_BASE,H.TM_RANDOM_SEED])assert.ok(!src.includes(String(b)),b+' used before');
  assert.deepEqual(H.SEEDS.map(H.sideOf),[false,true,false,true]);
});

test('eval seeds: every (six, hyp, model, cell, branch, s) job has its own seed',()=>{
  const seen=new Set();let n=0;
  for(let ui=0;ui<2;ui++)for(let hi=0;hi<2;hi++)for(let mi=0;mi<2;mi++)for(let ci=0;ci<9;ci++)for(let bi=0;bi<6;bi++)for(const s of H.SEEDS){seen.add(String(H.evalSeed(H.FINAL_SEED_BASE,ui,hi,mi,ci,bi,s)));n++;}
  assert.equal(seen.size,n);
});

test('PR #94 sixes: TeamValidator + 66 P / <=32 / four distinct moves / coherent items',{skip:!haveSD&&'SHOWDOWN_DIR not set'},()=>{
  const {load,normalize}=require('../lab');const {coherenceProblems}=require('../legal-role-hypotheses');
  const sim=load(),dex=sim.Dex.mod('champions'),v=sim.TeamValidator.get('gen9championsbssregmc');
  for(const [id,x] of Object.entries(H.unseenSixesPR94()))for(const [k,t] of Object.entries(x.hypotheses)){
    assert.deepEqual(v.validateTeam(normalize(t))||[],[],id+'/'+k);
    for(const s of t){assert.deepEqual(coherenceProblems(dex,s),[],id+'/'+k+' '+s.species);
      const pts=Object.values(s.evs).reduce((a,b)=>a+b,0);assert.ok(pts<=66&&Object.values(s.evs).every(e=>e<=32),id+' '+s.species+' points');
      assert.equal(new Set(s.moves).size,4);}
  }
});

test('rival model tm: independent rule, brings the ace in at least half its cells, deterministic',{skip:!haveSD&&'SHOWDOWN_DIR not set'},()=>{
  const {load}=require('../lab');const dex=load().Dex.mod('champions');
  const ownSpecies=require('../reported-live-roster-20261027').reportedLive().map(p=>p.species);
  const src=fs.readFileSync(path.join(root,'holdout-20261031-pr94.js'),'utf8').split('function tmScores')[1].split('const S=')[0].replace(/\/\/.*$/gm,'');
  for(const w of ['rankTrios','rationalCells','chooseThree','rivalCandidates'])assert.ok(!src.includes(w),'tm uses '+w);
  for(const x of Object.values(H.unseenSixesPR94()))for(const t of Object.values(x.hypotheses)){
    const c=H.tmCells({dex,team:t,ownSpecies,ace:x.ace}).cells;
    assert.ok(c.length>=4);assert.ok(c.filter(z=>z.foe.includes(x.ace)).length*2>=c.length,'ace in < half of the tm cells');
    assert.deepEqual(H.tmCells({dex,team:t,ownSpecies,ace:x.ace}).cells,c);
    for(const z of c)assert.equal(new Set(z.foe).size,3);
  }
});
