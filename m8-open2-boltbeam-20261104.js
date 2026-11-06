'use strict';
// M8-OPEN2 O5: independent six-member structural redistribution,
// preregistered BEFORE results in PR #104 comment #6626181367.
// The fixed idea is minimizing easy losses, NOT retaining any species.
const {reportedLive}=require('./reported-live-roster-20261027');
const {variants}=require('./fixtures');
const {build:r5}=require('./m8-r5-balanced-threat-rebuild');
const {groups}=require('./environment-m7-teams');
const clone=x=>structuredClone(x);
function pick(t,s,item){const x=t.find(p=>p.species===s&&(!item||p.item===item));if(!x)throw Error('Missing O5 fixture '+s);return clone(x);}
function build(){
 const starmie=pick(variants.A_rillaboom,'Starmie','Choice Scarf');
 if(!starmie.moves.includes('Trick'))throw Error('Source Starmie moves changed');
 starmie.moves=starmie.moves.map(m=>m==='Trick'?'Thunderbolt':m);
 return [
  pick(reportedLive(),'Metagross','Metagrossite'),
  starmie,
  pick(r5(),'Rotom-Heat','Leftovers'),
  pick(reportedLive(),'Primarina','Sitrus Berry'),
  pick(variants.A_rillaboom,'Rillaboom','Miracle Seed'),
  pick(groups[0].team,'Mimikyu','Life Orb')
 ];
}
// All chosen at public-six preview only. Enemy actual three is NOT input.
const plans={
 sun:['Starmie','Rotom-Heat','Mimikyu'],
 rain:['Rillaboom','Metagross','Starmie'],
 mence:['Starmie','Metagross','Mimikyu'],
 lucarioZ:['Metagross','Rotom-Heat','Primarina'],
 gyarados:['Starmie','Rotom-Heat','Mimikyu'],
 megaGolisopod:['Rotom-Heat','Starmie','Metagross'],
 psychic:['Metagross','Rotom-Heat','Starmie'],
 volcarona:['Starmie','Rotom-Heat','Mimikyu'],
 stall:['Metagross','Rotom-Heat','Mimikyu'],
 charX:['Primarina','Starmie','Mimikyu'],
 steelBunker:['Rotom-Heat','Starmie','Metagross'],
 hazardShift:['Metagross','Rotom-Heat','Starmie'],
 multiMega:['Starmie','Metagross','Primarina'],
 rainPivot:['Rillaboom','Starmie','Metagross'],
 mixedElectric:['Starmie','Metagross','Rotom-Heat']
};
module.exports={build,plans};
