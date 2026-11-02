'use strict';
// Predeclared before results: PR #104 comment #6579814402.
// LLM-authored trio+lead hypotheses with explicit bench coverage.
// New mixed public sixes are synthetic combinations of existing fixtures,
// not sampled ladder teams. Do not infer a human win rate.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize,hashSeed}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes,variants}=require('../fixtures');
const {teams}=require('../holdout-20261030');
const {battle,bench,nameOf,switchTo,earlyLines}=require('../encore-lead-audit');
const {executedEvents,eventSignature}=require('../public-execution-audit');
const clone=x=>structuredClone(x);
const get=(t,s)=>clone(t.find(p=>p.species===s));
const baseline=reportedLive();
const cases=[
  {id:'H-M5-dual-weather-fastwater-steel-grass',
    team:[get(teams().new_sun_balance.team,'Charizard'),
      get(variants.A_rillaboom,'Starmie'),get(archetypes.rain,'Gholdengo'),
      get(archetypes.rain,'Pelipper'),get(archetypes.rain,'Swampert'),
      get(archetypes.rain,'Rillaboom')],
    rival:[['Charizard','Starmie','Gholdengo'],
      ['Pelipper','Swampert','Rillaboom'],
      ['Gholdengo','Charizard','Swampert']]},
  {id:'H-M6-rain-steel-bulk-fire',
    team:[get(archetypes.rain,'Pelipper'),get(archetypes.rain,'Swampert'),
      get(archetypes.rain,'Gholdengo'),get(variants.C_master,'Corviknight'),
      get(variants.C_master,'Primarina'),get(variants.C_master,'Skeledirge')],
    rival:[['Pelipper','Swampert','Gholdengo'],
      ['Gholdengo','Corviknight','Primarina'],
      ['Skeledirge','Primarina','Swampert']]}
];
const candidates=[
  {id:'D_existing_sand',three:['Tyranitar','Metagross','Rotom-Wash']},
  {id:'F_rock_electric_dark',three:['Tyranitar','Rotom-Wash','Hydreigon']},
  {id:'G_electric_dark_rock',three:['Rotom-Wash','Hydreigon','Tyranitar']},
  {id:'H_rock_fairy_dark',three:['Tyranitar','Primarina','Hydreigon']},
  {id:'C_existing_scarf',three:['Garchomp','Rotom-Wash','Metagross']}
];
function publicPivot(req,bot,info){
  if(info.turn!==1||req.teamPreview||req.forceSwitch)return null;
  const active=req.side?.pokemon?.find(p=>p.active);
  if(!active)return null;
  const self=nameOf(active.details),foe=nameOf(bot.foeActive||'');
  let target=null;
  if(self==='Charizard'&&foe==='Tyranitar')target='Starmie';
  if(self==='Pelipper'&&foe==='Rotom-Wash')target='Swampert';
  if(self==='Gholdengo'&&foe==='Tyranitar')target='Swampert';
  if(self==='Starmie'&&foe==='Rotom-Wash')target='Rillaboom';
  if(!target||!bench(req).some(x=>nameOf(x.p.details)===target))return null;
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
function immuneCount(log,side){
  return log.split('\n').filter(x=>x.startsWith('|-immune|'+side+'a:')).length;
}
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
test('H-M5/H-M6 frozen public six, item clause and all trios legal',{skip},()=>{
  const v=load().TeamValidator.get('gen9championsbssregmc');
  assert.equal(cases.length,2);assert.equal(candidates.length,5);
  for(const c of cases){
    assert.equal(c.team.length,6,c.id);
    assert.equal(new Set(c.team.map(x=>x.species)).size,6,c.id);
    assert.equal(new Set(c.team.map(x=>x.item)).size,6,c.id+' item clause');
    assert.ok(!v.validateTeam(normalize(c.team))?.length,c.id+' validator');
    for(const t of c.rival){
      assert.equal(new Set(t).size,3,c.id+' trio');
      assert.ok(t.every(s=>c.team.some(p=>p.species===s)),c.id+' membership');
    }
  }
  assert.ok(!v.validateTeam(normalize(baseline))?.length,'reported roster legal');
  for(const x of candidates){
    assert.equal(new Set(x.three).size,3,x.id);
    assert.ok(x.three.every(s=>baseline.some(p=>p.species===s)),x.id);
  }
});
test('H-M5/H-M6 predeclared LLM bench-coverage trios with rational T1 pivot controls in FULL Showdown battles',{skip},async t=>{
  const sim=load(),rows=[],paired=new Map();
  let games=0,errors=0,immuneEvents=0,requestedPivots=0,noPivotPairs=0,pivotPairs=0;
  for(const [ci,c] of cases.entries())
  for(const [ri,foeThree] of c.rival.entries())
  for(const policy of ['autonomous','public-pivot-T1']){
    const row={case:c.id,foeThree,policy,candidates:{}};
    for(const x of candidates){
      const out={three:x.three,wins:0,losses:0,pivots:0,
        distinctOwnT1T2:0,distinctFoeT1T2:0,
        lossWithAllFoeAlive:0,firstLoss:null};
      const ownActions=[],foeActions=[];
      for(let si=0;si<2;si++)for(const reverse of [false,true]){
        const seed=hashSeed(11021200+ci*1000+ri*100+si);
        let requested=false;
        const script=policy==='public-pivot-T1'?
          (req,bot,info)=>{const choice=publicPivot(req,bot,info);
            if(choice)requested=true;return choice;}:null;
        const r=await battle(sim,clone(baseline),clone(c.team),seed,{
          ownThree:x.three,foeThree,reverse,script,rivalImmuneAware:true
        });
        assert.equal(r.errors,0,'legal Showdown requests');
        const actions=first(r.log,r.ownSide,r.foeSide);
        const key=[ci,ri,x.id,si,reverse].join(':');
        if(policy==='autonomous')paired.set(key,{won:r.won,actions});
        else{
          const old=paired.get(key);
          assert.ok(old,'same seed autonomous baseline must exist');
          if(!requested){
            assert.equal(r.won,old.won,'no pivot => identical outcome');
            assert.deepEqual(actions,old.actions,'no pivot => identical T1/T2');
            noPivotPairs++;
          }else{
            assert.match(actions.foeT1,/switch:/,'requested T1 pivot executed');
            pivotPairs++;
          }
        }
        if(requested){out.pivots++;requestedPivots++;}
        games++;errors+=r.errors;out.wins+=Number(r.won);out.losses+=Number(!r.won);
        ownActions.push(actions.ownT1+' / '+actions.ownT2);
        foeActions.push(actions.foeT1+' / '+actions.foeT2);
        immuneEvents+=immuneCount(r.log,r.ownSide);
        if(!r.won){
          if(faintCount(r.log,r.foeSide)===0)out.lossWithAllFoeAlive++;
          if(!out.firstLoss)out.firstLoss={seed,reverse,turns:r.turns,
            foeFaints:faintCount(r.log,r.foeSide),actions,
            early:earlyLines(r.log,r.ownSide,3)};
        }
      }
      assert.equal(out.wins+out.losses,4);
      out.distinctOwnT1T2=new Set(ownActions).size;
      out.distinctFoeT1T2=new Set(foeActions).size;
      row.candidates[x.id]=out;
    }
    rows.push(row);
  }
  assert.equal(games,2*3*2*5*2*2);
  assert.equal(noPivotPairs+pivotPairs,games/2);
  assert.ok(noPivotPairs>0,'must include unchanged policy controls');
  assert.ok(pivotPairs>0,'must actually execute at least one T1 pivot');
  t.diagnostic('M7_LLM_BENCH_COVERAGE_PREDECLARED '+JSON.stringify({
    predeclaredAt:'PR104 issuecomment-6579814402',
    syntheticPublicSix:true,humanOpponentOptimalityNotCertified:true,
    enemyThreeFixedForControlledSensitivity:true,
    selectionNeverReadsHiddenOpponentSet:true,independentSeedsPerCell:2,
    sideReversals:2,pairedPolicySeed:true,rosterAdopted:false,
    games,errors,immuneEvents,requestedPivots,noPivotPairs,pivotPairs,rows
  }));
});
