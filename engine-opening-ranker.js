'use strict';
/**
 * Research-only maximin preview ranking over ALL 20 legal own trios and their
 * three leads, against multiple plausible opponent-three/lead hypotheses.
 *
 * The rival's actual selected three and its items/moves are NOT inputs. Even
 * after seeing an opposing lead, the move decision cannot depend on the two
 * unobserved backline members or on an unobserved Mega choice.
 *
 * This is a small, explicitly scripted two-turn adversarial stress objective,
 * NOT an empirically trained AI, probability model, or complete 3v3 search.
 */
const {rankRationalPreview}=require('./preview-rational');
const {checkOpeningBranches}=require('./engine-opening-branches');
function scoreBranch(x){
  // A transparent exploratory payoff; weights are not calibrated to wins.
  // Each faint is material; reward retained team HP, penalize setup.
  const score=3*(x.foeFaintedCount-x.ownFaintedCount)
    +1.5*(x.ownTeamRemaining-x.foeTeamRemaining)
    -0.25*Math.max(0,x.foeAttackBoost);
  return +score.toFixed(4);
}
function robustLeadOutcomes(results){
  const grouped=new Map();
  for(const x of results){
    // The enemy lead becomes visible at battle start, but their remaining
    // selected two, item, chosen move and Mega decision stay unknown.
    const lead=x.assumedEnemyLead;
    if(!grouped.has(lead))grouped.set(lead,new Map());
    const moves=grouped.get(lead);
    if(!moves.has(x.ourFirstMove))moves.set(x.ourFirstMove,[]);
    moves.get(x.ourFirstMove).push(x);
  }
  const assessments=[];
  for(const [enemyLead,actions] of grouped){
    const scored=[...actions].map(([action,rows])=>({
      action,adversarialWorst:Math.min(...rows.map(scoreBranch)),
      meanUnweighted:rows.reduce((s,x)=>s+scoreBranch(x),0)/rows.length,
      tested:rows.length,secondExecuted:rows.filter(x=>x.secondExecuted).length,
      unfinished:rows.filter(x=>x.secondSkipped&&!x.secondExecuted).length
    }));
    scored.sort((a,b)=>b.adversarialWorst-a.adversarialWorst
      ||b.meanUnweighted-a.meanUnweighted||a.action.localeCompare(b.action));
    assessments.push({enemyLead,bestAvailableFirstAction:scored[0],options:scored});
  }
  return assessments;
}
function rankOpeningTrioLeads(sim,ownSix,publicSix,{
  maxScenes=4,seed=[2026,10,28,1],limit=60
}={}){
  const ranked=rankRationalPreview(sim.Dex.mod('champions'),ownSix,publicSix);
  const evaluated=[];
  for(const candidate of ranked){
    for(const lead of candidate.three){
      const ownThree=[lead,...candidate.three.filter(i=>i!==lead)].map(i=>ownSix[i].species);
      const audit=checkOpeningBranches(sim,ownSix,publicSix,{
        ownLead:ownThree[0],ownThree,maxScenes,seed
      });
      const threats=robustLeadOutcomes(audit.results);
      const values=threats.map(t=>t.bestAvailableFirstAction.adversarialWorst);
      evaluated.push({
        ownThree,lead:ownThree[0],
        scoreWorst:Math.min(...values),scoreScenarioMean:values.reduce((a,b)=>a+b,0)/values.length,
        oldRationalTrioRank:ranked.indexOf(candidate)+1,
        oldRationalTrioScore:+candidate.score.toFixed(3),
        scenarioLeads:threats.map(t=>({enemyLead:t.enemyLead,
          bestFirstAction:t.bestAvailableFirstAction.action,
          payoff:t.bestAvailableFirstAction.adversarialWorst,
          horizonCoverage:t.bestAvailableFirstAction.secondExecuted+'/'+t.bestAvailableFirstAction.tested
        })),
        opponentScenarios:audit.opponentScenes,
        comparisons:audit.results.length
      });
      if(evaluated.length>=limit)break;
    }
    if(evaluated.length>=limit)break;
  }
  evaluated.sort((a,b)=>b.scoreWorst-a.scoreWorst
    ||b.scoreScenarioMean-a.scoreScenarioMean
    ||a.oldRationalTrioRank-b.oldRationalTrioRank
    ||a.lead.localeCompare(b.lead));
  return {
    publicSix:[...publicSix],evaluated:evaluated.length,
    baseline:{
      three:ranked[0].three.map(i=>ownSix[i].species),
      lead:ownSix[ranked[0].leads[0].i].species
    },
    top:evaluated.slice(0,10),
    all:evaluated,
    warning:'Exploratory risk-averse two-turn script ranking; NOT true game-theoretic minimax, measured usage odds, complete 3v3 strategy or proved ladder improvement. Some branches stop at forced replacement. Record alternative opponent leads, not their actual hidden three.'
  };
}
module.exports={scoreBranch,robustLeadOutcomes,rankOpeningTrioLeads};
