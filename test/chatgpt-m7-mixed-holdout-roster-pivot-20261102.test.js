'use strict';
// 2026-11-02 22 JST: frozen BEFORE running. PR #104 comment #6578029591.
// H-M3/H-M4 are synthetic previously uncombined public-six hypotheses.
// Five human-authored own 3+lead options, one being a NON-ADOPTED six-mon swap.
// Opponent sees the candidate's public six in the game; opponent three/lead
// are frozen controlled hypotheses, NOT guaranteed rational for either roster.
// No opponent hidden set, trio, future move, or result enters own selection.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize,hashSeed}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes,variants}=require('../fixtures');
const {teams}=require('../holdout-20261030');
const {battle,earlyLines,bench,nameOf,switchTo}=require('../encore-lead-audit');
const {executedEvents,eventSignature}=require('../public-execution-audit');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const clone=x=>structuredClone(x);
const get=(team,s)=>clone(team.find(x=>x.species===s));
const baseline=reportedLive();
const swapped=[...clone(baseline).filter(x=>x.species!=='Tyranitar'),
  get(archetypes.rain,'Rillaboom')];
const cases=[
 {id:'H-M3-rain-steel-grass-scarf',
  team:[get(archetypes.rain,'Pelipper'),get(archetypes.rain,'Swampert'),
    get(archetypes.rain,'Gholdengo'),get(archetypes.rain,'Rillaboom'),
    get(variants.C_master,'Skeledirge'),get(variants.C_master,'Garchomp')],
  rival:[['Pelipper','Swampert','Gholdengo'],
    ['Rillaboom','Garchomp','Skeledirge'],
    ['Gholdengo','Pelipper','Rillaboom']]},
 {id:'H-M4-sun-fastwater-steel-bulk',
  team:[get(teams().new_sun_balance.team,'Charizard'),
    get(variants.A_rillaboom,'Starmie'),get(archetypes.rain,'Gholdengo'),
    get(archetypes.stall,'Umbreon'),get(variants.C_master,'Corviknight'),
    get(variants.C_master,'Primarina')],
  rival:[['Charizard','Starmie','Gholdengo'],
    ['Starmie','Umbreon','Charizard'],
    ['Gholdengo','Primarina','Corviknight']]}
];
const candidates=[
 {id:'A_reported',team:baseline,three:['Hydreigon','Metagross','Rotom-Wash']},
 {id:'B_rotom',team:baseline,three:['Rotom-Wash','Metagross','Primarina']},
 {id:'C_scarf',team:baseline,three:['Garchomp','Rotom-Wash','Metagross']},
 {id:'D_sand',team:baseline,three:['Tyranitar','Metagross','Rotom-Wash']},
 {id:'E_grass_swap_RESEARCH_ONLY',team:swapped,
   three:['Rillaboom','Metagross','Rotom-Wash']}
];
// The opponent uses only its own request/selected bench and the publicly
// visible opposing ACTIVE species. This is not a claimed human-optimal pivot.
function publicPivot(req,bot,info){
 if(info.turn!==1||req.teamPreview||req.forceSwitch)return null;
 const active=req.side?.pokemon?.find(p=>p.active);
 if(!active)return null;
 const self=nameOf(active.details),visible=nameOf(bot.foeActive||'');
 let target=null;
 if(self==='Pelipper'&&visible==='Rotom-Wash')target='Swampert';
 if(self==='Starmie'&&visible==='Hydreigon')target='Umbreon';
 if(self==='Gholdengo'&&visible==='Hydreigon')target='Primarina';
 if(!target)return null;
 if(!bench(req).some(x=>nameOf(x.p.details)===target))return null;
 return switchTo(req,target);
}
function first(log,ownSide,foeSide){
 const x=executedEvents(log,ownSide,foeSide,2);
 return {ownT1:eventSignature(x.own,1),ownT2:eventSignature(x.own,2),
   foeT1:eventSignature(x.rival,1),foeT2:eventSignature(x.rival,2)};
}
function faintCount(log,side){
 return log.split('\n').filter(x=>x.startsWith('|faint|'+side+'a:')).length;
}
function publicImmuneCount(log,ownSide){
 return log.split('\n').filter(x=>x.startsWith('|-immune|'+ownSide+'a:')).length;
}
test('T1 opponent pivot reads only public active and selected own bench',()=>{
 const req=(lead,benchSpecies)=>({side:{pokemon:[
  {details:lead+', L50',active:true,condition:'100/100'},
  ...benchSpecies.map(s=>({details:s+', L50',active:false,condition:'100/100'}))
 ]}});
 const info={turn:1};
 assert.equal(publicPivot(req('Pelipper',['Swampert','Gholdengo']),
  {foeActive:'Rotom-Wash'},info),'switch 2');
 assert.equal(publicPivot(req('Pelipper',['Swampert','Gholdengo']),
  {foeActive:'Hydreigon'},info),null);
 assert.equal(publicPivot(req('Pelipper',['Gholdengo']),
  {foeActive:'Rotom-Wash'},info),null);
 assert.equal(publicPivot(req('Starmie',['Umbreon','Charizard']),
  {foeActive:'Hydreigon'},info),'switch 2');
 assert.equal(publicPivot(req('Gholdengo',['Primarina','Corviknight']),
  {foeActive:'Hydreigon'},info),'switch 2');
 assert.equal(publicPivot(req('Starmie',['Umbreon','Charizard']),
  {foeActive:'Hydreigon'},{turn:2}),null);
});
test('H-M3/H-M4 predeclared public sixes, opponent trios and own swap are M-C legal',{skip},()=>{
 const sim=load(),v=sim.TeamValidator.get('gen9championsbssregmc');
 assert.equal(cases.length,2);assert.equal(candidates.length,5);
 for(const c of cases){
  assert.equal(c.team.length,6,c.id);
  assert.equal(new Set(c.team.map(x=>x.species)).size,6,c.id);
  assert.equal(new Set(c.team.map(x=>x.item)).size,6,c.id+' item clause');
  assert.ok(!v.validateTeam(normalize(c.team))?.length,c.id+' TeamValidator');
  for(const three of c.rival){
   assert.equal(new Set(three).size,3,c.id+' foe trio');
   assert.ok(three.every(s=>c.team.some(p=>p.species===s)),c.id+' foe membership');
  }
 }
 for(const c of candidates){
  assert.equal(c.team.length,6,c.id);
  assert.equal(new Set(c.team.map(x=>x.species)).size,6,c.id);
  assert.equal(new Set(c.team.map(x=>x.item)).size,6,c.id+' item clause');
  assert.ok(!v.validateTeam(normalize(c.team))?.length,c.id+' TeamValidator');
  assert.equal(new Set(c.three).size,3,c.id);
  assert.ok(c.three.every(s=>c.team.some(p=>p.species===s)),c.id);
 }
 assert.deepEqual(swapped.map(x=>x.species).sort(),
  [...baseline.filter(x=>x.species!=='Tyranitar').map(x=>x.species),'Rillaboom'].sort());
});
test('frozen mixed public sixes: rational-pivot counterfactual and roster-swap control in FULL battles',{skip},async t=>{
 const sim=load(),rows=[],paired=new Map();
 let games=0,errors=0,immuneEvents=0,requestedPivots=0,noPivotPairs=0,pivotPairs=0;
 for(const [ci,c] of cases.entries())
 for(const [ri,foeThree] of c.rival.entries())
 for(const [pi,policy] of ['autonomous','public-pivot-T1'].entries()){
  const row={case:c.id,foeThree,foeLead:foeThree[0],policy,candidates:{}};
  for(const candidate of candidates){
   const out={three:candidate.three,rosterSwap:candidate.id.startsWith('E_'),
     wins:0,losses:0,requestedPivots:0,observedImmune:0,
     distinctOwnT1T2:0,distinctFoeT1T2:0,lossWithFoeThreeAlive:0,
     firstLoss:null};
   const ownActions=[],foeActions=[];
   for(let si=0;si<2;si++)for(const reverse of [false,true]){
    // Corrected paired A/B: same RNG seed for BOTH opponent T1 policies.
    const seed=hashSeed(11021100+ci*1000+ri*100+si);
    let requested=false;
    const script=policy==='public-pivot-T1'?
      (req,bot,info)=>{const choice=publicPivot(req,bot,info);
        if(choice)requested=true;return choice;}:null;
    const r=await battle(sim,clone(candidate.team),clone(c.team),seed,{
      ownThree:candidate.three,foeThree,reverse,script,
      rivalImmuneAware:true
    });
    assert.equal(r.errors,0,'all Showdown requests must be legal');
    const a=first(r.log,r.ownSide,r.foeSide);
    const pairKey=[ci,ri,candidate.id,si,reverse].join(':');
    if(policy==='autonomous'){paired.set(pairKey,{won:r.won,actions:a});}
    else {
      const old=paired.get(pairKey);
      assert.ok(old,'autonomous control must precede policy arm');
      if(!requested){
        assert.equal(r.won,old.won,'no T1 pivot: win must be invariant on same seed');
        assert.deepEqual(a,old.actions,'no T1 pivot: T1/T2 must be invariant');
        noPivotPairs++;
      }else pivotPairs++;
    }
    if(requested){
      assert.match(a.foeT1,/switch:/,'public pivot must execute on T1');
      out.requestedPivots++;requestedPivots++;
    }
    games++;errors+=r.errors;out.wins+=Number(r.won);out.losses+=Number(!r.won);
    ownActions.push(a.ownT1+' / '+a.ownT2);
    foeActions.push(a.foeT1+' / '+a.foeT2);
    const immune=publicImmuneCount(r.log,r.ownSide);
    out.observedImmune+=immune;immuneEvents+=immune;
    if(!r.won){
      if(faintCount(r.log,r.foeSide)===0)out.lossWithFoeThreeAlive++;
      if(!out.firstLoss)out.firstLoss={seed,reverse,turns:r.turns,
        foeFaints:faintCount(r.log,r.foeSide),actions:a,
        early:earlyLines(r.log,r.ownSide,3)};
    }
   }
   assert.equal(out.wins+out.losses,4,'2 independent seeds x 2 sides');
   out.distinctOwnT1T2=new Set(ownActions).size;
   out.distinctFoeT1T2=new Set(foeActions).size;
   row.candidates[candidate.id]=out;
  }
  rows.push(row);
 }
 assert.equal(games,2*3*2*5*2*2);
 t.diagnostic('M7_FROZEN_MIXED_PUBLIC6_ROSTER_SWAP_PIVOT '+JSON.stringify({
  predeclaredAt:'PR104 issuecomment-6578029591',
  holdoutIsSynthetic:true,opponentRationalityCertified:false,
  selectedOpponentThreeFixedAcrossDifferentOwnPublicSix:true,
  ownSelectionDoesNotReadOpponentHiddenSet:true,
  rosterSwapAdopted:false,independentSeedsPerCell:2,sideReversals:2,
  games,errors,immuneEvents,requestedPivots,noPivotPairs,pivotPairs,
  pairedPolicySeed:true,priorPolicyComparisonInvalid:'PR104 issuecomment-6578158667',rows
 }));
});
