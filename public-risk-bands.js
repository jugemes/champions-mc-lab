'use strict';
// Public-data-only diagnostics for Champions M-C team preview (Issue #13).
// Never consumes an opposing set, moves, item, nature, ability points or actual 3.
// A legal move is a POSSIBLE coverage hypothesis, not an estimated usage rate.
const {ownStat}=require('./own-form');
const {incomingRisk}=require('./damage');
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function speedInterval(dex,speciesName,{scarf=false}={}){
  const species=dex.species.get(speciesName);
  if(!species.exists)throw Error('Unknown public species: '+speciesName);
  const base=species.baseStats.spe;
  // Champions lv50: floor((base + ability points[0..32] + 20) * nature).
  const min=Math.floor((base+20)*0.9+1e-9);
  const max=Math.floor((base+32+20)*1.1+1e-9);
  // Exact speed comparisons are engine-owned. The possible Choice Scarf
  // alternative is explicitly hypothetical, NEVER inferred to be held.
  return {min:scarf?Math.floor(min*1.5):min,
    max:scarf?Math.floor(max*1.5):max,scarfHypothesis:scarf};
}
function speedOutlook(dex,ownSet,opponentSpecies,{mega=true}={}){
  const ownSpeed=ownStat(dex,ownSet,'spe',{mega});
  const normal=speedInterval(dex,opponentSpecies);
  const scarf=speedInterval(dex,opponentSpecies,{scarf:true});
  const view=range=>({
    alwaysFasterThanUs:range.min>ownSpeed,
    mayMoveFirst:range.max>=ownSpeed, // includes possible speed ties
    alwaysSlowerThanUs:range.max<ownSpeed,
    speedTiePossible:range.min<=ownSpeed&&range.max>=ownSpeed
  });
  return {ownSpeed,normal,scarfHypothesis:scarf,normalOutlook:view(normal),
    scarfOutlook:view(scarf)};
}
function candidateCoverage(dex,opponentSpecies,validator,{candidateMoveNames}={}){
  const species=dex.species.get(opponentSpecies);
  if(!species.exists)throw Error('Unknown public species: '+opponentSpecies);
  if(!validator||typeof validator.validateSet!=='function')
    throw Error('M-C TeamValidator required for legal coverage diagnostics');
  const learned=dex.learnsets.get(species.name).learnset||{};
  const names=candidateMoveNames===undefined?Object.keys(learned):candidateMoveNames;
  if(!Array.isArray(names))throw TypeError('candidateMoveNames must be an array');
  const out=[],seen=new Set();
  for(const input of names){
    const m=dex.moves.get(input);
    if(!m.exists||seen.has(m.id)||!Object.hasOwn(learned,m.id))continue;
    seen.add(m.id);
    if(m.category==='Status'||m.basePower<50||species.types.includes(m.type))continue;
    // Validate a hypothetical one-move set against *this* M-C validator.
    // This does not assert that an actual opponent knows or uses this move.
    const hypothetical={species:species.name,ability:species.abilities['0'],
      item:'Sitrus Berry',nature:'Serious',level:50,
      evs:{hp:32,atk:0,def:0,spa:32,spd:0,spe:2},moves:[m.name]};
    const errors=validator.validateSet(hypothetical,{})||[];
    if(errors.length===0)out.push({name:m.name,type:m.type,category:m.category,
      basePower:m.basePower});
  }
  return out.sort((a,b)=>a.name.localeCompare(b.name));
}
function publicRiskBand(dex,ownSet,opponentSpecies,validator,{candidateMoveNames}={}){
  const baseline=incomingRisk(dex,ownSet,opponentSpecies,{});
  const possible=candidateCoverage(dex,opponentSpecies,validator,{candidateMoveNames});
  const ranked=possible.map(move=>({
    ...move,
    upperRisk:incomingRisk(dex,ownSet,opponentSpecies,{seenMoves:[move.name]})
  })).sort((a,b)=>b.upperRisk-a.upperRisk||a.name.localeCompare(b.name));
  const worst=ranked[0]?.upperRisk??baseline;
  return {
    baselineStabUpper:baseline,possibleCoverageUpper:Math.max(baseline,worst),
    worstCoverageMoves:ranked.filter(r=>r.upperRisk===worst).map(r=>r.name),
    exploredCoverageCount:possible.length,
    // Upper is a stress bound over possible moves: NOT move frequency or a
    // probability of taking a KO. It is never used to auto-rank choices yet.
    interpretation:'legal-possibility-only',
    candidates:ranked
  };
}
module.exports={speedInterval,speedOutlook,candidateCoverage,publicRiskBand};
