'use strict';
// M8 OPEN5 O7: full structural alternative, rain pivot + Steel special pressure
// + physical Mega + guaranteed action / Grassy Terrain. PREDECLARED
// PR #104 comment #6627129388. Research only, NOT an adopted ranked roster.
const {archetypes}=require('./fixtures');
const {groups}=require('./environment-m7-teams');
const clone=x=>structuredClone(x);
function pick(t,s,item){
 const p=t.find(x=>x.species===s&&(!item||x.item===item));
 if(!p)throw Error('O7 role source missing '+s+' '+(item||''));
 return clone(p);
}
function build(){
 const rain=archetypes.rain;
 return [
  pick(rain,'Pelipper','Focus Sash'),
  pick(rain,'Swampert','Swampertite'),
  pick(rain,'Archaludon','Sitrus Berry'),
  pick(rain,'Gholdengo','Air Balloon'),
  pick(rain,'Rillaboom','Miracle Seed'),
  pick(groups[0].team,'Mimikyu','Life Orb')
 ];
}
// The chosen 3 and lead (first element) use the enemy PUBLIC six ID only.
const plans={
 sun:['Pelipper','Swampert','Mimikyu'],
 rain:['Rillaboom','Archaludon','Gholdengo'],
 mence:['Mimikyu','Pelipper','Swampert'],
 lucarioZ:['Swampert','Pelipper','Mimikyu'],
 gyarados:['Archaludon','Mimikyu','Swampert'],
 megaGolisopod:['Pelipper','Swampert','Gholdengo'],
 psychic:['Gholdengo','Mimikyu','Archaludon'],
 volcarona:['Pelipper','Swampert','Mimikyu'],
 stall:['Gholdengo','Rillaboom','Archaludon'],
 charX:['Pelipper','Swampert','Mimikyu'],
 steelBunker:['Swampert','Gholdengo','Rillaboom'],
 hazardShift:['Gholdengo','Rillaboom','Swampert'],
 multiMega:['Mimikyu','Archaludon','Swampert'],
 rainPivot:['Rillaboom','Archaludon','Gholdengo'],
 mixedElectric:['Archaludon','Swampert','Mimikyu']
};
module.exports={build,plans};
