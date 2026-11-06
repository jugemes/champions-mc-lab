'use strict';
// Predeclared before results: PR #104 comment #6591341050.
// H-M13/H-M14 are new synthetic public-six combinations of existing legal
// fixtures, NOT samples of ladder sets, usage rates, or human win probabilities.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize,hashSeed,matchup}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes,variants}=require('../fixtures');
const {teams}=require('../holdout-20261030');
const {battle,bench,nameOf,switchTo,earlyLines}=require('../encore-lead-audit');
const {executedEvents,eventSignature,classifyPublicSwitches}=require('../public-execution-audit');
const {classifyChoiceCorroboratedSwitches}=require('../public-choice-causality');
const clone=x=>structuredClone(x);
const get=(team,s)=>{const p=team.find(x=>x.species===s);assert.ok(p,'fixture '+s);return clone(p);};
const own=reportedLive();
const cases=[
 {id:'H-M13-fast-ghost-grass-steel-stall',team:[
  get(variants.C_master,'Gengar'),get(variants.A_rillaboom,'Starmie'),
  get(variants.A_rillaboom,'Rillaboom'),get(archetypes.stall,'Skarmory'),
  get(archetypes.stall,'Umbreon'),get(archetypes.stall,'Gholdengo')],
  foe:[['Gengar','Starmie','Rillaboom'],['Skarmory','Umbreon','Gholdengo'],
       ['Gholdengo','Gengar','Rillaboom']]},
 {id:'H-M14-sun-dragon-grass-bulk',team:[
  get(teams().new_sun_balance.team,'Charizard'),get(archetypes.setup,'Dragonite'),
  get(archetypes.setup,'Rillaboom'),get(archetypes.stall,'Toxapex'),
  get(archetypes.stall,'Skarmory'),get(variants.A_rillaboom,'Starmie')],
  foe:[['Charizard','Dragonite','Rillaboom'],['Starmie','Toxapex','Skarmory'],
       ['Rillaboom','Charizard','Starmie']]}
];
const candidates=[
 {id:'A_scarf_mega_rotom',three:['Garchomp','Metagross','Rotom-Wash']},
 {id:'B_sand_rotom_dark',three:['Tyranitar','Rotom-Wash','Hydreigon']},
 {id:'C_fairy_mega_rotom',three:['Primarina','Metagross','Rotom-Wash']},
 {id:'D_mega_fairy_dark',three:['Metagross','Primarina','Hydreigon']},
 {id:'E_rotom_mega_fairy',three:['Rotom-Wash','Metagross','Primarina']}
];
const pivots=[
 ['Gengar','Tyranitar','Rillaboom'],
 ['Gholdengo','Tyranitar','Rillaboom'],
 ['Skarmory','Rotom-Wash','Umbreon'],
 ['Charizard','Tyranitar','Rillaboom'],
 ['Rillaboom','Metagross','Charizard'],
 ['Toxapex','Metagross','Skarmory'],
 ['Starmie','Rotom-Wash','Rillaboom']
];
function publicPivot(req,bot,info){
 if(info.turn!==1||req.teamPreview||req.forceSwitch)return null;
 if(req.active?.[0]?.trapped||req.active?.[0]?.maybeTrapped)return null;
 const p=req.side?.pokemon?.find(x=>x.active);
 if(!p)return null;
 const self=nameOf(p.details),foe=nameOf(bot.foeActive||'');
 const rule=pivots.find(x=>x[0]===self&&x[1]===foe);
 if(!rule||!bench(req).some(x=>nameOf(x.p.details)===rule[2]))return null;
 return switchTo(req,rule[2]);
}
function publicAttack(req,bot,info){
 if(info.turn!==1||req.teamPreview||req.forceSwitch)return null;
 const act=req.active?.[0],p=req.side?.pokemon?.find(x=>x.active);
 if(!act||!p)return null;
 const self=bot.getSet(p),foe=bot.foeActive;
 const moves=act.moves.map((m,i)=>({m,i}))
  .filter(x=>!x.m.disabled&&x.m.pp>0&&bot.dex.moves.get(x.m.id||x.m.move).category!=='Status')
  .map(x=>({...x,score:matchup(bot.dex,self,foe,x.m.id||x.m.move)}));
 moves.sort((a,b)=>b.score-a.score||a.i-b.i);
 return moves.length?'move '+(moves[0].i+1)+(act.canMegaEvo?' mega':''):null;
}
const actions=(log,ownSide,foeSide)=>{
 const e=executedEvents(log,ownSide,foeSide,2);
 return {ownT1:eventSignature(e.own,1),ownT2:eventSignature(e.own,2),
  foeT1:eventSignature(e.rival,1),foeT2:eventSignature(e.rival,2)};
};
const faintCount=(log,side)=>log.split('\n').filter(x=>x.startsWith('|faint|'+side+'a:')).length;
function benchMoves(log,ownSide,foeSide,three){
 const events=executedEvents(log,ownSide,foeSide,1000).own.filter(e=>e.kind==='move'&&e.turn>=3);
 const counts=Object.fromEntries(three.slice(1).map(s=>[s,0]));
 for(const e of events){
  const actor=e.actor.toLowerCase();
  const species=three.slice(1).find(s=>actor===s.toLowerCase()||
   (s==='Rotom-Wash'&&actor==='rotom'));
  if(species)counts[species]++;
 }
 return counts;
}
test('H-M13/H-M14 public-pivot only uses visible leads and selected legal bench',()=>{
 const req=(lead,b)=>({side:{pokemon:[{details:lead+', L50',active:true,condition:'100/100'},
  ...b.map(s=>({details:s+', L50',active:false,condition:'100/100'}))]}});
 for(const [self,foe,target] of pivots){
  const q=req(self,[target,'Hydreigon']);
  assert.equal(publicPivot(q,{foeActive:foe},{turn:1}),'switch 2');
  assert.equal(publicPivot(req(self,['Hydreigon']),{foeActive:foe},{turn:1}),null);
  assert.equal(publicPivot(q,{foeActive:foe},{turn:2}),null);
  const trapped=req(self,[target]);trapped.active=[{trapped:true}];
  assert.equal(publicPivot(trapped,{foeActive:foe},{turn:1}),null);
  const maybeTrapped=req(self,[target]);maybeTrapped.active=[{maybeTrapped:true}];
  assert.equal(publicPivot(maybeTrapped,{foeActive:foe},{turn:1}),null);
  const fainted=req(self,[target]);fainted.side.pokemon[1].condition='0 fnt';
  assert.equal(publicPivot(fainted,{foeActive:foe},{turn:1}),null);
  const forced=req(self,[target]);forced.forceSwitch=true;
  assert.equal(publicPivot(forced,{foeActive:foe},{turn:1}),null);
 }
});
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
test('H-M13/H-M14 predeclared public six, rival trios, own candidates validate',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc');
 assert.equal(cases.length,2);assert.equal(candidates.length,5);
 assert.ok(!v.validateTeam(normalize(own))?.length,'reported M-7');
 for(const c of cases){
  assert.equal(c.team.length,6,c.id);
  assert.equal(new Set(c.team.map(x=>x.species)).size,6,c.id);
  assert.equal(new Set(c.team.map(x=>x.item)).size,6,c.id+' item clause');
  assert.ok(!v.validateTeam(normalize(c.team))?.length,c.id+' validator');
  for(const trio of c.foe){
   assert.equal(new Set(trio).size,3,c.id);
   assert.ok(trio.every(s=>c.team.some(p=>p.species===s)),c.id+' trio');
  }
 }
 for(const x of candidates){
  assert.equal(new Set(x.three).size,3,x.id);
  assert.ok(x.three.every(s=>own.some(p=>p.species===s)),x.id);
 }
});
test('H-M13/H-M14 frozen cross-preview full battles with actual T1 branch coverage',{skip},async t=>{
 const sim=load(),paired=new Map(),rows=[];
 let games=0,errors=0,pivotPairs=0,attackPairs=0,noScriptPairs=0;
 const switchEvidence={own:{},rival:{}};
 const choiceEvidence={own:{},rival:{}};
 for(const [ci,c] of cases.entries())
 for(const [ri,foeThree] of c.foe.entries())
 for(const policy of ['autonomous','public-pivot-T1','public-attack-T1']){
  const row={case:c.id,foeThree,policy,candidates:{}};
  for(const x of candidates){
   const out={three:x.three,wins:0,losses:0,scriptRequests:0,
    ownFaintsInLosses:0,foeFaintsInLosses:0,
    benchWithMovesInLosses:0,lossWithNoFoeKO:0,
    firstLoss:null};
   for(let si=0;si<2;si++)for(const reverse of [false,true]){
    const seed=hashSeed(11031600+ci*1000+ri*100+si);
    let requested=null;
    const baseScript=policy==='public-pivot-T1'?publicPivot:
     policy==='public-attack-T1'?publicAttack:null;
    const script=baseScript?(req,bot,info)=>{
     const choice=baseScript(req,bot,info);
     if(choice)requested=choice;
     return choice;
    }:null;
    const r=await battle(sim,clone(own),clone(c.team),seed,{
     ownThree:x.three,foeThree,reverse,script,rivalImmuneAware:true,choiceAudit:true
    });
    assert.equal(r.errors,0,'legal Showdown choices');
    const a=actions(r.log,r.ownSide,r.foeSide);
    const key=[ci,ri,x.id,si,reverse].join(':');
    if(policy==='autonomous')paired.set(key,{won:r.won,actions:a});
    else{
     const baseline=paired.get(key);assert.ok(baseline,'paired autonomous');
     if(!requested){
      assert.equal(r.won,baseline.won,'no script request: same outcome');
      assert.deepEqual(a,baseline.actions,'no script request: same T1/T2');
      noScriptPairs++;
     }else if(policy==='public-pivot-T1'){
      assert.match(a.foeT1,/switch:/,'requested pivot executed');
      pivotPairs++;
     }else attackPairs++;
    }
    const sw=classifyPublicSwitches(r.log,r.ownSide,r.foeSide,2);
    const corroborated=classifyChoiceCorroboratedSwitches(r.log,r.ownSide,r.foeSide,r.choiceTrace,2);
    if(policy==='public-pivot-T1'&&requested){
     assert.ok(corroborated.rival.some(e=>e.turn===1&&e.botChoiceCorroborated),
      'requested T1 opponent pivot must be a normal-request submitted switch');
    }
    for(const side of ['own','rival'])for(const e of corroborated[side]){
     choiceEvidence[side][e.evidence]=(choiceEvidence[side][e.evidence]||0)+1;
    }
    for(const side of ['own','rival'])for(const e of sw[side]){
     switchEvidence[side][e.classification]=(switchEvidence[side][e.classification]||0)+1;
     assert.equal(e.provenTacticalChoice,false,'public switch not proven voluntary');
    }
    games++;errors+=r.errors;out.wins+=Number(r.won);out.losses+=Number(!r.won);
    out.scriptRequests+=Number(!!requested);
    if(!r.won){
     const ourFaints=faintCount(r.log,r.ownSide),theirFaints=faintCount(r.log,r.foeSide);
     const continuation=benchMoves(r.log,r.ownSide,r.foeSide,x.three);
     out.ownFaintsInLosses+=ourFaints;out.foeFaintsInLosses+=theirFaints;
     out.lossWithNoFoeKO+=Number(theirFaints===0);
     out.benchWithMovesInLosses+=Number(Object.values(continuation).some(n=>n>0));
     if(!out.firstLoss){
      out.firstLoss={seed,reverse,turns:r.turns,ourFaints,theirFaints,
       actions:a,benchMoveCounts:continuation,early:earlyLines(r.log,r.ownSide,5)};
     }
    }
   }
   assert.equal(out.wins+out.losses,4);
   row.candidates[x.id]=out;
  }
  rows.push(row);
 }
 assert.equal(games,360);assert.equal(errors,0);
 assert.equal(pivotPairs+attackPairs+noScriptPairs,240);
 assert.ok(noScriptPairs>0,'paired no-trigger controls');
 assert.ok(pivotPairs>0,'at least one opponent public pivot actually requested');
 t.diagnostic('M7_HM13_HM14_PREDECLARED '+JSON.stringify({
  declaredAt:'PR104 issuecomment-6591341050',synthetic:true,
  hiddenOpponentTrioNotUsedByOwnCandidate:true,
  humanRationalityNotCertified:true,notLadderWinRate:true,
  independentSeedsPerCell:2,sideReversals:2,
  games,errors,pivotPairs,attackPairs,noScriptPairs,
  switchEvidence,choiceEvidence,rows
 }));
});
