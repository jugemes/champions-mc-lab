'use strict';
// E with optional Unaware Skeledirge restored, exactly one species replacement.
// No hidden opponent information or in-battle move changes between candidates.
const {teams}=require('./cycle3-teams');
const {variants}=require('./fixtures');
function getCandidates(){
 const seed=teams().E_ee_primarina_for_skeledirge;
 const C=teams().C_rill_gholdengo_for_gengar;
 const dirge=variants.A_rillaboom.find(p=>p.species==='Skeledirge');
 function swap(species){
  if(!seed.some(p=>p.species===species))throw Error('Missing '+species);
  return seed.map(p=>structuredClone(p.species===species?dirge:p));
 }
 return {
  E0_noUnaware:structuredClone(seed),
  E1_DirgeForEelektross:swap('Eelektross'),
  E2_DirgeForRillaboom:swap('Rillaboom'),
  E3_DirgeForGholdengo:swap('Gholdengo'),
  E4_DirgeForPrimarina:swap('Primarina'),
  C_reference:structuredClone(C)
 };
}
module.exports={getCandidates};