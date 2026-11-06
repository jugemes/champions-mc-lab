'use strict';
// 2026-11-02 predeclared cross-archetype holdout for M-7 selection candidates.
// Frozen BEFORE executing this test: PR #104 comment #6568257097.
// These are synthetic legal public sixes assembled from known fixtures,
// not ladder usage estimates or reconstructed opponent hidden sets.
// Enemy legacy vs immuneAware100 is paired on seed/side/three/lead.
// The new switch is opponent-only and opt-in; saved default runner unchanged.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize,hashSeed,matchup}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {archetypes,variants}=require('../fixtures');
const {teams}=require('../holdout-20261030');
const {battle,earlyLines}=require('../encore-lead-audit');
const {executedEvents,eventSignature}=require('../public-execution-audit');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const own=reportedLive();
const clone=x=>structuredClone(x);
const find=(team,species)=>clone(team.find(x=>x.species===species));
const charizard=find(teams().new_sun_balance.team,'Charizard');
const cases=[
 {id:'U-K-sun-ground-steel-fairy-priority-stall',
  team:[charizard,find(variants.C_master,'Garchomp'),find(variants.A_rillaboom,'Gholdengo'),
    find(variants.A_rillaboom,'Primarina'),find(variants.A_rillaboom,'Rillaboom'),
    find(archetypes.stall,'Umbreon')],
  rival:[
   ['Charizard','Garchomp','Gholdengo'],
   ['Garchomp','Primarina','Rillaboom'],
   ['Gholdengo','Charizard','Umbreon']]},
 {id:'U-L-mega-setup-steel-stall-priority',
  team:[find(archetypes.setup,'Salamence'),find(archetypes.setup,'Volcarona'),
    find(archetypes.setup,'Gholdengo'),find(archetypes.stall,'Toxapex'),
    find(archetypes.stall,'Skarmory'),find(archetypes.setup,'Rillaboom')],
  rival:[
   ['Salamence','Volcarona','Gholdengo'],
   ['Rillaboom','Skarmory','Toxapex'],
   ['Volcarona','Salamence','Rillaboom']]}
];
const candidates={
 reportedHydreigonLead:['Hydreigon','Metagross','Rotom-Wash'],
 metagrossHydreigonRotom:['Metagross','Hydreigon','Rotom-Wash'],
 metagrossRotomPrimarina:['Metagross','Rotom-Wash','Primarina'],
 metagrossHydreigonPrimarina:['Metagross','Hydreigon','Primarina']
};
function publicAttackT1(req,bot,info){
 if(info.turn!==1||req.teamPreview||req.forceSwitch)return null;
 const act=req.active?.[0],active=req.side.pokemon.find(p=>p.active);
 if(!act||!active)return null;
 const self=bot.getSet(active),foe=bot.foeActive;
 const rows=act.moves.map((m,i)=>({m,i}))
   .filter(x=>!x.m.disabled&&x.m.pp>0&&bot.dex.moves.get(x.m.id||x.m.move).category!=='Status')
   .map(x=>({...x,score:matchup(bot.dex,self,foe,x.m.id||x.m.move)}));
 rows.sort((a,b)=>b.score-a.score||a.i-b.i);
 if(!rows.length)return null;
 return 'move '+(rows[0].i+1)+(act.canMegaEvo?' mega':'');
}
function firstActions(log,ownSide){
 const foeSide=ownSide==='p1'?'p2':'p1';
 const x=executedEvents(log,ownSide,foeSide);
 return {ourT1:eventSignature(x.own,1),theirT1:eventSignature(x.rival,1),
   ourT2:eventSignature(x.own,2),theirT2:eventSignature(x.rival,2)};
}
function observedImmuneHits(log,ownSide){
 return log.split('\n').filter(l=>l.startsWith('|-immune|'+ownSide+'a:')).length;
}
test('frozen U-K/U-L public sixes, three alternatives and M-7 candidates validate',{skip},()=>{
 const sim=load(),validator=sim.TeamValidator.get('gen9championsbssregmc');
 assert.ok(!validator.validateTeam(normalize(own))?.length);
 for(const c of cases){
   assert.equal(c.team.length,6);
   assert.equal(new Set(c.team.map(p=>p.species)).size,6);
   assert.equal(new Set(c.team.map(p=>p.item)).size,6,'no duplicate items in holdout');
   assert.ok(!validator.validateTeam(normalize(c.team))?.length,c.id);
   for(const r of c.rival){
     assert.equal(new Set(r).size,3);
     assert.ok(r.every(s=>c.team.some(p=>p.species===s)),c.id+' '+r.join('/'));
   }
 }
 for(const three of Object.values(candidates)){
   assert.equal(new Set(three).size,3);
   assert.ok(three.every(s=>own.some(p=>p.species===s)));
 }
});
test('predeclared holdout: executed T1/T2 across opponent trio, action and immunity-policy branches',{skip},async t=>{
 const sim=load(),rows=[],totals={games:0,errors:0,observedImmunityEvents:0,maskCorrections:0};
 for(const [ci,c] of cases.entries())for(const [ri,rival] of c.rival.entries())
 for(const [mi,mode] of ['autonomous','public-attack-T1'].entries())
 for(const immuneAware of [false,true]){
   const row={case:c.id,rival,mode,rivalImmuneAware:immuneAware,candidates:{}};
   for(const [label,three] of Object.entries(candidates)){
     const outcome={three,wins:0,losses:0,masked:0,observedImmunityEvents:0,
       executedT1:[],executedT2:[],sampleLoss:null};
     for(let s=0;s<2;s++)for(const reverse of [false,true]){
       const seed=hashSeed(11024000+ci*1000+ri*100+mi*10+s);
       const result=await battle(sim,clone(own),clone(c.team),seed,{
         ownThree:three,foeThree:rival,reverse,
         script:mode==='public-attack-T1'?publicAttackT1:null,
         rivalImmuneAware:immuneAware
       });
       assert.equal(result.errors,0,'engine choices must be legal');
       totals.games++;outcome.wins+=Number(result.won);outcome.losses+=Number(!result.won);
       const actions=firstActions(result.log,result.ownSide);
       outcome.executedT1.push(actions.theirT1);
       outcome.executedT2.push(actions.theirT2);
       const masks=result.rivalImmuneAudit?.masked?.length||0;
       outcome.masked+=masks;totals.maskCorrections+=masks;
       const hits=observedImmuneHits(result.log,result.ownSide);
       outcome.observedImmunityEvents+=hits;totals.observedImmunityEvents+=hits;
       if(!result.won&&!outcome.sampleLoss)
         outcome.sampleLoss={seed,reverse,turns:result.turns,
           actions,firstTurns:earlyLines(result.log,result.ownSide,2)};
     }
     assert.equal(outcome.wins+outcome.losses,4);
     row.candidates[label]=outcome;
   }
   rows.push(row);
 }
 assert.equal(totals.games,2*3*2*2*4*2*2);
 // Report by independent rival trio and policy; do not average unknown set frequencies.
 t.diagnostic('LLM_M7_FROZEN_HOLDOUT '+JSON.stringify({
   declaredAt:'PR104 issuecomment-6568257097',opponentRationalityCertified:false,
   policies:['legacy','immuneAware100'],totals,rows
 }));
});
