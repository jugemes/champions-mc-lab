'use strict';
// #104 preregistration #6560227079, public-immunity correction #6560234462.
// NEW public-six combinations; synthetic fixture holdout, not ranked frequency.
// Freeze all scenarios and seeds before observing the first battle result.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Bot,load,normalize,prelim,hashSeed}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes}=require('../fixtures');
const {immuneAware100}=require('../pr100-legal');
const {publicImmune98}=require('../pr98-timing');
const {chooseContinuityPreview}=require('../public-continuity-preview');
const {executedEvents,eventSignature}=require('../public-execution-audit');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const {rain,setup,stall}=archetypes;
const cases=[
 {id:'H-I-rain-mega-stall-priority',
  team:[rain[0],setup[0],stall[0],setup[4],setup[5],stall[4]],
  branches:[
   {rival:['Pelipper','Salamence','Toxapex'],t1:'Hurricane',pivot:'Toxapex'},
   {rival:['Rillaboom','Skarmory','Skeledirge'],t1:'Grassy Glide',pivot:'Skarmory'},
   {rival:['Salamence','Toxapex','Skeledirge'],t1:'Double-Edge',pivot:'Skeledirge'}
  ]},
 {id:'H-J-mega-rain-setup-stall',
  team:[rain[1],setup[1],rain[2],stall[3],setup[2],setup[3]],
  branches:[
   {rival:['Swampert','Volcarona','Gholdengo'],t1:'Liquidation',pivot:'Gholdengo'},
   {rival:['Archaludon','Slowbro','Dragonite'],t1:'Flash Cannon',pivot:'Slowbro'},
   {rival:['Volcarona','Swampert','Slowbro'],t1:'Quiver Dance',pivot:'Swampert'}
  ]}
];
const policies={
 legacy:{previewPolicy:'legacy',decisionPolicy:'baseline'},
 continuity:{previewPolicy:'publicContinuity',decisionPolicy:'publicContinuity'}
};
const canon=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
async function play(sim,own,foe,seed,reverse,branch,policy,pivotMode,rivalT1Mode='scripted',rivalSelectionMode='fixed'){
 const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
 const dex=sim.Dex.mod('champions'),trace={choices:[],selections:[],errors:[]};
 const ourSide=reverse?'p2':'p1',rivalSide=reverse?'p1':'p2';
 const [p1,p2]=reverse?[foe,own]:[own,foe];
 const make=(stream,team,side)=>new Bot(stream,dex,team,side,trace,
   side===rivalSide&&rivalSelectionMode==='fixed'?branch.rival:null,null,{
     seed,
     previewPolicy:side===ourSide?policy.previewPolicy:'legacy',
     decisionPolicy:side===ourSide?policy.decisionPolicy:'baseline'
   });
 const b1=make(streams.p1,p1,'p1'),b2=make(streams.p2,p2,'p2');
 const enemy=rivalSide==='p1'?b1:b2;
 const original=enemy.decide.bind(enemy);
 const immune=immuneAware100(null,dex,{});
 let pivotIssued=0;
 enemy.decide=function(req){
  if(req.teamPreview)return original(req);
  if(rivalT1Mode==='scripted'&&!req.forceSwitch&&this.turn===1){
   const moves=req.active?.[0]?.moves||[];
   const i=moves.findIndex(m=>canon(m.id||m.move)===canon(branch.t1)&&
     !m.disabled&&m.pp>0);
   assert.ok(i>=0,'declared rival T1 legal: '+branch.t1);
   return 'move '+(i+1)+(req.active[0].canMegaEvo?' mega':'');
  }
  if(pivotMode&&this.turn===2&&!req.forceSwitch){
   const i=req.side.pokemon.findIndex(p=>!p.active&&
     String(p.details||'').split(',')[0]===branch.pivot&&
     !String(p.condition||'').endsWith(' fnt'));
   if(i>=0){
    pivotIssued++;
    return 'switch '+(i+1);
   }
  }
  if(!req.forceSwitch){
   const corrected=immune(req,this,{turn:this.turn});
   if(corrected)return corrected;
  }
  return original(req);
 };
 let winner='',log='';
 const observer=(async()=>{for await(const msg of streams.omniscient){
   log+=msg;
   for(const line of msg.split('\n'))if(line.startsWith('|win|'))winner=line.slice(5);
 }})();
 const r1=b1.run(),r2=b2.run();
 await streams.omniscient.write('>start '+JSON.stringify({formatid:'gen9championsbssregmc',seed})+
   '\n>player p1 '+JSON.stringify({name:'p1',team:normalize(p1)})+
   '\n>player p2 '+JSON.stringify({name:'p2',team:normalize(p2)}));
 await Promise.all([observer,r1,r2]);
 assert.ok(winner,'completed pinned full Battle');
 const selected=trace.selections.find(x=>x.side===ourSide);
 const rivalSelected=trace.selections.find(x=>x.side===rivalSide);
 assert.ok(selected&&selected.chosen.length===3,'selection observed');
 assert.ok(rivalSelected&&rivalSelected.chosen.length===3,'rival selection observed');
 let turn=0,moveStarted=false,pivotExecuted=0,t1Executed=false;
 const publicEarly=[];
 for(const line of log.split('\n')){
   if(line.startsWith('|turn|')){turn=Number(line.split('|')[2])||0;moveStarted=false;continue;}
   const a=line.split('|');
   if(turn===1&&a[1]==='move'&&a[2]?.startsWith(rivalSide+'a:')&&
     canon(a[3])===canon(branch.t1))t1Executed=true;
   if(turn===2&&a[1]==='move')moveStarted=true;
   if(turn===2&&a[1]==='switch'&&a[2]?.startsWith(rivalSide+'a:')&&
     String(a[3]).split(',')[0]===branch.pivot&&!moveStarted)pivotExecuted++;
   if(turn<=2&&['move','switch','faint','-immune','-fail'].includes(a[1]))
     publicEarly.push('T'+turn+':'+line.slice(0,140));
 }
 assert.equal(pivotExecuted,pivotIssued,'issued T2 pivot must be seen in public Showdown log');
 const executed=executedEvents(log,ourSide,rivalSide);
 const rivalT1Moves=executed.rival.filter(e=>e.turn===1&&e.kind==='move').map(e=>e.detail);
 const rivalT1Categories=rivalT1Moves.map(m=>dex.moves.get(m).category);
 const ownChoices=trace.choices.filter(x=>x.side===ourSide&&x.turn>=1&&x.turn<=2)
   .map(x=>({turn:x.turn,choice:x.choice}));
 return {won:winner===ourSide,three:selected.chosen,lead:selected.lead,
   rivalThree:rivalSelected.chosen,rivalLead:rivalSelected.lead,
   ownChoices,ownExecuted:executed.own,rivalExecuted:executed.rival,
   t1Executed,pivotIssued,pivotExecuted,rivalT1Moves,rivalT1Categories,
   errors:trace.errors.length,knownImmuneHits:publicImmune98(log,rivalSide,dex).known.length,
   publicEarly:publicEarly.slice(0,12)};
}
test('new H-I/H-J public-six combinations and selected rival trios are legal',{skip},()=>{
 const sim=load(),v=sim.TeamValidator.get('gen9championsbssregmc');
 const own=reportedLive();
 assert.ok(!v.validateTeam(normalize(own))?.length,'reported M-7');
 for(const c of cases){
   prelim(c.team,c.id);
   assert.ok(!v.validateTeam(normalize(c.team))?.length,c.id);
   assert.equal(new Set(c.team.map(x=>x.species)).size,6,c.id+' six distinct species');
   assert.equal(new Set(c.team.map(x=>x.item)).size,6,c.id+' unique items');
   for(const b of c.branches){
     assert.equal(new Set(b.rival).size,3);
     for(const name of b.rival)assert.ok(c.team.some(x=>x.species===name));
     const first=c.team.find(x=>x.species===b.rival[0]);
     assert.ok(first.moves.some(m=>canon(m)===canon(b.t1)),c.id+' T1 legal');
     assert.ok(b.rival.includes(b.pivot)&&b.pivot!==b.rival[0]);
   }
 }
});
test('continuity preview only uses public six and is permutation invariant',{skip},()=>{
 const sim=load(),dex=sim.Dex.mod('champions'),own=reportedLive();
 for(const c of cases){
   const six=c.team.map(x=>x.species);
   const a=chooseContinuityPreview(dex,own,six).selection;
   const b=chooseContinuityPreview(dex,own,[...six].reverse()).selection;
   assert.deepEqual(a,b,c.id);
   assert.equal(new Set(a).size,3);
 }
});
test('preregistered H-I/H-J paired full Battle: public continuity vs legacy, immune-aware and legal pivot rivals',{skip},async t=>{
 const sim=load(),own=reportedLive(),summary=[];
 for(const [ci,c] of cases.entries()){
  const row={id:c.id,publicSix:c.team.map(x=>x.species),branches:[]};
  for(const [bi,b] of c.branches.entries())for(const pivotMode of [false,true]){
   const rec={rival:b.rival,t1:b.t1,pivot:b.pivot,pivotMode,
     oldWins:0,newWins:0,oldPivots:0,newPivots:0,
     oldT1Executed:0,newT1Executed:0,oldKnownImmune:0,newKnownImmune:0,
     changedThree:0,changedLead:0,changedT12:0,
     changedExecutedT1:0,changedExecutedT2:0,changedExecutedMoveT1:0,
     changedExecutedMoveT2:0,changedRivalExecutedT12:0,
     gains:0,losses:0,errors:0,samples:[]};
   for(let n=0;n<2;n++)for(const reverse of [false,true]){
     const seed=hashSeed(10422000+ci*1000+bi*100+n);
     const args=[sim,structuredClone(own),structuredClone(c.team),seed,reverse,b];
     const a=await play(...args,policies.legacy,pivotMode);
     const z=await play(sim,structuredClone(own),structuredClone(c.team),seed,reverse,b,policies.continuity,pivotMode);
     rec.oldWins+=+a.won;rec.newWins+=+z.won;
     rec.oldPivots+=a.pivotExecuted;rec.newPivots+=z.pivotExecuted;
     rec.oldT1Executed+=+a.t1Executed;rec.newT1Executed+=+z.t1Executed;
     rec.oldKnownImmune+=a.knownImmuneHits;rec.newKnownImmune+=z.knownImmuneHits;
     rec.changedThree+=+([...a.three].sort().join()!==[...z.three].sort().join());
     rec.changedLead+=+(a.lead!==z.lead);
     rec.changedT12+=+(JSON.stringify(a.ownChoices)!==JSON.stringify(z.ownChoices));
     // Actual Showdown |move|/|switch|/|drag| events, NOT Bot commands.
     // A switch can be a faint replacement; count it as an observed event,
     // not automatically a voluntary tactical decision.
     for(const turn of [1,2]){
       rec['changedExecutedT'+turn]+=+(eventSignature(a.ownExecuted,turn)!==eventSignature(z.ownExecuted,turn));
       rec['changedExecutedMoveT'+turn]+=+(eventSignature(a.ownExecuted,turn,{onlyMoves:true})!==eventSignature(z.ownExecuted,turn,{onlyMoves:true}));
     }
     rec.changedRivalExecutedT12+=+([1,2].some(turn=>eventSignature(a.rivalExecuted,turn)!==eventSignature(z.rivalExecuted,turn)));
     rec.gains+=+(!a.won&&z.won);rec.losses+=+(a.won&&!z.won);
     rec.errors+=a.errors+z.errors;
     if(rec.samples.length<1)rec.samples.push({seed,reverse,old:a,new:z});
   }
   assert.equal(rec.errors,0,c.id+' valid requests');
   assert.equal(rec.oldKnownImmune,0,c.id+' rival known immune old');
   assert.equal(rec.newKnownImmune,0,c.id+' rival known immune new');
   row.branches.push(rec);
  }
  summary.push(row);
 }
 const total=summary.flatMap(x=>x.branches).reduce((r,x)=>{
   for(const k of ['oldWins','newWins','oldPivots','newPivots','oldT1Executed',
     'newT1Executed','changedThree','changedLead','changedT12',
     'changedExecutedT1','changedExecutedT2','changedExecutedMoveT1',
     'changedExecutedMoveT2','changedRivalExecutedT12','gains','losses'])
     r[k]=(r[k]||0)+x[k];
   return r;
 },{});
 t.diagnostic('P0 NEW CONTINUITY HOLDOUT TOTAL '+JSON.stringify(total));
 t.diagnostic('P0 NEW CONTINUITY HOLDOUT CASES '+JSON.stringify(summary));
});


// P0 2x2 causal diagnostic on already-examined H-I/H-J: NOT a new holdout.
// LL=legacy preview+turn, LC=legacy preview+continuity turn,
// CL=continuity preview+legacy turn, CC=continuity preview+turn.
// Isolates preview/turn effects under fixed rival branch, seed and side.
test('P0 factorial full-Battle diagnostic: preview vs turn contributions',{skip},async t=>{
 const sim=load(),own=reportedLive();
 const arms={
  LL:{previewPolicy:'legacy',decisionPolicy:'baseline'},
  LC:{previewPolicy:'legacy',decisionPolicy:'publicContinuity'},
  CL:{previewPolicy:'publicContinuity',decisionPolicy:'baseline'},
  CC:{previewPolicy:'publicContinuity',decisionPolicy:'publicContinuity'}
 };
 const totals=Object.fromEntries(Object.keys(arms).map(k=>[k,{wins:0,errors:0,knownImmuneHits:0,t1Executed:0,conditions:0}]));
 const names={turnLegacy:['LL','LC'],turnContinuity:['CL','CC'],
   previewLegacy:['LL','CL'],previewContinuity:['LC','CC']};
 // Forced Status T1 is legal, but without an independently checked opponent
 // counterfactual it is NOT evidence of a rational adversary. Keep gains and
 // losses from those branches separate rather than crediting them as proof.
 const effects=Object.fromEntries(Object.keys(names).map(k=>[k,{gains:0,losses:0,
   forcedStatusGains:0,forcedStatusLosses:0,
   otherGains:0,otherLosses:0,
   changedT1:0,changedT2:0,changedThree:0,changedLead:0}]));
 const branches=[];
 for(const [ci,c] of cases.entries())for(const [bi,b] of c.branches.entries())
 for(const pivotMode of [false,true]){
  const forcedStatusT1=sim.Dex.mod('champions').moves.get(b.t1).category==='Status';
  const row={case:c.id,rival:b.rival,t1:b.t1,pivotMode,
    forcedStatusT1,opponentRationalityCertified:false,
    wins:{LL:0,LC:0,CL:0,CC:0}};
  for(let n=0;n<2;n++)for(const reverse of [false,true]){
   const seed=hashSeed(10422000+ci*1000+bi*100+n),res={};
   for(const [k,policy] of Object.entries(arms)){
    const r=await play(sim,structuredClone(own),structuredClone(c.team),seed,reverse,b,policy,pivotMode);
    res[k]=r;totals[k].wins+=+r.won;totals[k].errors+=r.errors;
    totals[k].knownImmuneHits+=r.knownImmuneHits;totals[k].t1Executed+=+r.t1Executed;totals[k].conditions++;row.wins[k]+=+r.won;
   }
   for(const [a,z] of [['LL','LC'],['CL','CC']]){
    assert.deepEqual(res[a].three,res[z].three,'turn-only comparison: fixed three');
    assert.equal(res[a].lead,res[z].lead,'turn-only comparison: fixed lead');
   }
   for(const [name,[a,z]] of Object.entries(names)){
    const e=effects[name];
    const gain=+(!res[a].won&&res[z].won),loss=+(res[a].won&&!res[z].won);
    e.gains+=gain;e.losses+=loss;
    if(forcedStatusT1){e.forcedStatusGains+=gain;e.forcedStatusLosses+=loss;}
    else{e.otherGains+=gain;e.otherLosses+=loss;}
    e.changedThree+=+([...res[a].three].sort().join()!==[...res[z].three].sort().join());
    e.changedLead+=+(res[a].lead!==res[z].lead);
    for(const turn of [1,2])e['changedT'+turn]+=
      +(eventSignature(res[a].ownExecuted,turn)!==eventSignature(res[z].ownExecuted,turn));
   }
  }
  branches.push(row);
 }
 for(const [key,v] of Object.entries(totals)){
  assert.equal(v.conditions,48,key+' fixed factorial conditions');
  assert.equal(v.errors,0,key+' valid Battle requests');
  assert.equal(v.knownImmuneHits,0,key+' public-known immune rival attacks');
 }
 assert.equal(branches.length,12);
 for(const e of Object.values(effects)){
   assert.equal(e.gains,e.forcedStatusGains+e.otherGains,
     'unverified forced-Status gains must never silently become certified wins');
   assert.equal(e.losses,e.forcedStatusLosses+e.otherLosses,
     'losses must remain visible even after excluding unverified setup gains');
 }
 t.diagnostic('P0 FACTORIAL RATIONALITY SCREEN '+JSON.stringify({
   scope:'diagnostic only; other gains are also not rationality-certified',
   forcedStatusDefinition:'scripted legal T1 Status without opponent counterfactual',
   previewLegacy:{...effects.previewLegacy,
     netExcludingUnverifiedForcedStatus:effects.previewLegacy.otherGains-effects.previewLegacy.otherLosses},
   previewContinuity:{...effects.previewContinuity,
     netExcludingUnverifiedForcedStatus:effects.previewContinuity.otherGains-effects.previewContinuity.otherLosses},
   caution:'remaining scripted-attack gains are not independently rationality-certified either'
 }));
 t.diagnostic('P0 FACTORIAL DIAGNOSTIC TOTAL '+JSON.stringify({totals,effects}));
 t.diagnostic('P0 FACTORIAL DIAGNOSTIC BRANCHES '+JSON.stringify(branches));
});


// P0 adversarial counterfactual: remove the scripted rival T1, keeping the
// same PUBLIC six, fixed opposing trio/lead, seed, side and optional T2 pivot.
// This is an already-used diagnostic set, NOT a preregistered new holdout.
// An autonomous baseline Bot with public-known immunity avoidance is NOT a
// certified rational human opponent. Its actual executed T1 is audited.
test('P0 adversarial T1 counterfactual: scripted vs autonomous rival Bot',{skip},async t=>{
 const sim=load(),own=reportedLive(),summary=[];
 const arms={
  legacy:{previewPolicy:'legacy',decisionPolicy:'baseline'},
  continuityPreview:{previewPolicy:'publicContinuity',decisionPolicy:'baseline'}
 };
 const total={conditions:0,scripted:{legacyWins:0,newWins:0,gains:0,losses:0,
   rivalStatusExecuted:0,rivalT1Absent:0},
  autonomous:{legacyWins:0,newWins:0,gains:0,losses:0,
   rivalStatusExecuted:0,rivalT1Absent:0},
  changedAutonomousRivalT1FromScript:0,errors:0,knownImmuneHits:0,
  autonomousByT2Mode:{
   noForcedPivot:{conditions:0,legacyWins:0,newWins:0,gains:0,losses:0},
   forcedPivot:{conditions:0,legacyWins:0,newWins:0,gains:0,losses:0}
  },
  autonomousT1NoMove:{switch:0,cant:0,unresolved:0}};
 for(const [ci,c] of cases.entries())for(const [bi,b] of c.branches.entries())
 for(const pivotMode of [false,true]){
  const row={case:c.id,rival:b.rival,t1Script:b.t1,pivotMode,
   scripted:{legacyWins:0,newWins:0,gains:0,losses:0},
   autonomous:{legacyWins:0,newWins:0,gains:0,losses:0,
     actualRivalT1Moves:[],actualRivalT1NonMoveEvents:[],statusExecutions:0,missingT1Moves:0}};
  for(let n=0;n<2;n++)for(const reverse of [false,true]){
   const seed=hashSeed(10422000+ci*1000+bi*100+n),res={};
   for(const mode of ['scripted','autonomous'])for(const [name,policy] of Object.entries(arms)){
    const x=await play(sim,structuredClone(own),structuredClone(c.team),
      seed,reverse,b,policy,pivotMode,mode);
    res[mode+'_'+name]=x;
    total.errors+=x.errors;total.knownImmuneHits+=x.knownImmuneHits;
   }
   for(const mode of ['scripted','autonomous']){
    const a=res[mode+'_legacy'],z=res[mode+'_continuityPreview'];
    assert.deepEqual(a.three.length,3);
    assert.deepEqual(z.three.length,3);
    const gain=+(!a.won&&z.won),loss=+(a.won&&!z.won);
    row[mode].legacyWins+=+a.won;row[mode].newWins+=+z.won;
    row[mode].gains+=gain;row[mode].losses+=loss;
    const s=total[mode];s.legacyWins+=+a.won;s.newWins+=+z.won;
    s.gains+=gain;s.losses+=loss;
    s.rivalStatusExecuted+=+(a.rivalT1Categories.includes('Status'));
    s.rivalT1Absent+=+(a.rivalT1Moves.length===0);
    if(mode==='autonomous'){
     // A missing |move| is NOT a skipped turn: the rival may have pivoted.
     // Only count the actual public Showdown event, never a Bot request.
     const t1Events=a.rivalExecuted.filter(e=>e.turn===1);
     const nonMove=t1Events.filter(e=>e.kind!=='move');
     const bucket=total.autonomousByT2Mode[pivotMode?'forcedPivot':'noForcedPivot'];
     bucket.conditions++;bucket.legacyWins+=+a.won;bucket.newWins+=+z.won;
     bucket.gains+=gain;bucket.losses+=loss;
     if(a.rivalT1Moves.length===0){
       const kind=nonMove.some(e=>e.kind==='switch')?'switch':
         nonMove.some(e=>e.kind==='cant')?'cant':'unresolved';
       total.autonomousT1NoMove[kind]++;
       row.autonomous.actualRivalT1NonMoveEvents.push({seed,reverse,
         kind,events:nonMove,publicEarly:a.publicEarly});
     }
     row.autonomous.actualRivalT1Moves.push(a.rivalT1Moves.join('+')||'(no move)');
     row.autonomous.statusExecutions+=+(a.rivalT1Categories.includes('Status'));
     row.autonomous.missingT1Moves+=+(a.rivalT1Moves.length===0);
    }
   }
   total.changedAutonomousRivalT1FromScript+=+
     (eventSignature(res.scripted_legacy.rivalExecuted,1)!==
      eventSignature(res.autonomous_legacy.rivalExecuted,1));
   total.conditions++;
  }
  summary.push(row);
 }
 assert.equal(total.conditions,48,'same 48 paired conditions, 4 variants each');
 // Verify this counterfactual did not silently alter the earlier 2x2 baseline.
 assert.equal(total.scripted.legacyWins,36,'scripted LL baseline unchanged');
 assert.equal(total.scripted.newWins,38,'scripted CL baseline unchanged');
 assert.equal(total.scripted.gains,6,'scripted preview gains unchanged');
 assert.equal(total.scripted.losses,4,'scripted preview losses unchanged');
 assert.equal(total.errors,0,'all Battle requests legal');
 assert.equal(total.knownImmuneHits,0,'no publicly known immune rival attacks');
 for(const [label,v] of Object.entries(total.autonomousByT2Mode)){
   assert.equal(v.conditions,24,label+' must retain 24 matched conditions');
   assert.equal(v.newWins-v.legacyWins,v.gains-v.losses,label+' paired accounting');
 }
 assert.equal(Object.values(total.autonomousT1NoMove).reduce((a,b)=>a+b,0),
   total.autonomous.rivalT1Absent,'missing T1 move must have explicit event classification');
 assert.equal(total.autonomousByT2Mode.noForcedPivot.legacyWins+
   total.autonomousByT2Mode.forcedPivot.legacyWins,total.autonomous.legacyWins);
 assert.equal(total.autonomousByT2Mode.noForcedPivot.newWins+
   total.autonomousByT2Mode.forcedPivot.newWins,total.autonomous.newWins);
 t.diagnostic('P0 ADVERSARIAL T1 COUNTERFACTUAL TOTAL '+JSON.stringify(total));
 t.diagnostic('P0 ADVERSARIAL T1 COUNTERFACTUAL BRANCHES '+JSON.stringify(summary));
 t.diagnostic('P0 AUTONOMOUS T2 MODE AUDIT '+JSON.stringify({
   autonomousByT2Mode:total.autonomousByT2Mode,
   rivalT1NoMove:total.autonomousT1NoMove,
   caution:'Only noForcedPivot allows both T1 and T2 autonomous choices; forcedPivot scripts T2.'
 }));
 t.diagnostic('P0 ADVERSARIAL T1 CAUTION: only noForcedPivot is autonomous at both T1/T2; forcedPivot contains a scripted T2 switch, so its wins cannot certify opponent rationality. A missing T1 move can be a switch/cant and must not be called inactivity. No new holdout or adoption evidence.');
});


// P0 opponent preview counterfactual, DIAGNOSTIC on already-used H-I/H-J.
// Unlike previous trials, the opposing Bot chooses its own 3+lead from its
// PUBLIC view of our six. Both sides then act autonomously at T1/T2.
// The rival Bot is not certified as a rational human; this does not qualify
// as a previously unused holdout or establish adoption of any policy.
test('P0 autonomous opposing 6-to-3 and T1/T2 full Battle diagnostic',{skip},async t=>{
 const sim=load(),own=reportedLive(),summary=[];
 for(const [ci,c] of cases.entries()){
  const row={id:c.id,publicSix:c.team.map(p=>p.species),
   rivalSelections:[],ownSelections:[],oldWins:0,newWins:0,
   gains:0,losses:0,errors:0,knownImmuneHits:0,conditions:0};
  // No fixed rival three, no scripted T1, no forced T2 pivot.
  // A branch object is retained only for the existing play() signature.
  const branch=c.branches[0];
  for(let n=0;n<2;n++)for(const reverse of [false,true]){
   const seed=hashSeed(10427000+ci*100+n);
   const args=[sim,structuredClone(own),structuredClone(c.team),seed,reverse,branch];
   const a=await play(...args,policies.legacy,false,'autonomous','autonomous');
   const z=await play(sim,structuredClone(own),structuredClone(c.team),
     seed,reverse,branch,policies.continuity,false,'autonomous','autonomous');
   // Rival selection must be a legal public-six subset, not a private set leak.
   for(const result of [a,z]){
    assert.equal(new Set(result.rivalThree).size,3,'three distinct opposing selections');
    for(const species of result.rivalThree)
     assert.ok(c.team.some(p=>p.species===species),'rival picks from its six');
    assert.ok(result.rivalThree.includes(result.rivalLead),'lead belongs to chosen trio');
   }
   row.conditions++;row.oldWins+=+a.won;row.newWins+=+z.won;
   row.gains+=+(!a.won&&z.won);row.losses+=+(a.won&&!z.won);
   row.errors+=a.errors+z.errors;
   row.knownImmuneHits+=a.knownImmuneHits+z.knownImmuneHits;
   row.rivalSelections.push({seed,reverse,legacy:{three:a.rivalThree,lead:a.rivalLead},
     continuity:{three:z.rivalThree,lead:z.rivalLead}});
   row.ownSelections.push({seed,reverse,legacy:{three:a.three,lead:a.lead},
     continuity:{three:z.three,lead:z.lead}});
  }
  assert.equal(row.conditions,4,'two independent seeds and two sides');
  assert.equal(row.errors,0,'no illegal Battle choices');
  assert.equal(row.knownImmuneHits,0,'no publicly certain immune rival attack');
  assert.equal(row.newWins-row.oldWins,row.gains-row.losses,'paired accounting');
  summary.push(row);
 }
 t.diagnostic('P0 AUTONOMOUS RIVAL PREVIEW AND T1T2 '+JSON.stringify({
  scope:'previously used H-I/J; diagnostic, NOT unused holdout',
  opponentModel:'Bot chooses 3+lead from public six, autonomous T1/T2 plus immuneAware100',
  opponentRationalityCertified:false,selectionAndLeadReviewedByHuman:false,
  cases:summary
 }));
});


// P0: independent opposing 6->3+lead HYPOTHESES, not just one autonomous Bot
// optimum. Existing H-I/H-J are DIAGNOSTIC, never unused holdout.
// The enumerator sees rival's OWN known six and our PUBLIC six species only.
// It cannot inspect M-7 private moves/items or the result of a battle.
test('P0 diverse public-only rival 3+lead branches vs M-7 full Battle diagnostic',{skip},async t=>{
 const {enumeratePublicRivalBranches}=require('../public-rival-multibranch');
 const sim=load(),dex=sim.Dex.mod('champions'),own=reportedLive();
 const ownPublic=own.map(p=>p.species),rows=[];
 for(const [ci,c] of cases.entries()){
   const generated=enumeratePublicRivalBranches(dex,c.team,ownPublic,{limit:3});
   assert.equal(generated.length,3,'three distinct rival hypotheses');
   assert.equal(new Set(generated.map(x=>[...x.selection].sort().join())).size,3,
     'three different opposing trios, not lead-only permutations');
   const row={case:c.id,publicSix:c.team.map(p=>p.species),
     opponentRationalityCertified:false,branches:[],legacyWins:0,newWins:0,
     errors:0,knownImmuneHits:0};
   for(const [bi,proposal] of generated.entries()){
     const rival=proposal.selection;
     assert.equal(new Set(rival).size,3);
     for(const species of rival)assert.ok(c.team.some(p=>p.species===species));
     const branch={rival,t1:c.branches[0].t1,pivot:c.branches[0].pivot};
     const b={mode:proposal.mode,three:rival,lead:rival[0],
       rationale:proposal.rationale,oldWins:0,newWins:0,gains:0,losses:0,
       actualRivalT1:[],samples:[]};
     for(let n=0;n<2;n++)for(const reverse of [false,true]){
       const seed=hashSeed(10431000+ci*1000+bi*100+n);
       const a=await play(sim,structuredClone(own),structuredClone(c.team),
         seed,reverse,branch,{previewPolicy:'legacy',decisionPolicy:'baseline'},
         false,'autonomous','fixed');
       const z=await play(sim,structuredClone(own),structuredClone(c.team),
         seed,reverse,branch,{previewPolicy:'publicContinuity',decisionPolicy:'baseline'},
         false,'autonomous','fixed');
       assert.deepEqual(a.rivalThree,rival,'opposing legal 3+lead fixed as declared');
       assert.deepEqual(z.rivalThree,rival,'opposing legal 3+lead fixed across policies');
       assert.equal(a.rivalLead,rival[0]);
       assert.equal(z.rivalLead,rival[0]);
       row.errors+=a.errors+z.errors;
       row.knownImmuneHits+=a.knownImmuneHits+z.knownImmuneHits;
       row.legacyWins+=+a.won;row.newWins+=+z.won;
       b.oldWins+=+a.won;b.newWins+=+z.won;
       b.gains+=+(!a.won&&z.won);b.losses+=+(a.won&&!z.won);
       b.actualRivalT1.push(a.rivalExecuted.filter(e=>e.turn===1));
       if(b.samples.length===0)b.samples.push({seed,reverse,
         oldOwn:{three:a.three,lead:a.lead},newOwn:{three:z.three,lead:z.lead},
         rivalT1:a.rivalExecuted.filter(e=>e.turn===1),
         rivalT2:a.rivalExecuted.filter(e=>e.turn===2)});
     }
     assert.equal(b.newWins-b.oldWins,b.gains-b.losses,'paired accounting');
     row.branches.push(b);
   }
   assert.equal(row.errors,0,'no illegal choice');
   assert.equal(row.knownImmuneHits,0,'no public-known immune rival attacks');
   rows.push(row);
 }
 t.diagnostic('P0 MULTI-RIVAL 3+LEAD PUBLIC HYPOTHESES '+JSON.stringify({
   scope:'H-I/H-J reused diagnostic, NOT new holdout',
   opponentSelection:'three distinct trios generated from public six, forced for stress; not certified rational',
   opponentTurn:'autonomous baseline Bot plus public-known immunity avoidance, no T1/T2 scripts',
   totalPairs:24,totalBattles:48,cases:rows,
   caution:'No candidate adoption from these results. Future unknown public-six holdout only AFTER own policy frozen.'
 }));
});
