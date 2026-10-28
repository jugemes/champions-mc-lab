'use strict';
/**
 * Opt-in preview experiment; does NOT identify the actual opponent Mega item.
 * The score is a one-hit engine mechanics coverage screen, not a probability,
 * 3v3 strategy or inference from the enemy's private chosen three.
 */
const {publicHypotheses}=require('./public-hypotheses');
const {engineDamageSample}=require('./engine-reference');
const {rankRationalPreview}=require('./preview-rational');
const {canonical}=require('./tactics');
function screenMegaCoverage(sim,ownSix,publicSix,{sampleLimit=3,maxScoreDrop=30}={}){
 const dex=sim.Dex.mod('champions');
 const ranked=rankRationalPreview(dex,ownSix,publicSix);
 const hypot=publicHypotheses(sim,publicSix,{limit:sampleLimit});
 const megas=new Map();
 for(const a of hypot.assumptions)for(const p of a.team){
  if(dex.items.get(p.item).megaStone) {
   const key=JSON.stringify([p.species,p.item,p.nature,p.ability,p.evs,p.moves]);
   if(!megas.has(key))megas.set(key,{team:a.team,set:p});
  }
 }
 const perFoe=[];
 for(const {team,set} of megas.values()){
  const d=[];
  for(const p of ownSix){
   let best=0,move=null;
   for(const m of p.moves){
    if(dex.moves.get(m).category==='Status')continue;
    const hit=engineDamageSample(sim,ownSix,team,{
      ourLead:p.species,opponentLead:set.species,move:m,
      ourMega:Boolean(dex.items.get(p.item).megaStone),
      opponentMega:true
    });
    if(hit.fraction>best){best=hit.fraction;move=m;}
   }
   d.push({member:p.species,damage:best,move});
  }
  perFoe.push({species:set.species,item:set.item,byMember:d});
 }
 if(!perFoe.length)return {selected:ranked[0],changed:false,reason:'no-legal-mega-hypotheses',perFoe};
 const elig=ranked.filter(r=>r.score>=ranked[0].score-maxScoreDrop);
 function cover(trio){
   return Math.min(...perFoe.map(f=>Math.max(...trio.three.map(i=>f.byMember[i].damage))));
 }
 const viable=elig.filter(t=>cover(t)>=1);
 const selected=(viable.length?viable:elig)[0];
 return {selected,baseline:ranked[0],changed:selected.three.join(',')!==ranked[0].three.join(','),
   coverage:cover(selected),baselineCoverage:cover(ranked[0]),
   consideredTrioCount:elig.length,oneHitThreshold:1,
   reason:viable.length?'at-least-one-Showdown-100pct-hit-on-each-tested-mega':'no-covered-trio-keep-baseline',
   perFoe,
   caveat:'Synthetic moves/items/stats, incomplete Mega hypotheses; one-hit coverage ignores actual rival three, switching, speed, Disguise, priority, setup and weather. EXPERIMENT ONLY.'
 };
}
function chooseEngineMegaPreview(sim,ownSix,publicSix){
 const x=screenMegaCoverage(sim,ownSix,publicSix);
 const lead=x.selected.leads[0].i;
 return [lead,...x.selected.three.filter(i=>i!==lead)].map(i=>i+1);
}
module.exports={screenMegaCoverage,chooseEngineMegaPreview};
