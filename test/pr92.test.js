'use strict';
// PR #92 (CLAUDE-TASK after ChatGPT review #5721340698 of PR #91): the
// predeclared unseen sixes, seeds and cell rule (committed before any PR #92
// battle).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const H=require('../holdout-20261031-pr92');
const root=path.join(__dirname,'..');
const haveSD=!!process.env.SHOWDOWN_DIR;

test('predeclared PR #92 unseen sixes: species absent from every other repo .js, not ours',()=>{
  const files=[...fs.readdirSync(root).filter(f=>f.endsWith('.js')&&!/pr92/.test(f)).map(f=>path.join(root,f)),
    ...fs.readdirSync(__dirname).filter(f=>f.endsWith('.js')&&!/pr92/.test(f)).map(f=>path.join(__dirname,f))];
  const src=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
  const own=['Metagross','Hydreigon','Primarina','Garchomp','Tyranitar','Rotom-Wash'];
  const U=H.unseenSixesPR92();assert.equal(Object.keys(U).length,2);
  for(const [id,x] of Object.entries(U)){const a=x.hypotheses.a.map(p=>p.species);
    assert.deepEqual(x.hypotheses.b.map(p=>p.species),a);assert.ok(a.includes(x.ace));
    for(const s of a){assert.ok(!own.includes(s));assert.ok(!src.includes("'"+s+"'")&&!src.includes('"'+s+'"'),id+' '+s+' appears in the repo');}
    assert.ok(x.hypotheses.a.find(p=>p.species===x.ace).item.endsWith('ite'),'a: ace Megas');
    assert.ok(!x.hypotheses.b.some(p=>/ite$/.test(p.item)),'b: nobody Megas');}
  for(const b of [H.FINAL_SEED_BASE,H.SEARCH_SEED_BASE,H.DEV_SEED_BASE])assert.ok(!src.includes(String(b)),b+' used before');
  assert.deepEqual(H.SEEDS.map(H.sideOf),[false,true,false,true]);
});

test('PR #92 sixes: TeamValidator + 66 P / <=32 / four distinct moves / coherent items',{skip:!haveSD&&'SHOWDOWN_DIR not set'},()=>{
  const {load,normalize}=require('../lab');const {coherenceProblems}=require('../legal-role-hypotheses');
  const sim=load(),dex=sim.Dex.mod('champions'),v=sim.TeamValidator.get('gen9championsbssregmc');
  for(const [id,x] of Object.entries(H.unseenSixesPR92()))for(const [k,t] of Object.entries(x.hypotheses)){
    assert.deepEqual(v.validateTeam(normalize(t))||[],[],id+'/'+k);
    for(const s of t)assert.deepEqual(coherenceProblems(dex,s),[],id+'/'+k+' '+s.species);
  }
});

test('PR #92 cell rule = pr88 rationalCells + view3 (distinct threes)',{skip:!haveSD&&'SHOWDOWN_DIR not set'},()=>{
  const {load,chooseThree}=require('../lab');const {rivalCandidates}=require('../preview-legal-search');
  const H88=require('../holdout-20261031-pr88');
  const sim=load(),dex=sim.Dex.mod('champions'),ownSpecies=require('../reported-live-roster-20261027').reportedLive().map(p=>p.species);
  for(const x of Object.values(H.unseenSixesPR92()))for(const t of Object.values(x.hypotheses)){
    const a=H88.rationalCells({dex,team:t,ownSpecies,ace:x.ace,chooseThree,rivalCandidates});
    const b=H.rationalCellsPR92({dex,team:t,ownSpecies,ace:x.ace,chooseThree,rivalCandidates});
    assert.deepEqual(b.cells.slice(0,a.cells.length),a.cells);
    const keys=b.cells.map(c=>c.foe.join());assert.equal(new Set(keys).size,keys.length);// a three with another lead is another cell
  }
});
