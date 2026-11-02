'use strict';
// Predeclared BEFORE results: PR #104 comment #6588145004.
// H-M11/H-M12 synthetic, previously unused six-species previews; fixture sets
// are reused and are NOT unknown ladder sets or estimates of human win rate.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize,hashSeed}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes,variants}=require('../fixtures');
const {battle,bench,nameOf,switchTo,earlyLines}=require('../encore-lead-audit');
const {executedEvents,eventSignature}=require('../public-execution-audit');
const {classifyExecutedImmunities}=require('../public-immune-causality-audit');
const clone=x=>structuredClone(x);
const get=(a,s)=>{const p=a.find(x=>x.species===s);assert.ok(p,'fixture '+s);return clone(p);};
const own=reportedLive();
const cases=[
 {id:'H-M11-rain-megaswampert-grass-steel',team:[
   get(archetypes.rain,'Pelipper'),get(archetypes.rain,'Swampert'),
   get(variants.A_rillaboom,'Rillaboom'),get(archetypes.rain,'Gholdengo'),
   get(archetypes.setup,'Skeledirge'),get(variants.C_master,'Corviknight')],
  rival:[['Pelipper','Swampert','Rillaboom'],
    ['Gholdengo','Skeledirge','Corviknight'],['Swampert','Gholdengo','Rillaboom']]},
 {id:'H-M12-megamence-volcarona-fastwater',team:[
   get(archetypes.setup,'Salamence'),get(archetypes.setup,'Volcarona'),
   get(variants.A_rillaboom,'Rillaboom'),get(variants.C_master,'Corviknight'),
   get(variants.A_rillaboom,'Starmie'),get(variants.A_rillaboom,'Primarina')],
  rival:[['Salamence','Volcarona','Rillaboom'],
    ['Starmie','Primarina','Corviknight'],['Volcarona','Corviknight','Starmie']]}
];
const candidates=[
 {id:'A_rotom_mega_fairy',three:['Rotom-Wash','Metagross','Primarina']},
 {id:'A2_fairy_mega_rotom',three:['Primarina','Metagross','Rotom-Wash']},
 {id:'B_sand_rotom_dark',three:['Tyranitar','Rotom-Wash','Hydreigon']},
 {id:'C_scarf_fairy_mega',three:['Garchomp','Primarina','Metagross']},
 {id:'D_mega_rotom_dark',three:['Metagross','Rotom-Wash','Hydreigon']}
];
const pivots=[
 ['Pelipper','Rotom-Wash','Rillaboom'],
 ['Swampert','Rotom-Wash','Rillaboom'],
 ['Gholdengo','Tyranitar','Corviknight'],
 ['Salamence','Rotom-Wash','Rillaboom'],
 ['Volcarona','Tyranitar','Primarina'],
 ['Starmie','Tyranitar','Primarina'],
 ['Primarina','Metagross','Corviknight']
];
function publicPivot(req,bot,info){
 if(info.turn!==1||req.teamPreview||req.forceSwitch)return null;
 // A switch is not legal under a trapping request, even when the bench exists.
 if(req.active?.[0]?.trapped||req.active?.[0]?.maybeTrapped)return null;
 const active=req.side?.pokemon?.find(p=>p.active);
 if(!active)return null;
 const self=nameOf(active.details),foe=nameOf(bot.foeActive||'');
 const rule=pivots.find(x=>x[0]===self&&x[1]===foe);
 if(!rule||!bench(req).some(x=>nameOf(x.p.details)===rule[2]))return null;
 return switchTo(req,rule[2]);
}
const first=(log,ownSide,foeSide)=>{
 const e=executedEvents(log,ownSide,foeSide,2);
 return {ownT1:eventSignature(e.own,1),ownT2:eventSignature(e.own,2),
   foeT1:eventSignature(e.rival,1),foeT2:eventSignature(e.rival,2)};
};
const faintCount=(log,side)=>log.split('\n').filter(x=>x.startsWith('|faint|'+side+'a:')).length;
// Observable bench participation is NOT a damage or human-win-rate estimate.
function benchContinuation(log,ownSide,foeSide,three){
 const moves=executedEvents(log,ownSide,foeSide,1000).own
  .filter(e=>e.turn>=3&&e.kind==='move');
 const counts=Object.fromEntries(three.slice(1).map(s=>[s,0]));
 for(const e of moves){
  const actor=e.actor.toLowerCase();
  // Showdown's active name for Rotom-Wash is commonly just "Rotom".
  const s=three.slice(1).find(x=>{
   const species=x.toLowerCase();
   return actor===species||actor.startsWith(species+'-')||
    (species==='rotom-wash'&&actor==='rotom');
  });
  if(s)counts[s]++;
 }
 return {postT2OwnExecutedMoves:moves.length,
  benchExecutedMoveCounts:counts,
  benchWithExecutedMove:Object.keys(counts).filter(s=>counts[s]>0)};
}
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
test('H-M11/H-M12 public pivot uses only active species and selected bench',()=>{
 const req=(s,b)=>({side:{pokemon:[{details:s+', L50',active:true,condition:'100/100'},
   ...b.map(x=>({details:x+', L50',active:false,condition:'100/100'}))]}});
 for(const [self,foe,target] of pivots){
  assert.equal(publicPivot(req(self,[target,'Primarina']),{foeActive:foe},{turn:1}),'switch 2');
  assert.equal(publicPivot(req(self,['Primarina']),{foeActive:foe},{turn:1}),null);
  assert.equal(publicPivot(req(self,[target]),{foeActive:foe},{turn:2}),null);
  const trapped=req(self,[target]);trapped.active=[{trapped:true}];
  assert.equal(publicPivot(trapped,{foeActive:foe},{turn:1}),null);
  const maybeTrapped=req(self,[target]);maybeTrapped.active=[{maybeTrapped:true}];
  assert.equal(publicPivot(maybeTrapped,{foeActive:foe},{turn:1}),null);
 }
});
test('H-M11/H-M12 fixture and own three are legal in pinned M-C',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc');
 assert.equal(cases.length,2);assert.equal(candidates.length,5);
 assert.deepEqual([...candidates[0].three].sort(),[...candidates[1].three].sort(),
   'A/A2 must compare only the lead for the same selected three');
 assert.notEqual(candidates[0].three[0],candidates[1].three[0],
   'A/A2 must have different leads');
 for(const c of cases){
  assert.equal(c.team.length,6,c.id);
  assert.equal(new Set(c.team.map(x=>x.species)).size,6,c.id);
  assert.equal(new Set(c.team.map(x=>x.item)).size,6,c.id+' item clause');
  assert.ok(!v.validateTeam(normalize(c.team))?.length,c.id+' TeamValidator');
  for(const t of c.rival){
   assert.equal(new Set(t).size,3,c.id+' rival trio');
   assert.ok(t.every(s=>c.team.some(x=>x.species===s)),c.id+' rival subset');
  }
 }
 assert.ok(!v.validateTeam(normalize(own))?.length,'reported live roster');
 for(const x of candidates)assert.ok(x.three.every(s=>own.some(p=>p.species===s)),x.id);
});
test('H-M11/H-M12 preregistered paired full battles and bench survival',{skip},async t=>{
 const sim=load(),paired=new Map(),rows=[];
 let games=0,errors=0,pivotPairs=0,noPivotPairs=0;
 const observed={ownImmunity:0,previouslyObserved:0,changedThisTurn:0,
   forced:0,lockedSwitchAvailable:0,lockedSwitchUnknown:0,unchangedUnforced:0};
 const examples=[],unforcedExamples=[],lockedSwitchExamples=[];
 for(const [ci,c] of cases.entries())
 for(const [ri,foeThree] of c.rival.entries())
 for(const policy of ['autonomous','public-pivot-T1']){
  const row={case:c.id,foeThree,policy,candidates:{}};
  for(const x of candidates){
   const out={three:x.three,wins:0,losses:0,requestedPivots:0,
     ownImmune:0,previouslyObserved:0,lossWithAllFoeAlive:0,
     ownT1T2:0,foeT1T2:0,benchMoveUsersInLosses:0,firstLoss:null};
   const ownActions=[],foeActions=[];
   for(let si=0;si<2;si++)for(const reverse of [false,true]){
    // Policy intentionally excluded from seed; paired controls must be causal.
    const seed=hashSeed(11031500+ci*1000+ri*100+si);
    let requested=false;
    const script=policy==='public-pivot-T1'?
      (req,bot,info)=>{const choice=publicPivot(req,bot,info);
       if(choice)requested=true;return choice;}:null;
    const r=await battle(sim,clone(own),clone(c.team),seed,{
      ownThree:x.three,foeThree,reverse,script,rivalImmuneAware:true
    });
    assert.equal(r.errors,0,'legal Showdown choices');
    const actions=first(r.log,r.ownSide,r.foeSide);
    const key=[ci,ri,x.id,si,reverse].join(':');
    if(policy==='autonomous')paired.set(key,{won:r.won,actions});
    else{
     const prev=paired.get(key);assert.ok(prev,'paired autonomous result');
     if(!requested){
      assert.equal(r.won,prev.won,'no requested pivot same outcome');
      assert.deepEqual(actions,prev.actions,'no requested pivot same T1/T2');
      noPivotPairs++;
     }else{
      assert.match(actions.foeT1,/switch:/,'requested pivot actually executed');
      pivotPairs++;
     }
    }
    const events=classifyExecutedImmunities(r.log,r.ownSide,r.foeSide,r.reqLog);
    const immuneLogged=r.log.split('\n').filter(l=>l.startsWith('|-immune|'+r.foeSide+'a:')).length;
    assert.equal(events.length,immuneLogged,'every own immune is classified');
    observed.ownImmunity+=events.length;out.ownImmune+=events.length;
    for(const e of events){
     if(e.previouslyObservedSameStintImmunity){
      observed.previouslyObserved++;out.previouslyObserved++;
      if(examples.length<10)examples.push({case:c.id,foeThree,own:x.id,
       policy,turn:e.turn,move:e.move,target:e.target,
       forced:e.locked,prior:e.priorSameStintCount,seed,reverse});
     }
     if(e.classification==='defender-changed-this-turn')observed.changedThisTurn++;
     if(e.classification==='forced-request')observed.forced++;
     if(e.classification==='locked-move-switch-unknown')observed.lockedSwitchUnknown++;
     if(e.classification==='locked-move-switch-available'){
      observed.lockedSwitchAvailable++;
      if(lockedSwitchExamples.length<12)lockedSwitchExamples.push({case:c.id,foeThree,
       own:x.id,policy,turn:e.turn,move:e.move,target:e.target,
       lockReason:e.lockReason,prior:e.priorSameStintCount,seed,reverse});
     }
     if(e.classification==='unchanged-target-unforced-request'){
      observed.unchangedUnforced++;
      if(unforcedExamples.length<12)unforcedExamples.push({case:c.id,foeThree,
       own:x.id,policy,turn:e.turn,move:e.move,target:e.target,
       prior:e.priorSameStintCount,seed,reverse});
     }
    }
    games++;errors+=r.errors;
    out.wins+=Number(r.won);out.losses+=Number(!r.won);
    out.requestedPivots+=Number(requested);
    if(!r.won){
     const continuation=benchContinuation(r.log,r.ownSide,r.foeSide,x.three);
     if(continuation.benchWithExecutedMove.length)out.benchMoveUsersInLosses++;
     if(faintCount(r.log,r.foeSide)===0)out.lossWithAllFoeAlive++;
     if(!out.firstLoss)out.firstLoss={seed,reverse,turns:r.turns,
       foeFaints:faintCount(r.log,r.foeSide),actions,continuation,
       early:earlyLines(r.log,r.ownSide,4)};
    }
    ownActions.push(actions.ownT1+' / '+actions.ownT2);
    foeActions.push(actions.foeT1+' / '+actions.foeT2);
   }
   assert.equal(out.wins+out.losses,4);
   out.ownT1T2=new Set(ownActions).size;
   out.foeT1T2=new Set(foeActions).size;
   row.candidates[x.id]=out;
  }
  rows.push(row);
 }
 assert.equal(games,240);assert.equal(errors,0);
 assert.equal(pivotPairs+noPivotPairs,120);
 assert.ok(noPivotPairs>0);
 assert.equal(observed.ownImmunity,
  observed.changedThisTurn+observed.forced+observed.lockedSwitchAvailable+
  observed.lockedSwitchUnknown+observed.unchangedUnforced,
  'every observed immunity must have a documented decision/switch classification');
 t.diagnostic('M7_HM11_HM12_PREDECLARED '+JSON.stringify({
   preregistered:'PR104 comment 6588145004',synthetic:true,
   humanWinRate:false,foeTrioPreselectedForStress:true,
   rosterAdopted:false,independentSeedsPerCell:2,sideReversals:2,
   games,errors,pivotPairs,noPivotPairs,observed,examples,unforcedExamples,lockedSwitchExamples,rows
 }));
});
