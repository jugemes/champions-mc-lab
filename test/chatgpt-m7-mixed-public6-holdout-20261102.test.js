'use strict';
// Predeclared BEFORE results: PR #104 comment #6573635319 (2026-11-02).
// Two NEW MIXED public-six compositions, built from existing legal fixtures.
// This is synthetic adversarial holdout, NOT ladder frequency or proof of
// human-rational enemy choices. The candidates are frozen, not a new selector.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,hashSeed,normalize}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes,variants}=require('../fixtures');
const {battle,rivalScript,earlyLines}=require('../encore-lead-audit');
const {executedEvents,eventSignature}=require('../public-execution-audit');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const copy=x=>structuredClone(x);
const get=(team,s)=>copy(team.find(x=>x.species===s));
const cases=[
 {id:'H-M1-rain-wall-priority',
  team:[get(archetypes.rain,'Pelipper'),get(archetypes.rain,'Swampert'),
    get(archetypes.rain,'Archaludon'),get(archetypes.stall,'Toxapex'),
    get(archetypes.stall,'Umbreon'),get(archetypes.rain,'Dragonite')],
  rival:[['Pelipper','Swampert','Archaludon'],
    ['Dragonite','Toxapex','Umbreon'],
    ['Pelipper','Dragonite','Toxapex']]},
 {id:'H-M2-scarf-mega-pivot',
  team:[get(variants.C_master,'Garchomp'),get(variants.C_master,'Golisopod'),
    get(variants.C_master,'Gengar'),get(archetypes.stall,'Corviknight'),
    get(archetypes.stall,'Slowbro'),get(archetypes.setup,'Rillaboom')],
  rival:[['Garchomp','Golisopod','Gengar'],
    ['Gengar','Corviknight','Slowbro'],
    ['Rillaboom','Golisopod','Slowbro']]}
];
// Public-log diagnostic only: do not infer the rival's hidden set or the
// choice made before our side's switch from the eventual immunity message.
function immuneTraces(log,ownSide,foeSide){
 let turn=0;const context=[],events=[];
 for(const line of String(log).split('\n')){
  if(line.startsWith('|turn|'))turn=Number(line.slice(6));
  if(line.startsWith('|-immune|'+ownSide+'a:')){
   const move=[...context].reverse().find(x=>x.startsWith('|move|'+foeSide+'a:'))||null;
   const priorSwitch=context.slice(-14).filter(x=>x.startsWith('|switch|')||x.startsWith('|drag|'));
   events.push({turn,immune:line,foeMove:move,priorSwitches:priorSwitch.slice(-3),
     priorPublicEvents:context.slice(-6)});
  }
  if(line.startsWith('|')){context.push(line);if(context.length>16)context.shift();}
 }
 return events;
}
const candidates={
 A_reported:['Hydreigon','Metagross','Rotom-Wash'],
 B_rotom_primarina_metagross:['Rotom-Wash','Primarina','Metagross'],
 C_tyranitar_metagross_primarina:['Tyranitar','Metagross','Primarina'],
 D_garchomp_rotom_metagross:['Garchomp','Rotom-Wash','Metagross']
};
const first=(log,ownSide,foeSide)=>{
 const ex=executedEvents(log,ownSide,foeSide,2);
 return {ownT1:eventSignature(ex.own,1),foeT1:eventSignature(ex.rival,1),
   ownT2:eventSignature(ex.own,2),foeT2:eventSignature(ex.rival,2)};
};
test('H-M1/H-M2 previously uncombined sixes and fixed trios are legal',{skip},()=>{
 const sim=load(),validator=sim.TeamValidator.get('gen9championsbssregmc');
 const own=reportedLive();
 assert.ok(!validator.validateTeam(normalize(own))?.length,'reported M-7 legal');
 assert.equal(cases.length,2);
 for(const c of cases){
  assert.equal(c.team.length,6);
  assert.equal(new Set(c.team.map(x=>x.species)).size,6,c.id);
  assert.equal(new Set(c.team.map(x=>x.item)).size,6,c.id+' items');
  assert.ok(!validator.validateTeam(normalize(c.team))?.length,c.id);
  for(const three of c.rival){
   assert.equal(new Set(three).size,3,c.id);
   assert.ok(three.every(x=>c.team.some(p=>p.species===x)),c.id);
  }
 }
 for(const [name,three] of Object.entries(candidates)){
  assert.equal(new Set(three).size,3,name);
  assert.ok(three.every(x=>own.some(p=>p.species===x)),name);
 }
});
test('predeclared mixed public-six holdout: full 3v3 decisions across rival trios and T1 policies',{skip},async t=>{
 const sim=load(),dex=sim.Dex.mod('champions'),own=reportedLive();
 const rows=[];let games=0,errors=0,publicImmuneEvents=0;const immuneSamples=[];
 for(const [ci,c] of cases.entries())
 for(const [ri,foeThree] of c.rival.entries())
 for(const [pi,policy] of ['autonomous','public-attack-T1'].entries()){
  const row={case:c.id,foeThree,foeLead:foeThree[0],policy,candidates:{}};
  for(const [name,ownThree] of Object.entries(candidates)){
   const out={ownThree,wins:0,losses:0,foeT1:[],foeT2:[],ownT1:[],ownT2:[],
     publicImmuneEvents:0,firstLoss:null};
   for(let si=0;si<2;si++)for(const reverse of [false,true]){
    const seed=hashSeed(11029000+ci*1000+ri*100+pi*10+si);
    const r=await battle(sim,copy(own),copy(c.team),seed,{
     ownThree,foeThree,reverse,rivalImmuneAware:true,
     script:policy==='public-attack-T1'?rivalScript('attack','stay',dex):null
    });
    assert.equal(r.errors,0,'all requested choices must be legal');
    games++;errors+=r.errors;out.wins+=Number(r.won);out.losses+=Number(!r.won);
    const a=first(r.log,r.ownSide,r.foeSide);
    out.ownT1.push(a.ownT1);out.ownT2.push(a.ownT2);
    out.foeT1.push(a.foeT1);out.foeT2.push(a.foeT2);
    const hits=r.log.split('\n').filter(l=>l.startsWith('|-immune|'+r.ownSide+'a:')).length;
    out.publicImmuneEvents+=hits;publicImmuneEvents+=hits;
    if(hits){const traces=immuneTraces(r.log,r.ownSide,r.foeSide);
      assert.equal(traces.length,hits,'every immunity event must be traceable');
      immuneSamples.push({case:c.id,foeThree,policy,ownThree,seed,reverse,
        rivalMasked:r.rivalImmuneAudit.masked.length,
        traces:traces.slice(0,3)});
    }
    if(!r.won&&!out.firstLoss)out.firstLoss={seed,reverse,turns:r.turns,
      early:earlyLines(r.log,r.ownSide,3)};
   }
   assert.equal(out.wins+out.losses,4);
   out.distinctFoeT1T2=new Set(out.foeT1.map((x,i)=>x+' / '+out.foeT2[i])).size;
   out.distinctOwnT1T2=new Set(out.ownT1.map((x,i)=>x+' / '+out.ownT2[i])).size;
   // 4 battles are 2 independent RNG seeds x 2 seat reversals, not
   // four independent opponent strategies.
   out.independentSeeds=2;out.sideReversals=2;
   delete out.ownT1;delete out.ownT2;delete out.foeT1;delete out.foeT2;
   row.candidates[name]=out;
  }
  rows.push(row);
 }
 assert.equal(games,2*3*2*4*2*2);
 t.diagnostic('M7_MIXED_PUBLIC6_PREDECLARED_HOLDOUT '+JSON.stringify({
  predeclaredAt:'PR104 issuecomment-6573635319',
  frozenCandidates:true,opponentRationalityCertified:false,
  publiclyKnownOpponentSixOnlyAtSelection:true,
  opponentImmuneAwareOptIn:true,
  independentRivalTrioPolicies:6,
  rngAndSideRepetitionsPerCell:4,
  games,errors,publicImmuneEvents,immuneSamples,rows
 }));
});
