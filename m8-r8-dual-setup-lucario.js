'use strict';
// R8 preregistered PR #104 comment #6622358063.
// Different Mega and double setup: Mega Lucario Z special Nasty Plot plus
// physical Life Orb Mimikyu Swords Dance, with Scarf Garch, Heat Rotom,
// Rillaboom and Primarina. Entirely research-only, not ranked adopted.
const {build:base}=require('./m8-r7-grassy-scarf');
const {groups}=require('./environment-m7-teams');
const copy=x=>structuredClone(x);
function fixture(i,s,item){
 const t=groups[i].team;const p=t.find(x=>x.species===s&&(!item||x.item===item));
 if(!p)throw Error('Fixture not found: '+s);
 return copy(p);
}
function build(){
 const six=base(true); // exact R7T, retain all other 4 members.
 const luke=fixture(1,'Lucario','Lucarionite Z');
 const mimi=fixture(0,'Mimikyu','Life Orb');
 const i=six.findIndex(p=>p.species==='Metagross'),j=six.findIndex(p=>p.species==='Gholdengo');
 if(i<0||j<0)throw Error('Expected Metagross and Gholdengo roles');
 six[i]=luke;six[j]=mimi;
 return six;
}
const publicPlans={
 sun:['Rotom-Heat','Garchomp','Mimikyu'],
 rain:['Rotom-Heat','Rillaboom','Lucario'],
 mence:['Mimikyu','Garchomp','Lucario'],
 lucarioZ:['Garchomp','Rotom-Heat','Lucario'],
 gyarados:['Rotom-Heat','Garchomp','Lucario'],
 megaGolisopod:['Rotom-Heat','Lucario','Primarina'],
 psychic:['Garchomp','Mimikyu','Rotom-Heat'],
 volcarona:['Mimikyu','Rotom-Heat','Garchomp'],
 stall:['Lucario','Rotom-Heat','Rillaboom'],
 charX:['Garchomp','Mimikyu','Primarina']
};
module.exports={build,publicPlans};
