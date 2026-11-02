'use strict';
// 2026-11-02 predeclared at PR #104 comment #6569056635 BEFORE test execution.
// Full pinned M-C Showdown: is a Primarina lead an actual strategic response
// or does a public-information-only Gholdengo pivot break the win line?
// Existing U-K/U-L are REUSED diagnostic fixtures, not a new holdout.
// The opponent's complete known OWN set is allowed; our unseen moves/items and
// actual opponent three/sets are not used in selection or pivot decisions.
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {load,hashSeed,normalize}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes,variants}=require('../fixtures');
const {teams}=require('../holdout-20261030');
const {battle,switchTo,earlyLines}=require('../encore-lead-audit');
const {executedEvents,eventSignature}=require('../public-execution-audit');
const {assessPublicBranchRobustness}=require('../public-branch-robustness');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const clone=x=>structuredClone(x);
const from=(team,s)=>clone(team.find(x=>x.species===s));
const own=reportedLive();
const scenarios=[
 {id:'U-L-mega-setup',
  team:[from(archetypes.setup,'Salamence'),from(archetypes.setup,'Volcarona'),
    from(archetypes.setup,'Gholdengo'),from(archetypes.stall,'Toxapex'),
    from(archetypes.stall,'Skarmory'),from(archetypes.setup,'Rillaboom')],
  trio:['Salamence','Volcarona','Gholdengo']},
 {id:'U-K-sun-ground',
  team:[from(teams().new_sun_balance.team,'Charizard'),
    from(variants.C_master,'Garchomp'),from(variants.A_rillaboom,'Gholdengo'),
    from(variants.A_rillaboom,'Primarina'),from(variants.A_rillaboom,'Rillaboom'),
    from(archetypes.stall,'Umbreon')],
  trio:['Charizard','Garchomp','Gholdengo']}
];
const candidates={
 A_reported:['Hydreigon','Metagross','Rotom-Wash'],
 B_metagross:['Metagross','Hydreigon','Rotom-Wash'],
 P1_primarina_hydreigon_metagross:['Primarina','Hydreigon','Metagross'],
 P2_primarina_rotom_metagross:['Primarina','Rotom-Wash','Metagross'],
 P3_primarina_hydreigon_rotom:['Primarina','Hydreigon','Rotom-Wash']
};
function publicPivotToGholdengo(req,bot,info){
 if(info.turn!==1||req.teamPreview||req.forceSwitch||req.active?.[0]?.trapped)return null;
 // The opposing side is allowed to observe the Pokemon species at our lead,
 // but never our move set, item, EVs, planned actions or bench.
 if(!String(bot.foeActive||'').startsWith('Primarina'))return null;
 const found=req.side.pokemon.some(p=>!p.active&&String(p.details||'').startsWith('Gholdengo')&&
  !String(p.condition||'').endsWith(' fnt'));
 if(!found)return null;
 return switchTo(req,'Gholdengo');
}
function first(log,ownSide){
 const enemy=ownSide==='p1'?'p2':'p1';
 const ex=executedEvents(log,ownSide,enemy);
 return {oursT1:eventSignature(ex.own,1),enemyT1:eventSignature(ex.rival,1),
   oursT2:eventSignature(ex.own,2),enemyT2:eventSignature(ex.rival,2)};
}
test('predeclared M-7 lead portfolio and U-K/U-L pivot threats are legal',{skip},()=>{
 const sim=load(),v=sim.TeamValidator.get('gen9championsbssregmc');
 assert.ok(!v.validateTeam(normalize(own))?.length);
 for(const c of scenarios){
  assert.ok(!v.validateTeam(normalize(c.team))?.length,c.id);
  assert.equal(new Set(c.team.map(p=>p.species)).size,6);
  assert.equal(new Set(c.trio).size,3);
  assert.ok(c.trio.every(s=>c.team.some(x=>x.species===s)));
  assert.ok(c.trio.includes('Gholdengo'));
 }
 for(const [name,three] of Object.entries(candidates)){
  assert.equal(new Set(three).size,3,name);
  assert.ok(three.every(s=>own.some(x=>x.species===s)),name);
 }
 // The strategy can inspect only public species, not known hidden own sets.
 assert.equal(publicPivotToGholdengo({teamPreview:false,forceSwitch:false,active:[{}],
   side:{pokemon:[{active:true,details:'Salamence, L50',condition:'100/100'},
      {active:false,details:'Gholdengo, L50',condition:'100/100'}]}},
   {foeActive:'Primarina'},{turn:1}),'switch 2');
 assert.equal(publicPivotToGholdengo({teamPreview:false,forceSwitch:false,active:[{}],
   side:{pokemon:[{active:true,details:'Salamence, L50',condition:'100/100'},
      {active:false,details:'Gholdengo, L50',condition:'100/100'}]}},
   {foeActive:'Hydreigon'},{turn:1}),null);
});
test('public Primarina lead vs rational Gholdengo pivot: full M-C 3v3 diagnostic',{skip},async t=>{
 const sim=load(),rows=[],counts={games:0,errors:0,requiredPivot:0,actualPivots:0};
 for(const [ci,c] of scenarios.entries())for(const mode of ['autonomous','public-primarina-pivot']){
  const row={case:c.id,opponentThree:c.trio,opponentT1:mode,alternatives:{}};
  for(const [name,three] of Object.entries(candidates)){
   const out={three,wins:0,losses:0,t1:[],t2:[],fullActionHashes:[],decisionSamples:[],lossExample:null};
   for(let s=0;s<2;s++)for(const reverse of [false,true]){
    const seed=hashSeed(11027000+ci*100+s);
    const r=await battle(sim,clone(own),clone(c.team),seed,{
      ownThree:three,foeThree:c.trio,reverse,
      script:mode==='public-primarina-pivot'?publicPivotToGholdengo:null,
      rivalImmuneAware:true
    });
    assert.equal(r.errors,0,'all Showdown choices must execute');
    counts.games++;counts.errors+=r.errors;
    out.wins+=Number(r.won);out.losses+=Number(!r.won);
    const a=first(r.log,r.ownSide);
    out.t1.push(a.oursT1+' | '+a.enemyT1);
    out.t2.push(a.oursT2+' | '+a.enemyT2);
    // Full executed actions may vary due to RNG/forced replacements. Counting
    // different action traces does NOT imply distinct rational strategies.
    const events=executedEvents(r.log,r.ownSide,r.foeSide,Infinity);
    const fullHash=createHash('sha256').update(JSON.stringify(events)).digest('hex').slice(0,16);
    out.fullActionHashes.push(fullHash);
    out.decisionSamples.push({seed,reverse,won:r.won,fullHash});
    if(!r.won&&!out.lossExample)
      out.lossExample={seed,reverse,firstTurns:earlyLines(r.log,r.ownSide,3)};
    if(mode==='public-primarina-pivot'&&three[0]==='Primarina'){
      counts.requiredPivot++;
      assert.match(a.enemyT1,/switch:Gholdengo/,'public pivot must actually execute at T1');
      counts.actualPivots++;
    }
   }
   assert.equal(out.wins+out.losses,4);
   const early=out.t1.map((x,i)=>x+' / '+out.t2[i]);
   out.distinctT1=new Set(out.t1).size;
   out.distinctT2=new Set(out.t2).size;
   out.distinctT1T2=new Set(early).size;
   out.distinctFullActionTraces=new Set(out.fullActionHashes).size;
   // Two independent RNG seeds x two seat reversals do not equal four
   // independently chosen policies. These are reproducible observations.
   out.independentSeedValues=2;
   out.seatReversalsPerSeed=2;
   out.allFourRepeatT1T2=out.distinctT1T2===1;
   row.alternatives[name]=out;
  }
  rows.push(row);
 }
 assert.equal(counts.games,80);
 assert.equal(counts.requiredPivot,2*3*2*2);
 assert.equal(counts.actualPivots,counts.requiredPivot);
 // Cross-policy audit: a win against the stay-in Bot is NOT transferable
 // if a public-species-only pivot reverses it. No frequencies are invented.
 const robustness=assessPublicBranchRobustness(rows);
 assert.equal(robustness.byCandidate.P1_primarina_hydreigon_metagross.cases['U-L-mega-setup'].bestWins,4);
 assert.equal(robustness.byCandidate.P1_primarina_hydreigon_metagross.cases['U-L-mega-setup'].worstWins,0);
 assert.equal(robustness.byCandidate.P1_primarina_hydreigon_metagross.cases['U-K-sun-ground'].bestWins,4);
 assert.equal(robustness.byCandidate.P1_primarina_hydreigon_metagross.cases['U-K-sun-ground'].worstWins,0);
 assert.equal(robustness.byCandidate.P2_primarina_rotom_metagross.cases['U-L-mega-setup'].worstWins,2);
 assert.equal(robustness.byCandidate.P2_primarina_rotom_metagross.cases['U-K-sun-ground'].worstWins,0);
 assert.ok(Object.values(robustness.byCandidate).every(x=>!x.supportedAcrossAllTestedBranches),
   'none of these five preregistered candidates survives every tested counter-branch');
 const allOutcomes=rows.flatMap(r=>Object.values(r.alternatives));
 const diversity={cells:allOutcomes.length,games:counts.games,
  repeatedT1T2Cells:allOutcomes.filter(x=>x.allFourRepeatT1T2).length,
  repeatedFullActionTraceCells:allOutcomes.filter(x=>x.distinctFullActionTraces===1).length,
  distinctEarlyPerCell:allOutcomes.map(x=>x.distinctT1T2),
  distinctFullPerCell:allOutcomes.map(x=>x.distinctFullActionTraces),
  seedValuesPerCell:2,seatReversalsPerSeed:2,
  warning:'4/4 is four reproducible outcomes, NOT four independent strategic decisions; identical T1/T2 traces are near-duplicates; even distinct full-action traces may be RNG rather than rationality'};
 assert.equal(diversity.cells,20,'20 scenario x opponent policy x selection cells');
 assert.ok(diversity.repeatedT1T2Cells>=0&&diversity.repeatedT1T2Cells<=20);
 t.diagnostic('M7_DECISION_DIVERSITY '+JSON.stringify(diversity));
 t.diagnostic('M7_PUBLIC_BRANCH_ROBUSTNESS '+JSON.stringify(robustness));
 t.diagnostic('M7_PUBLIC_PIVOT_CONTINUITY '+JSON.stringify({
  declaration:'PR104 issuecomment-6569056635',usedPublicSixes:true,newHoldout:false,
  opponentRationalityCertified:false,actualBattleWinRate:false,
  scriptedPivotKnowledge:'public opponent lead species + rival own selected 3 only',
  counts,rows
 }));
});

test('public pivot counterfactual cannot read our private set/item or actual opposing selection',{skip},()=>{
 const publicRequest={
  teamPreview:false,forceSwitch:false,active:[{trapped:false}],
  side:{pokemon:[
   {active:true,details:'Salamence, L50',condition:'180/180'},
   {active:false,details:'Gholdengo, L50',condition:'150/150'},
   {active:false,details:'Volcarona, L50',condition:'160/160'}]}
 };
 const before=publicPivotToGholdengo(clone(publicRequest),
  {foeActive:'Primarina',privateUnknownMoves:['Moonblast'],privateUnknownItem:'Choice Scarf'},{turn:1});
 const after=publicPivotToGholdengo(clone(publicRequest),
  {foeActive:'Primarina',privateUnknownMoves:['Hydro Pump'],privateUnknownItem:'Leftovers'},{turn:1});
 assert.equal(before,'switch 2');
 assert.equal(after,before,'same public opponent species means same opponent switch');
 const locked=clone(publicRequest);
 locked.active[0].trapped=true;
 assert.equal(publicPivotToGholdengo(locked,{foeActive:'Primarina'},{turn:1}),null,
  'a trapped lead must not issue an illegal switch');
});
