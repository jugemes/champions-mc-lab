'use strict';
// PR #90 request (ChatGPT review #5721083231 of PR #89): same-seed guard sides,
// eligible-candidate decision, hard deadline, public item/ability in the T2 key.
const test=require('node:test'),assert=require('node:assert/strict');
const GP=require('../pr88-guarded-preview');
const V2=require('../pr90-guarded-preview-v2');
const haveSD=!!process.env.SHOWDOWN_DIR;

test('P0-1 reproduced: pr88 guard left/right of cell 0 use different seeds; V2 pairs one seed on both sides',()=>{
  const {hashSeed}=require('../lab');
  // pr88 formula, seedBase SEL_SEARCH_SEED_BASE, ci=0: rep0 left, rep1 right
  const B=require('../holdout-20261031-pr88').SEL_SEARCH_SEED_BASE;
  assert.deepEqual(hashSeed(B+300000),[6654,38881,52623,7123]);
  assert.deepEqual(hashSeed(B+300001),[44798,55675,22272,29975]);
  const cells=[{si:0,foe:['X','Y','Z']},{si:1,foe:['Y','X','W']}];
  const old=V2.guardJobs(['A>B/C','D>B/C'],cells,{...GP.GUARD,pairedSides:false},B);
  assert.throws(()=>V2.pairSides(old),/has 1 games/);
  const jobs=V2.guardJobs(['A>B/C','D>B/C'],cells,V2.GUARD_V2,B);
  assert.equal(jobs.length,2*old.length,'pr88 seeds, each on both sides');
  const pairs=V2.pairSides(jobs);
  assert.equal(pairs.length,jobs.length/2);
  const c0=jobs.filter(j=>j.ci===0&&j.k===0&&j.branch==='ai'&&j.rep===0);
  assert.deepEqual(c0.map(j=>j.reverse),[false,true]);
  assert.deepEqual(c0[0].seed,[6654,38881,52623,7123]);assert.deepEqual(c0[1].seed,c0[0].seed);
  // a tampered pair is caught
  const bad=structuredClone(jobs);bad[1].foe=['Q','Y','Z'];
  assert.throws(()=>V2.pairSides(bad),/foe differs/);
});

test('P1-1 reproduced: pr88 decide misses an eligible runner-up; decideV2 takes it',()=>{
  const L={pick:'L>a/b',legacy:true,worst:0.40,mean:0.70},A={pick:'A>a/b',worst:0.70,mean:0.60},B={pick:'B>a/b',worst:0.60,mean:0.75};
  const o={margin:0.10,meanSlack:0.02};
  assert.equal(GP.decide([L,A,B],o).pick,'L>a/b');                 // the reported bug, kept for reproducibility
  const d=V2.decideV2([L,A,B],o);assert.equal(d.pick,'B>a/b');assert.deepEqual(d.eligible,['B>a/b']);
  // pr88 rule unchanged where only one candidate exists
  const L2={pick:'L>a/b',legacy:true,worst:0.5,mean:0.8};
  for(const [c,want] of [[{pick:'Q>a/b',worst:0.55,mean:0.95},'L>a/b'],[{pick:'Q>a/b',worst:0.6,mean:0.79},'Q>a/b'],
    [{pick:'Q>a/b',worst:0.9,mean:0.7},'L>a/b']])assert.equal(V2.decideV2([L2,c],o).pick,want);
  // among eligible: worst first, then mean
  assert.equal(V2.decideV2([L,{pick:'C>a/b',worst:0.6,mean:0.9},B,{pick:'E>a/b',worst:0.65,mean:0.69}],o).pick,'E>a/b');
  assert.throws(()=>V2.decideV2([A,B],o),/legacy candidate missing/);
});

test('hard deadline: selector process group is killed, legacy pick returned as abstain',{skip:!haveSD&&'SHOWDOWN_DIR not set'},async()=>{
  const {load}=require('../lab');const dex=load().Dex.mod('champions');
  const own=require('../reported-live-roster-20261027').reportedLive();
  const six=['Charizard','Garchomp','Kingambit','Rotom-Wash','Gholdengo','Primarina'];
  const t0=Date.now();
  const r=await V2.guardedPreviewHard({dex,own,publicSix:six,seedBase:9050000,workers:2,budgetSeconds:3});
  const s=(Date.now()-t0)/1000;
  assert.equal(r.status,'abstain');assert.deepEqual(r.pick,GP.legacyPick(dex,own,six));
  assert.ok(s<6,'returned at the deadline, took '+s+'s');
  await assert.rejects(V2.guardedPreviewHard({dex,own,publicSix:six.slice(0,3),seedBase:1}),/species names/);
});

test('P1-2: revealed rival item / ability enter the V4 key; unrevealed stay empty; pr84 key unchanged',{skip:!haveSD&&'SHOWDOWN_DIR not set'},()=>{
  const C=require('../pr84-public-cond-entry'),C4=require('../pr90-public-cond-v4');
  const req={side:{pokemon:[{active:true,condition:'100/100'}]}};
  const bot=x=>({boosts:{},foeHP:0.5,foeBoosts:{},hazards:{},ownHazards:{},weather:'',terrain:'',...x});
  const a=bot({foeItem:'Choice Scarf',foeAbility:'Levitate'}),b=bot({foeItem:'Leftovers',foeAbility:'Pressure'});
  assert.equal(C.condSig(C.condFromBot(req,a)),C.condSig(C.condFromBot(req,b)));   // the reported gap, unchanged
  assert.equal(C.condSig(C.condFromBot(req,a)),'o:F//h:|f:H//h:|w:/t:');
  const ka=C4.condSigV4(C4.condFromBotV4(req,a)),kb=C4.condSigV4(C4.condFromBotV4(req,b)),k0=C4.condSigV4(C4.condFromBotV4(req,bot({foeItem:'',foeAbility:''})));
  assert.notEqual(ka,kb);assert.equal(ka,'o:F//h:|f:H//h:|w:/t:|r:choicescarf/levitate');
  assert.equal(k0,'o:F//h:|f:H//h:|w:/t:|r:/');
  assert.equal(C4.condSigV4({...C4.condFromBotV4(req,a),foeItem:'Rocky Helmet'}).endsWith('|r:rockyhelmet/levitate'),true);
  assert.throws(()=>C4.condSigV4({...C4.condFromBotV4(req,a),foeItem:'hidden:Leftovers'}),/bad foeItem/);
  assert.throws(()=>C4.condSigV4({...C4.condFromBotV4(req,a),foeMoves:['x']}),/non-public cond field/);
});

test('P1-2: lab Bot foeItem / foeAbility come only from public log lines',{skip:!haveSD&&'SHOWDOWN_DIR not set'},async()=>{
  // Two rival sets that differ ONLY in hidden item / ability: before anything is
  // revealed the V4 cond seen by our bot at T1 must be identical.
  const {load}=require('../lab');const {battle}=require('../encore-lead-audit');const C4=require('../pr90-public-cond-v4');
  const sim=load(),own=require('../reported-live-roster-20261027').reportedLive();
  const foe=item=>[{species:'Gholdengo',item,ability:'Good as Gold',nature:'Modest',evs:{hp:32,spa:32,spe:2},moves:['Make It Rain','Shadow Ball','Nasty Plot','Protect']},
    {species:'Kingambit',item:'Black Glasses',ability:'Supreme Overlord',nature:'Adamant',evs:{hp:32,atk:32,spe:2},moves:['Kowtow Cleave','Sucker Punch','Iron Head','Swords Dance']},
    {species:'Primarina',item:'Sitrus Berry',ability:'Liquid Voice',nature:'Modest',evs:{hp:32,spa:32,spe:2},moves:['Hyper Voice','Moonblast','Calm Mind','Protect']}];
  const seen=async item=>{const out=[];
    await battle(sim,structuredClone(own),foe(item),[1,2,3,4],{ownThree:['Metagross','Garchomp','Rotom-Wash'],foeThree:['Gholdengo','Kingambit','Primarina'],
      ownOptions:{script:(req,b,info)=>{if(info.turn===1)out.push(C4.condSigV4(C4.condFromBotV4(req,b)));return null;}}});
    return out[0];};
  const x=await seen('Leftovers'),y=await seen('Shuca Berry');
  assert.ok(x);assert.equal(x,y);assert.ok(x.endsWith('|r:/'),x);
});

test('saved V2 run: same-seed sides are (near) duplicates; DEV guard scores equal pr88, F1 is the only changed pick',()=>{
  const fs=require('node:fs'),path=require('node:path'),rd=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','reports/data',f),'utf8'));
  for(const ph of ['dev','final']){
    const v=rd('pr90-selection-'+ph+'.json'),o=rd('pr88-selection-'+ph+'.json');
    assert.equal(v.guard.reps,2);assert.equal(v.guard.pairedSides,true);
    for(const [id,x] of Object.entries(v.sixes)){
      const split=x.v2.scores.reduce((a,s)=>a+s.sideSplit,0),pairs=x.v2.scores.reduce((a,s)=>a+s.pairs,0);
      assert.ok(split/pairs<0.07,id+' side split '+split+'/'+pairs);
      if(split===0)assert.deepEqual(x.v2.scores.map(s=>[s.pick,s.worst,s.mean]),o.sixes[id].selection.guarded.scores.map(s=>[s.pick,s.worst,s.mean]),id);
      assert.equal(x.changed,id==='F1_gallade',id);
    }
  }
});
