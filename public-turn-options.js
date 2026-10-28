'use strict';
/**
 * P0-1 tactical exploration, opt-in and offline only.
 * Does NOT read a live opponent's private team. Builds assumptions solely from
 * public six and a separately authored M-7 synthetic set catalog, then lets
 * Showdown simulate both players' one-turn choices in their own isolated Battle.
 * No arbitrarily assigned probability for any hypothesis/choice.
 */
const {publicHypotheses}=require('./public-hypotheses');
const {engineTurnSample}=require('./engine-reference');
function publicMoveOutcomes(sim,ownSix,publicSix,{
  ourLead,opponentLead,assumptions=1,opponentMoves=null,seed=[2026,10,28,1],
  ourMega=false
}={}){
  if(!ourLead||!opponentLead||!publicSix.includes(opponentLead))
    throw Error('both leads required; opponent lead must be among public six');
  const us=ownSix.find(p=>p.species===ourLead);
  if(!us)throw Error('known own lead not on six');
  const generated=publicHypotheses(sim,publicSix,{limit:assumptions});
  const cases=[];
  for(const scenario of generated.assumptions){
    const set=scenario.team.find(p=>p.species===opponentLead);
    if(!set)throw Error('missing scenario opposing lead');
    const item=sim.Dex.mod('champions').items.get(set.item);
    const canMega=Boolean(item.megaStone);
    // A Mega Stone does not mean the rival MUST Mega on this turn.
    // Both legal branches are separate, equally unlabeled possibilities.
    const options=canMega?[false,true]:[false];
    const theirMoves=opponentMoves==null?set.moves:opponentMoves;
    if(!Array.isArray(theirMoves)||!theirMoves.length||
       theirMoves.some(m=>!set.moves.includes(m)))
      throw Error('opponent test actions must be explicitly legal set moves');
    for(const mega of options){
      for(const foeMove of theirMoves){
        for(const ownMove of us.moves){
          const result=engineTurnSample(sim,ownSix,scenario.team,{
            ourLead,opponentLead,ourMove:ownMove,opponentMove:foeMove,
            ourMega,opponentMega:mega,seed
          });
          cases.push({
            ownMove,opponentMove:foeMove,opponentMega:mega,
            assumedItem:set.item,assumedAbility:set.ability,
            ownHP:result.ourAfter.hp/result.ourAfter.maxhp,
            foeHP:result.opponentAfter.hp/result.opponentAfter.maxhp,
            foeFainted:result.opponentAfter.fainted,
            ownFainted:result.ourAfter.fainted,
            foeAttackBoost:result.opponentAfter.boosts.atk,
            ourForm:result.ourAfter.form,foeForm:result.opponentAfter.form,
            source:scenario.sources.find(s=>s.species===opponentLead).source,
            events:result.events
          });
        }
      }
    }
  }
  const summary=us.moves.map(move=>{
    const subset=cases.filter(x=>x.ownMove===move);
    return {
      move,
      testedCases:subset.length,
      enemyKO:subset.filter(x=>x.foeFainted).length,
      ownKO:subset.filter(x=>x.ownFainted).length,
      enemyBoosted:subset.filter(x=>x.foeAttackBoost>=2).length,
      enemySurvivingFractionRange:[
        +Math.min(...subset.map(x=>x.foeHP)).toFixed(3),
        +Math.max(...subset.map(x=>x.foeHP)).toFixed(3)
      ]
    };
  });
  return {
    ourLead,opponentLead,publicSix:[...generated.publicSix],
    assumptionsUsed:generated.assumptions.length,
    comparisons:summary,cases,
    warning:'Tested hypothetical moves/forms are NOT observed enemy choices. Counts are scenario coverage, not probabilities or prediction. Engine one-turn only.'
  };
}
module.exports={publicMoveOutcomes};
