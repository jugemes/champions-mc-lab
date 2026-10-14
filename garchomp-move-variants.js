'use strict';
// One-move-at-a-time Garchomp candidates. All other five team members are
// copied without changing ability, nature, stat points, item, or moves.
const {teams}=require('./cycle3-teams');
function teamsForMoveAudit(){
 const seed=teams().C_rill_gholdengo_for_gengar;
 const E=teams().E_ee_primarina_for_skeledirge;
 function replaceMove(from,to){
   const t=structuredClone(seed), g=t.find(p=>p.species==='Garchomp');
   if(!g||g.moves.filter(m=>m===from).length!==1)throw Error('Unexpected move template: '+from);
   if(g.moves.includes(to))throw Error('Already contains '+to);
   g.moves=g.moves.map(m=>m===from?to:m);
   return t;
 }
 return {
  C0_Earthquake:structuredClone(seed),
  C1_TantrumForEarthquake:replaceMove('Earthquake','Stomping Tantrum'),
  C2_TantrumForRockSlide:replaceMove('Rock Slide','Stomping Tantrum'),
  C3_TantrumForPoisonJab:replaceMove('Poison Jab','Stomping Tantrum'),
  E_reference:structuredClone(E)
 };
}
module.exports={teamsForMoveAudit};
