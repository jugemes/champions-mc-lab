'use strict';
// PR #76 P0-A: public HP/status condition parsing (ChatGPT review of PR #75).
// Legacy split('/') reads "80/200 par" as [80,NaN] and leaves foeHP stale; a
// statused switch-in set foePublicStatus but kept foeStatus ''. The opt-in
// publicCondition / ownCondition options parse every condition once.
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const {Bot,parseCondition}=require('../lab');
const {run,reentry}=require('../public-condition-audit');
const dex=sim.Dex.mod('champions');
const streamOf=text=>({async *[Symbol.asyncIterator](){yield text;}});
const feed=async(lines,options={})=>{
  const b=new Bot(streamOf(lines.join('\n')),dex,[{species:'Rotom-Wash',moves:['Will-O-Wisp'],evs:{hp:32,def:32,spa:2},nature:'Bold'}],'p1',{choices:[],selections:[],errors:[]},null,null,options);
  await b.run();return b;
};
const FIX={publicCondition:true,ownCondition:true};

test('parseCondition: plain, every status, fnt, champions 20%/50% colour suffix, no HP',()=>{
  assert.deepEqual(parseCondition('100/100'),{hp:1,fainted:false,status:''});
  assert.deepEqual(parseCondition('80/200 par'),{hp:0.4,fainted:false,status:'par'});
  for(const s of ['slp','frz','par','brn','psn','tox'])assert.equal(parseCondition('180/200 '+s).status,s);
  assert.equal(parseCondition('180/200 brn').hp,0.9);
  assert.deepEqual(parseCondition('0 fnt'),{hp:0,fainted:true,status:''});
  assert.equal(parseCondition('50/100g').hp,0.5);
  assert.deepEqual(parseCondition('20/100r tox'),{hp:0.2,fainted:false,status:'tox'});
  assert.equal(parseCondition('').hp,null);
  assert.equal(parseCondition(undefined).hp,null);
});
test('isolated repro: legacy keeps foeHP 0.75 after "80/200 par" / "180/200 brn"; fixed 0.40 / 0.90',async()=>{
  const base=['|switch|p2a: Garchomp|Garchomp, L50|150/200','|turn|1'];
  for(const [line,want] of [['|-damage|p2a: Garchomp|80/200 par',0.4],['|-heal|p2a: Garchomp|180/200 brn',0.9]]){
    assert.equal((await feed([...base,line])).foeHP,0.75,'legacy stale value reproduced');
    const b=await feed([...base,line],FIX);
    assert.equal(b.foeHP,want);assert.equal(b.foeStatus,line.slice(-3));assert.equal(b.foePublicStatus,b.foeStatus);
  }
  assert.equal((await feed([...base,'|-damage|p2a: Garchomp|50/100g'])).foeHP,0.75,'legacy drops the colour suffix');
  assert.equal((await feed([...base,'|-damage|p2a: Garchomp|50/100g'],FIX)).foeHP,0.5);
  assert.equal((await feed([...base,'|-sethp|p2a: Garchomp|30/100'],FIX)).foeHP,0.3,'Pain Split -sethp');
  assert.equal((await feed([...base,'|-damage|p2a: Garchomp|0 fnt','|faint|p2a: Garchomp'],FIX)).foeHP,0);
});
test('switch-in public status: legacy foeStatus "" vs foePublicStatus par; fixed both par, cure clears both',async()=>{
  const sw='|switch|p2a: Garchomp|Garchomp, L50|100/200 par';
  let b=await feed([sw,'|turn|1']);
  assert.equal(b.foeStatus,'');assert.equal(b.foePublicStatus,'par');assert.equal(b.foeHP,0.5);
  b=await feed([sw,'|turn|1'],FIX);
  assert.equal(b.foeStatus,'par');assert.equal(b.foePublicStatus,'par');
  b=await feed([sw,'|-curestatus|p2a: Garchomp|par','|turn|1'],FIX);
  assert.equal(b.foeStatus,'');assert.equal(b.foePublicStatus,'');
  b=await feed([sw,'|drag|p2a: Hippowdon|Hippowdon, L50|100/100','|turn|1'],FIX);
  assert.equal(b.foeStatus,'','a new foe clears the old status');assert.equal(b.foeHP,1);
});
test('own HP ratio: legacy reads a burned 30% Corviknight as full HP and never Roosts; ownCondition Roosts',async()=>{
  const team=[{species:'Corviknight',ability:'Pressure',item:'Rocky Helmet',moves:['Roost','Body Press'],evs:{hp:32,def:32,spd:2},nature:'Impish'}];
  const req=cond=>({side:{pokemon:[{active:true,condition:cond,details:'Corviknight, L50, M',item:'rockyhelmet'}]},
    active:[{moves:[{move:'Roost',id:'roost',pp:8,maxpp:8},{move:'Body Press',id:'bodypress',pp:16,maxpp:16}]}]});
  const pick=async(o,cond)=>{const b=new Bot(streamOf(['|switch|p2a: Garchomp|Garchomp, L50|100/100','|turn|3'].join('\n')),dex,team,'p1',{choices:[],selections:[],errors:[]},null,null,o);
    await b.run();return b.decide(req(cond));};
  assert.equal(await pick({},'60/200'),'move 1','unstatused: both parse 0.30 and Roost');
  assert.equal(await pick({},'60/200 brn'),'move 2','legacy: max NaN -> ratio 1 -> Roost scored 0');
  assert.equal(await pick({ownCondition:true},'60/200 brn'),'move 1');
});
test('real Battle: fixed Bot internals equal the engine at every request; legacy mismatches reproduced',async()=>{
  const r=await run({cases:['Real_indeedee_scarf','NEW_realE_sun'],seedN:2});
  const L=r.totals.legacy,F=r.totals.fixed;
  assert.ok(F.decisions>50&&F.foeStatused>0&&F.ownStatused>0,'statused states covered '+JSON.stringify(F));
  assert.equal(F.hpMismatch,0);assert.equal(F.statusMismatch,0);assert.equal(F.ownRatioMismatch,0);
  assert.ok(L.hpMismatchStatused>0,'legacy stale foeHP after a statused -damage/-heal');
  assert.ok(L.hpMismatch>L.hpMismatchStatused,'legacy colour-suffix (50/100g) mismatch');
  assert.equal(L.ownRatioMismatch,L.ownStatused,'legacy own ratio wrong whenever statused');
});
test('real Battle re-entry: legacy re-uses Will-O-Wisp on a burned foe (engine -fail), fixed never',async()=>{
  const r=await reentry({leads:['Archaludon','Garchomp'],seedN:3});
  const L=r.totals.legacy,F=r.totals.fixed;
  assert.ok(L.willOWispFailed>0,'counterexample reproduced '+JSON.stringify(L));
  assert.ok(L.statusMismatch>0,'legacy foeStatus "" on a statused re-entry');
  assert.equal(F.willOWispFailed,0);assert.equal(F.statusMismatch,0);assert.equal(F.hpMismatch,0);
  assert.ok(F.foeStatused>0);
});
test('default Bot keeps the legacy parse (saved results replay unchanged)',async()=>{
  const b=await feed(['|switch|p2a: Garchomp|Garchomp, L50|100/200 par','|turn|1']);
  assert.equal(b.publicCondition,false);assert.equal(b.ownCondition,false);
});
