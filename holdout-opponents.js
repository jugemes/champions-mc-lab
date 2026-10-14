'use strict';
// Predeclared 6-species holdout patterns, intentionally different from the
// eight preview training patterns. Still synthetic; no M-7 frequency claim.
const {six}=require('./preview-opponents');
const opponents={
  dragon_offense:six(['Garchomp','Gengar','Dragonite','Salamence','Volcarona','Gholdengo']),
  mixed_rain:six(['Pelipper','Swampert','Volcarona','Dragonite','Starmie','Toxapex']),
  steel_bunker:six(['Gholdengo','Archaludon','Corviknight','Skeledirge','Garchomp','Gengar']),
  hazard_shift:six(['Toxapex','Slowbro','Skarmory','Gholdengo','Dragonite','Lucario']),
  multi_mega_offense:six(['Gengar','Lucario','Golisopod','Starmie','Volcarona','Rillaboom']),
  rain_pivot:six(['Pelipper','Swampert','Archaludon','Toxapex','Volcarona','Starmie']),
  bulky_rotation:six(['Salamence','Skeledirge','Corviknight','Slowbro','Swampert','Archaludon']),
  mixed_electric:six(['Rillaboom','Eelektross','Primarina','Garchomp','Volcarona','Gholdengo'])
};
module.exports={opponents};
