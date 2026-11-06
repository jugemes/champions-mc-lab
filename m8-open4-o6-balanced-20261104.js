'use strict';
// M8-OPEN4 O6 pre-registered PR #104 comment #6626512535.
// No strategic species constraint. Only goal: winning by reducing
// one-sided losses; legal-set reuse does NOT imply human performance.
const {reportedLive}=require('./reported-live-roster-20261027');
const {build:r5}=require('./m8-r5-balanced-threat-rebuild');
const {archetypes,variants}=require('./fixtures');
const {groups}=require('./environment-m7-teams');
const copy=x=>structuredClone(x);
function get(team,species,item){
 const p=team.find(x=>x.species===species&&(!item||x.item===item));
 if(!p)throw Error('O6 source missing '+species);
 return copy(p);
}
function build(){
 const ske=get(archetypes.setup,'Skeledirge','Sitrus Berry');
 ske.item='Rocky Helmet'; // avoid duplicate Sitrus; validator must certify
 return [
  get(reportedLive(),'Metagross','Metagrossite'),
  get(r5(),'Rotom-Heat','Leftovers'),
  get(reportedLive(),'Primarina','Sitrus Berry'),
  get(variants.A_rillaboom,'Rillaboom','Miracle Seed'),
  get(groups[6].team,'Baxcalibur','Focus Sash'),
  ske
 ];
}
const plans={
 sun:['Rotom-Heat','Primarina','Metagross'],
 rain:['Rotom-Heat','Rillaboom','Primarina'],
 mence:['Baxcalibur','Metagross','Skeledirge'],
 lucarioZ:['Rotom-Heat','Primarina','Metagross'],
 gyarados:['Metagross','Rotom-Heat','Baxcalibur'],
 megaGolisopod:['Rotom-Heat','Baxcalibur','Metagross'],
 psychic:['Metagross','Rotom-Heat','Baxcalibur'],
 volcarona:['Rotom-Heat','Baxcalibur','Primarina'],
 stall:['Metagross','Skeledirge','Primarina'],
 charX:['Primarina','Baxcalibur','Metagross'],
 steelBunker:['Rotom-Heat','Metagross','Baxcalibur'],
 hazardShift:['Metagross','Skeledirge','Primarina'],
 multiMega:['Metagross','Primarina','Rotom-Heat'],
 rainPivot:['Rotom-Heat','Rillaboom','Primarina'],
 mixedElectric:['Primarina','Baxcalibur','Rotom-Heat']
};
module.exports={build,plans};
