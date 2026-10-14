'use strict';
// Adversarial stress input, not usage-rate-weighted ladder samples.
// All sets must pass the exact pinned M-C validator before simulation.
const {variants,archetypes}=require('./fixtures');
const copy=p=>structuredClone(p);
const get=name=>{
  const pools=[...Object.values(variants),...Object.values(archetypes)];
  for(const team of pools){
    const found=team.find(p=>p.species===name);
    if(found)return copy(found);
  }
  throw Error('No base fixture for '+name);
};
const p=(species,item,ability,nature,stats,moves)=>({
  species,item,ability,nature,moves:moves.split('/'),evs:stats
});
const atk={hp:2,spa:32,spe:32},physical={hp:2,atk:32,spe:32};
const charizard=p('Charizard','Charizardite Y','Blaze','Timid',atk,
  'Flamethrower/Solar Beam/Air Slash/Roost');
const indeedee=p('Indeedee','Focus Sash','Psychic Surge','Timid',atk,
  'Expanding Force/Mystical Fire/Encore/Trick Room');
const gengar=get('Gengar');
const volcarona=get('Volcarona');
const dragonite=get('Dragonite');
const gholdengo=get('Gholdengo');
const primarina=get('Primarina');
const garchomp=get('Garchomp');
const skeledirge=get('Skeledirge');
const rillaboom=get('Rillaboom');
const toxapex=get('Toxapex');
const archaludon=get('Archaludon');
const archaludonAlternate={...archaludon,item:'Eject Button'};
const pelipper=get('Pelipper');
const opponents={
  sun_charizard_y:[
    charizard,dragonite,garchomp,gholdengo,primarina,volcarona
  ].map(copy),
  sun_with_water_trap:[
    charizard,dragonite,garchomp,gholdengo,toxapex,archaludon
  ].map(copy),
  psychic_terrain_singles:[
    indeedee,gengar,dragonite,gholdengo,volcarona,rillaboom
  ].map(copy),
  psychic_terrain_hybrid:[
    indeedee,gengar,dragonite,primarina,archaludonAlternate,skeledirge
  ].map(copy)
};
module.exports={opponents};
