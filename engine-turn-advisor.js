'use strict';
/**
 * P0 stage 3 candidate: SHOWDOWN-BASED CONDITIONAL move advice.
 * This does not make up probabilities for unseen moves, Mega choices or
 * opponent team selection. It refuses a universal decision when distinct
 * legally plausible scenarios point to different moves.
 *
 * This is offline advisory output, NOT opt-in for the existing duel bot yet.
 */
const {publicMoveOutcomes}=require('./public-turn-options');
function outcomeQuality(x){
  return [
    x.foeFainted?1:0,
    x.ownFainted?0:1,
    -(x.foeAttackBoost||0),
    -x.foeHP,
    x.ownHP
  ];
}
function compareQuality(a,b){
  const x=outcomeQuality(a),y=outcomeQuality(b);
  for(let i=0;i<x.length;i++)if(Math.abs(x[i]-y[i])>1e-8)return x[i]>y[i]?-1:1;
  return a.ownMove.localeCompare(b.ownMove);
}
function adviseEngineTurn(sim,ownSix,publicSix,options){
  const sample=publicMoveOutcomes(sim,ownSix,publicSix,options);
  const cases=new Map();
  for(const entry of sample.cases){
    const key=JSON.stringify([entry.source,entry.assumedItem,
      entry.assumedAbility,entry.opponentMove,entry.opponentMega]);
    if(!cases.has(key))cases.set(key,[]);
    cases.get(key).push(entry);
  }
  const byScenario=[];
  for(const [key,entries] of cases){
    const [source,item,ability,foeMove,mega]=JSON.parse(key);
    const sorted=entries.slice().sort(compareQuality);
    const top=sorted[0];
    byScenario.push({
      hypothesisSource:source,assumedOpponentItem:item,assumedOpponentAbility:ability,
      assumedOpponentMove:foeMove,assumedMega:mega,
      preferredMove:top.ownMove,
      evidence:{
        foeFainted:top.foeFainted,ownFainted:top.ownFainted,
        foeAttackBoost:top.foeAttackBoost,
        foeRemaining:+top.foeHP.toFixed(3),ownRemaining:+top.ownHP.toFixed(3)
      },
      comparison:sorted.map(e=>({move:e.ownMove,foeFainted:e.foeFainted,
        foeAttackBoost:e.foeAttackBoost,foeRemaining:+e.foeHP.toFixed(3),
        ownFainted:e.ownFainted}))
    });
  }
  const candidates=[...new Set(byScenario.map(x=>x.preferredMove))];
  return {
    publicSix:[...publicSix],ownLead:sample.ourLead,foeLead:sample.opponentLead,
    decision:candidates.length===1?'unanimous-in-tested-hypotheses':'conditional',
    commonMove:candidates.length===1?candidates[0]:null,
    byScenario,
    epistemicWarning:'Ranking is a limited one-turn tactical ordering, NOT 3v3 strategic optimality. Scenarios are not sampled by usage rate. No real rival private data were used.'
  };
}
module.exports={outcomeQuality,compareQuality,adviseEngineTurn};
