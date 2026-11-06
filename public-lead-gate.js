'use strict';
// Research-only lead counterfactual: preserve legacy three and change ONLY
// lead if multiple PUBLIC species can threaten an immediate KO without Scarf.
// Legal possibility is not prevalence, and this is not a rank-ready policy.
const {chooseThree}=require('./lab');
const {publicCoverageBand}=require('./public-coverage-band');

function chooseLeadGate(sim,own,publicSix,matchup){
  if(own.length!==6||publicSix.length!==6||publicSix.some(s=>typeof s!=='string'))
    throw Error('Expected own known six and opponent public six species');
  const dex=sim.Dex.mod('champions');
  const legacy=chooseThree(dex,own,publicSix).map(i=>i-1);
  const summary=legacy.map(i=>{
    const bands=publicSix.map(s=>publicCoverageBand(sim,own[i],s));
    const threats=bands.filter(b=>b.worstPossible>=1&&b.speed.canOutspeedUnboosted)
      .map(b=>b.foe);
    const offense=publicSix.reduce((sum,s)=>
      sum+Math.max(...own[i].moves.map(m=>matchup(dex,own[i],s,m))),0)/6;
    return {i,species:own[i].species,threats,threatCount:threats.length,offense};
  });
  const original=summary[0];
  let chosen=original;
  if(original.threatCount>=2){
    const alternatives=summary.slice(1).filter(x=>
      x.threatCount<=original.threatCount-1&&
      x.offense>=0.7*original.offense);
    alternatives.sort((a,b)=>a.threatCount-b.threatCount||
      b.offense-a.offense||a.i-b.i);
    if(alternatives.length)chosen=alternatives[0];
  }
  const selection=[chosen.i,...legacy.filter(i=>i!==chosen.i)]
    .map(i=>own[i].species);
  return {selection,changedLead:chosen.i!==original.i,
    originalLead:original.species,lead:chosen.species,
    summary:summary.map(x=>({...x,offense:+x.offense.toFixed(3)})),
    status:'research-only',warning:'Uncalibrated legal possibility; no Scarf assumption or win-rate claim'};
}
module.exports={chooseLeadGate};
