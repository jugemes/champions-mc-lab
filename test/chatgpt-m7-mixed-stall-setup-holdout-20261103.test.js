'use strict';
// Preregistered before any results: PR #104 comment #6581230099.
// H-M7/H-M8 synthetic mixed public sixes, NOT ladder samples.
// Neither candidate nor the opponent T1 script receives hidden opponent sets.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize,hashSeed}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes,variants}=require('../fixtures');
const {battle,bench,nameOf,switchTo,earlyLines}=require('../encore-lead-audit');
const {executedEvents,eventSignature}=require('../public-execution-audit');
const clone=x=>structuredClone(x);
const get=(team,s)=>{const p=team.find(x=>x.species===s);if(!p)throw Error('missing '+s);return clone(p);};
const baseline=reportedLive();
const cases=[
 {id:'H-M7-stall-steel-priority',team:[
   get(archetypes.stall,'Toxapex'),get(archetypes.stall,'Umbreon'),
   get(archetypes.stall,'Corviknight'),get(archetypes.stall,'Gholdengo'),
   get(archetypes.setup,'Dragonite'),get(variants.A_rillaboom,'Lucario')],
  rival:[['Toxapex','Umbreon','Corviknight'],
    ['Gholdengo','Dragonite','Lucario'],
    ['Corviknight','Gholdengo','Umbreon']]},
 {id:'H-M8-setup-fastwater-grass',team:[
   get(archetypes.setup,'Salamence'),get(archetypes.setup,'Volcarona'),
   get(archetypes.setup,'Dragonite'),get(archetypes.setup,'Gholdengo'),
   get(archetypes.setup,'Rillaboom'),get(variants.A_rillaboom,'Starmie')],
  rival:[['Salamence','Volcarona','Gholdengo'],
    ['Starmie','Rillaboom','Dragonite'],
    ['Gholdengo','Salamence','Starmie']]}
];
const candidates=[
 {id:'A_mega_rotom_fairy',three:['Metagross','Rotom-Wash','Primarina']},
 {id:'B_rock_electric_dark',three:['Tyranitar','Rotom-Wash','Hydreigon']},
 {id:'C_rotom_mega_fairy',three:['Rotom-Wash','Metagross','Primarina']},
 {id:'D_scarf_fairy_mega',three:['Garchomp','Primarina','Metagross']}
];
function publicPivot(req,bot,info){
 if(info.turn!==1||req.teamPreview||req.forceSwitch)return null;
 const active=req.side?.pokemon?.find(p=>p.active);
 if(!active)return null;
 const self=nameOf(active.details),foe=nameOf(bot.foeActive||'');
 const rules=[
  ['Toxapex','Metagross','Umbreon'],
  ['Gholdengo','Hydreigon','Lucario'],
  ['Salamence','Tyranitar','Gholdengo'],
  ['Starmie','Rotom-Wash','Rillaboom'],
  ['Volcarona','Garchomp','Gholdengo']
 ];
 const rule=rules.find(x=>x[0]===self&&x[1]===foe);
 if(!rule||!bench(req).some(x=>nameOf(x.p.details)===rule[2]))return null;
 return switchTo(req,rule[2]);
}
const first=(log,ownSide,foeSide)=>{
 const e=executedEvents(log,ownSide,foeSide,2);
 return {ownT1:eventSignature(e.own,1),ownT2:eventSignature(e.own,2),
   foeT1:eventSignature(e.rival,1),foeT2:eventSignature(e.rival,2)};
};
const faintCount=(log,side)=>log.split('\n').filter(x=>x.startsWith('|faint|'+side+'a:')).length;
const immuneCount=(log,side)=>log.split('\n').filter(x=>x.startsWith('|-immune|'+side+'a:')).length;
test('T1 opponent pivots require public active species and an available selected bench',()=>{
 const req=(lead,benchSpecies)=>({side:{pokemon:[
  {details:lead+', L50',active:true,condition:'100/100'},
  ...benchSpecies.map(s=>({details:s+', L50',active:false,condition:'100/100'}))
 ]}});
 const t1={turn:1};
 assert.equal(publicPivot(req('Toxapex',['Umbreon','Corviknight']),{foeActive:'Metagross'},t1),'switch 2');
 assert.equal(publicPivot(req('Toxapex',['Corviknight']),{foeActive:'Metagross'},t1),null);
 assert.equal(publicPivot(req('Gholdengo',['Lucario','Dragonite']),{foeActive:'Hydreigon'},t1),'switch 2');
 assert.equal(publicPivot(req('Salamence',['Gholdengo','Volcarona']),{foeActive:'Tyranitar'},t1),'switch 2');
 assert.equal(publicPivot(req('Starmie',['Rillaboom','Dragonite']),{foeActive:'Rotom-Wash'},t1),'switch 2');
 assert.equal(publicPivot(req('Volcarona',['Gholdengo','Salamence']),{foeActive:'Garchomp'},t1),'switch 2');
 assert.equal(publicPivot(req('Starmie',['Rillaboom']),{foeActive:'Rotom-Wash'},{turn:2}),null);
 assert.equal(publicPivot(req('Starmie',['Rillaboom']),{foeActive:'Metagross'},t1),null);
});
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
test('H-M7/H-M8 preregistered sixes, trios and item clause legal',{skip},()=>{
 const v=load().TeamValidator.get('gen9championsbssregmc');
 assert.equal(cases.length,2);assert.equal(candidates.length,4);
 for(const c of cases){
  assert.equal(c.team.length,6,c.id);
  assert.equal(new Set(c.team.map(x=>x.species)).size,6,c.id);
  assert.equal(new Set(c.team.map(x=>x.item)).size,6,c.id+' item clause');
  assert.ok(!v.validateTeam(normalize(c.team))?.length,c.id+' validator');
  for(const t of c.rival){
   assert.equal(new Set(t).size,3,c.id);
   assert.ok(t.every(s=>c.team.some(p=>p.species===s)),c.id+' trio');
  }
 }
 assert.ok(!v.validateTeam(normalize(baseline))?.length,'M-7 legal');
 for(const x of candidates){
  assert.equal(new Set(x.three).size,3,x.id);
  assert.ok(x.three.every(s=>baseline.some(p=>p.species===s)),x.id);
 }
});
test('H-M7/H-M8 full Showdown paired opponent T1 controls and bench continuity',{skip},async t=>{
 const sim=load(),rows=[],paired=new Map();
 let games=0,errors=0,ownImmuneEvents=0,foeImmuneEvents=0;
 let pivotPairs=0,noPivotPairs=0;const immuneSamples=[];
 for(const [ci,c] of cases.entries())
 for(const [ri,foeThree] of c.rival.entries())
 for(const policy of ['autonomous','public-pivot-T1']){
  const row={case:c.id,foeThree,policy,candidates:{}};
  for(const x of candidates){
   const out={three:x.three,wins:0,losses:0,requestedPivots:0,
     ownImmune:0,foeImmune:0,lossWithAllFoeAlive:0,firstLoss:null,
     distinctOwnT1T2:0,distinctFoeT1T2:0};
   const ownActions=[],foeActions=[];
   for(let si=0;si<2;si++)for(const reverse of [false,true]){
    const seed=hashSeed(11021300+ci*1000+ri*100+si);
    let requested=false;
    const script=policy==='public-pivot-T1'?
      (req,bot,info)=>{const choice=publicPivot(req,bot,info);
        if(choice)requested=true;return choice;}:null;
    const r=await battle(sim,clone(baseline),clone(c.team),seed,{
      ownThree:x.three,foeThree,reverse,script,rivalImmuneAware:true
    });
    assert.equal(r.errors,0,'Showdown legal choices');
    const actions=first(r.log,r.ownSide,r.foeSide);
    const key=[ci,ri,x.id,si,reverse].join(':');
    if(policy==='autonomous')paired.set(key,{won:r.won,actions});
    else{
     const old=paired.get(key);assert.ok(old,'paired autonomous exists');
     if(!requested){
      assert.equal(r.won,old.won,'no requested pivot outcome');
      assert.deepEqual(actions,old.actions,'no requested pivot T1/T2');
      noPivotPairs++;
     }else{
      assert.match(actions.foeT1,/switch:/,'requested pivot executed');
      pivotPairs++;
     }
    }
    const ownImm=immuneCount(r.log,r.foeSide);
    const foeImm=immuneCount(r.log,r.ownSide);
    if((ownImm||foeImm)&&immuneSamples.length<16){
      const log=r.log.split('\n');let turn=0,previousMove='';
      for(const line of log){
       if(line.startsWith('|turn|'))turn=Number(line.slice(6));
       if(line.startsWith('|move|'))previousMove=line;
       if(line.startsWith('|-immune|')&&immuneSamples.length<16)
        immuneSamples.push({case:c.id,foeThree,candidate:x.id,policy,
          seed,reverse,turn,previousMove,immuneLine:line,
          requestAtTurn:r.reqLog.filter(q=>q.turn===turn),
          rivalMasked:r.rivalImmuneAudit?.masked?.length||0});
      }
    }
    games++;errors+=r.errors;
    ownImmuneEvents+=ownImm;foeImmuneEvents+=foeImm;
    out.ownImmune+=ownImm;out.foeImmune+=foeImm;
    out.wins+=Number(r.won);out.losses+=Number(!r.won);
    if(requested)out.requestedPivots++;
    ownActions.push(actions.ownT1+' / '+actions.ownT2);
    foeActions.push(actions.foeT1+' / '+actions.foeT2);
    if(!r.won){
      if(faintCount(r.log,r.foeSide)===0)out.lossWithAllFoeAlive++;
      if(!out.firstLoss)out.firstLoss={seed,reverse,turns:r.turns,
        foeFaints:faintCount(r.log,r.foeSide),actions,
        early:earlyLines(r.log,r.ownSide,4)};
    }
   }
   assert.equal(out.wins+out.losses,4);
   out.distinctOwnT1T2=new Set(ownActions).size;
   out.distinctFoeT1T2=new Set(foeActions).size;
   row.candidates[x.id]=out;
  }
  rows.push(row);
 }
 assert.equal(games,2*3*2*4*2*2);
 assert.equal(noPivotPairs+pivotPairs,games/2);
 assert.ok(noPivotPairs>0,'unchanged policy controls exist');
 assert.ok(pivotPairs>0,'actual T1 pivot comparison exists');
 t.diagnostic('M7_MIXED_STALL_SETUP_PREDECLARED '+JSON.stringify({
  predeclaredAt:'PR104 issuecomment-6581230099',
  syntheticPublicSix:true,humanOpponentOptimalityNotCertified:true,
  opponentTrioFixedForControlledSensitivity:true,
  noHumanWinRateClaim:true,independentSeedsPerCell:2,
  sideReversals:2,pairedPolicySeed:true,rosterAdopted:false,
  games,errors,pivotPairs,noPivotPairs,ownImmuneEvents,foeImmuneEvents,
  immuneSamples,rows
 }));
});
