'use strict';
// PR #84 (ChatGPT review #5719818884 of PR #83): a forced exit (Emergency Exit,
// Eject Button) must not pass as a voluntary requested switch; switch causes
// on both sides; public-condition T1/T2 key. Real pinned-Showdown battles with
// explicit choices (pr84-forced-switch-probe.js) plus protocol boundaries.
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../pr82-switch-utility-t1t2');
const V3=require('../pr84-switch-cause');
const C=require('../pr84-public-cond-entry');
const L=a=>a.join('\n');

test('ChatGPT synthetic counterexample: V2 executed, V3 forcedExit (ability and item)',()=>{
  const req=[{turn:1,choice:'switch 2',active:'Golisopod',move:null,target:'Archaludon'}];
  const ee=L(['|turn|1','|move|p1a: Garchomp|Earthquake|p2a: Golisopod','|-damage|p2a: Golisopod|45/100',
    '|-activate|p2a: Golisopod|ability: Emergency Exit','|switch|p2a: Archaludon|Archaludon, L50|100/100','|turn|2']);
  assert.equal(M.checkRequestedV2(ee,'p2',req)[0].result,'executed','PR #83 blind spot reproduced');
  assert.deepEqual(V3.checkRequestedV3(ee,'p2',req)[0],{result:'forcedExit',effect:null,cause:'forcedExit',by:'Emergency Exit',actual:'Archaludon',target:'Archaludon'});
  const eb=ee.replace('|-activate|p2a: Golisopod|ability: Emergency Exit','|-enditem|p2a: Golisopod|Eject Button');
  assert.equal(M.checkRequestedV2(eb,'p2',req)[0].result,'executed');
  assert.equal(V3.checkRequestedV3(eb,'p2',req)[0].by,'Eject Button');
  // a genuine voluntary switch to the same species stays executed
  const vol=L(['|turn|1','|switch|p2a: Archaludon|Archaludon, L50|100/100','|move|p1a: Garchomp|Earthquake|p2a: Archaludon','|turn|2']);
  assert.equal(V3.checkRequestedV3(vol,'p2',req)[0].result,'executed');
  // different target, forced: still forcedExit (not wrongTarget, not executed)
  assert.equal(V3.checkRequestedV3(ee,'p2',[{...req[0],target:'Corviknight'}])[0].result,'forcedExit');
});

test('switchEvents: cause per switch, either side, any order',()=>{
  const lines=['|move|p2a: Garchomp|Stone Edge|p1a: Corviknight','|-enditem|p1a: Corviknight|Eject Button','|switch|p1a: Archaludon|Archaludon, L50|100/100',
    '|move|p1a: Rotom|Volt Switch|p2a: Garchomp','|switch|p2a: Tyranitar|Tyranitar, L50|100/100','|switch|p1a: Primarina|Primarina, L50|100/100|[from] U-turn',
    '|faint|p2a: Tyranitar','|switch|p2a: Hydreigon|Hydreigon, L50|100/100','|drag|p1a: Garchomp|Garchomp, L50|100/100','|switch|p1a: Rotom|Rotom-Wash, L50|100/100'];
  assert.deepEqual(V3.switchEvents(lines,'p1a: ').map(e=>e.cause+':'+e.species),['forcedExit:Archaludon','pivot:Primarina','drag:Garchomp','unattributed:Rotom-Wash']);
  // p2 pivot without [from] (attributed by the preceding own pivot move) is not voluntary
  assert.deepEqual(V3.switchEvents(['|move|p2a: Corviknight|U-turn|p1a: Rotom','|switch|p2a: Tyranitar|Tyranitar, L50|100/100'],'p2a: ').map(e=>e.cause),['pivot']);
  // both sides switch before any move: both voluntary (Speed order irrelevant)
  const both=['|switch|p1a: Rotom|Rotom-Wash, L50|100/100','|switch|p2a: Archaludon|Archaludon, L50|100/100'];
  assert.equal(V3.voluntarySwitchV3(both,'p1a: '),'Rotom-Wash');assert.equal(V3.voluntarySwitchV3(both,'p2a: '),'Archaludon');
  // a mid-turn switch with no cause after a move is NOT voluntary (PR #83 would call the p1 switch voluntary)
  const odd=['|move|p2a: Garchomp|Stone Edge|p1a: Corviknight','|switch|p1a: Archaludon|Archaludon, L50|100/100'];
  assert.equal(M.voluntarySwitch(odd,'p1a: ').split(',')[0],'Archaludon');
  assert.equal(V3.voluntarySwitchV3(odd,'p1a: '),null);
});

test('real pinned-Showdown battles: Emergency Exit / Eject Button / Red Card / pivot / post-KO / voluntary',async()=>{
  const {main}=require('../pr84-forced-switch-probe');
  const {rows}=await main();
  const R=Object.fromEntries(rows.map(r=>[r.id,r]));
  for(const r of rows)assert.deepEqual(r.errors,[],r.id);
  // engine log shapes (not hand-written): exit line precedes the replacement switch
  assert.ok(R.emergencyExit_rivalMove.turn1.includes('|-activate|p2a: Golisopod|ability: Emergency Exit'));
  assert.ok(R.ejectButton_rivalMove.turn1.includes('|-enditem|p2a: Corviknight|Eject Button'));
  assert.ok(R.redCard_drag.turn1.some(l=>l.startsWith('|drag|p1a: Tyranitar')));
  assert.ok(R.pivot_voltSwitch.turn1.some(l=>/\|switch\|p1a: Garchomp.*\[from\] Volt Switch$/.test(l)));
  // forced exit to the requested species: PR #83 executed, V3 forcedExit
  for(const id of ['emergencyExit_asIfSwitchRequested','ejectButton_asIfSwitchRequested']){
    assert.equal(R[id].v2.result,'executed',id+' PR #83');assert.equal(R[id].v3.result,'forcedExit',id+' V3');}
  for(const id of ['emergencyExit_rivalMove','ejectButton_rivalMove']){assert.equal(R[id].v3.result,'forcedOut');assert.equal(R[id].v3.cause,'forcedExit');}
  assert.equal(R.eject_after_own_move.v3.result,'executed');
  assert.deepEqual(R.eject_after_own_move.rivalEvents.map(e=>e.cause),['forcedExit']);
  assert.equal(R.voluntary_switch.v3.result,'executed');
  assert.deepEqual(R.voluntary_then_eject.rivalEvents.map(e=>e.cause),['voluntary','forcedExit']);
  assert.equal(R.voluntary_then_eject.v3.result,'executed');
  assert.equal(R.both_voluntary.v3.result,'executed');assert.equal(R.both_voluntary.ownV3,'switch:Rotom-Wash');
  assert.deepEqual(R.pivot_voltSwitch.ownEvents.map(e=>e.cause),['pivot']);
  assert.deepEqual(R.redCard_drag.ownEvents.map(e=>e.cause),['drag']);
  assert.deepEqual(R.postKO_replacement.rivalEvents.map(e=>e.cause),['replacement']);
  assert.equal(R.postKO_replacement.v3.result,'preempted');assert.equal(R.postKO_replacement.ownV3,'none');
  // OUR side ejected before its forced move: PR #83 executedOwn calls it a voluntary switch
  assert.equal(R.own_ejected_before_move.ownV2,'switch:Archaludon');
  assert.equal(R.own_ejected_before_move.ownV3,'forcedOut:forcedExit');
});

test('V3 public-condition key: same six/lead/actives, different public condition -> different key / uncovered',()=>{
  const base={publicSix:['Garchomp','Gholdengo','Golisopod','Hippowdon','Mimikyu','Primarina'],ownThree:['Primarina','Garchomp','Rotom-Wash'],turn:2,
    rivalActive:'Golisopod',ownActive:'Primarina',rivalT1:{lead:'Golisopod',action:'move:First Impression'},legal:['move:Moonblast','move:Encore','switch:Garchomp','switch:Rotom-Wash']};
  const cond={ownHP:0.6,ownStatus:'',ownBoosts:{},ownEncored:false,ownHazards:{},foeHP:1,foeStatus:'',foeBoosts:{},foeEncored:false,foeHazards:{},weather:'',terrain:''};
  const kA=C.obsKeyV3({...base,cond});
  const table={rules:{[kA]:{status:'rule',action:'move:Encore',reason:'test'}}};
  assert.equal(C.decideEarlyV3(table,{...base,cond}).action,'move:Encore');
  // PR #83 key ignores these: identical for every variant below
  const k83=M.obsKey({...base,rivalT1Lead:base.rivalT1.lead,rivalT1:base.rivalT1.action});
  const variants={lowHP:{ownHP:0.2},burned:{ownStatus:'brn'},foeBoost:{foeBoosts:{atk:2}},rocks:{ownHazards:{stealthrock:1}},
    sand:{weather:'sandstorm'},encored:{ownEncored:true},foeHP:{foeHP:0.4}};
  for(const [n,v] of Object.entries(variants)){
    const o={...base,cond:{...cond,...v}};
    assert.notEqual(C.obsKeyV3(o),kA,n);
    assert.equal(C.decideEarlyV3(table,o).status,'uncovered',n);
    assert.equal(M.obsKey({...o,rivalT1Lead:o.rivalT1.lead,rivalT1:o.rivalT1.action}),k83,n+' (PR #83 key aliases it)');
  }
  // Choice / Encore lock shows as a different legal set -> uncovered
  assert.equal(C.decideEarlyV3(table,{...base,cond,legal:['move:Moonblast','switch:Garchomp','switch:Rotom-Wash']}).status,'uncovered');
  // hidden fields still throw; post-KO replacement is forced
  for(const k of ['rivalThree','rivalSets','branch','hypothesis','items','futureEvents'])
    assert.throws(()=>C.decideEarlyV3(table,{...base,cond,[k]:1}),/non-public/);
  assert.throws(()=>C.decideEarlyV3(table,{...base,cond:{...cond,foeItemHidden:'Choice Band'}}),/non-public cond/);
  assert.equal(C.decideEarlyV3(table,{...base,cond,forced:true}).status,'forced');
});
