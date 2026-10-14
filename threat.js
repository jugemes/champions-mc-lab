'use strict';
// Public typing and base stats only; never query the opponent's unrevealed set.
// This is a rough STAB exposure metric, NOT a damage calculator.
function publicThreat(dex,defenderName,attackerName){
  const defender=dex.species.get(defenderName),attacker=dex.species.get(attackerName);
  if(!defender.exists||!attacker.exists)return 0;
  let worst=0;
  for(const type of attacker.types){
    const mult=dex.getImmunity(type,defender.types)?2**dex.getEffectiveness(type,defender.types):0;
    const phys=attacker.baseStats.atk/Math.max(40,defender.baseStats.def);
    const special=attacker.baseStats.spa/Math.max(40,defender.baseStats.spd);
    worst=Math.max(worst,mult*Math.max(phys,special));
  }
  return worst*100;
}
function defensiveCoverage(dex,selected,opponentSix){
  if(!opponentSix.length)return 0;
  // Each major opposing type should have at least one defensively plausible answer.
  return opponentSix.reduce((sum,foe)=>
    sum+Math.min(...selected.map(p=>publicThreat(dex,p.species,foe))),0
  )/opponentSix.length;
}
module.exports={publicThreat,defensiveCoverage};
