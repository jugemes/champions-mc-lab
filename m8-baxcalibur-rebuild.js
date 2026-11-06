'use strict';
// Preregistered in PR #104 issuecomment-6620782432 before testing.
// R4-Bax: first genuine 6-member redistribution to cover fast Dragons
// after R3H improved the Charizard Y lead but failed Salamence/Garch/Mimikyu.
const {candidates:rotoms}=require('./m8-weather-resilient-candidates');
const {groups}=require('./environment-m7-teams');
const c=x=>structuredClone(x);
const bax=groups[6].team.find(p=>p.species==='Baxcalibur'&&p.item==='Focus Sash');
if(!bax)throw Error('Need exact legal Baxcalibur fixture');
function build(){
 const team=c(rotoms().R3_heat_noSand),idx=team.findIndex(p=>p.species==='Primarina');
 if(idx<0)throw Error('R3H expected Primarina');
 team.splice(idx,1,c(bax));
 return team;
}
const publicPlans={
 sun:['Rotom-Heat','Baxcalibur','Gholdengo'],
 rain:['Rotom-Heat','Rillaboom','Garchomp'],
 megaGolisopod:['Garchomp','Rotom-Heat','Mimikyu'],
 megaSalamence:['Baxcalibur','Gholdengo','Rotom-Heat'],
 stall:['Gholdengo','Garchomp','Rotom-Heat']
};
module.exports={build,publicPlans};
