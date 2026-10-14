'use strict';
// Eight distinct six-species preview pools; not statistically representative of M-7.
// None of these specifies the opposing three, lead or tactical script.
const {variants,archetypes}=require('./fixtures');
const fixtures=Object.values({...variants,...archetypes}).flat();
function six(species){
  if(species.length!==6||new Set(species).size!==6)throw Error('Expected six unique species');
  const pick=(position,used,chosen)=>{
    if(position===species.length)return chosen;
    const matching=fixtures.filter(p=>p.species===species[position]);
    if(!matching.length)throw Error('Missing opponent fixture: '+species[position]);
    for(const set of matching){
      if(used.has(set.item))continue;
      const result=pick(position+1,new Set([...used,set.item]),[...chosen,structuredClone(set)]);
      if(result)return result;
    }
    return null;
  };
  const team=pick(0,new Set(),[]);
  if(!team)throw Error('No available legal unique-item set for '+species.join('/'));
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
