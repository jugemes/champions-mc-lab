'use strict';
/**
 * A second, independently evaluated preview candidate.
 * Threat coverage is a HARD diagnostic gate, not an added magic score.
 * The Mega forms come ONLY from public-six-derived legal synthetic sets;
 * this does not know which Mega or hidden item the real rival has.
 *
 * A 100% noncrit hit is a necessary but NOT sufficient check in this narrow
 * experiment. Speed, switching, abilities, survival and full 3v3 strategy
 * still need independent verification. If the gate cannot be met, decline.
 */
const {rankOpeningTrioLeads}=require('./engine-opening-ranker');
const {screenMegaCoverage}=require('./engine-mega-preview');
function rankCoverageOpening(sim,ownSix,publicSix,{maxScenes=6,limit=60}={}){
 const search=rankOpeningTrioLeads(sim,ownSix,publicSix,{maxScenes,limit});
 const coverage=screenMegaCoverage(sim,ownSix,publicSix,{sampleLimit:3});
 const perFoe=coverage.perFoe;
 const detail=search.all.map(candidate=>{
   const megaCoverage=perFoe.length?Math.min(...perFoe.map(f=>
     Math.max(...candidate.ownThree.map(name=>{
       const x=f.byMember.find(m=>m.member===name);
       return x?.damage??0;
     })))):null;
   return {...candidate,megaCoverage,
     megaCoveragePassed:megaCoverage===null||megaCoverage>=1};
 });
 const candidates=detail.filter(x=>x.comparable&&x.megaCoveragePassed);
 const selected=candidates[0]||null;
 return {
   selected,baseline:search.baseline,
   inspected:search.evaluated,
   possibleMegaThreats:perFoe.map(f=>({species:f.species,item:f.item})),
   excludedByCoverage:detail.filter(x=>x.comparable&&!x.megaCoveragePassed).length,
   excludedByIncomplete:detail.filter(x=>!x.comparable).length,
   winnerReason:selected?
     'complete two-turn hypothesis comparison, with at least one hypothetical 100% noncrit attack for every tested Mega':
     'no complete & Mega-covered scenario; defer to old preview, do NOT guess',
   alternatives:detail.slice(0,10).map(x=>({
     lead:x.lead,three:x.ownThree,scoreWorst:x.scoreWorst,
     comparable:x.comparable,megaCoverage:x.megaCoverage,
     megaCoveragePassed:x.megaCoveragePassed
   })),
   caveat:'This is not tested Mega probability, a proof that a hit can actually land, or 3v3 win-rate. Every public rival can lead; AI uses only public species + documented synthetic assumptions.'
 };
}
module.exports={rankCoverageOpening};
