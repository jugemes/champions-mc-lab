'use strict';
// Research-only counterexample snapshot. This DOES NOT replace the team's
// preview policy. Opponent inputs are publicly displayed species only.
// Scenarios A/B/C were written down BEFORE inspecting a rival's hidden three.
// Source: reports/claude-m7-live-counterplay-2026-10-30.md, PR #46.
const {rankPreview,choosePreview,seededRandom}=require('./preview-policy');
const {rankStrategicPreview,chooseStrategicPreview}=require('./preview-strategic');
const {chooseThree,matchup}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const SCENARIOS=Object.freeze({
  A_golisopod_mimikyu:Object.freeze(['Golisopod','Garchomp','Primarina','Mimikyu','Hippowdon','Gholdengo']),
  B_lucario_z_corviknight:Object.freeze(['Lucario','Garchomp','Primarina','Mimikyu','Archaludon','Corviknight']),
  C_charizard_x_y:Object.freeze(['Charizard','Garchomp','Primarina','Mimikyu','Gholdengo','Baxcalibur']),
});
const REFERENCE_OPEN_SIX_RECOMMENDATIONS=Object.freeze({
  A_golisopod_mimikyu:{lead:'Rotom-Wash',selected:['Rotom-Wash','Metagross','Hydreigon'],
    caveat:'Metagross+Hydreigon vs Metagross+Primarina bench slots still unproven.'},
  B_lucario_z_corviknight:{lead:'Garchomp',selected:['Garchomp','Rotom-Wash','Metagross'],
    caveat:'Scarf Garchomp Earthquake is intended for Lucario Z; preserve it for that threat.'},
  C_charizard_x_y:{lead:'Tyranitar',selected:['Tyranitar','Garchomp','Metagross'],
    caveat:'Charizard Y mega weather overwrites Tyranitar lead sand on turn one.'},
});
// The reference choices come from Claude's human plausibility assessment in
// PR #46, NOT oracle-verified optimal decisions or actual enemy hidden sets.
function speciesFromIndices(team,indices){
  return indices.map(i=>team[i-1].species);
}
function describeRank(team,candidate){
  return {
    selected:candidate.three.map(i=>team[i].species),
    lead:candidate.leads[0] && team[candidate.leads[0].i].species,
    score:Number(candidate.score.toFixed(4)),
    leadScores:candidate.leads.map(x=>({name:team[x.i].species,score:Number(x.score.toFixed(4))})),
  };
}
function inspectPublicPreview(dex,team=reportedLive()){
  if(!Array.isArray(team)||team.length!==6)throw Error('Need six own known sets');
  const out={source:'public-six only',candidateCount:20,format:'gen9championsbssregmc',
    note:'One-step simplified matchup heuristic. NOT an accurate M-C Battle result, human win rate or hidden-three oracle.',
    scenarios:{}};
  for(const [scenario,publicSix] of Object.entries(SCENARIOS)){
    const seed=[2026,10,30,1],randomA=seededRandom(seed,'p1'),randomB=seededRandom(seed,'p1');
    const legacy=speciesFromIndices(team,chooseThree(dex,team,publicSix));
    const stochastic=speciesFromIndices(team,choosePreview(dex,team,publicSix,randomA,matchup));
    const strategic=speciesFromIndices(team,chooseStrategicPreview(dex,team,publicSix,randomB,matchup));
    const ranked=rankPreview(dex,team,publicSix,matchup);
    const rankedStrat=rankStrategicPreview(dex,team,publicSix,matchup);
    const ref=REFERENCE_OPEN_SIX_RECOMMENDATIONS[scenario];
    const sameMembers=(arr,brr)=>arr.length===brr.length&&arr.every(x=>brr.includes(x));
    out.scenarios[scenario]={
      publicSix:[...publicSix],
      reference:ref,
      policies:{
        legacy:{lead:legacy[0],selected:legacy,referenceMembersMatch:sameMembers(legacy,ref.selected),referenceLeadMatch:legacy[0]===ref.lead},
        stochastic:{lead:stochastic[0],selected:stochastic,referenceMembersMatch:sameMembers(stochastic,ref.selected),referenceLeadMatch:stochastic[0]===ref.lead},
        strategic:{lead:strategic[0],selected:strategic,referenceMembersMatch:sameMembers(strategic,ref.selected),referenceLeadMatch:strategic[0]===ref.lead},
      },
      topRaw:ranked.slice(0,5).map(x=>describeRank(team,x)),
      topStrategic:rankedStrat.slice(0,5).map(x=>describeRank(team,x)),
    };
  }
  return out;
}
function summarizePublicPreview(dex,team=reportedLive()){
  const result=inspectPublicPreview(dex,team);
  const lines=['SCENARIO | REFERENCE | LEGACY | STOCHASTIC | STRATEGIC','---|---|---|---|---'];
  const format=(p)=>p.selected.join('/')+' (lead '+p.lead+')';
  for(const [k,x] of Object.entries(result.scenarios))lines.push(
    k+' | '+format(x.reference)+' | '+format(x.policies.legacy)+' | '+format(x.policies.stochastic)+' | '+format(x.policies.strategic)
  );
  return lines.join('\n');
}
module.exports={SCENARIOS,REFERENCE_OPEN_SIX_RECOMMENDATIONS,inspectPublicPreview,summarizePublicPreview};
