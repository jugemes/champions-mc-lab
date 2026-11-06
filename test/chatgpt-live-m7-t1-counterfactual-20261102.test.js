'use strict';
// ChatGPT independent M-7 opponent-first-turn counterfactual.
// Four distinct public-threat families. This is an engine observation, not
// a 6->3 policy, ranked win rate, or proof of a human's chosen hidden set.
// Opposing full sets are LEGAL hypotheses and may not be what was used on ladder.
const test=require('node:test');
const assert=require('node:assert/strict');
const {load,normalize,hashSeed}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const A=require('../hybrid01-audit');
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const own=reportedLive();
const set=n=>structuredClone(own.find(p=>p.species===n));
const scenarios=[
  {id:'B_indeedee_scarf_fairy',foe:A.INDEEDEE_HYPOTHESES.scarf_timid_c32,
    foeMove:'move 1',picks:[['Hydreigon','move 2'],['Rotom-Wash','move 3'],
      ['Metagross','move 1 mega'],['Primarina','move 1']]},
  {id:'Gyarados_sitrus_dragon_dance',foe:A.GYARADOS_SITRUS_HYPOTHESIS,
    foeMove:'move 1',picks:[['Rotom-Wash','move 3'],['Metagross','move 4 mega'],
      ['Primarina','move 1'],['Garchomp','move 3']]},
  {id:'Charizard_Y_sun_solar_beam',foe:A.CHARIZARD_Y_HYPOTHESIS,
    foeMove:'move 2 mega',picks:[['Tyranitar','move 1'],['Rotom-Wash','move 3'],
      ['Primarina','move 2'],['Hydreigon','move 1']]},
  {id:'Garchomp_scarf_earthquake',foe:set('Garchomp'),
    foeMove:'move 1',picks:[['Rotom-Wash','move 1'],['Metagross','move 1 mega'],
      ['Primarina','move 1'],['Hydreigon','move 1']]}
];
// Execute exactly one T1, then read the engine state, not a heuristic damage
// estimate. Two predetermined seeds x both sides; no result-driven seed search.
function run(sim,scenario,name,choice,seed,reverse){
 const o=A.padTo6(set(name),A.FILLER());
 const f=A.padTo6(structuredClone(scenario.foe),A.FILLER());
 const ownSide=reverse?'p2':'p1';
 const b=reverse?A.engineBattle(sim,f,o,seed,[[scenario.foeMove,choice]]):
   A.engineBattle(sim,o,f,seed,[[choice,scenario.foeMove]]);
 const side=ownSide==='p1'?0:1,enemySide=1-side;
 const ownActive=b.sides[side].active[0],foeActive=b.sides[enemySide].active[0];
 assert.ok(ownActive&&foeActive,'active users');
 const moves=b.log.filter(l=>l.startsWith('|move|'));
 const ourMove=moves.some(l=>l.startsWith('|move|'+ownSide+'a:'));
 const foeId=ownSide==='p1'?'p2':'p1';
 const foeMove=moves.some(l=>l.startsWith('|move|'+foeId+'a:'));
 const immune=b.log.some(l=>l.startsWith('|-immune|'+ownSide+'a:'));
 const errors=b.log.filter(l=>l.startsWith('|error|'));
 assert.equal(errors.length,0,JSON.stringify(errors));
 return {ownFainted:ownActive.fainted,ownHP:+(ownActive.hp/ownActive.maxhp).toFixed(3),
   foeFainted:foeActive.fainted,foeHP:+(foeActive.hp/foeActive.maxhp).toFixed(3),
   ourMove,foeMove,immune};
}
test('M-7 T1 strategic scenarios are legal under pinned Champions M-C',{skip},()=>{
 const sim=load(),v=sim.TeamValidator.get('gen9championsbssregmc');
 assert.ok(!v.validateTeam(normalize(own))?.length,'reported M-7 legal');
 for(const c of scenarios){
  assert.ok(!v.validateTeam(normalize(A.padTo6(c.foe,A.FILLER())))?.length,c.id);
  assert.ok(c.picks.length>=4,'multiple our response candidates');
  for(const [name,choice] of c.picks){
   assert.ok(!v.validateTeam(normalize(A.padTo6(set(name),A.FILLER())))?.length,name);
   assert.match(choice,/^move [1-4]( mega)?$/);
  }
 }
});
test('M-7 T1: engine-executed KO, HP and action availability across four distinct threat families',{skip},t=>{
 const sim=load(),results=[];
 for(const [ci,c] of scenarios.entries()){
  const rows=[];
  for(const [name,choice] of c.picks){
   const obs=[];
   for(let s=0;s<2;s++)for(const reverse of [false,true]){
    obs.push(run(sim,c,name,choice,hashSeed(11022026+ci*100+s),reverse));
   }
   rows.push({name,choice,observations:obs,
     fainted:obs.filter(x=>x.ownFainted).length,
     acted:obs.filter(x=>x.ourMove).length,
     immune:obs.filter(x=>x.immune).length,
     hpMin:Math.min(...obs.map(x=>x.ownHP)),
     hpMax:Math.max(...obs.map(x=>x.ownHP))});
  }
  results.push({case:c.id,foe:c.foe.species,foeItemHypothesis:c.foe.item,
    foeMove:c.foeMove,rows});
 }
 const indeedee=results.find(x=>x.case==='B_indeedee_scarf_fairy');
 assert.equal(indeedee.rows.find(x=>x.name==='Hydreigon').fainted,4,
   'reproduce actual reported lead risk under legal Scarf+Fairy hypothesis');
 assert.equal(indeedee.rows.find(x=>x.name==='Hydreigon').acted,0,
   'Hydreigon must not be credited with an attack it never executed');
 const ground=results.find(x=>x.case==='Garchomp_scarf_earthquake');
 assert.equal(ground.rows.find(x=>x.name==='Rotom-Wash').immune,4,
   'Showdown executes Levitate immunity against this legal Earthquake set');
 for(const x of results)for(const r of x.rows)assert.equal(r.observations.length,4);
 t.diagnostic('LIVE_M7_T1_COUNTERFACTUAL '+JSON.stringify(results));
});
