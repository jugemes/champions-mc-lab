'use strict';
// OPEN8 research primitive: pre-registered branch-specific Battle outcomes.
// Scores must come from actual full 3v3 Battle (or explicitly labelled scenario
// evaluation); this module NEVER converts independent 1v1 scores to 3v3 results.
const {combinations}=require('./m8-open7-public-three-minimax-20261105');
function chooseByBranchOutcomes({ownSix,publicSix,branches,outcomes}) {
  if(!Array.isArray(ownSix)||ownSix.length!==6||new Set(ownSix).size!==6)throw Error('Six distinct own members required');
  if(!Array.isArray(publicSix)||publicSix.length!==6||new Set(publicSix).size!==6)throw Error('Six distinct public opponents required');
  if(!Array.isArray(branches)||!branches.length||!Array.isArray(outcomes))throw Error('Registered branches and outcomes required');
  const visible=new Set(publicSix), keys=new Set();
  for(const b of branches){
    if(!b||typeof b.id!=='string'||!b.id||keys.has(b.id)||!Array.isArray(b.three)||b.three.length!==3||new Set(b.three).size!==3||b.three.some(x=>!visible.has(x)))throw Error('Invalid pre-registered branch');
    keys.add(b.id);
  }
  const map=new Map();
  for(const o of outcomes){
    if(!o||!keys.has(o.branch)||!Array.isArray(o.three)||o.three.length!==3||new Set(o.three).size!==3||o.three.some(x=>!ownSix.includes(x))||!o.three.includes(o.lead)||!Number.isFinite(o.score)||o.score<0||o.score>1)throw Error('Invalid outcome');
    const canon=o.three.slice().sort().join('|');
    const key=JSON.stringify([canon,o.lead,o.branch]);
    if(map.has(key))throw Error('Duplicate outcome: '+key);
    map.set(key,o.score);
  }
  const ranked=[];
  for(const three of combinations(ownSix)){
    for(const lead of three){
      const canon=three.slice().sort().join('|');
      const scores=branches.map(b=>map.get(JSON.stringify([canon,lead,b.id])));
      if(scores.some(s=>s===undefined))continue; // No optimistic fill for untested scenarios
      ranked.push({three,lead,worst:Math.min(...scores),mean:scores.reduce((a,b)=>a+b,0)/scores.length,branchScores:Object.fromEntries(branches.map((b,i)=>[b.id,scores[i]]))});
    }
  }
  ranked.sort((a,b)=>b.worst-a.worst||b.mean-a.mean||JSON.stringify([a.three,a.lead]).localeCompare(JSON.stringify([b.three,b.lead])));
  return {selected:ranked[0]||null,ranked,coverage:{completeChoices:ranked.length,possibleChoices:60,registeredBranches:branches.length},limitations:['Scores are provided externally, not inferred from 1v1 proxy','Only complete branch coverage can rank a selection','Do not use hidden enemy three to choose in live Battle']};
}
module.exports={chooseByBranchOutcomes};
