'use strict';
const {teams:cycle2}=require('./cycle2-teams');
const {variants}=require('./fixtures');
const {pool}=require('./optimize');
const get=s=>pool().B_eelektross.find(p=>p.species===s)||variants.A_rillaboom.find(p=>p.species===s);
function replace(t,from,set){
 if(!t.some(p=>p.species===from))throw Error('Missing '+from);
 return t.map(p=>structuredClone(p.species===from?set:p));
}
function teams(){
 const prior=cycle2(),c=prior.C_with_rillaboom,e=prior.E_with_eelektross_for_primarina;
 const ghold=variants.A_rillaboom.find(p=>p.species==='Gholdengo');
 return {
  C_rill_control:structuredClone(c),
  C_rill_electross_for_gengar:replace(c,'Gengar',get('Eelektross')),
  C_rill_gholdengo_for_gengar:replace(c,'Gengar',ghold),
  C_rill_electross_for_primarina:replace(c,'Primarina',get('Eelektross')),
  C_rill_starmie_for_garchomp:replace(c,'Garchomp',get('Starmie')),
  C_rill_corviknight_for_skeledirge:replace(c,'Skeledirge',variants.C_master.find(p=>p.species==='Corviknight')),
  E_ee_control:structuredClone(e),
  E_ee_primarina_for_rillaboom:replace(e,'Rillaboom',get('Primarina')),
  E_ee_garchomp_for_starmie:replace(e,'Starmie',variants.C_master.find(p=>p.species==='Garchomp')),
  E_ee_primarina_for_skeledirge:replace(e,'Skeledirge',get('Primarina')),
  E_ee_lucario_for_golisopod:replace(e,'Golisopod',get('Lucario')),
  E_ee_gengar_for_golisopod:replace(e,'Golisopod',variants.C_master.find(p=>p.species==='Gengar')),
 };
}
module.exports={teams};