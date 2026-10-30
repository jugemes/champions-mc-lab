'use strict';
// PR #60 holdout public sixes for previewPolicy:'threat-aware-v2'.
// NOT used while tuning v2 (tuning looked only at A/B/C = groups 01-04).
// 1. holdout-opponents.js sixes, which PR #58 never battled.
// 2. The reported real case B public six (docs/REAL-BATTLE-CASES-2026-10-27.md):
//    Indeedee/Hippowdon/Garchomp/Umbreon/Gengar/Gyarados. Their sets are NOT
//    known; two legal hypotheses (Scarf Indeedee / Sash Indeedee) are run.
// forcedA (ace axis) and forcedB (cycle axis) were written from the public
// six only, before any v2 battle on these teams. They are experiment
// conditions, never preview inputs.
const {opponents}=require('./holdout-opponents');
const {variants,archetypes}=require('./fixtures');
const A=require('./hybrid01-audit');
const fixtures=Object.values({...variants,...archetypes}).flat();
const fx=s=>structuredClone(fixtures.find(p=>p.species===s));
const mk=(s,item,ability,nature,points,moves)=>A.set(s,item,ability,nature,points,moves);
const FORCED={
  dragon_offense:[['Salamence','Garchomp','Dragonite'],['Gengar','Gholdengo','Volcarona']],
  mixed_rain:[['Pelipper','Swampert','Dragonite'],['Toxapex','Starmie','Volcarona']],
  steel_bunker:[['Gengar','Garchomp','Gholdengo'],['Corviknight','Skeledirge','Archaludon']],
  hazard_shift:[['Lucario','Dragonite','Gholdengo'],['Toxapex','Skarmory','Slowbro']],
  multi_mega_offense:[['Golisopod','Rillaboom','Starmie'],['Gengar','Volcarona','Lucario']],
  rain_pivot:[['Pelipper','Swampert','Archaludon'],['Toxapex','Volcarona','Starmie']],
  bulky_rotation:[['Salamence','Swampert','Archaludon'],['Corviknight','Slowbro','Skeledirge']],
  mixed_electric:[['Garchomp','Rillaboom','Volcarona'],['Primarina','Eelektross','Gholdengo']]
};
const realB=indeedee=>{
  const scarf=indeedee==='scarf';
  return [
    mk('Indeedee',scarf?'Choice Scarf':'Focus Sash','Psychic Surge','Timid',{hp:2,spa:32,spe:32},
      scarf?['Expanding Force','Dazzling Gleam','Shadow Ball','Trick']:['Expanding Force','Dazzling Gleam','Shadow Ball','Trick Room']),
    mk('Hippowdon','Rocky Helmet','Sand Stream','Impish',{hp:32,def:32,spd:2},['Earthquake','Yawn','Stealth Rock','Slack Off']),
    scarf?mk('Garchomp','Garchompite Z','Rough Skin','Timid',{hp:2,spa:32,spe:32},['Earth Power','Draco Meteor','Flamethrower','Stealth Rock'])
      :fx('Garchomp'),
    fx('Umbreon'),
    fx('Gengar'),
    mk('Gyarados','Sitrus Berry','Intimidate','Jolly',{hp:2,atk:32,spe:32},['Dragon Dance','Waterfall','Earthquake','Taunt'])
  ];
};
const holdoutGroups=[
  ...Object.entries(opponents).map(([k,team])=>({name:'H_'+k,team:structuredClone(team),forcedA:FORCED[k][0],forcedB:FORCED[k][1]})),
  {name:'H_realB_scarf_indeedee',team:realB('scarf'),forcedA:['Indeedee','Garchomp','Gengar'],forcedB:['Hippowdon','Umbreon','Gyarados']},
  {name:'H_realB_sash_indeedee',team:realB('sash'),forcedA:['Indeedee','Garchomp','Gengar'],forcedB:['Hippowdon','Umbreon','Gyarados']}
];
module.exports={holdoutGroups,FORCED};
