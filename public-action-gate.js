'use strict';
// Research-only public-information T1/T2 feasibility gate.
// Does not inspect the opposing actual selected three, private set, item or moves.
// A publicly unique ability is known from the shown species; an explicitly
// revealed ability takes precedence. Do not infer uncertain ability slots.
const id=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function publicCertainAbility(dex,foeName,revealedAbility=''){
  if(revealedAbility)return id(revealedAbility);
  const species=dex.species.get(foeName);
  if(!species.exists)return '';
  const possibilities=new Set(Object.values(species.abilities||{}).filter(Boolean).map(id));
  return possibilities.size===1?[...possibilities][0]:'';
}
function blockedPublicTargetStatus(dex,foeName,moveName,{revealedAbility='',ownAbility=''}={}){
  const move=dex.moves.get(moveName);
  if(!move.exists||move.category!=='Status')return false;
  // Side/field/self status moves do not target the opposing Pokemon.
  if(!['normal','adjacentFoe'].includes(move.target))return false;
  // Mold Breaker-style abilities can bypass Good as Gold; never block those.
  if(['moldbreaker','teravolt','turboblaze'].includes(id(ownAbility)))return false;
  return publicCertainAbility(dex,foeName,revealedAbility)==='goodasgold';
}
module.exports={publicCertainAbility,blockedPublicTargetStatus};
