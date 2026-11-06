'use strict';
// M-8 weather-resilient countermeasure: PR104 issuecomment-6620657980.
// Independent alternatives to R1's Tyranitar slot. Both are experimental.
const {candidates:old}=require('./m8-rebuild-candidates');
const {reportedLive}=require('./reported-live-roster-20261027');
const clone=x=>structuredClone(x);
const src=reportedLive().find(p=>p.species==='Rotom-Wash');
if(!src)throw Error('Missing reported Rotom-Wash fixture');
function make(form){
 const team=clone(old().R1_megaGarchZ_sand_doubleSetup);
 const idx=team.findIndex(p=>p.species==='Tyranitar');
 if(idx<0)throw Error('R1 Tyranitar baseline missing');
 const p=clone(src);
 if(form==='Heat'){
  p.species='Rotom-Heat';
  p.moves=p.moves.map(m=>m==='Hydro Pump'?'Overheat':m);
 }
 team.splice(idx,1,p);
 return team;
}
const builders={
 R3_heat_noSand:()=>make('Heat'),
 R3_wash_noSand:()=>make('Wash')
};
const publicPlans={
 sun:{
  R3_heat_noSand:['Rotom-Heat','Garchomp','Primarina'],
  R3_wash_noSand:['Rotom-Wash','Garchomp','Primarina']},
 rain:{
  R3_heat_noSand:['Rotom-Heat','Rillaboom','Garchomp'],
  R3_wash_noSand:['Rotom-Wash','Rillaboom','Garchomp']},
 megaGolisopod:{
  R3_heat_noSand:['Garchomp','Primarina','Mimikyu'],
  R3_wash_noSand:['Garchomp','Primarina','Mimikyu']},
 megaSalamence:{
  R3_heat_noSand:['Mimikyu','Gholdengo','Rotom-Heat'],
  R3_wash_noSand:['Mimikyu','Gholdengo','Rotom-Wash']},
 stall:{
  R3_heat_noSand:['Gholdengo','Garchomp','Rillaboom'],
  R3_wash_noSand:['Gholdengo','Garchomp','Rillaboom']}
};
function candidates(){return Object.fromEntries(Object.entries(builders).map(([k,f])=>[k,f()]));}
module.exports={candidates,publicPlans};
