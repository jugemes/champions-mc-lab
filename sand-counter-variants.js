'use strict';
const {teams}=require('./cycle3-teams');
const c=teams().C_rill_gholdengo_for_gengar;
const e=teams().E_ee_primarina_for_skeledirge;
const tyranitar={
 species:'Tyranitar',item:'Lum Berry',ability:'Sand Stream',nature:'Adamant',
 evs:{hp:32,atk:32,spd:2},
 moves:['Stone Edge','Knock Off','Ice Punch','Stealth Rock']
};
function replace(t,from){
 if(!t.some(p=>p.species===from))throw Error('Missing '+from);
 return t.map(p=>structuredClone(p.species===from?tyranitar:p));
}
function candidates(){
 return {
  C0_standard:structuredClone(c),
  C1_TyranitarForGholdengo:replace(c,'Gholdengo'),
  C2_TyranitarForRillaboom:replace(c,'Rillaboom'),
  E0_standard:structuredClone(e),
  E1_TyranitarForGholdengo:replace(e,'Gholdengo'),
  E2_TyranitarForRillaboom:replace(e,'Rillaboom'),
  E3_TyranitarForEelektross:replace(e,'Eelektross')
 };
}
module.exports={candidates};