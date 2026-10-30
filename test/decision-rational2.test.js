'use strict';
// PR #54 follow-up: 'rational2' safety fixes. Unit tests use synthetic
// Showdown-shaped requests; engine tests use the pinned Showdown battles.
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const R=require('../decision-rational');
const {reportedLive}=require('../reported-live-roster-20261027');
const {runCase,H}=require('../rational-cases');
const {compareBranches}=require('../rational-branch');
const {Bot,hashSeed}=require('../lab');
const {playToEnd:play,choiceAt}=require('./battle-helpers');
const playToEnd=o=>play(sim,dex,o);
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const live=reportedLive();
const get=s=>live.find(p=>p.species===s);
const mv=(name,o={})=>({move:name,id:dex.moves.get(name).id,pp:16,maxpp:16,target:'normal',disabled:false,...o});

test('restriction is classified from the request and public volatiles, not assumed to be Choice',()=>{
  const four=(only,o={})=>['Earthquake','Dragon Claw','Rock Slide','Poison Jab'].map(m=>mv(m,m===only?{}:o));
  assert.equal(R.classifyRestriction({moves:four('Poison Jab',{disabled:true}),ownItem:'choicescarf',lastOwnMove:'poisonjab'}),'choice');
  assert.equal(R.classifyRestriction({moves:four('Poison Jab',{pp:0,disabled:true})}),'pp');
  assert.equal(R.classifyRestriction({moves:four('Poison Jab',{disabled:true}),volatiles:{encore:true}}),'encore');
  assert.equal(R.classifyRestriction({moves:four('Poison Jab',{disabled:true}),volatiles:{taunt:true}}),'taunt');
  assert.equal(R.classifyRestriction({moves:four('Poison Jab',{disabled:true}),volatiles:{disable:true}}),'disable');
  // Item knocked off / tricked away: the request no longer shows a Choice item.
  assert.equal(R.classifyRestriction({moves:four('Poison Jab',{disabled:true}),ownItem:'',lastOwnMove:'poisonjab'}),'unknown');
  assert.equal(R.classifyRestriction({moves:four('Poison Jab')}),'','4 usable moves');
  assert.equal(R.classifyRestriction({moves:[mv('Outrage')]}),'','two-turn lockedMove request has one slot only');
});
test('Champions PP, hazards and the public damage band corrections',()=>{
  assert.equal(R.championsPP(dex,'Roost'),8);
  assert.equal(R.championsPP(dex,'Thunder Punch'),16);
  assert.equal(R.hazardEntry(dex,H.charizardY,{stealthrock:1}),0.5,'4x Rock');
  assert.equal(R.hazardEntry(dex,{...H.charizardY,item:'Heavy-Duty Boots'},{stealthrock:1}),0);
  assert.equal(R.hazardEntry(dex,get('Garchomp'),{spikes:2}),1/6);
  assert.equal(R.hazardEntry(dex,get('Rotom-Wash'),{spikes:2}),0,'Levitate');
  const mega={...get('Metagross'),species:'Metagross-Mega'};
  const e=require('../damage').estimateDamage(dex,mega,'Corviknight','Thunder Punch',{});
  const b=R.hitBand(dex,mega,'Corviknight','Thunder Punch',{});
  assert.ok(Math.abs(b.min/e.min-1.3)<1e-9,'Tough Claws is the fixed public Mega ability');
  const bp=R.hitBand(dex,H.corviknight,'Metagross','Body Press',{});
  const bp0=require('../damage').estimateDamage(dex,H.corviknight,'Metagross','Body Press',{});
  assert.ok(bp.mid>bp0.mid,'Body Press uses Defense');
});
test('loop detector: a hit that out-damages one recovery, or a foe on its last Roost PP, is not a stall',()=>{
  const hist=[{foe:'Corviknight',kind:'move',foeHP:0.58,ratio:0.62}];
  const now={foeHP:0.66,ratio:0.45};
  assert.equal(R.noProgressLoopV2(hist,'Corviknight',now,{hit:0.45}),true);
  assert.equal(R.noProgressLoopV2(hist,'Corviknight',now,{hit:0.6}),false);
  assert.equal(R.noProgressLoopV2(hist,'Corviknight',now,{hit:0.45,recoveryLeft:1}),false);
  assert.equal(R.noProgressLoopV2(hist,'Corviknight',now,{hit:0.45,samples:2}),false,'one cycle is not two');
});
test('switch choice: a KO-on-entry or clearly worse switch is refused; hazards count',()=>{
  const rows=[{action:'move Thunder Punch',worst:-0.3,mean:0},
    {action:'switch A',slot:2,worst:-0.2,mean:-0.1,offense:0.4,hazard:0.25},
    {action:'switch B',slot:3,worst:-0.25,mean:-0.1,offense:0.4,hazard:0}];
  assert.equal(R.chooseSwitchV2(rows).slot,3,'Stealth Rock on A outweighs its better worst case');
  assert.equal(R.chooseSwitchV2([rows[0],{...rows[2],koOnEntry:true}]),null);
  assert.equal(R.chooseSwitchV2(rows,{stayWorst:0}),null,'stay -0 vs switch -0.25: more than the margin');
});
// ---- Bot-level, synthetic requests (no engine) ----
function bot(o={}){
  const trace={choices:[],selections:[],errors:[]};
  const b=new Bot(null,dex,live,'p1',trace,null,null,{decisionPolicy:'rational2',...o});
  b.turn=5;return b;
}
const poke=(species,hp,o={})=>{const s=get(species),d=dex.species.get(species);
  return {ident:'p1: '+d.baseSpecies,details:species+', L50',condition:hp,active:false,item:dex.items.get(s.item).id,moves:s.moves.map(m=>dex.moves.get(m).id),...o};};
function lockReq(o={}){
  return {active:[{moves:['Earthquake','Dragon Claw','Rock Slide','Poison Jab'].map(m=>mv(m,m==='Poison Jab'?{}:{disabled:true}))}],
    side:{pokemon:[poke('Garchomp','150/185',{active:true}),poke('Metagross','157/157'),poke('Rotom-Wash','157/157'),...(o.extra||[])]}};
}
test('one shared voluntary-switch counter: rational2 switches count toward the legacy cap of 3',()=>{
  const b=bot();
  b.foeActive='Archaludon';b.lastOwnMove='poisonjab';b.observedImmune.Archaludon=['poisonjab'];b.ownForm='Garchomp';
  const c=b.decide(lockReq());
  assert.match(c,/^switch [23]$/);
  assert.equal(b.switches,1,'the rational switch increments this.switches (PR #51 kept a second counter)');
  assert.equal(b.trace.rational.at(-1).reason,'choice-locked-bad');
});
test('a lock that only restricts by PP is labelled pp, not choice',()=>{
  const b=bot();
  b.foeActive='Archaludon';b.lastOwnMove='earthquake';b.observedImmune.Archaludon=['poisonjab'];
  const req=lockReq();req.active[0].moves=req.active[0].moves.map(m=>m.id==='poisonjab'?m:{...m,pp:0,disabled:true});
  b.decide(req);
  assert.equal(b.trace.rational.at(-1).reason,'pp-locked-bad');
});
test('an immune lock is exempt from the switch ceiling (staying does nothing), other reasons are not',()=>{
  const b=bot();
  b.foeActive='Archaludon';b.lastOwnMove='poisonjab';b.observedImmune.Archaludon=['poisonjab'];b.switches=9;
  assert.match(b.decide(lockReq()),/^switch/);
});
test('ping-pong guard: no immediate return to the mon that just left the same foe; a third mon is allowed',()=>{
  // Metagross came in on Corviknight last turn (Rotom left). Helmet + Roost shown,
  // a stalled cycle is in history, so rational2 wants to leave again.
  const setup=b=>{b.foeActive='Corviknight';b.foeItem='Rocky Helmet';b.seenMoves.Corviknight=['Roost','Body Press'];
    b.history=[{foe:'Corviknight',kind:'move',foeHP:0.58,ratio:0.62}];b.foeHP=0.66;
    b.switchStreak={foe:'Corviknight',n:1,stint:1,left:'Rotom-Wash'};b.ownForm='Metagross-Mega';
    // Observed this game: Thunder Punch took 45% < one Roost.
    for(const m of ['thunderpunch','meteormash','psychicfangs','bulletpunch'])b.lastHit['Corviknight|'+m]=0.3;};
  const req=bench=>({active:[{moves:get('Metagross').moves.map(m=>mv(m))}],
    side:{pokemon:[poke('Metagross','70/157',{active:true,details:'Metagross-Mega, L50'}),...bench]}});
  const only=bot();setup(only);
  const c1=only.decide(req([poke('Rotom-Wash','157/157'),poke('Garchomp','0 fnt')]));
  assert.match(c1,/^move/);
  assert.equal(only.trace.rational.at(-1).choice,'ping-pong');
  const third=bot();setup(third);
  // At 6% HP every contact move is a Rocky Helmet self-KO, so leaving is
  // right; the guard still removes Rotom and lets the third mon in.
  const lowReq=bench=>{const r=req(bench);r.side.pokemon[0].condition='10/157';return r;};
  const c2=third.decide(lowReq([poke('Rotom-Wash','157/157'),poke('Primarina','187/187')]));
  assert.equal(c2,'switch 3','Primarina (not the mon that just left) is still allowed');
  const worse=bot();setup(worse);
  worse.decide(req([poke('Rotom-Wash','157/157'),poke('Garchomp','185/185')]));
  assert.equal(worse.trace.rational.at(-1).choice,'ping-pong','Garchomp is worse than staying, Rotom is the ping-pong');
  assert.equal(third.pingPong({details:'Rotom-Wash, L50'}),true);
  third.switchStreak={foe:'Corviknight',n:0,stint:3,left:'Rotom-Wash'};
  assert.equal(third.pingPong({details:'Garchomp, L50'}),true,'4th voluntary switch into the same foe');
  third.foeActive='Archaludon';
  assert.equal(third.pingPong({details:'Rotom-Wash, L50'}),false,'a new foe resets the streak');
});
test('a foe on its last Roost PP is pressed instead of switched from',()=>{
  const b=bot();
  b.foeActive='Corviknight';b.foeItem='Rocky Helmet';b.seenMoves.Corviknight=['Roost','Body Press'];
  b.history=[{foe:'Corviknight',kind:'move',foeHP:0.58,ratio:0.62}];b.foeHP=0.66;b.ownForm='Metagross-Mega';
  b.lastHit['Corviknight|thunderpunch']=0.45;
  const req={active:[{moves:get('Metagross').moves.map(m=>mv(m))}],
    side:{pokemon:[poke('Metagross','70/157',{active:true,details:'Metagross-Mega, L50'}),poke('Rotom-Wash','157/157'),poke('Garchomp','185/185')]}};
  b.recoveryUses['Corviknight|roost']=3;
  assert.match(b.decide(req),/^switch/,'5 Roost PP left: the stall is real');
  const b2=bot();Object.assign(b2,{foeActive:b.foeActive,foeItem:b.foeItem,seenMoves:b.seenMoves,history:b.history,foeHP:b.foeHP,ownForm:b.ownForm,lastHit:b.lastHit});
  b2.recoveryUses={'Corviknight|roost':7};
  b2.decide(req);
  assert.ok(!(b2.trace.rational||[]).some(x=>x.reason==='no-progress-loop'),'1 Roost PP left');
});
// ---- Hidden-information boundary on full, awaited battles ----
test('choiceAt fails loudly when the requested turn was never decided',()=>{
  assert.throws(()=>choiceAt({choices:[{side:'p1',turn:1,choice:'move 1'}]},'p1',999),/no p1 choice at turn 999/);
});
test('hidden-info boundary: unrevealed foe moves/items and the foe\'s back two never change our selection or T1 choice',async()=>{
  // Same PUBLIC six (species), same lead. Variants differ only in things we
  // cannot see before our T1 decision.
  const base=[H.corviknight,H.archaludon,H.lucarioZ,H.primarina,H.hippowdon,H.gengar];
  const variants=[
    {opp:base,pick:['Corviknight','Archaludon','Lucario']},
    {opp:[{...H.corviknight,item:'Leftovers',moves:['Roost','U-turn','Body Press','Brave Bird']},...base.slice(1)],pick:['Corviknight','Archaludon','Lucario']},
    {opp:[H.corviknight,{...H.archaludon,item:'Assault Vest',moves:['Electro Shot','Draco Meteor','Flash Cannon','Body Press']},...base.slice(2)],pick:['Corviknight','Primarina','Gengar']},
    {opp:base,pick:['Corviknight','Hippowdon','Primarina']},
  ];
  for(const s of [4242,4243,4244]){
    const seed=hashSeed(s),seen=[];
    for(const v of variants){
      const t=await playToEnd({own:live,opp:v.opp,ownPick:null,oppPick:v.pick,seed});
      seen.push(JSON.stringify([t.selections.find(x=>x.side==='p1'),choiceAt(t,'p1',1)]));
      assert.equal(t.errors.length,0);
    }
    assert.equal(new Set(seen).size,1,'seed '+s+': '+seen.join(' / '));
  }
});
// ---- Engine regressions on the pinned Showdown (P0.5 gate) ----
test('engine gate: rational2 keeps A (+6 Swords Dance) and B (Poison Jab -> Archaludon) fixed',async()=>{
  for(let i=0;i<4;i++){
    const seed=hashSeed(700000+i),reverse=Boolean(i%2);
    const a0=await runCase(sim,'A_golisopod_setup_encore',{policy:'baseline',seed,reverse});
    const a2=await runCase(sim,'A_golisopod_setup_encore',{policy:'rational2',seed,reverse});
    assert.ok(a0.metrics.setupAtCap>0);assert.equal(a2.metrics.setupAtCap,0);
    const b0=await runCase(sim,'B_scarf_poisonjab_archaludon',{policy:'baseline',seed,reverse});
    const b2=await runCase(sim,'B_scarf_poisonjab_archaludon',{policy:'rational2',seed,reverse});
    assert.ok(b2.metrics.immuneHits<=1&&b2.metrics.immuneHits<b0.metrics.immuneHits);
    assert.equal(a2.errors+b2.errors,0);
  }
});
test('engine gate: unscripted opponent (no repeated scripted Encore) still shows no +6 Swords Dance',async()=>{
  const r=await runCase(sim,'A_golisopod_setup_encore',{policy:'rational2',seed:hashSeed(700000),script:null});
  assert.equal(r.metrics.setupAtCap,0);
});
test('engine: the PR #52 seed reproduces and its T3 switch is evaluated by a same-state branch, not by one outcome',async()=>{
  const seed='52522-48513-31438-37827'.split('-').map(Number);
  const old=await runCase(sim,'B_helmet_roost',{policy:'rational',seed,reverse:true});
  const neu=await runCase(sim,'B_helmet_roost',{policy:'rational2',seed,reverse:true});
  assert.equal(old.win,false);assert.equal(old.candidateChoices[3],'3:switch 3');
  assert.equal(neu.candidateChoices[3],'3:switch 3','rational2 keeps the T3 switch (see report)');
  // Same T3 state, same 40 continuation seeds, only the T3 choice differs.
  const r=await compareBranches(sim,'B_helmet_roost',{seed,reverse:true,turn:3,choices:['move 4','switch 3'],k:40});
  assert.ok(r.branches['switch 3'].wins>=r.branches['move 4'].wins,JSON.stringify(r.branches));
});
