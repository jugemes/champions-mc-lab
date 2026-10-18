'use strict';
// A PROVISIONAL roster for threat-specific legal and interaction checks only.
// Never call this battle-ready until realistic 6->3 counterplay is checked.
const {variants}=require('./fixtures');
const row=(species,item,ability,nature,points,moves)=>({
 species,item,ability,nature,moves:moves.split('/'),
 evs:Object.fromEntries(points.split(',').map(t=>[({H:'hp',A:'atk',B:'def',C:'spa',D:'spd',S:'spe'})[t[0]],Number(t.slice(1))]))
});
const find=(species)=>structuredClone(variants.A_rillaboom.find(p=>p.species===species)||variants.C_master.find(p=>p.species===species));
function provisional(){
 return [
  row('Metagross','Metagrossite','Clear Body','Jolly','H2,A32,S32',
   'Meteor Mash/Zen Headbutt/Bullet Punch/Thunder Punch'),
  row('Hydreigon','Choice Specs','Levitate','Timid','H2,C32,S32',
   'Draco Meteor/Dark Pulse/Flamethrower/Flash Cannon'),
  find('Primarina'),
  find('Garchomp'),
  row('Tyranitar','Chople Berry','Sand Stream','Adamant','H32,A32,D2',
   'Stone Edge/Knock Off/Ice Punch/Stealth Rock'),
  row('Rotom-Wash','Leftovers','Levitate','Bold','H32,B32,C2',
   'Hydro Pump/Volt Switch/Thunderbolt/Will-O-Wisp')
 ];
}
module.exports={provisional};
