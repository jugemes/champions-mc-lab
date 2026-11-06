'use strict';
// R9 preregistered PR #104 comment #6623251885 (results not yet observed when
// registered). Exactly R8 with Rotom-Heat -> the EXISTING trained Rotom-Wash set
// (provisional-rank-roster-20261018.js: Leftovers/Levitate/Bold H32 B32 C2,
// Hydro Pump/Volt Switch/Thunderbolt/Will-O-Wisp). Research only, not adopted.
const {build:r8}=require('./m8-r8-dual-setup-lucario');
const {provisional}=require('./provisional-rank-roster-20261018');
function washRotom(){
 const p=provisional().find(x=>x.species==='Rotom-Wash');
 if(!p)throw Error('existing Rotom-Wash set missing');
 return structuredClone(p);
}
function build(){
 const six=r8(),i=six.findIndex(p=>p.species==='Rotom-Heat');
 if(i<0)throw Error('R8 Rotom-Heat missing');
 six[i]=washRotom();
 return six;
}
// Per comment #6623251885: sun = Garchomp/Rotom/Lucario (R8 alt S1),
// charX = Mimikyu/Garchomp/Lucario (R8 alt X1), all others = R8 publicPlans
// with only the Rotom forme replaced. Lead is the first entry. These are fixed
// from the opponent PUBLIC six only; the opponent's actual 3 is never an input.
const R8_PLANS={
 sun:['Garchomp','Rotom-Heat','Lucario'],
 rain:['Rotom-Heat','Rillaboom','Lucario'],
 mence:['Mimikyu','Garchomp','Lucario'],
 lucarioZ:['Garchomp','Rotom-Heat','Lucario'],
 gyarados:['Rotom-Heat','Garchomp','Lucario'],
 megaGolisopod:['Rotom-Heat','Lucario','Primarina'],
 psychic:['Garchomp','Mimikyu','Rotom-Heat'],
 volcarona:['Mimikyu','Rotom-Heat','Garchomp'],
 stall:['Lucario','Rotom-Heat','Rillaboom'],
 charX:['Mimikyu','Garchomp','Lucario']
};
const R9_PLANS=Object.fromEntries(Object.entries(R8_PLANS).map(([k,t])=>[k,t.map(s=>s==='Rotom-Heat'?'Rotom-Wash':s)]));
module.exports={build,washRotom,R8_PLANS,R9_PLANS};
