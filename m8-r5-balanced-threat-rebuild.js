'use strict';
// R5 proposed 2026-11-04 before results, PR #104 comment #6620917760.
// New selected-three architecture: Baxcalibur ice, Mega Metagross priority
// steel, Heat Rotom weather resistance. NOT a deployed ladder team.
const {build:old}=require('./m8-baxcalibur-rebuild');
const {reportedLive}=require('./reported-live-roster-20261027');
const c=x=>structuredClone(x);
const get=(team,s)=>{const p=team.find(x=>x.species===s);
 if(!p)throw Error('Missing '+s);return c(p);};
function build(){
 const prior=old(),live=reportedLive();
 const bax=get(prior,'Baxcalibur');
 if(!bax.moves.includes('Earthquake'))throw Error('Bax Earthquake expected');
 bax.moves=bax.moves.map(m=>m==='Earthquake'?'Dragon Dance':m);
 return [get(live,'Metagross'),bax,get(prior,'Rotom-Heat'),
   get(prior,'Rillaboom'),get(live,'Primarina'),get(prior,'Gholdengo')];
}
const publicPlans={
 sun:['Rotom-Heat','Baxcalibur','Metagross'],
 rain:['Rotom-Heat','Rillaboom','Primarina'],
 megaGolisopod:['Primarina','Rotom-Heat','Metagross'],
 megaSalamence:['Baxcalibur','Metagross','Primarina'],
 stall:['Gholdengo','Rotom-Heat','Rillaboom']
};
module.exports={build,publicPlans};
