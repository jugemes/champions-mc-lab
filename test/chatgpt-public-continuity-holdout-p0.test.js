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
async function play(sim,own,foe,seed,reverse,branch,policy,pivotMode){
 const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
 const dex=sim.Dex.mod('champions'),trace={choices:[],selections:[],errors:[]};
 const ourSide=reverse?'p2':'p1',rivalSide=reverse?'p1':'p2';
 const [p1,p2]=reverse?[foe,own]:[own,foe];
 const make=(stream,team,side)=>new Bot(stream,dex,team,side,trace,
   side===rivalSide?branch.rival:null,null,{
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
  if(!req.forceSwitch&&this.turn===1){
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
 assert.ok(selected&&selected.chosen.length===3,'selection observed');
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
 const ownChoices=trace.choices.filter(x=>x.side===ourSide&&x.turn>=1&&x.turn<=2)
   .map(x=>({turn:x.turn,choice:x.choice}));
 return {won:winner===ourSide,three:selected.chosen,lead:selected.lead,
   ownChoices,ownExecuted:executed.own,rivalExecuted:executed.rival,
   t1Executed,pivotIssued,pivotExecuted,
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
