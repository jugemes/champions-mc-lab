'use strict';
// P0-B2 experimental OPT-IN preview. Independent of rankRationalPreview().
 // It is a sensitivity test, NOT a learned move frequency or a ladder predictor.
const {rankRationalPreview,selectionDistribution,WEIGHT,SAMPLE}=require('./preview-rational');
const {softmaxPick}=require('./preview-policy');
const {ownForm}=require('./own-form');
const {speedOutlook,publicRiskBand}=require('./public-risk-bands');

// Hypotheses grounded in real battle incidents or explicit simulator stress
// cases. NO empirical usage rate is asserted. An item/move is never read from
// the opposing private set. All moves undergo M-C legality validation.
const PROBES=Object.freeze({
  Indeedee:Object.freeze(['Dazzling Gleam']), // real B, move observed; item unknown
  Garchomp:Object.freeze(['Rock Slide']), // own Scarf Garchomp vs Mega-Y countercase
  Gyarados:Object.freeze(['Ice Fang']), // explicit coverage sensitivity only
  Volcarona:Object.freeze(['Giga Drain']), // explicit coverage sensitivity only
  Chandelure:Object.freeze(['Energy Ball']) // explicit coverage sensitivity only
});
const MODEL=Object.freeze({
  // Scarf-only scenario is downweighted as an *arbitrary sensitivity*, not
  // an estimated frequency. Change this and re-evaluate the full case matrix.
  scarfOnlySensitivity:0.55,
  scenarioPenaltyPerRiskUnit:34,
  maxOneThreatPenalty:45,
  leadMeanShare:0.35,
  leadWorstShare:0.8,
  teamMeanShare:0.30
});

const clamp=(v,max)=>Math.min(max,Math.max(0,v));
function previewThreat(dex,ownSet,foeName,validator,{mega=true,probes=PROBES}={}){
  const moves=probes[foeName]||[];
  const form=ownForm(dex,ownSet,{mega});
  const member={...ownSet,species:form.species,ability:form.ability};
  const band=publicRiskBand(dex,member,foeName,validator,{candidateMoveNames:moves});
  const speed=speedOutlook(dex,ownSet,foeName,{mega});
  // Risk above known STAB baseline only. A Scarf that could act first is not
  // assumed: it receives a smaller explicit uncertainty sensitivity.
  const surprise=Math.max(0,band.possibleCoverageUpper-band.baselineStabUpper);
  const initiative=speed.normalOutlook.mayMoveFirst?1
    :speed.scarfOutlook.mayMoveFirst?MODEL.scarfOnlySensitivity:0;
  const penalty=clamp(surprise*MODEL.scenarioPenaltyPerRiskUnit*initiative,
    MODEL.maxOneThreatPenalty);
  return {foe:foeName,ourSpecies:ownSet.species,ownSpeed:speed.ownSpeed,
    baseline:band.baselineStabUpper,upper:band.possibleCoverageUpper,
    consideredMoves:band.candidates.map(x=>x.name),
    normalCanLead:speed.normalOutlook.mayMoveFirst,
    scarfCanLead:speed.scarfOutlook.mayMoveFirst,
    initiativeSensitivity:initiative,penalty};
}
function riskMatrix(dex,own,opponentSix,validator,{probes=PROBES}={}){
  if(!validator||typeof validator.validateSet!=='function')
    throw Error('M-C validator needed for rational-risk preview');
  // Build once per own (Mega/non-Mega) member and public opposing species.
  const data={};
  for(let i=0;i<own.length;i++)for(const mega of [false,true]){
    const key=i+':'+mega;
    data[key]=opponentSix.map(foe=>previewThreat(dex,own[i],foe,validator,{mega,probes}));
  }
  return data;
}
function rankRationalRisk(dex,team,opponentSix,validator,options={}){
  const old=rankRationalPreview(dex,team,opponentSix);
  const matrix=riskMatrix(dex,team,opponentSix,validator,options);
  const annotated=old.map(c=>{
    const rows=Object.fromEntries(c.three.map(i=>[i,matrix[i+':'+(c.mega===i)]]));
    // Team-level: a foe threatens us only to the extent that NONE of the
    // three has a credible defensive answer to that hypothesis.
    const defensiveExtra=opponentSix.reduce((sum,_,f)=>
      sum+Math.min(...c.three.map(i=>rows[i][f].penalty)),0)/opponentSix.length;
    const teamAdjustment=MODEL.teamMeanShare*defensiveExtra;
    const leads=c.leads.map(l=>{
      const row=rows[l.i],worst=Math.max(...row.map(x=>x.penalty));
      const avg=row.reduce((a,x)=>a+x.penalty,0)/row.length;
      const leadAdjustment=MODEL.leadWorstShare*worst+MODEL.leadMeanShare*avg;
      return {...l,score:l.score-leadAdjustment,
        riskAdjustment:leadAdjustment,mostDangerous:row
          .filter(x=>x.penalty===worst&&x.penalty>0)
          .map(x=>({foe:x.foe,moves:x.consideredMoves,
            speed:x.ownSpeed,normal:x.normalCanLead,scarf:x.scarfCanLead,
            upper:x.upper,baseline:x.baseline}))};
    }).sort((a,b)=>b.score-a.score||a.i-b.i);
    return {...c,score:c.score-teamAdjustment,leads,
      riskAdjustment:teamAdjustment,
      riskDetails:Object.fromEntries(c.three.map(i=>[team[i].species,rows[i]]))};
  });
  return annotated.sort((a,b)=>b.score-a.score||a.three.join('').localeCompare(b.three.join('')));
}
function chooseRationalRiskPreview(dex,team,opponentSix,random,validator,options={}){
  const ranked=rankRationalRisk(dex,team,opponentSix,validator,options);
  const best=ranked[0].score,pool=ranked.filter(c=>c.score>=best-SAMPLE.range).slice(0,SAMPLE.top);
  const choice=softmaxPick(pool,random,SAMPLE.temperature);
  const maxLead=choice.leads[0].score;
  const lpool=choice.leads.filter(l=>l.score>=maxLead-SAMPLE.leadRange);
  const lead=softmaxPick(lpool,random,SAMPLE.leadTemperature).i;
  const rest=choice.three.filter(i=>i!==lead).sort((a,b)=>
    choice.leads.find(x=>x.i===b).score-choice.leads.find(x=>x.i===a).score||a-b);
  return [lead,...rest].map(i=>i+1);
}
function comparePreviewDistributions(dex,team,opponentSix,validator,options={}){
  const old=selectionDistribution(rankRationalPreview(dex,team,opponentSix));
  const next=selectionDistribution(rankRationalRisk(dex,team,opponentSix,validator,options));
  const summary=dist=>({
    inclusion:Object.fromEntries(team.map((p,i)=>[p.species,+dist
      .filter(x=>x.candidate.three.includes(i)).reduce((s,x)=>s+x.p,0).toFixed(4)])),
    lead:Object.fromEntries(team.map((p,i)=>[p.species,+dist
      .reduce((s,x)=>s+x.p*(x.leads.find(l=>l.i===i)?.p||0),0).toFixed(4)])),
    top:dist.slice(0,4).map(x=>({
      three:x.candidate.three.map(i=>team[i].species),
      lead:x.leads.map(l=>({species:team[l.i].species,p:+l.p.toFixed(3)})),
      p:+x.p.toFixed(3),score:+x.candidate.score.toFixed(1),
      teamPenalty:+(x.candidate.riskAdjustment||0).toFixed(2)
    }))
  });
  return {old:summary(old),risk:summary(next)};
}
module.exports={PROBES,MODEL,previewThreat,riskMatrix,rankRationalRisk,
  chooseRationalRiskPreview,comparePreviewDistributions};
