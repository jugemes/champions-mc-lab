'use strict';
// R7 hypothesis pre-registered PR #104 comment #6622249073.
// Keep all R5 roles except Bax -> Scarf Garchomp. With Grassy Surge, compare
// Earthquake (base 100, terrain halves damage to grounded targets)
// against Stomping Tantrum (base 75, terrain does not halve).
// No claim of rank performance; all changes are research-only.
const {build:r5build}=require('./m8-r5-balanced-threat-rebuild');
const {reportedLive}=require('./reported-live-roster-20261027');
const clone=x=>structuredClone(x);
function build(useStomping=true){
 const six=r5build();
 const garch=reportedLive().find(p=>p.species==='Garchomp'&&p.item==='Choice Scarf');
 if(!garch||!garch.moves.includes('Earthquake'))throw Error('Scarf Garchomp fixture moved');
 const ix=six.findIndex(p=>p.species==='Baxcalibur');
 if(ix<0)throw Error('R5 Baxcalibur missing');
 const p=clone(garch);
 if(useStomping)p.moves=p.moves.map(x=>x==='Earthquake'?'Stomping Tantrum':x);
 six[ix]=p;
 return six;
}
const candidates={
 R7T_grassyScarfTantrum:()=>build(true),
 R7E_grassyScarfEarthquake:()=>build(false)
};
const publicPlans={
 sun:['Rotom-Heat','Garchomp','Metagross'],
 rain:['Rotom-Heat','Rillaboom','Gholdengo'],
 mence:['Garchomp','Metagross','Gholdengo'],
 lucarioZ:['Garchomp','Primarina','Metagross'],
 gyarados:['Rotom-Heat','Garchomp','Metagross'],
 rain_ground_grass:['Rillaboom','Garchomp','Rotom-Heat']
};
module.exports={build,candidates,publicPlans};
