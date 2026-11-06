'use strict';
// PR #66 request (PR #65 review 5711453967) P0 regressions for legal-search v2.
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const H=require('../legal-role-hypotheses');
const P=require('../preview-legal-search');
const {misplays}=require('../legal-search-compare');
const {caseList}=require('../legal-search-v2-compare');
const {misplaysV2,V1_TAGS}=require('../misplay-tags-v2');
const {reportedLive}=require('../reported-live-roster-20261027');
const {opponents}=require('../threat-scenarios-20261014');
const {groups}=require('../environment-m7-teams');
const {normalize,prelim}=require('../lab');
const FORMAT='gen9championsbssregmc';
const v=new sim.TeamValidator(FORMAT);
const plain=s=>({species:s.species,item:s.item,ability:s.ability,nature:s.nature,level:50,evs:s.evs,moves:s.moves});
const fixture=(species,move)=>[...Object.values(opponents).flat(),...groups.flatMap(g=>g.team)]
  .find(p=>p.species===species&&p.moves.includes(move));
// One pinned-engine game: both sides bring their first three; T1 choices given.
function play(t1,t2,c1,c2,{seed=[1,2,3,4],before}={}){
  const b=new sim.Battle({formatid:FORMAT,seed});
  b.setPlayer('p1',{name:'a',team:normalize(t1)});b.setPlayer('p2',{name:'b',team:normalize(t2)});
  b.makeChoices('team 123','team 123');
  if(before)before(b);
  b.makeChoices(c1,c2);
  return b;
}
const dealt=(b,target)=>{
  const i=b.log.findIndex(l=>/^\|move\|p1a: /.test(l));
  const d=b.log.slice(i).find(l=>l.startsWith('|-damage|'+target));
  const [hp,max]=d.split('|')[3].split(' ')[0].split('/').map(Number);
  return 1-hp/max;
};

test('P0-1 pre-fix: v1 hypotheses drop Solar Beam / Last Respects / Expanding Force / First Impression',()=>{
  const has=(s,m)=>H.legalRoleHypotheses(sim,s).sets.some(x=>x.moves.includes(m));
  assert.equal(has('Charizard','Solar Beam'),false,'v1 allowImpractical solarbeam is dead: attackValue drops charge moves');
  assert.equal(has('Basculegion','Last Respects'),false);
  assert.equal(has('Indeedee','Expanding Force'),false);
  assert.equal(has('Golisopod','First Impression'),false);
});

test('P0-1: v2 keeps each conditional move as a legal, coherent set whose condition the public form can create',()=>{
  const want=[['Charizard','Solar Beam',s=>s.form==='Charizard-Mega-Y'&&s.item==='Charizardite Y'],
    ['Basculegion','Last Respects',()=>true],
    ['Indeedee','Expanding Force',s=>s.ability==='Psychic Surge'],
    ['Golisopod','First Impression',()=>true]];
  for(const [sp,move,cond] of want){
    const out=H.legalRoleHypotheses(sim,sp,{version:'v2'});
    const sets=out.sets.filter(s=>s.moves.includes(move));
    assert.ok(sets.length,sp+' '+move);
    for(const s of sets){
      assert.ok(cond(s),sp+' '+move+' only where its condition holds: '+s.form+' '+s.ability);
      assert.equal(v.validateSet(structuredClone(plain(s)),{}),null,sp);
      assert.deepEqual(H.coherenceProblems(dex,plain(s),{formName:s.form}),[]);
      assert.ok(s.tags.includes('cond:'+dex.moves.get(move).id));
    }
    // Existing legal research fixtures use exactly these moves.
    if(sp!=='Golisopod')assert.ok(fixture(sp,move),sp+' '+move+' fixture premise');
  }
  // No Solar Beam outside the Drought form (Mega X / plain Charizard would charge).
  assert.ok(H.legalRoleHypotheses(sim,'Charizard',{version:'v2'}).sets
    .filter(s=>s.moves.includes('Solar Beam')).every(s=>s.form==='Charizard-Mega-Y'));
  // Generic roles still never get the old "always max power" fillers.
  for(const sp of ['Garchomp','Corviknight','Lucario','Gengar'])
    assert.ok(H.legalRoleHypotheses(sim,sp,{version:'v2'}).sets.every(s=>!s.moves.some(m=>['Hyper Beam','Giga Impact','Last Resort','Upper Hand'].includes(m))));
});

test('P0-1 real Battle: Mega Charizard Y Solar Beam fires on the Mega turn; plain Charizard charges (tagged)',()=>{
  const y=fixture('Charizard','Solar Beam');
  assert.equal(y.item,'Charizardite Y');
  const foe=[fixture('Basculegion','Last Respects'),...groups[0].team.slice(0,2)];
  const own=[y,...groups[1].team.slice(0,2)];
  const i=y.moves.indexOf('Solar Beam')+1;
  const b=play(own,foe,'move '+i+' mega','move 1');
  const log=b.log.join('\n');
  assert.match(log,/\|-weather\|SunnyDay\|\[from\] ability: Drought/);
  // Pinned engine logs -prepare even in sun, then fires the same action (-anim + damage).
  assert.match(log,/\|-prepare\|p1a: Charizard\|Solar Beam\n\|-anim\|p1a: Charizard\|Solar Beam\|p2a/);
  assert.equal(misplaysV2(log).p1.chargeNoSun,0);
  const b2=play([{...y,item:'Life Orb'},...own.slice(1)],foe,'move '+i,'move 1');
  assert.match(b2.log.join('\n'),/\|-prepare\|p1a: Charizard\|Solar Beam/);
  assert.doesNotMatch(b2.log.join('\n'),/\|-anim\|p1a: Charizard\|Solar Beam/);
  assert.equal(misplaysV2(b2.log.join('\n')).p1.chargeNoSun,1);
});

test('P0-1 real Battle: Expanding Force is boosted by Psychic Surge; Last Respects by fainted allies',()=>{
  const ind=fixture('Indeedee','Expanding Force'),bas=fixture('Basculegion','Last Respects');
  const target=[structuredClone(groups[0].team.find(p=>p.species==='Corviknight')||groups[0].team[0])];
  const foe=[...target,...groups[2].team.filter(p=>p.species!==target[0].species).slice(0,2)];
  const mv=(s,m)=>'move '+(s.moves.indexOf(m)+1);
  const withT=dealt(play([ind,...groups[1].team.slice(0,2)],foe,mv(ind,'Expanding Force'),'move 1'),'p2a');
  const noT=dealt(play([{...ind,ability:'Inner Focus'},...groups[1].team.slice(0,2)],foe,mv(ind,'Expanding Force'),'move 1'),'p2a');
  assert.ok(withT>1.5*noT,'terrain '+withT+' vs none '+noT);
  const lr0=dealt(play([bas,...groups[1].team.slice(0,2)],foe,mv(bas,'Last Respects'),'move 1'),'p2a');
  const lr2=dealt(play([bas,...groups[1].team.slice(0,2)],foe,mv(bas,'Last Respects'),'move 1',
    {before:b=>{b.sides[0].totalFainted=2;}}),'p2a');
  assert.ok(lr2>2.3*lr0,'2 fainted '+lr2+' vs 0 '+lr0);
});

test('P0-3: coverage scenarios show every (species, threat tag); A keeps an SD Golisopod; legal under item clause',()=>{
  for(const c of caseList().slice(0,7)){
    const sp=c.team.map(p=>p.species);
    const cov=H.coverageScenarios(sp.map(s=>H.legalRoleHypotheses(sim,s,{version:'v2'})));
    assert.deepEqual(cov.coverage.missing,[],c.id);
    for(const sc of cov.scenarios){
      assert.equal(new Set(sc.map(p=>p.item)).size,6,c.id+' item clause');
      const team=P.toLabTeam(sc);prelim(team,c.id);
      assert.equal(v.validateTeam(normalize(team)),null,c.id);
    }
    if(c.id==='A_golisopod')assert.ok(cov.scenarios.some(sc=>sc.find(p=>p.species==='Golisopod').moves.includes('Swords Dance')),
      'PR #65 A counterexample: SD Golisopod must be in some scenario');
  }
  // Counter-check of the PR #65 report: at head 8114a29 the v1 A scenarios
  // k=1,2 DO hold SD Mega Golisopod (the "no-SD Golisopod" text described an
  // earlier item-clause ordering). Pinned so the claim cannot drift silently.
  const a=caseList()[0].team.map(p=>p.species),hv1=a.map(s=>H.legalRoleHypotheses(sim,s));
  assert.deepEqual([0,1,2].map(k=>H.rivalScenario(hv1,k).find(p=>p.species==='Golisopod').moves.includes('Swords Dance')),[false,true,true]);
});

test('P0-2: v2 rival candidates keep every public species in a three and as a lead (A/B/C/Indeedee/E)',()=>{
  const own=reportedLive().map(p=>p.species);
  for(const c of caseList().slice(0,7)){
    const sp=c.team.map(p=>p.species);
    const cov=H.coverageScenarios(sp.map(s=>H.legalRoleHypotheses(sim,s,{version:'v2'})));
    for(const sc of cov.scenarios){
      const cand=P.rivalCandidates(dex,P.toLabTeam(sc),own,2,'all',{truncate:false});
      for(const s of sp){assert.ok(cand.some(r=>r.three.includes(s)),c.id+' '+s);assert.ok(cand.some(r=>r.three[0]===s),c.id+' lead '+s);}
    }
  }
});

test('P0-4: v2 shares one seed across rival branches, so a branch that changes nothing changes nothing',async()=>{
  // A rival with no setup move: the 'setup' branch falls back to the turn AI.
  const own=reportedLive();
  const foe=P.toLabTeam(['Corviknight','Hippowdon','Umbreon','Gyarados','Gengar','Garchomp']
    .map(s=>H.legalRoleHypotheses(sim,s,{version:'v2'}).sets.find(x=>!x.tags.includes('setup')&&!x.tags.includes('scarf'))))
    .map((p,i)=>({...p,item:['Leftovers','Sitrus Berry','Rocky Helmet','Life Orb','Focus Sash','Lum Berry'][i]}));
  const args={own,ownThree:['Primarina','Metagross','Garchomp'],foe,foeThree:['Corviknight','Hippowdon','Umbreon'],horizon:3};
  const seed=P.seedFor(7300000,5,0);
  const ai=await P.shortBattle(sim,{...args,seed,branch:'ai'});
  const setup=await P.shortBattle(sim,{...args,seed,branch:'setup'});
  assert.equal(setup.value,ai.value,'same seed, same action -> same value');
  const rev=await P.shortBattle(sim,{...args,seed,branch:'ai',reverse:true});
  assert.ok(Number.isFinite(rev.value));
  assert.ok(rev.lines.some(l=>l.startsWith('|switch|p2a: Primarina')),'reverse seats our lead on p2');
});

test('P0-2/P0-4: v2 evaluates all 20 trios x 3 leads, and sees public species only',async()=>{
  const own=reportedLive();
  const cs=caseList(),a=cs.find(c=>c.id==='Real_indeedee_scarf'),b=cs.find(c=>c.id==='Real_indeedee_sash');
  const names=a.team.map(p=>p.species);
  await assert.rejects(P.chooseLegalSearchV2(sim,own,a.team,{}),/species names only/);
  const opts={version:'v2',maxScenarios:1,rivalTrios:0,branches:['ai'],reps:[{rep:0,reverse:false}],horizon:1};
  const r1=await P.chooseLegalSearch(sim,own,names,opts);
  const r2=await P.chooseLegalSearch(sim,own,b.team.map(p=>p.species),opts);
  assert.equal(r1.evidence.ownOptions,60);
  assert.equal(r1.evidence.ownTrios,20);
  assert.equal(r1.table.length,60);
  assert.deepEqual(r1.chosen,r2.chosen);
  assert.deepEqual(r1.table.map(x=>x.score),r2.table.map(x=>x.score));
  assert.ok(r1.unverified&&r1.unverified.some(x=>/scenario coverage/.test(x)),'one scenario cannot cover all tags -> unverified, not scored as verified');
  assert.ok(r1.table.every(x=>x.rankMean>=1&&x.rankMin>=1));
});

test('P0-5: misplay tags v2 (v1 tags identical, new tags on synthetic logs)',()=>{
  const v1log=['|turn|1','|move|p2a: Golisopod|Swords Dance|p2a: Golisopod','|turn|2',
    '|move|p2a: Golisopod|Swords Dance|p2a: Golisopod','|turn|3','|move|p2a: Golisopod|Swords Dance|p2a: Golisopod',
    '|move|p1a: Primarina|Encore|p2a: Golisopod','|turn|4','|move|p1a: Primarina|Encore|p2a: Golisopod',
    '|move|p2a: Garchomp|Earthquake|p1a: Rotom','|-immune|p1a: Rotom','|turn|5',
    '|move|p2a: Garchomp|Earthquake|p1a: Rotom','|-immune|p1a: Rotom'].join('\n');
  const a=misplays(v1log),b=misplaysV2(v1log);
  for(const s of ['p1','p2'])for(const t of V1_TAGS)assert.equal(b[s][t],a[s][t],s+t);
  const log=['|switch|p1a: Garchomp|Garchomp|100/100','|switch|p2a: Corviknight|Corviknight|100/100','|turn|1',
    '|move|p1a: Garchomp|Rock Slide|p2a: Corviknight','|-resisted|p2a: Corviknight','|-damage|p2a: Corviknight|80/100','|turn|2',
    '|move|p1a: Garchomp|Rock Slide|p2a: Corviknight','|-resisted|p2a: Corviknight','|-damage|p2a: Corviknight|60/100',
    '|-damage|p1a: Garchomp|0 fnt|[from] item: Rocky Helmet|[of] p2a: Corviknight','|faint|p1a: Garchomp',
    '|switch|p1a: Rotom|Rotom-Wash|100/100','|turn|3',
    '|switch|p2a: Hippowdon|Hippowdon|100/100','|-weather|Sandstorm|[from] ability: Sand Stream','|turn|4',
    '|switch|p2a: Corviknight|Corviknight|60/100','|move|p1a: Rotom|Sandstorm|p1a: Rotom','|turn|5',
    '|move|p1a: Rotom|U-turn|p2a: Corviknight','|switch|p1a: Primarina|Primarina|100/100','|turn|6'].join('\n');
  const m=misplaysV2(log);
  assert.equal(m.p1.resistRepeat,1);
  assert.equal(m.p1.helmetFaint,1);
  assert.equal(m.p2.switchLoop,1,'T3 and T4 voluntary switches');
  assert.equal(m.p1.switchLoop,0,'replacement after faint and U-turn are not voluntary');
  assert.equal(m.p1.weatherRedundant,1);
});
