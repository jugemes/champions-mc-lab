'use strict';
// PR #104 issuecomment #6626181367 preregistered BEFORE results:
// O5 BoltBeam Starmie full-six: same 15 public sixes, same opponent 3 pairs
// and seeds as M8-OPEN1, plus same three rational opponent scenarios.
// 15 x 2 x 2 seeds x 2 sides = 120, +3 x 2 seeds x 2 sides = 12.
const test=require('node:test'),assert=require('node:assert/strict');
const {load,normalize,prelim,hashSeed}=require('../lab');
const {build,plans}=require('../m8-open2-boltbeam-20261104');
const {groups}=require('../environment-m7-teams');
const {archetypes}=require('../fixtures');
const {opponents}=require('../holdout-opponents');
const {battle,rivalScript,earlyLines}=require('../encore-lead-audit');
const clone=x=>structuredClone(x);
const skip=!process.env.SHOWDOWN_DIR&&'SHOWDOWN_DIR unavailable';
const cases=[
 {id:'sun',six:()=>groups[2].team,rival:[['Charizard','Garchomp','Mimikyu'],['Garchomp','Primarina','Gholdengo']]},
 {id:'rain',six:()=>archetypes.rain,rival:[['Pelipper','Swampert','Archaludon'],['Pelipper','Gholdengo','Rillaboom']]},
 {id:'mence',six:()=>groups[4].team,rival:[['Salamence','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']]},
 {id:'lucarioZ',six:()=>groups[1].team,rival:[['Lucario','Garchomp','Mimikyu'],['Corviknight','Primarina','Archaludon']]},
 {id:'gyarados',six:()=>groups[8].team,rival:[['Gyarados','Garchomp','Mimikyu'],['Mimikyu','Gholdengo','Corviknight']]},
 {id:'megaGolisopod',six:()=>groups[0].team,rival:[['Golisopod','Garchomp','Mimikyu'],['Hippowdon','Primarina','Gholdengo']]},
 {id:'psychic',six:()=>groups[10].team,rival:[['Indeedee','Gengar','Dragonite'],['Gholdengo','Volcarona','Rillaboom']]},
 {id:'volcarona',six:()=>groups[13].team,rival:[['Salamence','Volcarona','Dragonite'],['Gholdengo','Skeledirge','Rillaboom']]},
 {id:'stall',six:()=>groups[12].team,rival:[['Toxapex','Umbreon','Corviknight'],['Slowbro','Skarmory','Gholdengo']]},
 {id:'charX',six:()=>groups[3].team,rival:[['Charizard','Garchomp','Mimikyu'],['Primarina','Baxcalibur','Gholdengo']]},
 {id:'steelBunker',six:()=>opponents.steel_bunker,rival:[['Gholdengo','Archaludon','Corviknight'],['Skeledirge','Garchomp','Gengar']]},
 {id:'hazardShift',six:()=>opponents.hazard_shift,rival:[['Toxapex','Skarmory','Dragonite'],['Slowbro','Gholdengo','Lucario']]},
 {id:'multiMega',six:()=>opponents.multi_mega_offense,rival:[['Gengar','Lucario','Golisopod'],['Starmie','Volcarona','Rillaboom']]},
 {id:'rainPivot',six:()=>opponents.rain_pivot,rival:[['Pelipper','Swampert','Archaludon'],['Toxapex','Volcarona','Starmie']]},
 {id:'mixedElectric',six:()=>opponents.mixed_electric,rival:[['Eelektross','Garchomp','Volcarona'],['Primarina','Rillaboom','Gholdengo']]}
];
test('M8 OPEN2 O5 BoltBeam exact M-C legal and public plans',{skip},()=>{
 const t=build(),v=load().TeamValidator.get('gen9championsbssregmc');
 assert.doesNotThrow(()=>prelim(t,'O5'));
 assert.ok(!v.validateTeam(normalize(t))?.length,'O5 legality');
 assert.deepEqual(t.find(p=>p.species==='Starmie').moves,['Ice Beam','Hydro Pump','Grass Knot','Thunderbolt']);
 assert.equal(new Set(t.map(p=>p.item)).size,6);
 assert.equal(cases.length,15);
 for(const c of cases){
  assert.ok(!v.validateTeam(normalize(c.six()))?.length,c.id+' foe six legal');
  const t3=plans[c.id];assert.equal(new Set(t3).size,3,c.id);
  assert.ok(t3.every(s=>t.some(p=>p.species===s)),c.id+' own three');
  for(const rival of c.rival)assert.ok(rival.every(s=>c.six().some(p=>p.species===s)),c.id+' foe 3');
 }
});
test('M8 OPEN2 O5 15 published public-six x 2 rival trio x seed2 side2: 120 full Battles',{skip},async t=>{
 const sim=load(),rows=[];let games=0,errors=0;
 for(const [ci,c] of cases.entries())for(const [ei,foeThree] of c.rival.entries()){
  const obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(12161104+ci*1000+ei*100+si);
   const r=await battle(sim,clone(build()),clone(c.six()),seed,{
    ownThree:plans[c.id],foeThree,reverse,script:null,rivalImmuneAware:true,choiceAudit:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,'O5 '+c.id+' foe '+ei);
   obs.push({won:r.won,choices:r.choiceTrace.filter(x=>x.side===r.ownSide&&x.requestKind==='normal'&&x.turn<=2)
    .slice(0,2).map(x=>({turn:x.turn,choice:x.choice})),
    loss:r.won?null:earlyLines(r.log,r.ownSide,6).slice(0,31)});
  }
  rows.push({id:c.id,enemy3:ei,own3:plans[c.id],wins:obs.filter(x=>x.won).length,
   firstLoss:obs.find(x=>!x.won)?.loss,firstOwnDecisions:obs[0].choices});
 }
 assert.equal(games,120);assert.equal(errors,0);assert.equal(rows.length,30);
 t.diagnostic('M8_OPEN2_O5_120 '+JSON.stringify({games,errors,rows,notHumanWinRate:true,
  fixed:'PR#104 issuecomment #6626181367'}));
});
test('M8 OPEN2 O5 known rational enemy lead counterplays: 12 full Battles',{skip},async t=>{
 const sim=load(),dex=sim.Dex.mod('champions'),rows=[];let games=0,errors=0;
 const scenarios=[
  {id:'YbackGarchLead',team:cases[0].six(),three:['Garchomp','Charizard','Mimikyu'],plan:'sun',script:null},
  {id:'YbackMimiLead',team:cases[0].six(),three:['Mimikyu','Charizard','Garchomp'],plan:'sun',script:null},
  {id:'gyaraT1GarchSwitch',team:cases[4].six(),three:['Gyarados','Garchomp','Mimikyu'],plan:'gyarados',script:rivalScript('switch','stay',dex)}
 ];
 for(const [ci,c] of scenarios.entries()){
  const obs=[];
  for(let si=0;si<2;si++)for(const reverse of [false,true]){
   const seed=hashSeed(12281200+ci*1000+si);
   const r=await battle(sim,clone(build()),clone(c.team),seed,{
    ownThree:plans[c.plan],foeThree:c.three,reverse,script:c.script,rivalImmuneAware:true,choiceAudit:true});
   games++;errors+=r.errors;assert.equal(r.errors,0,c.id);
   obs.push({won:r.won,early:earlyLines(r.log,r.ownSide,7).slice(0,43)});
  }
  rows.push({scenario:c.id,own3:plans[c.plan],wins:obs.filter(o=>o.won).length,
   firstLoss:obs.find(o=>!o.won)?.early,firstWin:obs.find(o=>o.won)?.early});
 }
 assert.equal(games,12);assert.equal(errors,0);
 t.diagnostic('M8_OPEN2_O5_RATIONAL_12 '+JSON.stringify({games,errors,rows,notHumanWinRate:true}));
});
