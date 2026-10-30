'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const V2=require('../preview-threat-aware-v2');
const V1=require('../preview-threat-aware');
const {chooseThree,game,hashSeed,load}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {groups}=require('../environment-m7-teams');
const {holdoutGroups}=require('../holdout-v2-teams');
const {SCENARIOS}=require('../preview-threat-audit');
const {battle}=require('../preview-threat-v2-audit');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const names=(team,idx)=>idx.map(i=>team[i-1].species);
const G=n=>structuredClone(groups.find(g=>g.name===n));
const mega=n=>V2.publicVariants(dex,n).find(v=>v.mega);

test('v2 accepts only six public species names; hidden rival sets cannot change the result',()=>{
  const team=reportedLive(),foe=G('01_M7_golisopod_balance').team;
  assert.throws(()=>V2.chooseThreatAwareV2(dex,team,foe),/public rival species names/);
  assert.throws(()=>V2.chooseThreatAwareV2(dex,team,foe.slice(0,5).map(p=>p.species)),/exactly six/);
  const tampered=foe.map(p=>({...p,item:'Leftovers',moves:['Splash'],evs:{hp:32}}));
  assert.deepEqual(V2.explainThreatAwareV2(dex,team,foe.map(p=>p.species)),
    V2.explainThreatAwareV2(dex,team,tampered.map(p=>p.species)));
});
test('v2 rival hypotheses: all 20 threes, weights sum to 1, read only our public species',()=>{
  const team=reportedLive(),six=SCENARIOS.B_lucario_z_corviknight;
  const h=V2.rivalHypotheses(dex,team.map(p=>p.species),six);
  assert.equal(h.length,20);
  assert.ok(Math.abs(h.reduce((s,x)=>s+x.weight,0)-1)<1e-9);
  const other=team.map(p=>({...p,moves:['Splash'],item:'Leftovers'}));
  assert.deepEqual(h,V2.rivalHypotheses(dex,other.map(p=>p.species),six));
  for(const x of h)assert.ok(x.likelyMega===null||x.three.includes(x.likelyMega));
});
test('root cause A: learnable priority is kept apart from the strongest move of its type',()=>{
  // v1 kept only Throat Chop as the best Dark physical move and lost Sucker Punch.
  assert.ok(!V1.coverageMoves(dex,'Golisopod-Mega').some(m=>m.type==='Dark'&&m.priority>0));
  const pool=V2.movePool(dex,'Golisopod-Mega');
  assert.ok(pool.priority.some(m=>m.id==='suckerpunch'));
  assert.ok(pool.setup>=2,'Swords Dance is learnable');
  assert.ok(pool.priority.find(m=>m.id==='firstimpression').firstTurn);
});
test('A lead: Mega Metagross does not hold a lead into Mega Golisopod (setup then boosted priority)',()=>{
  const team=reportedLive(),met=team.find(p=>p.species==='Metagross');
  const g=mega('Golisopod');
  assert.ok(V2.duel(dex,met,g,{entry:'lead'}).value<0.3);
  // Switching hands Golisopod a free turn; the switch value is not a free pass.
  const ctx={opt:V2.DEFAULTS,field:{},cache:new Map()};
  const three=['Metagross','Hydreigon','Primarina'].map(s=>team.findIndex(p=>p.species===s));
  const m=V2.leadValue(dex,team,three,three[0],'Golisopod','Golisopod',ctx);
  const h=V2.leadValue(dex,team,three,three[1],'Golisopod','Golisopod',ctx);
  assert.ok(m.sw<0.3,'switch out of Metagross is costly: '+m.sw);
  assert.ok(h.value>m.value+0.2,'Hydreigon lead beats Metagross lead into Mega Golisopod');
});
test('first-turn-only moves count only when both sides are fresh, not after a KO',()=>{
  const hyd=reportedLive().find(p=>p.species==='Hydreigon'),g=mega('Golisopod');
  assert.ok(V2.duel(dex,hyd,g,{entry:'free'}).value>V2.duel(dex,hyd,g,{entry:'lead'}).value);
});
test('our known Encore punishes a setup plan; a rational rival then attacks instead',()=>{
  const base={ourDmg:0.43,ourPrio:0,ourAcc:1,faster:1,theirDmg:0.3,theirPrio:0.3,theirFirst:0,
    firstTurnNow:false,setup:2,plan:'setup',recovery:false,ourHP:1,theirHP:1,chip:0,recoil:0,boost:0};
  assert.ok(V2.race({...base,encore:true})>V2.race({...base,encore:false})+0.3);
});
test('Rocky Helmet is a weighted possibility for every non-Mega rival, never zero and never certain',()=>{
  const vs=V2.publicVariants(dex,'Corviknight');
  const helm=vs.filter(v=>v.item==='rockyhelmet'),plain=vs.filter(v=>!v.item&&!v.mega);
  assert.equal(helm.length,plain.length);
  assert.ok(helm.every(v=>v.weight>0&&v.weight<plain[0].weight));
  const met=reportedLive().find(p=>p.species==='Metagross');
  assert.ok(V2.duel(dex,met,helm[0]).value<V2.duel(dex,met,plain[0]).value,'contact chip lowers the contact answer');
});
test('every Mega form is a separate public variant (Charizard X and Y), Scarf only on non-Mega',()=>{
  const forms=V2.publicVariants(dex,'Charizard').filter(v=>v.mega).map(v=>v.form).sort();
  assert.deepEqual(forms,['Charizard-Mega-X','Charizard-Mega-Y']);
  assert.ok(V2.publicVariants(dex,'Charizard').every(v=>!(v.item==='choicescarf'&&v.mega)));
  const y=V2.variantAttack(dex,V2.publicVariants(dex,'Charizard').find(v=>v.form==='Charizard-Mega-Y'),
    {species:'Primarina',ability:'Torrent',item:'',evs:{hp:32},nature:'Modest'},{knownDefender:true});
  assert.ok(y.worst>0,'Drought adds a sun Solar Beam into Primarina');
});
test('Sand Force needs a public sand setter (v1 condition could never be true)',()=>{
  const v={species:'Hippowdon',form:'Hippowdon',mega:false,item:'',weight:1,ability:'Sand Force'};
  const def={species:'Tyranitar',ability:'Sand Stream',item:'',evs:{},nature:'Serious'};
  const off=V2.variantAttack(dex,v,def,{knownDefender:true,field:{sandSetter:false}});
  const on=V2.variantAttack(dex,v,def,{knownDefender:true,field:{sandSetter:true}});
  assert.ok(on.stab>off.stab*1.2,"Ground STAB boosted only with a sand setter");
});
test('pinned Showdown: Mega Charizard Y Drought overwrites a leading Tyranitar Sandstorm on T1',async()=>{
  const g=G('03_M7_charizardY_offense');
  const r=await battle(load(),reportedLive(),g.team,hashSeed(777),
    {ownForced:['Tyranitar','Primarina','Garchomp'],foeForced:['Charizard','Garchomp','Mimikyu'],keepLog:true});
  const lines=r.log.split('\n'),sand=lines.findIndex(l=>l.startsWith('|-weather|Sandstorm|[from] ability: Sand Stream'));
  const sun=lines.findIndex(l=>l.startsWith('|-weather|SunnyDay|[from] ability: Drought'));
  assert.ok(sand>=0&&sun>sand,'sand first, then Drought on Mega Evolution');
  assert.ok(lines.slice(sand,sun).some(l=>l==='|turn|1'));
});
test('holdout teams are legal in gen9championsbssregmc',()=>{
  const {normalize}=require('../lab');
  const v=sim.TeamValidator.get('gen9championsbssregmc');
  for(const g of holdoutGroups){const p=v.validateTeam(normalize(g.team));assert.ok(!p||!p.length,g.name+': '+(p||[]).join('; '));}
});
test('v1 and legacy are unchanged by the v2 opt-in (PR #58 snapshot)',()=>{
  const team=reportedLive();
  assert.deepEqual(names(team,V1.chooseThreatAwarePreview(dex,team,SCENARIOS.A_golisopod_mimikyu)),['Metagross','Hydreigon','Primarina']);
  assert.deepEqual(names(team,chooseThree(dex,team,SCENARIOS.A_golisopod_mimikyu)),['Hydreigon','Primarina','Metagross']);
  assert.deepEqual(names(team,chooseThree(dex,team,SCENARIOS.C_charizard_x_y)),['Tyranitar','Hydreigon','Metagross']);
});
test('Bot with previewPolicy threat-aware-v2 selects from |poke| species only in a real Battle',async()=>{
  const team=reportedLive(),foe=G('01_M7_golisopod_balance').team;
  const g=await game(sim,team,foe,hashSeed(5656),false,null,false,{candidatePreviewPolicy:'threat-aware-v2',opponentPreviewPolicy:'legacy'});
  assert.equal(g.trace.errors.length,0);
  const mine=g.trace.selections.find(s=>s.side==='p1');
  assert.deepEqual(mine.chosen,names(team,V2.chooseThreatAwareV2(dex,team,foe.map(p=>p.species))));
});
test('A counterexample: v2 does not lead Mega Metagross into the public Golisopod six',()=>{
  const team=reportedLive();
  assert.notEqual(names(team,V2.chooseThreatAwareV2(dex,team,SCENARIOS.A_golisopod_mimikyu))[0],'Metagross');
});
