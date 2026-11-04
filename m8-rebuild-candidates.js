'use strict';
// M-8 radical reconstruction candidates, NOT M-7 reported ladder rosters.
// These are explicit new hypotheses from public M-7 data, with known legal
// M-C set fixtures reused where possible. No inference of human win rate.
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {archetypes,variants}=require('./fixtures');
const c=p=>structuredClone(p);
function get(team,species,item){
 const p=team.find(x=>x.species===species&&(!item||x.item===item));
 if(!p)throw Error('Missing fixture '+species+' '+(item||''));
 return c(p);
}
function own(species){return get(reportedLive(),species);}
const garchZ=get(groups[8].team,'Garchomp','Garchompite Z');
const mimi=get(groups[0].team,'Mimikyu','Life Orb');
const gold=get(variants.A_rillaboom,'Gholdengo','Air Balloon');
const rilla=get(variants.A_rillaboom,'Rillaboom','Miracle Seed');
const hippo=get(groups[0].team,'Hippowdon','Leftovers');
const charX=get(groups[3].team,'Charizard','Charizardite X');
const meow={species:'Meowscarada',item:'Miracle Seed',ability:'Overgrow',nature:'Jolly',
 evs:{hp:2,atk:32,spe:32},
 moves:['Flower Trick','Knock Off','Sucker Punch','U-turn']};
// Strongly different from the M-7 six: replaces Metagross, Hydreigon,
// Garchomp's Scarf role and Rotom with an aggressive two-setup core.
// Carries an explicit weather reset through Tyranitar and rain counterplan
// through Primarina + Rillaboom. Grassy Terrain does not weaken Earth Power.
const builders={
 R1_megaGarchZ_sand_doubleSetup:()=>[
  c(garchZ),c(mimi),c(gold),own('Primarina'),c(rilla),own('Tyranitar')],
 // Alternative: Yawn/defence -> three different setup finishers, high speed
 // Meowscarada handles rain without making Hippowdon Earthquake half-damage
 // (which Rillaboom's Grassy Terrain would do).
 R2_megaCharX_hippo_setup:()=>[
  c(charX),c(hippo),own('Primarina'),c(gold),c(mimi),c(meow)]
};
const publicPreviewPlans={
 sun:{
  R1_megaGarchZ_sand_doubleSetup:['Garchomp','Tyranitar','Primarina'],
  R2_megaCharX_hippo_setup:['Charizard','Hippowdon','Primarina']},
 rain:{
  R1_megaGarchZ_sand_doubleSetup:['Primarina','Rillaboom','Garchomp'],
  R2_megaCharX_hippo_setup:['Primarina','Meowscarada','Gholdengo']},
 megaGolisopod:{
  R1_megaGarchZ_sand_doubleSetup:['Garchomp','Primarina','Mimikyu'],
  R2_megaCharX_hippo_setup:['Charizard','Primarina','Gholdengo']},
 megaSalamence:{
  R1_megaGarchZ_sand_doubleSetup:['Mimikyu','Garchomp','Gholdengo'],
  R2_megaCharX_hippo_setup:['Mimikyu','Gholdengo','Charizard']},
 stall:{
  R1_megaGarchZ_sand_doubleSetup:['Gholdengo','Garchomp','Rillaboom'],
  R2_megaCharX_hippo_setup:['Gholdengo','Meowscarada','Charizard']}
};
function candidates(){return Object.fromEntries(Object.entries(builders).map(([k,f])=>[k,f()]));}
module.exports={candidates,publicPreviewPlans};
