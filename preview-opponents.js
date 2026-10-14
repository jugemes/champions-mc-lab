'use strict';
// Eight distinct six-species preview pools; not statistically representative of M-7.
// None of these specifies the opposing three, lead or tactical script.
const {variants,archetypes}=require('./fixtures');
const fixtures=Object.values({...variants,...archetypes}).flat();
function six(species){
  const team=species.map(s=>{
    const found=fixtures.find(p=>p.species===s);
    if(!found)throw Error('Missing opponent fixture: '+s);
    return structuredClone(found);
  });
  if(new Set(team.map(p=>p.species)).size!==6||new Set(team.map(p=>p.item)).size!==6)
    throw Error('Duplicate species/item in preview opponent: '+species.join('/'));
  return team;
}
const opponents={
  rain:six(['Pelipper','Swampert','Archaludon','Dragonite','Gholdengo','Rillaboom']),
  setup:six(['Salamence','Volcarona','Dragonite','Gholdengo','Skeledirge','Rillaboom']),
  stall:six(['Toxapex','Umbreon','Corviknight','Slowbro','Skarmory','Gholdengo']),
  previous_master:structuredClone(variants.C_master),
  rain_volcarona:six(['Pelipper','Swampert','Archaludon','Volcarona','Gholdengo','Rillaboom']),
  steel_setup:six(['Salamence','Volcarona','Dragonite','Gholdengo','Archaludon','Rillaboom']),
  regen_field:six(['Toxapex','Umbreon','Corviknight','Slowbro','Rillaboom','Gholdengo']),
  fast_offense:six(['Garchomp','Gengar','Volcarona','Archaludon','Rillaboom','Toxapex']),
};
module.exports={opponents,six};
