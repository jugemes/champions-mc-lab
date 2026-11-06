'use strict';
// Preregistered in PR104 comment #6621479933. R6 replaces two R5 slots:
// Baxcalibur -> Scarf Garchomp, Rillaboom -> Meowscarada.
// No AI performance or rank superiority is presumed.
const {build:r5build}=require('./m8-r5-balanced-threat-rebuild');
const {reportedLive}=require('./reported-live-roster-20261027');
const {candidates}=require('./m8-rebuild-candidates');
const c=x=>structuredClone(x);
function build(){
 const t=r5build();
 const scarf=reportedLive().find(x=>x.species==='Garchomp'&&x.item==='Choice Scarf');
 const meow=candidates().R2_megaCharX_hippo_setup.find(x=>x.species==='Meowscarada');
 if(!scarf||!meow)throw Error('Missing original verified species');
 const bax=t.findIndex(x=>x.species==='Baxcalibur');
 const rilla=t.findIndex(x=>x.species==='Rillaboom');
 if(bax<0||rilla<0)throw Error('R5 does not have intended replaced slots');
 t[bax]=c(scarf);t[rilla]=c(meow);
 return t;
}
const publicPlans={
 sun:['Rotom-Heat','Garchomp','Metagross'],
 rain:['Rotom-Heat','Meowscarada','Gholdengo'],
 mence:['Garchomp','Metagross','Gholdengo'],
 lucarioZ:['Garchomp','Primarina','Metagross'],
 gyarados:['Rotom-Heat','Garchomp','Metagross']
};
module.exports={build,publicPlans};
