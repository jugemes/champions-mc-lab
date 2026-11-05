'use strict';
// PR #76 P0-B (public-six preview entry point, H2 bounds) and P0-C (executed()
// turn boundary) from the ChatGPT review of PR #75.
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const {choosePublicSixPreview,A_SIX}=require('../public-six-preview');
const {reportedLive}=require('../reported-live-roster-20261027');
const {caseList}=require('../legal-search-v2-compare');
const {executed,finalLabel}=require('../a-branch-audit-v2');
const {battle}=require('../encore-lead-audit');
const {bounds}=require('../pr76-h2-bounds');
const {run:holdoutRun}=require('../public-six-holdout');
const dex=sim.Dex.mod('champions');

test('entry point takes public species names only; hidden sets are rejected',()=>{
  const A=caseList().find(c=>c.id==='A_golisopod').team;
  assert.throws(()=>choosePublicSixPreview({dex,own:reportedLive(),publicSix:A,seed:[1,2,3,4]}),/strings/);
  assert.throws(()=>choosePublicSixPreview({dex,own:reportedLive(),publicSix:A_SIX.slice(0,3),seed:[1,2,3,4]}),/six/);
  assert.equal(choosePublicSixPreview.length,1,'one options object: {dex,own,publicSix,seed,side}');
});
test('registered A six: seeded draw from the robust mixture, order-independent, reproducible, logged',()=>{
  const own=reportedLive();
  const a=choosePublicSixPreview({dex,own,publicSix:A_SIX,seed:[9,8,7,6]});
  const b=choosePublicSixPreview({dex,own,publicSix:[...A_SIX].reverse(),seed:[9,8,7,6]});
  assert.equal(a.status,'registered');assert.deepEqual(a.hypotheses,['H0','H1']);assert.equal(a.policy,'robust');
  assert.deepEqual(a,b,'public six order does not matter');
  assert.deepEqual(a.security,{H0:0.225,H1:0.294},'PR #75 robust security reproduced');
  assert.match(a.notCovered,/unevaluated/);
  assert.equal(a.pick.length,3);assert.deepEqual(a.selection.map(n=>own[n-1].species),a.pick);
  // Over many seeds the draw follows the mixture (support mass ~0.99 at >=3%).
  const seen={};for(let s=0;s<400;s++){const r=choosePublicSixPreview({dex,own,publicSix:A_SIX,seed:[s,1,2,3]});seen[r.pickIndex]=(seen[r.pickIndex]||0)+1;}
  const top=a.support[0];assert.ok(Object.keys(seen).length>=5,'mixed, not a single pick');
  assert.ok(top[1]>0.2);
});
test('unregistered or altered six / altered own roster: explicit legacy fallback, A matrix never reused',()=>{
  const own=reportedLive();
  for(const id of ['B_lucarioZ','C_charizardY','Real_indeedee_scarf','NEW_realE_sun','HOLD_psychic_offense']){
    const r=choosePublicSixPreview({dex,own,publicSix:caseList().find(c=>c.id===id).team.map(p=>p.species),seed:[1,2,3,4]});
    assert.equal(r.status,'fallback',id);assert.match(r.reason,/no registered matrix/);assert.equal(r.security,undefined);
  }
  const near=[...A_SIX.slice(0,5),'Corviknight'];
  assert.equal(choosePublicSixPreview({dex,own,publicSix:near,seed:[1,2,3,4]}).status,'fallback');
  const changed=structuredClone(own);changed[0]={...changed[0],moves:[...changed[0].moves.slice(0,3),'Protect']};
  const r=choosePublicSixPreview({dex,own:changed,publicSix:A_SIX,seed:[1,2,3,4]});
  assert.equal(r.status,'fallback');assert.match(r.reason,/own six differs/);
});
test('real Battle: Bot previewPolicy publicSix logs the entry decision (A registered, B fallback)',async()=>{
  const {Bot,normalize,hashSeed}=require('../lab');
  for(const [id,want] of [['A_golisopod','registered'],['B_lucarioZ','fallback']]){
    const rival=caseList().find(c=>c.id===id).team;
    const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true})),trace={choices:[],selections:[],errors:[]},seed=hashSeed(7650000);
    const b1=new Bot(streams.p1,dex,reportedLive(),'p1',trace,null,null,{previewPolicy:'publicSix',seed,publicCondition:true,ownCondition:true});
    const b2=new Bot(streams.p2,dex,structuredClone(rival),'p2',trace,null,null,{seed});
    const w=(async()=>{for await(const _ of streams.omniscient);})();const r=[b1.run(),b2.run()];
    await streams.omniscient.write('>start '+JSON.stringify({formatid:'gen9championsbssregmc',seed})+'\n>player p1 '+JSON.stringify({name:'a',team:normalize(reportedLive())})+'\n>player p2 '+JSON.stringify({name:'b',team:normalize(rival)}));
    await Promise.all([w,...r]);
    const sel=trace.selections.find(s=>s.side==='p1');
    assert.equal(sel.previewLog.status,want,id);assert.deepEqual(sel.chosen,sel.previewLog.pick);assert.equal(trace.errors.length,0);
  }
});
test('H2 holdout: renormalised 0.151 lies inside [lower, upper] with the unevaluated mass',()=>{
  const r=bounds().policies.robust;
  assert.equal(r.renormalised,0.151);assert.equal(r.coveredMass,0.9834);
  assert.ok(r.lower<=r.renormalised&&r.renormalised<=r.upper);assert.equal(r.lower,0.148);assert.equal(r.upper,0.165);
});
test('B/C/Indeedee/E/unknown six regression: legal, rival picks keep the ace, pr75 vs pr76 same seeds/sides',async()=>{
  const r=await holdoutRun({cases:['C_charizardY','Real_indeedee_scarf'],seedN:1});
  assert.ok(r.meta.C_charizardY.rivalPicks.some(p=>p.pick[0]==='Charizard'),'Charizard-Y lead is a tested rival pick');
  assert.ok(r.meta.Real_indeedee_scarf.rivalPicks.some(p=>p.pick[0]==='Indeedee'));
  assert.ok(r.games.some(g=>g.case==='C_charizardY'&&g.rivalSrc==='aceLead'&&g.aceMega&&g.sun),'Mega Charizard-Y and sun actually observed');
  assert.ok(r.games.every(g=>g.entryStatus==='fallback'));
  assert.equal(r.pr75VsPr76.pairs*2,r.games.length);
});
test('executed(): missing |turn| is noturn/unknown; our mid-turn faint no longer hides the rival move; pr75 mode reproduces',()=>{
  const L=['|turn|1','|move|p2a: Garchomp|Earthquake|p1a: Tyranitar','|-damage|p1a: Tyranitar|10/100','|win|p2'];
  assert.deepEqual(executed(L,2,'p2'),{kind:'noturn'});
  assert.equal(executed(L,2,'p2',{pr75:true}).name,'Earthquake','PR #75 slice(0) bug reproduced');
  assert.equal(finalLabel({kind:'move',name:'Earthquake',cls:'plausible'},executed(L,2,'p2')).cls,'unknown');
  // Our mon faints to Rocky Helmet before the rival acts in the same turn.
  const M=['|turn|1','|move|p1a: Metagross|Meteor Mash|p2a: Corviknight','|-damage|p2a: Corviknight|60/100',
    '|-damage|p1a: Metagross|0 fnt|[from] item: Rocky Helmet|[of] p2a: Corviknight','|faint|p1a: Metagross',
    '|move|p2a: Corviknight|Body Press||[notarget]','|-fail|p2a: Corviknight','|','|upkeep','|switch|p1a: Tyranitar|Tyranitar, L50|100/100','|turn|2'];
  assert.deepEqual(executed(M,1,'p2'),{kind:'move',name:'Body Press',failed:true});
  assert.deepEqual(executed(M,1,'p2',{pr75:true}),{kind:'none'},'PR #75 stopped at our faint');
  // Rival fainted before acting: still preempted (none), replacement switch not read.
  const F=['|turn|1','|move|p1a: Metagross|Meteor Mash|p2a: Corviknight','|-damage|p2a: Corviknight|0 fnt','|faint|p2a: Corviknight','|','|upkeep','|switch|p2a: Garchomp|Garchomp, L50|100/100','|turn|2'];
  assert.deepEqual(executed(F,1,'p2'),{kind:'none'});
});
