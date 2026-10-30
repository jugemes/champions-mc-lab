'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const H=require('../legal-role-hypotheses');
const {chooseLegalSearch,shortBattle,toLabTeam}=require('../preview-legal-search');
const {misplays}=require('../legal-search-compare');
const {reportedLive}=require('../reported-live-roster-20261027');
const {teams}=require('../holdout-20261030');
const {teams:claudeHoldout}=require('../holdout-20261030-claude');
const {normalize,prelim}=require('../lab');
const SPECIES=['Golisopod','Garchomp','Primarina','Mimikyu','Hippowdon','Gholdengo','Lucario','Archaludon',
  'Corviknight','Charizard','Baxcalibur','Indeedee','Umbreon','Gengar','Gyarados','Raichu','Meowscarada','Basculegion'];
const v=new sim.TeamValidator('gen9championsbssregmc');

test('PR #63 counterexample: pinned TeamValidator alone accepts a wrong Mega Stone',()=>{
  const bad={species:'Garchomp',item:'Charizardite Y',ability:'Rough Skin',nature:'Jolly',level:50,
    evs:{hp:2,atk:32,def:0,spa:0,spd:0,spe:32},moves:['Earthquake','Outrage','Rock Slide','Stone Edge']};
  assert.equal(v.validateSet(structuredClone(bad),{}),null,'if this starts failing the validator gap is closed upstream');
  assert.match(H.coherenceProblems(dex,bad).join(),/does not Mega Evolve/);
  assert.match(H.coherenceProblems(dex,{...bad,item:'Choice Scarf',moves:['Earthquake','Outrage','Swords Dance','Stone Edge']}).join(),/Choice item with a status move/);
  assert.match(H.coherenceProblems(dex,{...bad,evs:{hp:3,atk:32,def:0,spa:0,spd:0,spe:32}}).join(),/66/);
});

test('every role hypothesis is ONE legal, coherent four-move set from the public pool',()=>{
  for(const s of SPECIES){
    const out=H.legalRoleHypotheses(sim,s);
    assert.ok(out.sets.length>=2,s+' needs several hypotheses');
    const pool=new Set(H.movePool(dex,s));
    for(const set of out.sets){
      assert.equal(set.moves.length,4,s);
      assert.equal(new Set(set.moves).size,4,s);
      assert.ok(set.moves.every(m=>pool.has(dex.moves.get(m).id)),s+' '+set.moves);
      const plain={species:set.species,item:set.item,ability:set.ability,nature:set.nature,level:50,evs:set.evs,moves:set.moves};
      assert.equal(v.validateSet(structuredClone(plain),{}),null,s+' '+set.role);
      assert.deepEqual(H.coherenceProblems(dex,plain,{formName:set.form}),[],s+' '+set.role);
      assert.ok(!set.moves.some(m=>['Hyper Beam','Giga Impact','Last Resort','Upper Hand','Future Sight','Focus Punch'].includes(m)),
        s+' conditional filler move '+set.moves);
      assert.equal(set.provenance.showdown,'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640');
    }
  }
});

test('tactical moves PR #63 lost are represented by some coherent hypothesis',()=>{
  const has=(s,pred)=>H.legalRoleHypotheses(sim,s).sets.some(pred);
  const mv=m=>x=>x.moves.includes(m);
  assert.ok(has('Garchomp',x=>x.item==='Choice Scarf'),'Scarf Garchomp (real case B/C)');
  assert.ok(has('Garchomp',mv('Swords Dance')));
  assert.ok(has('Golisopod',x=>x.item==='Golisopite'&&x.moves.includes('Sucker Punch')&&x.moves.includes('Swords Dance')));
  assert.ok(has('Corviknight',mv('Roost')));
  assert.ok(has('Hippowdon',mv('Slack Off')));
  assert.ok(has('Indeedee',mv('Fake Out')));
  assert.ok(has('Charizard',x=>x.form==='Charizard-Mega-X')&&has('Charizard',x=>x.form==='Charizard-Mega-Y'),'X/Y ambiguity is public');
  assert.ok(has('Lucario',x=>x.form==='Lucario-Mega-Z'));
  // Speed P differs between roles: bulky hypotheses invest 0.
  const sp=new Set(H.legalRoleHypotheses(sim,'Hippowdon').sets.map(x=>x.speedPoints));
  assert.ok(sp.has(0)&&sp.has(32));
});

test('rival scenarios keep whole sets under the item clause',()=>{
  const species=teams().realB_indeedee_scarf.team.map(p=>p.species);
  const hyps=species.map(s=>H.legalRoleHypotheses(sim,s));
  for(let k=0;k<3;k++){
    const sc=H.rivalScenario(hyps,k);
    assert.equal(new Set(sc.map(p=>p.item)).size,6,'item clause');
    for(const p of sc){
      if(p.itemSwapped)continue;
      const original=hyps.find(h=>h.species===p.species).sets.find(x=>x.role===p.role&&x.form===p.form);
      assert.equal(original.item,p.item,'moves and item come from the same hypothesis');
    }
    const team=toLabTeam(sc);
    prelim(team,'scenario'+k);
    assert.equal(v.validateTeam(normalize(team)),null);
  }
});

test('new Claude holdout is legal and was not produced by the hypothesis generator',()=>{
  const t=claudeHoldout().claude_realE_sun;
  prelim(t.team,'holdout');
  assert.equal(v.validateTeam(normalize(t.team)),null);
  const gen=new Set(t.team.flatMap(p=>H.legalRoleHypotheses(sim,p.species).sets.map(x=>x.species+x.item+x.moves.join())));
  assert.ok(t.team.some(p=>!gen.has(p.species+p.item+p.moves.join())));
});

test('short Showdown branches really play the forced rival T1 action and stop at the horizon',async()=>{
  const own=reportedLive();
  const foe=toLabTeam(H.rivalScenario(['Golisopod','Garchomp','Primarina','Mimikyu','Hippowdon','Gholdengo']
    .map(s=>H.legalRoleHypotheses(sim,s)),2));
  assert.ok(foe.find(p=>p.species==='Mimikyu').moves.includes('Swords Dance'),'fixture premise');
  const setup=await shortBattle(sim,{own,ownThree:['Primarina','Metagross','Garchomp'],foe,
    foeThree:['Mimikyu','Golisopod','Garchomp'],seed:[1,2,3,4],branch:'setup',horizon:3});
  assert.ok(setup.lines.some(l=>/\|move\|p2a: Mimikyu\|Swords Dance/.test(l)),setup.lines.join('\n'));
  assert.ok(setup.turns<=3&&Number.isFinite(setup.value));
  const sw=await shortBattle(sim,{own,ownThree:['Primarina','Metagross','Garchomp'],foe,
    foeThree:['Mimikyu','Golisopod','Garchomp'],seed:[1,2,3,4],branch:'switch',horizon:1});
  const t1=sw.lines.slice(sw.lines.findIndex(l=>l.startsWith('|switch|p2a'))+1);
  assert.ok(t1.some(l=>l.startsWith('|switch|p2a:')),'T1 rival switch '+sw.lines.join('\n'));
});

test('legal-search sees only public species: same pick whatever the hidden rival sets are',async()=>{
  const own=reportedLive();
  const a=teams().realB_indeedee_scarf,b=teams().realB_indeedee_sash;
  const names=a.team.map(p=>p.species);
  assert.deepEqual(b.team.map(p=>p.species),names);
  await assert.rejects(chooseLegalSearch(sim,own,a.team,{}),/species names only/);
  const opts={scenarios:1,ownTrios:2,rivalTrios:1,branches:['ai','attack'],rivalLeads:'best'};
  const r1=await chooseLegalSearch(sim,own,names,opts);
  const r2=await chooseLegalSearch(sim,own,b.team.map(p=>p.species),opts);
  assert.deepEqual(r1.chosen,r2.chosen);
  assert.deepEqual(r1.table.map(x=>x.score),r2.table.map(x=>x.score));
  assert.ok(r1.scenarios[0].every(s=>!/Choice Scarf:Psychic\/Dazzling Gleam\/Shadow Ball/.test(s)),'no case set leaks in');
});

test('turn-AI misplay tags (counted out of preview evidence)',()=>{
  const log=['|turn|1','|move|p2a: Golisopod|Swords Dance|p2a: Golisopod','|turn|2',
    '|move|p2a: Golisopod|Swords Dance|p2a: Golisopod','|turn|3','|move|p2a: Golisopod|Swords Dance|p2a: Golisopod',
    '|move|p1a: Primarina|Encore|p2a: Golisopod','|turn|4','|move|p1a: Primarina|Encore|p2a: Golisopod',
    '|move|p2a: Garchomp|Earthquake|p1a: Rotom','|-immune|p1a: Rotom','|turn|5',
    '|move|p2a: Garchomp|Earthquake|p1a: Rotom','|-immune|p1a: Rotom'].join('\n');
  const m=misplays(log);
  assert.equal(m.p2.setupSpam,1);
  assert.equal(m.p1.encoreRepeat,1);
  assert.equal(m.p2.immuneRepeat,1);
});
