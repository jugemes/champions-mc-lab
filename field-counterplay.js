'use strict';
// v3 adds rules which depend on PUBLIC weather and terrain.
// Explicitly a candidate policy; v2 remains the control.
const {evaluateMove}=require('./decision-v2');
const {canonical}=require('./tactics');
function isGroundedPublic(dex,name,info={}){
  const species=dex.species.get(name);
  if(!species.exists)return true;
  if(species.types.includes('Flying'))return false;
  if(canonical(info.foeAbility)==='levitate')return false;
  if(canonical(info.foeItem)==='airballoon')return false;
  return true; // no guessing unrevealed abilities or items
}
function blockedByPsychicTerrain(dex,name,moveName,info={}){
  if(canonical(info.terrain)!=='psychicterrain')return false;
  const m=dex.moves.get(moveName);
  if(!m.exists||m.priority<=0||m.target==='self')return false;
  // Grassy Glide only acquires priority on Grassy Terrain, not Psychic Terrain.
  return isGroundedPublic(dex,name,info);
}
function evaluateMoveV3(dex,own,foeName,moveName,info={}){
  if(blockedByPsychicTerrain(dex,foeName,moveName,info))return -1e5;
  return evaluateMove(dex,own,foeName,moveName,info);
}
module.exports={isGroundedPublic,blockedByPsychicTerrain,evaluateMoveV3};