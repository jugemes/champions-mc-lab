'use strict';
// Opt-in preview research candidate. Uses only own known six sets and rival
// public species. Legal coverage and Scarf are POSSIBILITY bounds, not
// prevalence estimates or leaked rival sets. Not a default rank policy.
const {rankPreview}=require('./preview-policy');
const {publicCoverageBand}=require('./public-coverage-band');
function rankPublicCoveragePreview(sim,own,publicSix,matchup){
  const dex=sim.Dex.mod('champions');
  const base=rankPreview(dex,own,publicSix,matchup);
  const bands=own.map(p=>publicSix.map(foe=>publicCoverageBand(sim,p,foe)));
  const risk=b=>{
    const speed=b.speed.canOutspeedUnboosted?1:b.speed.canOutspeedWithScarf?.55:.2;
    return Math.max(0,b.worstPossible-.65)*speed;
  };
  const ranked=base.map(c=>{
    // Do not require that all speculative coverage moves coexist. This is a
    // stress-screen for vulnerable leads and a team without any safe pivot.
    const minRisk=publicSix.map((_,f)=>Math.min(...c.three.map(i=>risk(bands[i][f]))));
    const teamPenalty=10*minRisk.reduce((a,b)=>a+Math.min(2,b),0)/6+
      7*minRisk.filter(x=>x>.35).length;
    const leads=c.leads.map(l=>{
      const row=bands[l.i].map(risk).sort((a,b)=>b-a);
      const penalty=22*(Math.min(2,row[0]||0)+.4*Math.min(2,row[1]||0));
      return {...l,score:l.score-penalty,possibleRisk:row.slice(0,2),penalty};
    }).sort((a,b)=>b.score-a.score||a.i-b.i);
    return {...c,originalScore:c.score,score:c.score-teamPenalty,
      riskPenalty:teamPenalty,leads};
  });
  return ranked.sort((a,b)=>b.score-a.score||a.three.join('').localeCompare(b.three.join('')));
}
function choosePublicCoveragePreview(sim,own,publicSix,matchup){
  const ranked=rankPublicCoveragePreview(sim,own,publicSix,matchup);
  const best=ranked[0],lead=best.leads[0].i;
  const rest=best.three.filter(i=>i!==lead).sort((a,b)=>{
    const ra=best.leads.find(x=>x.i===a).score,rb=best.leads.find(x=>x.i===b).score;
    return rb-ra||a-b;
  });
  return {selection:[lead,...rest].map(i=>i+1),status:'research-only',
    lead:own[lead].species,score:+best.score.toFixed(2),
    originalScore:+best.originalScore.toFixed(2),
    riskPenalty:+best.riskPenalty.toFixed(2),
    warning:'Uncalibrated upper possibility screen; no move prevalence or win-rate claim'};
}
module.exports={rankPublicCoveragePreview,choosePublicCoveragePreview};
