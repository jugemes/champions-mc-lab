'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const rational=require('../decision-rational');
const {reportedLive}=require('../reported-live-roster-20261027');
const {runCase,H}=require('../rational-cases');
const {Bot,hashSeed,normalize}=require('../lab');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const live=reportedLive();
const get=s=>live.find(p=>p.species===s);
const state=(o={})=>({ratio:1,foeHP:1,foeItem:'',foeAbility:'',boosts:{},foeBoosts:{},seenMoves:[],foeRecovers:false,observedImmune:[],flags:{},...o});

test('(iii) a self-boost whose boosted stats are all +6 is never chosen',()=>{
  assert.equal(rational.setupIsCapped(dex,'Swords Dance',{atk:6}),true);
  assert.equal(rational.setupIsCapped(dex,'Swords Dance',{atk:4}),false);
  assert.equal(rational.setupIsCapped(dex,'Dragon Dance',{atk:6,spe:2}),false,'speed can still rise');
  assert.equal(rational.setupIsCapped(dex,'Dragon Dance',{atk:6,spe:6}),true);
  assert.ok(rational.rationalMoveScore(dex,H.golisopodSD,'Primarina','Swords Dance',86,state({boosts:{atk:6}})).score<=-1e4);
});
test('(i) contact into public Rocky Helmet is a self-KO below 1/6 HP and penalised into shown Roost',()=>{
  const meta=get('Metagross');
  const lethal=rational.rationalMoveScore(dex,meta,'Corviknight','Thunder Punch',150,state({ratio:0.1,foeHP:0.9,foeItem:'Rocky Helmet'}));
  assert.ok(lethal.flags.includes('contact-self-ko'));assert.ok(lethal.score<=-1e4);
  const roost=rational.rationalMoveScore(dex,meta,'Corviknight','Thunder Punch',150,state({foeItem:'Rocky Helmet',foeRecovers:true}));
  assert.ok(roost.flags.includes('contact-into-recovery'));
  assert.equal(rational.contactRecoil(dex,meta,'Thunder Punch',{item:'Rocky Helmet'}),1/6);
  assert.equal(rational.contactRecoil(dex,meta,'Thunder Punch',{}),0,'unrevealed item is not assumed');
});
test('(ii) a choice lock into an immune or non-progressing move is flagged; a strong lock is kept',()=>{
  const chomp=get('Garchomp');
  assert.equal(rational.lockedMoveIsBad(dex,chomp,'Archaludon','Poison Jab',state()),true);
  assert.equal(rational.lockedMoveIsBad(dex,chomp,'Charizard','Earthquake',state()),true);
  assert.equal(rational.lockedMoveIsBad(dex,chomp,'Corviknight','Rock Slide',state({foeRecovers:true})),true);
  assert.equal(rational.lockedMoveIsBad(dex,chomp,'Hippowdon','Earthquake',state()),false);
  assert.equal(rational.lockedMoveIsBad(dex,chomp,'Charizard','Rock Slide',state()),false);
});
test('(iv) an Encore lock into a status move is kept only while it still has value',()=>{
  assert.equal(rational.lockedMoveIsBad(dex,H.golisopodSD,'Primarina','Swords Dance',state({boosts:{atk:2},statusValue:-1})),true);
  assert.equal(rational.lockedMoveIsBad(dex,H.golisopodSD,'Primarina','Swords Dance',state({boosts:{atk:6},statusValue:200})),true);
  assert.equal(rational.lockedMoveIsBad(dex,H.golisopodSD,'Umbreon','Swords Dance',state({statusValue:113})),false);
});
test('public risk band is non-zero before any foe move is seen (no battle-engine Phase1 hole)',()=>{
  const acts=rational.foePublicActions(dex,'Archaludon',[]);
  assert.ok(acts.some(a=>a.attack&&a.type==='Dragon'));
  assert.ok(!acts.some(a=>a.label.includes('(seen)')),'nothing unrevealed is added');
  assert.ok(rational.foeHit(dex,get('Garchomp'),'Archaludon',acts.find(a=>a.type==='Dragon'&&a.category==='Special'))>0.3);
});
test('simultaneous matrix reports worst and mean per own action, including switches',()=>{
  const rows=rational.simultaneousMatrix(dex,{...state({foeItem:'Rocky Helmet',seenMoves:['Roost','Body Press']}),own:get('Metagross'),foe:'Corviknight',
    moves:get('Metagross').moves,bench:[{set:get('Rotom-Wash'),slot:6,ratio:1}]});
  assert.equal(rows.length,5);
  for(const r of rows){assert.ok(r.worst<=r.mean+1e-9);assert.ok(r.cells.some(c=>c.enemy.startsWith('Roost')));}
  assert.ok(rows.find(r=>r.action==='switch Rotom-Wash').offense>0.3);
});
test('hidden-info boundary: changing an unrevealed foe move/item does not change our turn-1 choice',async()=>{
  // Two opponent sixes that differ only in Corviknight's 4th move and item,
  // which are not revealed before our turn-1 decision.
  const runT1=async corvi=>{
    const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
    const trace={choices:[],selections:[],errors:[]};
    const a=new Bot(streams.p1,dex,live,'p1',trace,['Metagross','Garchomp','Rotom-Wash'],null,{decisionPolicy:'rational'});
    const opp=[corvi,H.archaludon,H.lucarioZ,H.primarina,H.hippowdon,H.gengar];
    const b=new Bot(streams.p2,dex,opp,'p2',trace,['Corviknight','Archaludon','Lucario'],null,{decisionPolicy:'baseline'});
    const r1=a.run(),r2=b.run();
    const seed=hashSeed(4242);
    await streams.omniscient.write('>start '+JSON.stringify({formatid:'gen9championsbssregmc',seed})+'\n>player p1 '+JSON.stringify({name:'a',team:normalize(live)})+'\n>player p2 '+JSON.stringify({name:'b',team:normalize(opp)}));
    const t=Date.now();while(!trace.choices.some(c=>c.side==='p1'&&c.turn===1)&&Date.now()-t<5000)await new Promise(r=>setTimeout(r,5));
    void r1;void r2;
    return trace.choices.find(c=>c.side==='p1'&&c.turn===1).choice;
  };
  const one=await runT1(H.corviknight);
  const two=await runT1({...H.corviknight,item:'Leftovers',moves:['Roost','U-turn','Body Press','Brave Bird']});
  assert.equal(one,two);
});
test('engine regression A: encored Swords Dance is not repeated to +6 by the rational policy',async()=>{
  const old=await runCase(sim,'A_golisopod_setup_encore',{policy:'baseline',seed:hashSeed(700000)});
  const neu=await runCase(sim,'A_golisopod_setup_encore',{policy:'rational',seed:hashSeed(700000)});
  assert.ok(old.metrics.setupAtCap>0,'baseline reproduces the reported blunder');
  assert.equal(neu.metrics.setupAtCap,0);
  assert.ok(neu.rational.some(x=>x.reason==='encore-locked-bad'));
  assert.equal(neu.errors,0);
});
test('engine regression B: choice-locked Poison Jab leaves Archaludon after the first immune hit',async()=>{
  const old=await runCase(sim,'B_scarf_poisonjab_archaludon',{policy:'baseline',seed:hashSeed(700000)});
  const neu=await runCase(sim,'B_scarf_poisonjab_archaludon',{policy:'rational',seed:hashSeed(700000)});
  assert.ok(old.metrics.immuneHits>=2);
  assert.equal(neu.metrics.immuneHits,1);
  assert.ok(neu.rational.some(x=>x.reason==='choice-locked-bad'));
});
test('engine regression B: contact into Helmet + Roost Corviknight stops once no progress is public',async()=>{
  const old=await runCase(sim,'B_helmet_roost',{policy:'baseline',seed:hashSeed(700000)});
  const neu=await runCase(sim,'B_helmet_roost',{policy:'rational',seed:hashSeed(700000)});
  assert.ok(neu.metrics.helmetChip<old.metrics.helmetChip);
  assert.ok(neu.rational.some(x=>x.reason==='no-progress-loop'||x.reason==='contact-into-recovery'));
});
