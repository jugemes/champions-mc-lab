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

// ---- pr92-rational-cover-preview / pr92-t1t2 (written after the predeclaration) ----
const P=require('../pr92-rational-cover-preview');
const T=require('../pr92-t1t2');
const F2SIX=['Feraligatr','Infernape','Hatterene','Mudsdale','Noivern','Aegislash'];

test('cover selector input: anything but six species strings throws before a battle',async()=>{
  assert.throws(()=>P.assertPublicSix(['A','B','C','D','E',{species:'F',item:'x'}]),/species names/);
  assert.throws(()=>P.assertPublicSix(['A','B','C']),/species names/);
  await assert.rejects(P.coverPreviewHard({own:[],publicSix:['A'],seedBase:1,dex:{}}),/species names/);
});

test('decidePR92: eligible filter on CVaR + mean slack; legacy kept otherwise',()=>{
  const L={pick:'L>a/b',legacy:true,cvar:0.4,mean:0.7};
  assert.equal(P.decidePR92([L,{pick:'A>a/b',cvar:0.7,mean:0.6},{pick:'B>a/b',cvar:0.6,mean:0.75}]).pick,'B>a/b');
  assert.equal(P.decidePR92([L,{pick:'A>a/b',cvar:0.44,mean:0.9}]).pick,'L>a/b');
  assert.equal(P.decidePR92([L,{pick:'A>a/b',cvar:0.45,mean:0.68}]).pick,'A>a/b');
  assert.throws(()=>P.decidePR92([{pick:'A',cvar:1,mean:1}]),/legacy candidate missing/);
  assert.equal(P.cvar([1,0,0.5,1,1,1,1,1],0.25),0.25);
});

test('T1/T2 obs: only public fields; key = T1 rival lead / T2 lead|ours|rival',()=>{
  assert.equal(T.keyOf({turn:1,rivalLead:'Hatterene',rivalActive:'Hatterene',ownActive:'Metagross',legal:[]}),'T1|Hatterene');
  assert.equal(T.keyOf({turn:2,rivalLead:'Hatterene',rivalActive:'Feraligatr-Mega',ownActive:'Metagross-Mega',legal:[]}),'T2|Hatterene|Metagross|Feraligatr');
  assert.throws(()=>T.keyOf({turn:1,rivalActive:'X',rivalItem:'Leftovers'}),/non-public field rivalItem/);
  assert.throws(()=>T.keyOf({turn:2,rivalActive:'X',rivalThree:['X']}),/non-public field rivalThree/);
});

test('T1/T2 table: a forced label is kept only past MIN_GAIN with n >= MIN_N, paired with base AI in the same observed state',()=>{
  const rows=[];
  for(let i=0;i<10;i++){const j={ci:i,branch:'ai',seed:[i],reverse:false};
    rows.push({j:{...j,label:'ai'},r:{won:i<3?1:0,keys:{1:'T1|X'},used:{}}});
    rows.push({j:{...j,label:'move:A'},r:{won:i<8?1:0,keys:{1:'T1|X'},used:{1:'move:A'}}});
    rows.push({j:{...j,label:'move:B'},r:{won:1,keys:{1:'T1|X'},used:{1:'unavailable:move:B'}}});// not executed: ignored
  }
  const t=T.tableFrom(rows,1,{minN:8,minGain:0.10});
  assert.equal(t['T1|X'].action,'move:A');assert.equal(t['T1|X'].best.n,10);assert.equal(t['T1|X'].options.length,1);
  assert.equal(T.tableFrom(rows.slice(0,15),1,{minN:8,minGain:0.10})['T1|X']?.action??'ai','ai');// n=5 < 8
});

test('PR92 scenarios/cells from public names only: Scarf + speed setup covered, F2 Hatterene/Infernape/Feraligatr cell present',{skip:!haveSD&&'SHOWDOWN_DIR not set'},()=>{
  const {load}=require('../lab');const sim=load(),dex=sim.Dex.mod('champions');
  const ownSpecies=require('../reported-live-roster-20261027').reportedLive().map(p=>p.species);
  const {teams,coverage}=P.scenarioTeamsPR92(sim,F2SIX);
  assert.deepEqual(coverage.missing,[]);
  assert.ok(teams.some(t=>t.some(p=>p.species==='Feraligatr'&&p.item==='Choice Scarf')));
  assert.ok(teams.some(t=>t.some(p=>p.species==='Feraligatr'&&p.item==='Feraligite'&&p.moves.includes('Dragon Dance'))));
  for(const rule of [P.rivalCellsPR92,P.rivalCellsRational]){
    const all=teams.flatMap(t=>rule(dex,t,ownSpecies).map(c=>c.foe.slice().sort().join('/')));
    assert.ok(all.includes('Feraligatr/Hatterene/Infernape'),rule.name);
  }
  // the pr88 (#89/#91) scenarios never had it
  const GP=require('../pr88-guarded-preview');const {rivalCandidates}=require('../preview-legal-search');
  const old=GP.scenarioTeams(sim,F2SIX,4).flatMap(t=>rivalCandidates(dex,t,ownSpecies,2,'all',{truncate:false}).map(r=>r.three.slice().sort().join('/')));
  assert.ok(!old.includes('Feraligatr/Hatterene/Infernape'));
});

test('ownAction: first own move / voluntary switch of the turn; a faint first means no choice',()=>{
  assert.equal(T.ownAction(['|switch|p2a: Hatterene|Hatterene, L50, F|100/100','|move|p1a: Metagross|Iron Head|p2a: Hatterene'],'p1'),'move:Iron Head');
  assert.equal(T.ownAction(['|switch|p1a: Garchomp|Garchomp, L50, M|185/185'],'p1'),'switch:Garchomp');
  assert.equal(T.ownAction(['|faint|p1a: Metagross','|switch|p1a: Garchomp|Garchomp, L50, M|185/185'],'p1'),null);
});
