'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const V=require('../preview-threat-aware-v2');
const T=require('../preview-threat-aware');
const {game,hashSeed}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {groups}=require('../environment-m7-teams');
const {SCENARIOS}=require('../preview-threat-audit');
const {teams:holdout}=require('../holdout-20261030');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const names=(team,idx)=>idx.map(i=>team[i-1].species);
const G=n=>structuredClone(groups.find(g=>g.name===n));

test('v2 accepts only six public species names; hidden rival sets cannot change it',()=>{
  const team=reportedLive(),foe=G('01_M7_golisopod_balance').team;
  assert.throws(()=>V.chooseThreatAwarePreviewV2(dex,team,foe),/public rival species names/);
  const tampered=foe.map(p=>({...p,item:'Leftovers',moves:['Splash']}));
  assert.deepEqual(V.explainThreatAwarePreviewV2(dex,team,foe.map(p=>p.species)),
    V.explainThreatAwarePreviewV2(dex,team,tampered.map(p=>p.species)));
  // Our private sets do not reach the rival model either (names only).
  const other=team.map(p=>({...p,moves:['Splash'],item:'Leftovers'}));
  assert.deepEqual(V.rivalHypotheses(dex,team.map(p=>p.species),SCENARIOS.B_lucario_z_corviknight),
    V.rivalHypotheses(dex,other.map(p=>p.species),SCENARIOS.B_lucario_z_corviknight));
});
test('rival hypotheses: one variant per member, Mega fixed by the hypothesis, at most one Scarf',()=>{
  const team=reportedLive();
  for(const six of Object.values(SCENARIOS)){
    const hs=V.rivalHypotheses(dex,team.map(p=>p.species),six);
    assert.ok(Math.abs(hs.reduce((s,h)=>s+h.weight,0)-1)<1e-9);
    for(const h of hs){
      assert.equal(h.rivalBest.length,3);
      assert.ok(h.rivalBest.filter(x=>x.includes('@Scarf')).length<=1,'item clause');
      h.three.forEach((n,k)=>assert.equal(/-Mega/.test(h.rivalBest[k]),h.mega===n,h.rivalBest.join(',')));
      // Each (three, Mega holder) is its own hypothesis (no second Mega draw).
      for(const sc of V.scenarios(dex,h)){
        assert.equal(sc.vars.length,3);
        sc.vars.forEach((v,k)=>{assert.equal(v.species,dex.species.get(h.three[k]).name);assert.equal(v.mega,h.mega===h.three[k]);});
        assert.ok(sc.vars.filter(v=>v.scarf).length<=1);
      }
    }
  }
});
test('priority moves are kept apart in v2 (Sucker Punch), PR #58 default unchanged',()=>{
  const v2=T.coverageMoves(dex,'Golisopod-Mega',{priorityKeys:true});
  assert.ok(v2.some(m=>m.type==='Dark'&&m.priority>0),'Sucker Punch-like Dark priority visible');
  const v1=T.coverageMoves(dex,'Golisopod-Mega');
  assert.ok(!v1.some(m=>m.type==='Dark'&&m.priority>0),'PR #58 behaviour kept for reproducibility');
});
test('Sand Force only in sand; undefined weather keeps PR #58 output',()=>{
  const v=T.publicVariants(dex,'Garchomp').find(x=>x.form==='Garchomp-Mega');
  assert.equal(v.ability,'Sand Force');
  const meta=reportedLive().find(p=>p.species==='Metagross');
  const at=w=>T.variantAttack(dex,v,meta,{knownDefender:true,weather:w});
  assert.ok(at('sand').worst>at('none').worst*1.2);
  assert.deepEqual(at(undefined),at('none'));
});
test('weather: contested setters cancel; two leads keep the slower setter',()=>{
  const team=reportedLive(),ttar=team.find(p=>p.species==='Tyranitar');
  const y=T.publicVariants(dex,'Charizard').find(x=>x.form==='Charizard-Mega-Y');
  assert.equal(V.leadWeather(dex,ttar,y),'sand','slower Tyranitar overwrites Drought');
  assert.equal(V.scenarioWeather([y],[ttar]),'none');
  assert.equal(V.scenarioWeather([y],[team[0]]),'sun');
});
test('our known Encore cancels a setup line only when we can outspeed',()=>{
  const prim=reportedLive().find(p=>p.species==='Primarina');
  const gol=T.publicVariants(dex,'Golisopod').find(x=>x.form==='Golisopod-Mega');
  const d=T.duel(dex,prim,gol,{priorityKeys:true,encore:true,speedSpread:true});
  assert.equal(d.speedCases.max.encoreLock,false,'max-speed Mega Golisopod outspeeds Primarina');
  assert.equal(d.speedCases.none.encoreLock,true);
  const noEnc=T.duel(dex,{...prim,moves:prim.moves.map(m=>m==='Encore'?'Calm Mind':m)},gol,{priorityKeys:true,encore:true,speedSpread:true});
  assert.ok(d.free>=noEnc.free);
});
test('PR #58 threat-aware picks are unchanged by the shared-code options (report table)',()=>{
  const team=reportedLive(),pick=k=>names(team,T.chooseThreatAwarePreview(dex,team,SCENARIOS[k]));
  assert.deepEqual(pick('A_golisopod_mimikyu'),['Metagross','Hydreigon','Primarina']);
  assert.deepEqual(pick('B_lucario_z_corviknight'),['Metagross','Primarina','Garchomp']);
  assert.deepEqual(pick('C_charizard_x_y'),['Metagross','Primarina','Garchomp']);
  assert.deepEqual(pick('real_B_indeedee'),['Primarina','Metagross','Tyranitar']);
});
test('real case B: v2 does not lead Hydreigon into the public Indeedee six',()=>{
  const team=reportedLive();
  for(const six of [SCENARIOS.real_B_indeedee,...Object.entries(holdout()).filter(([k])=>k.startsWith('realB')).map(([,t])=>t.team.map(p=>p.species))])
    assert.notEqual(names(team,V.chooseThreatAwarePreviewV2(dex,team,six))[0],'Hydreigon');
});
test('Bot with previewPolicy threat-aware-v2 selects from |poke| species only in a real Battle',async()=>{
  const team=reportedLive(),foe=G('01_M7_golisopod_balance').team;
  const g=await game(sim,team,foe,hashSeed(5959),false,null,false,{candidatePreviewPolicy:'threat-aware-v2',opponentPreviewPolicy:'legacy'});
  assert.equal(g.trace.errors.length,0);
  assert.deepEqual(g.trace.selections.find(s=>s.side==='p1').chosen,names(team,V.chooseThreatAwarePreviewV2(dex,team,foe.map(p=>p.species))));
});
test('holdout sixes are legal in M-C (TeamValidator)',()=>{
  const {normalize}=require('../lab');
  const v=new sim.TeamValidator('gen9championsbssregmc');
  for(const [k,t] of Object.entries(holdout()))assert.equal(v.validateTeam(sim.Teams.unpack(normalize(t.team))),null,k);
});
// A counterexample (PR #58 0/12): v2 leads Hydreigon with the same three,
// because the pivot now prices the hit aimed at the lead. The margin over the
// Metagross lead is small (about 0.003), so this is fragile: see the report.
test('A counterexample: same three as PR #58 but not a Metagross lead into a public Golisopod six (v2)',()=>{
  const team=reportedLive();
  const pick=names(team,V.chooseThreatAwarePreviewV2(dex,team,SCENARIOS.A_golisopod_mimikyu));
  assert.notEqual(pick[0],'Metagross');
  assert.deepEqual([...pick].sort(),['Hydreigon','Metagross','Primarina']);
});
test('pivot prices the hit aimed at the lead: Metagross into a Primarina hit meant for Hydreigon',()=>{
  const team=reportedLive(),hyd=team.find(p=>p.species==='Hydreigon'),meta=team.find(p=>p.species==='Metagross');
  const v=T.publicVariants(dex,'Primarina').find(x=>!x.mega&&!x.scarf);
  const plain=T.duel(dex,meta,v,{priorityKeys:true,weather:'none'}).swap;
  const o={knownDefender:true,weather:'none',priorityKeys:true,detail:true};
  const L=T.variantAttack(dex,v,hyd,o).detail,B=T.variantAttack(dex,v,{...meta,species:'Metagross-Mega',ability:'Tough Claws'},o).detail;
  const k=L.reduce((bi,m,i)=>m.frac>L[bi].frac?i:bi,0);
  assert.ok(B[k].frac<L[k].frac/2,'a Fairy hit aimed at Hydreigon is resisted by Metagross');
  const entry={stab:B[k].frac,cov:B[k].frac};
  assert.ok(T.duel(dex,meta,v,{priorityKeys:true,weather:'none',entry}).swap>plain);
});
