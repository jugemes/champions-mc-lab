'use strict';
// PR #82 (ChatGPT review #5719297548 of PR #81): requested switch TARGET and
// move OUTCOME checks, rival utility rationality, and the executable
// public-information-only T1/T2 entry (no hidden-information leakage).
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const G=require('../public-six-general');
const M=require('../pr82-switch-utility-t1t2');
const {battle}=require('../encore-lead-audit');
const {reportedLive}=require('../reported-live-roster-20261027');
const {holdoutSixPR80}=require('../holdout-20261031-pr80');
const dex=sim.Dex.mod('champions');
const L=a=>a.join('\n');

test('P0-1 counterexamples: PR #81 checkRequested says executed; V2 says wrongTarget / fail',()=>{
  // public-six-general.js checkRequested is byte-identical to PR #81 bde7fd7.
  const sw=L(['|turn|1','|switch|p2a: Gholdengo|Gholdengo, L50|100/100','|move|p1a: Rotom|Hydro Pump|p2a: Gholdengo']);
  const req={turn:1,choice:'switch 2',active:'Swampert',move:null};
  assert.deepEqual(G.checkRequested(sw,'p2',[req]),['executed'],'PR #81 blind spot reproduced');
  const v2=M.checkRequestedV2(sw,'p2',[{...req,target:'Archaludon'}])[0];
  assert.equal(v2.result,'wrongTarget');assert.equal(v2.actual,'Gholdengo');
  // saved PR #81 records have no target: a T1 slot resolves from the rival's selected order
  assert.equal(M.checkRequestedV2(sw,'p2',[req],{rival3:['Swampert','Archaludon','Gholdengo']})[0].result,'wrongTarget');
  assert.equal(M.checkRequestedV2(sw,'p2',[req],{rival3:['Swampert','Gholdengo','Archaludon']})[0].result,'executed');
  assert.equal(M.checkRequestedV2(sw,'p2',[{...req,turn:1}])[0].result,'unverifiable');
  const sr=L(['|turn|1','|move|p2a: Swampert|Stealth Rock|p1a: Rotom','|-fail|p2a: Swampert']);
  const q={turn:1,choice:'move 2',active:'Swampert',move:'Stealth Rock'};
  assert.deepEqual(G.checkRequested(sr,'p2',[q]),['executed']);
  assert.deepEqual(M.checkRequestedV2(sr,'p2',[q])[0],{result:'executed',effect:'fail'});
  const wo=L(['|turn|1','|move|p2a: Swampert|Will-O-Wisp|p1a: Rotom','|-fail|p1a: Rotom|brn']);
  assert.equal(M.checkRequestedV2(wo,'p2',[{...q,move:'Will-O-Wisp'}])[0].effect,'fail');
  const im=L(['|turn|1','|move|p2a: Swampert|Thunder Wave|p1a: Garchomp','|-immune|p1a: Garchomp']);
  assert.equal(M.checkRequestedV2(im,'p2',[{...q,move:'Thunder Wave'}])[0].effect,'immune');
});

test('V2 separates voluntary switch from post-KO replacement, U-turn exit and drag',()=>{
  const req={turn:1,choice:'switch 2',active:'Swampert',move:null,target:'Archaludon'};
  const rep=L(['|turn|1','|move|p1a: Rotom|Leaf Storm|p2a: Swampert','|faint|p2a: Swampert','|switch|p2a: Archaludon|Archaludon, L50|100/100']);
  assert.deepEqual(G.checkRequested(rep,'p2',[req]),['executed'],'PR #81 counts a post-KO replacement as the requested switch');
  assert.equal(M.checkRequestedV2(rep,'p2',[req])[0].result,'preempted');
  const ut=L(['|turn|1','|move|p2a: Swampert|Flip Turn|p1a: Rotom','|switch|p2a: Archaludon|Archaludon, L50|100/100']);
  assert.equal(M.checkRequestedV2(ut,'p2',[req])[0].result,'mismatch');
  const dr=L(['|turn|1','|move|p1a: Rotom|Whirlwind|p2a: Swampert','|drag|p2a: Archaludon|Archaludon, L50|100/100']);
  assert.equal(M.checkRequestedV2(dr,'p2',[req])[0].result,'dragged');
  const mega=L(['|turn|1','|switch|p2a: Charizard|Charizard, L50|100/100']);
  assert.equal(M.checkRequestedV2(mega,'p2',[{...req,target:'Charizard-Mega-Y'}])[0].result,'executed');
});

test('P0-2 rationality from public state: executed != effective != rational',()=>{
  const R=(m,s)=>M.rationalityFromState(m,s)[0];
  assert.equal(R('Stealth Rock',{target:{hazards:{stealthrock:1}}}),'irrational');
  assert.equal(R('Stealth Rock',{target:{hazards:{}}}),'rational');
  assert.equal(R('Spikes',{target:{hazards:{spikes:2}}}),'rational');
  assert.equal(R('Will-O-Wisp',{target:{status:'brn',types:['Water']}}),'irrational');
  assert.equal(R('Will-O-Wisp',{target:{status:'',types:['Fire']}}),'irrational');
  assert.equal(R('Thunder Wave',{target:{status:'',types:['Dragon','Ground']}}),'irrational');
  assert.equal(R('Toxic',{target:{status:'',types:['Steel','Psychic']}}),'irrational');
  assert.equal(R('Encore',{target:{moved:false}}),'irrational');
  assert.equal(R('Encore',{target:{moved:true,lastMoveCategory:'Status'}}),'rational');
  assert.equal(R('Encore',{target:{moved:true,lastMoveCategory:'Physical'}}),'unknown');
  assert.equal(R('Slack Off',{user:{hp:1},target:{}}),'irrational');
  assert.equal(R('Slack Off',{user:{hp:0.4},target:{}}),'rational');
  assert.equal(R('Trick',{target:{}}),'unknown');
  // a public-state-rational move that the engine failed (hidden ability) is not called irrational
  const log=L(['|switch|p1a: Rotom|Rotom-Wash, L50|100/100','|switch|p2a: Ceruledge|Ceruledge, L50|100/100','|turn|1',
    '|move|p2a: Ceruledge|Will-O-Wisp|p1a: Rotom','|-immune|p1a: Rotom|[from] ability: Flash Fire']);
  const u=M.utilityAudit(log,'p2',dex);
  assert.equal(u.length,1);assert.equal(u[0].rational,'unknown');assert.equal(u[0].effect,'immune');
  const log2=L(['|switch|p1a: Rotom|Rotom-Wash, L50|100/100','|switch|p2a: Hippowdon|Hippowdon, L50|100/100','|turn|1',
    '|move|p2a: Hippowdon|Stealth Rock|p1a: Rotom','|-sidestart|p1: own|move: Stealth Rock','|turn|2','|move|p2a: Hippowdon|Stealth Rock|p1a: Rotom','|-fail|p2a: Hippowdon']);
  assert.deepEqual(M.utilityAudit(log2,'p2',dex).map(x=>x.rational),['rational','irrational']);
});

test('real pinned-Showdown battle: PR #81 utility repeats Stealth Rock (-fail, irrational); utilityRational does not',async()=>{
  const sand=holdoutSixPR80().HX_sand.hypotheses.a,own=reportedLive();
  const runWith=async(branch)=>{
    const requested=[];
    const script=branch==='utility'?G.rivalScript('utility',dex,requested):M.rivalScriptV2(branch,dex,requested);
    const g=await battle(sim,structuredClone(own),structuredClone(sand),[11,22,33,44],
      {ownThree:['Garchomp','Primarina','Metagross'],foeThree:['Hippowdon','Excadrill','Kingambit'],reverse:false,script,ownOptions:G.OWN_AI});
    assert.equal(g.errors,0);
    return {g,requested,v1:G.checkRequested(g.log,g.foeSide,requested),v2:M.checkRequestedV2(g.log,g.foeSide,requested),u:M.utilityAudit(g.log,g.foeSide,dex)};
  };
  const old=await runWith('utility');
  assert.deepEqual(old.requested.map(r=>r.move),['Stealth Rock','Stealth Rock'],'PR #81 utility = first utility move on T1 and T2');
  assert.deepEqual(old.v1,['executed','executed']);
  assert.deepEqual(old.v2.map(x=>x.result+'/'+x.effect),['executed/effective','executed/fail']);
  assert.deepEqual(old.u.filter(x=>x.move==='Stealth Rock').map(x=>x.rational),['rational','irrational']);
  const neu=await runWith('utilityRational');
  assert.equal(neu.requested[0].move,'Stealth Rock');
  assert.notEqual(neu.requested[1]?.move,'Stealth Rock','second Stealth Rock is not rational');
  assert.ok(neu.u.every(x=>x.rational!=='irrational'),JSON.stringify(neu.u));
});

test('real pinned-Showdown battle: V2 resolves the requested switch slot to the selected rival three',async()=>{
  const sand=holdoutSixPR80().HX_sand.hypotheses.a,own=reportedLive(),requested=[];
  const g=await battle(sim,structuredClone(own),structuredClone(sand),[5,6,7,8],
    {ownThree:['Primarina','Metagross','Garchomp'],foeThree:['Hippowdon','Excadrill','Kingambit'],reverse:true,
      script:M.rivalScriptV2('switch',dex,requested),ownOptions:G.OWN_AI});
  assert.equal(requested.length,1);assert.ok(['Excadrill','Kingambit'].includes(requested[0].target));
  const v=M.checkRequestedV2(g.log,g.foeSide,requested)[0];
  assert.equal(v.result,'executed');assert.equal(v.actual,requested[0].target);
  // the slot alone, without target, resolves identically from the selected order at T1
  assert.equal(M.checkRequestedV2(g.log,g.foeSide,[{...requested[0],target:undefined}],{rival3:['Hippowdon','Excadrill','Kingambit']})[0].result,'executed');
});

test('P0-3 executable entry: public observations only; hidden fields throw; same observation -> same decision',()=>{
  const six=['Hippowdon','Excadrill','Kingambit','Sylveon','Rotom-Heat','Dragapult'];
  const obs={publicSix:six,ownThree:['Primarina','Metagross','Garchomp'],turn:1,rivalActive:'Hippowdon',ownActive:'Primarina'};
  const key=M.obsKey(obs);
  const table={rules:{[key]:{status:'rule',action:'move:Moonblast',reason:'x',evidence:[]}}};
  for(const hidden of ['rivalThree','rivalSets','branch','hypothesis','items','futureEvents','rsrc'])
    assert.throws(()=>M.decideEarly(table,{...obs,[hidden]:'x'}),/non-public field/,hidden);
  assert.equal(M.decideEarly(table,obs).action,'move:Moonblast');
  // the entry has no access to hidden state: two games that differ only in hidden rival three / sets reach the same observation
  assert.deepEqual(M.decideEarly(table,{...obs}),M.decideEarly(table,{...obs,publicSix:[...six].reverse()}));
  assert.equal(M.decideEarly(table,{...obs,forced:true}).status,'forced','post-KO replacement is not a pre-action choice');
  assert.equal(M.decideEarly(table,{...obs,rivalActive:'Dragapult'}).status,'uncovered');
  assert.equal(M.decideEarly(table,{...obs,legal:['move:Surf']}).status,'uncovered','tabled action not legal now');
  assert.equal(M.decideEarly(table,{...obs,turn:3}).status,'uncovered');
  const t2={...obs,turn:2,rivalT1:{lead:'Hippowdon',action:'move:Stealth Rock'}};
  assert.match(M.obsKey({...t2,rivalT1Lead:'Hippowdon',rivalT1:'move:Stealth Rock'}),/#T2#Hippowdon#move:Stealth Rock#Primarina#Hippowdon$/);
});

test('buildTable: base-first; deviation needs a margin; otherwise base or uncovered with reasons',()=>{
  const g=[];
  const add=(key,label,cond,wins,n)=>{for(let i=0;i<n;i++)g.push({key,label,cond,won:i<wins?1:0});};
  // K1: alternative beats base clearly in every hidden condition
  add('K1','=base','c1',1,4);add('K1','=base','c2',0,4);add('K1','move:A','c1',4,4);add('K1','move:A','c2',3,4);
  // K2: alternative ties base -> base holds
  add('K2','=base','c1',3,4);add('K2','=base','c2',2,4);add('K2','move:A','c1',3,4);add('K2','move:A','c2',2,4);
  // K3: everything loses c2 -> uncovered
  add('K3','=base','c1',4,4);add('K3','=base','c2',0,4);add('K3','move:A','c1',4,4);add('K3','move:A','c2',0,4);
  // K4: alternative not tried in every condition cannot be a rule
  add('K4','=base','c1',0,4);add('K4','=base','c2',0,4);add('K4','move:A','c1',4,8);
  const t=M.buildTable(g).rules;
  assert.equal(t.K1.status,'rule');assert.equal(t.K1.action,'move:A');
  assert.equal(t.K2.status,'base');
  assert.equal(t.K3.status,'uncovered');assert.match(t.K3.reason,/c2/);
  assert.equal(t.K4.status,'uncovered');
});

test('legalActions: moves (with Mega) then bench switches; none on a forced switch',()=>{
  const req={active:[{moves:[{move:'Moonblast',id:'moonblast'},{move:'Surf',id:'surf',disabled:true}],canMegaEvo:true}],
    side:{pokemon:[{active:true,details:'Primarina, L50',condition:'100/100'},{details:'Metagross, L50',condition:'100/100'},{details:'Garchomp, L50',condition:'0 fnt'}]}};
  assert.deepEqual(M.legalActions(req).map(a=>a.choice+'='+a.label),['move 1 mega=move:Moonblast','switch 2=switch:Metagross']);
  assert.deepEqual(M.legalActions({...req,forceSwitch:[true]}),[]);
});

test('P0-5 livePreview: no valid search and no budget -> explained legacy fallback, immediately',async()=>{
  const own=reportedLive(),six=holdoutSixPR80().HX_sand.publicSix;
  const t0=Date.now(),d=await M.livePreview({sim,own,publicSix:six,seed:[1,2,3,4],saved:{version:'general-v1'},budgetSeconds:0});
  assert.ok(Date.now()-t0<5000);
  assert.equal(d.status,'fallback');assert.match(d.path,/legacy fallback/);assert.ok(d.cacheRejected.length);assert.match(d.uncertainty,/security 0/);
  assert.equal(d.pick.length,3);
});
