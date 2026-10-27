'use strict';
// Preview-safe ability knowledge. Own sets may use their actual selected
// ability; opposing sets may use ONLY abilities entailed by publicly known
// species/form. Never inspect unrevealed opposing moves, items, or set data.
const canon=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const BYPASS=new Set(['moldbreaker','teravolt','turboblaze']);
function possibleAbilities(dex,name){
  const species=dex.species.get(name);
  if(!species.exists)return [];
  return [...new Set(Object.values(species.abilities||{}).filter(Boolean))];
}
function certainPublicAbility(dex,name){
  const options=possibleAbilities(dex,name);
  return options.length===1?options[0]:'';
}
function ignoresAbilities(ability){return BYPASS.has(canon(ability));}
function couldIgnoreAbilities(dex,name){
  return possibleAbilities(dex,name).some(ignoresAbilities);
}
function isLevitateImmuneToGround(dex,defenderName,info={}){
  const ability=info.revealedAbility||certainPublicAbility(dex,defenderName);
  return canon(ability)==='levitate'
    &&!ignoresAbilities(info.attackerAbility)
    &&!info.attackerMayBypass
    &&!info.ignoreAbility
    &&!info.gravity
    &&!info.ignoreGroundLevitate;
}
module.exports={possibleAbilities,certainPublicAbility,ignoresAbilities,couldIgnoreAbilities,isLevitateImmuneToGround};
