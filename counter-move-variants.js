'use strict';
// Each candidate modifies exactly one move on a previously validated C/E team.
const {teams}=require('./cycle3-teams');
const baseC=teams().C_rill_gholdengo_for_gengar;
const baseE=teams().E_ee_primarina_for_skeledirge;
function replace(team,species,from,to){
 const t=structuredClone(team),p=t.find(x=>x.species===species);
 if(!p||!p.moves.includes(from)||p.moves.includes(to))throw Error('Bad single move replacement '+species+' '+from);
 p.moves=p.moves.map(m=>m===from?to:m);
 return t;
}
function candidates(){
 return {
  C0_standard:structuredClone(baseC),
  C1_StoneEdgeForRockSlide:replace(baseC,'Garchomp','Rock Slide','Stone Edge'),
  C2_StoneEdgeForPoisonJab:replace(baseC,'Garchomp','Poison Jab','Stone Edge'),
  E0_standard:structuredClone(baseE),
  E1_PowerGemForTrick:replace(baseE,'Starmie','Trick','Power Gem'),
  E2_PowerGemForGrassKnot:replace(baseE,'Starmie','Grass Knot','Power Gem'),
  E3_PowerGemForIceBeam:replace(baseE,'Starmie','Ice Beam','Power Gem')
 };
}
module.exports={candidates};