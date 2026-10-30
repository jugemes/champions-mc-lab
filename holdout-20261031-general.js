'use strict';
// PR #78 request item 4: holdout public sixes for the general public-six
// preview entry (public-six-general.js). Written and committed BEFORE the
// entry was run on any public six, and NOT used to tune the entry: the
// development cases are A / B / C (Y and X sets) / Indeedee (scarf, sash,
// quick claw) / E. These sixes are only run by the final holdout step.
// Each six has two legal set hypotheses (a = environment-m7-teams.js team,
// b = hand-written variant below). Constructed teams, NOT sampled ladder
// rosters, and neither hypothesis carries a usage weight. Hidden sets are
// only used to RUN battles; the preview entry receives species names only.
const {groups}=require('./environment-m7-teams');
const g=n=>structuredClone(groups.find(x=>x.name===n).team);
const swap=(team,species,set)=>team.map(p=>p.species===species?{species,...set}:p);
function holdoutSixes(){
  const rain=g('12_M7_rain'),gy=g('09_M7_gyarados_megagarchompZ');
  let rainB=swap(rain,'Swampert',{item:'Sitrus Berry',ability:'Torrent',nature:'Adamant',
    moves:['Liquidation','Earthquake','Stealth Rock','Flip Turn'],evs:{hp:32,atk:32,def:2}});
  rainB=swap(rainB,'Dragonite',{item:'Dragoninite',ability:'Multiscale',nature:'Adamant',
    moves:['Dragon Dance','Extreme Speed','Earthquake','Fire Punch'],evs:{hp:2,atk:32,spe:32}});
  rainB=swap(rainB,'Archaludon',{item:'Leftovers',ability:'Stamina',nature:'Modest',
    moves:['Electro Shot','Draco Meteor','Flash Cannon','Thunderbolt'],evs:{hp:32,spa:32,spd:2}});
  rainB=swap(rainB,'Gholdengo',{item:'Choice Scarf',ability:'Good as Gold',nature:'Timid',
    moves:['Make It Rain','Shadow Ball','Thunderbolt','Focus Blast'],evs:{hp:2,spa:32,spe:32}});
  let gyB=swap(gy,'Gyarados',{item:'Gyaradosite',ability:'Intimidate',nature:'Jolly',
    moves:['Dragon Dance','Waterfall','Crunch','Earthquake'],evs:{hp:2,atk:32,spe:32}});
  gyB=swap(gyB,'Garchomp',{item:'Choice Scarf',ability:'Rough Skin',nature:'Jolly',
    moves:['Earthquake','Dragon Claw','Rock Slide','Poison Jab'],evs:{hp:2,atk:32,spe:32}});
  gyB=swap(gyB,'Corviknight',{item:'Leftovers',ability:'Pressure',nature:'Impish',
    moves:['Roost','U-turn','Body Press','Brave Bird'],evs:{hp:32,def:32,spd:2}});
  return {
    HX_rain:{publicSix:rain.map(p=>p.species),hypotheses:{a:rain,b:rainB},
      ace:'Swampert',note:'a: Mega Swampert + Sitrus Archaludon; b: Mega Dragonite + Leftovers Archaludon + Scarf Gholdengo'},
    HX_gyarados:{publicSix:gy.map(p=>p.species),hypotheses:{a:gy,b:gyB},
      ace:'Garchomp',note:'a: Mega Garchomp-Z (special) + Sitrus DD Gyarados; b: Mega Gyarados + Scarf Garchomp + Leftovers Corviknight'},
  };
}
module.exports={holdoutSixes};
