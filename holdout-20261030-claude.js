'use strict';
// NEW holdout public six for the legal-search audit (PR for #64), written
// BEFORE legal-search was run against it. Species are the public six of the
// user's real ladder loss "E" in docs/REAL-BATTLE-CASES-2026-10-27.md
// (Raichu / Meowscarada / Charizard / Garchomp / Basculegion / Corviknight;
// Mega Charizard Y swept). The rival's actual sets, items and three were NOT
// observed: every set below is a hand-written legal M-C HYPOTHESIS, not
// produced by legal-role-hypotheses.js (so the search is not graded against
// its own hypothesis generator). Preview AIs only ever see species names.
const {opponents}=require('./threat-scenarios-20261014');
const {variants}=require('./fixtures');
const A=require('./hybrid01-audit');
const mk=(s,item,ability,nature,points,moves)=>A.set(s,item,ability,nature,points,moves);
function teams(){
  const charY=structuredClone(opponents.sun_charizard_y.find(p=>p.species==='Charizard'));
  const corv=structuredClone(variants.C_master.find(p=>p.species==='Corviknight'));
  const six=[
    mk('Raichu','Focus Sash','Lightning Rod','Timid',{hp:2,spa:32,spe:32},['Thunderbolt','Grass Knot','Focus Blast','Nasty Plot']),
    mk('Meowscarada','Life Orb','Protean','Jolly',{hp:2,atk:32,spe:32},['Flower Trick','Knock Off','U-turn','Sucker Punch']),
    charY,
    mk('Garchomp','Choice Scarf','Rough Skin','Jolly',{hp:2,atk:32,spe:32},['Earthquake','Outrage','Rock Slide','Poison Jab']),
    mk('Basculegion','Mystic Water','Adaptability','Adamant',{hp:2,atk:32,spe:32},['Wave Crash','Last Respects','Aqua Jet','Flip Turn']),
    corv,
  ];
  return {
    claude_realE_sun:{team:six,forcedA:['Charizard','Garchomp','Meowscarada'],forcedB:['Corviknight','Basculegion','Raichu']},
  };
}
module.exports={teams};
