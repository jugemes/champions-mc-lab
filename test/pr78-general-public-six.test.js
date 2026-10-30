'use strict';
// PR #78: general public-six entry (public-six-general.js), its rival T1/T2
// branch bookkeeping, and the pre-declared holdout sixes.
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const {searchPublicSix,choosePublicSixGeneral,usableSaved,runGames,keyOf,ownHash,policyIdentity}=require('../public-six-general');
const {reportedLive}=require('../reported-live-roster-20261027');
const {caseList}=require('../legal-search-v2-compare');
const {holdoutSixes}=require('../holdout-20261031-general');
const {cases}=require('../public-six-general-eval');
const {normalize}=require('../lab');
const C_Y=caseList().find(c=>c.id==='C_charizardY').team,C_X=caseList().find(c=>c.id==='C_charizardX').team;
const TINY={maxScenarios:1,n1:2,r2:1,expand:false,workers:2};

test('entry takes public species names only; a hidden set throws',async()=>{
  const own=reportedLive();
  await assert.rejects(choosePublicSixGeneral({sim,own,publicSix:C_Y,seed:[1,2,3,4]}),/strings/);
  await assert.rejects(searchPublicSix({sim,own,publicSix:C_Y.slice(0,3).map(p=>p.species)}),/six/);
  assert.equal(choosePublicSixGeneral.length,1,'one options object, no hidden-set argument');
});
test('search depends on the public six only: C Mega-Y and Mega-X hidden sets give the identical search',async()=>{
  const own=reportedLive();
  const a=await searchPublicSix({sim,own,publicSix:C_Y.map(p=>p.species),opts:TINY});
  const b=await searchPublicSix({sim,own,publicSix:[...C_X.map(p=>p.species)].reverse(),opts:TINY});
  for(const k of ['support','security','scenarios','cells','survivors','games'])assert.deepEqual(a[k],b[k],k);
  assert.equal(a.publicKey,keyOf(C_Y.map(p=>p.species)));
  // every scenario team is legal; every species appears in some rival cell, and as a lead
  const v=sim.TeamValidator.get('gen9championsbssregmc');
  assert.ok(a.scenarios.length>=1&&a.cells.length>=12);
  for(const sp of C_Y.map(p=>p.species)){
    assert.ok(a.cells.some(c=>c.rival.split(/[>/]/).includes(sp)),sp+' in a rival cell');
    assert.ok(a.cells.some(c=>c.rival.startsWith(sp+'>')),sp+' as rival lead');
  }
  assert.equal(a.games.screen,60*a.cells.length,'all 60 own picks screened');
  assert.ok(a.support.length>=1&&Math.abs(a.support.reduce((s,x)=>s+x.p,0)-1)<0.02);
  assert.ok(v);
});
test('saved result is reused only for the same public six AND the same own six',()=>{
  const own=reportedLive(),six=C_Y.map(p=>p.species);
  // PR #80: a saved result now carries its whole policy identity
  const saved={...policyIdentity(own),publicKey:keyOf(six),support:[{pick:'Tyranitar>Hydreigon/Metagross',p:1}]};
  assert.equal(usableSaved(saved,[...six].reverse(),own),true);
  assert.equal(usableSaved(saved,[...six.slice(0,5),'Indeedee'],own),false);
  const own2=structuredClone(own);own2[0].moves=[...own2[0].moves];own2[0].moves[0]='Zen Headbutt';
  assert.equal(usableSaved(saved,six,own2),false,'one move differs -> another roster');
});
test('seeded draw from a saved mixture is reproducible; PR #79 side-dependent draw still reproducible on request',async()=>{
  const own=reportedLive(),six=C_Y.map(p=>p.species);
  const saved={...policyIdentity(own),publicKey:keyOf(six),security:0.5,games:{total:1},seconds:1,
    support:[{pick:'Tyranitar>Hydreigon/Metagross',p:0.5},{pick:'Garchomp>Metagross/Primarina',p:0.5}]};
  const a=await choosePublicSixGeneral({sim,own,publicSix:six,seed:[5,6,7,8],saved});
  const b=await choosePublicSixGeneral({sim,own,publicSix:six,seed:[5,6,7,8],saved});
  assert.deepEqual(a,b);assert.equal(a.status,'general');
  assert.deepEqual(a.selection.map(n=>own[n-1].species),a.pick);
  const draws=new Set();for(let s=0;s<16;s++)draws.add((await choosePublicSixGeneral({sim,own,publicSix:six,seed:[s,1,2,3],side:s%2?'p2':'p1',saved,sideDependentDraw:true})).pick[0]);
  assert.equal(draws.size,2,'both support picks are drawn');
});
test('rival T1/T2 branches are applied and checked against the engine log',async()=>{
  const own=reportedLive();
  const jobs=['attack','switch','setup'].map((branch,i)=>({branch,team:0,own:['Tyranitar','Hydreigon','Metagross'],
    foe:['Charizard','Garchomp','Primarina'],seed:[11+i,2,3,4],reverse:i===1}));
  const r=await runGames(own,[C_Y],jobs,{workers:1,keepLog:true});
  const att=r[0].requested,sw=r[1].requested;
  assert.ok(att.length>=1&&att[0].turn===1&&att[0].move,'attack branch requested a move on T1');
  assert.ok(att.every(q=>['executed','preempted'].includes(q.result)),JSON.stringify(att));
  assert.equal(sw.length,1,'switch branch only on T1');assert.equal(sw[0].result,'executed');
  assert.ok(r[0].t1t2.includes('T1'));
});
test('holdout sixes: legal, two hypotheses each, public six disjoint from every dev six',()=>{
  const v=sim.TeamValidator.get('gen9championsbssregmc');
  const dev=new Set(cases('dev').map(c=>keyOf(c.team.map(p=>p.species))));
  for(const [id,h] of Object.entries(holdoutSixes())){
    assert.equal(Object.keys(h.hypotheses).length,2,id);
    for(const t of Object.values(h.hypotheses)){
      assert.equal(v.validateTeam(normalize(t)),null,id);
      assert.deepEqual(t.map(p=>p.species),h.publicSix);
    }
    assert.ok(!dev.has(keyOf(h.publicSix)),id+' is not a dev six');
  }
  for(const c of [...cases('dev'),...cases('holdout')])assert.equal(v.validateTeam(normalize(c.team)),null,c.six+'/'+c.hyp);
});
test('requested-vs-executed: Emergency Exit before moving is forcedOut, not a mismatch',()=>{
  const {checkRequested}=require('../public-six-general');
  const log=['|turn|1','|move|p1a: Metagross|Thunder Punch|p2a: Golisopod','|-activate|p2a: Golisopod|ability: Emergency Exit',
    '|switch|p2a: Gholdengo|Gholdengo, L50|100/100','|turn|2','|move|p2a: Gholdengo|Nasty Plot|p2a: Gholdengo'].join('\n');
  assert.deepEqual(checkRequested(log,'p2',[{turn:1,move:'Swords Dance',active:'Golisopod'},{turn:2,move:'Nasty Plot',active:'Gholdengo'},
    {turn:2,move:'Shadow Ball',active:'Gholdengo'}]),['forcedOut','executed','mismatch']);
});
