'use strict';
// Rational-preview CANDIDATE policy (Issue #4, P0-A). Not a trained or expert AI.
// Difference from preview-policy.js (stochastic): the selecting side evaluates
// its OWN members in the form they will battle in (Mega form from the held
// stone, one Mega per trio, the form's ability/typing/stats) and its OWN weather.
// The objective weights and sampling constants are deliberately the same as the
// stochastic policy so an A/B isolates that knowledge. No species name is
// special-cased and no selection rate is targeted.
// The opposing side is seen only as six public species names.
const {softmaxPick}=require('./preview-policy');
const {ownForm,ownMatchup,ownExposure,weatherOf,ownStat,megaFormOf}=require('./own-form');
const WEIGHT={floor:0.22,defensive:1/5,scarf:7,leadRisk:0.28,teammateWeather:0.5};
const SAMPLE={range:20,top:8,temperature:8,leadRange:12,leadTemperature:6};

// Weather each member of a trio fights in. A setter always gets its own weather
// on its first action (Sand Stream on entry; Drought on Mega Evolution, which
// resolves after switches and before moves). Teammates get it only partially
// (weight 0.5): it can expire or be replaced by the rival. Conflicting setters
// cancel the teammate share.
function trioWeather(dex,team,three,megaIndex){
  const setter={};
  for(const i of three){
    const w=weatherOf(ownForm(dex,team[i],{mega:i===megaIndex}).ability);
    if(w)setter[i]=w;
  }
  const kinds=[...new Set(Object.values(setter))];
  return {setter,shared:kinds.length===1?kinds[0]:''};
}
function memberValues(dex,team,i,opponentSix,megaIndex,weather){
  const set=team[i],mega=i===megaIndex,own=weather.setter[i];
  const blend=f=>{
    if(own)return f(own);
    if(!weather.shared)return f('');
    const k=WEIGHT.teammateWeather;
    return k*f(weather.shared)+(1-k)*f('');
  };
  return {
    offense:opponentSix.map(o=>blend(w=>Math.max(...set.moves.map(m=>ownMatchup(dex,set,o,m,{mega,weather:w}))))),
    exposure:opponentSix.map(o=>blend(w=>ownExposure(dex,set,o,{mega,weather:w})))
  };
}
function scoreTrio(dex,team,three,opponentSix,megaIndex){
  const weather=trioWeather(dex,team,three,megaIndex);
  const values=Object.fromEntries(three.map(i=>[i,memberValues(dex,team,i,opponentSix,megaIndex,weather)]));
  const coverage=opponentSix.map((_,o)=>Math.max(...three.map(i=>values[i].offense[o])));
  const counter=opponentSix.map((_,o)=>Math.min(...three.map(i=>values[i].exposure[o])));
  const mean=coverage.reduce((a,b)=>a+b,0)/opponentSix.length;
  const floor=Math.min(...coverage);
  const defensive=counter.reduce((a,b)=>a+b,0)/opponentSix.length;
  const scarf=three.some(i=>team[i].item==='Choice Scarf');
  const score=mean+WEIGHT.floor*floor-WEIGHT.defensive*defensive+(scarf?WEIGHT.scarf:0);
  const leads=three.map(i=>{
    const attack=values[i].offense.reduce((a,b)=>a+b,0)/opponentSix.length;
    const risk=values[i].exposure.reduce((a,b)=>a+b,0)/opponentSix.length;
    return {i,score:attack-WEIGHT.leadRisk*risk};
  }).sort((x,y)=>y.score-x.score||x.i-y.i);
  return {three,score,leads,mega:megaIndex,weather,values,coverage,counter,
    components:{mean,floor,defensive,scarf}};
}
function rankRationalPreview(dex,team,opponentSix){
  if(team.length!==6||opponentSix.length!==6||opponentSix.some(s=>typeof s!=='string'))
    throw Error('Preview requires own six sets and exactly six public rival species');
  const out=[];
  for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<6;c++){
    const three=[a,b,c];
    // One Mega per battle: try "no Mega" and each holder as the Mega.
    const options=[null,...three.filter(i=>megaFormOf(dex,team[i]))];
    const best=options.map(m=>scoreTrio(dex,team,three,opponentSix,m))
      .sort((x,y)=>y.score-x.score)[0];
    out.push(best);
  }
  return out.sort((x,y)=>y.score-x.score||x.three.join('').localeCompare(y.three.join('')));
}
function plausible(ranked){
  const best=ranked[0].score;
  return ranked.filter(x=>x.score>=best-SAMPLE.range).slice(0,SAMPLE.top);
}
function chooseRationalPreview(dex,team,opponentSix,random){
  const choice=softmaxPick(plausible(rankRationalPreview(dex,team,opponentSix)),random,SAMPLE.temperature);
  const top=choice.leads[0].score;
  const lead=softmaxPick(choice.leads.filter(x=>x.score>=top-SAMPLE.leadRange),random,SAMPLE.leadTemperature).i;
  const rest=choice.three.filter(i=>i!==lead).sort((a,b)=>
    choice.leads.find(x=>x.i===b).score-choice.leads.find(x=>x.i===a).score||a-b);
  return [lead,...rest].map(i=>i+1);
}
// Exact probabilities of the sampling above (trio and lead), for reporting.
function selectionDistribution(ranked){
  const pool=plausible(ranked),best=pool[0].score;
  const w=pool.map(x=>Math.exp((x.score-best)/SAMPLE.temperature)),W=w.reduce((a,b)=>a+b,0);
  return pool.map((x,k)=>{
    const top=x.leads[0].score,leads=x.leads.filter(l=>l.score>=top-SAMPLE.leadRange);
    const lw=leads.map(l=>Math.exp((l.score-top)/SAMPLE.leadTemperature)),LW=lw.reduce((a,b)=>a+b,0);
    return {candidate:x,p:w[k]/W,leads:leads.map((l,j)=>({i:l.i,p:lw[j]/LW}))};
  });
}
function probabilityIncluding(ranked,team,species){
  return selectionDistribution(ranked)
    .filter(d=>d.candidate.three.some(i=>team[i].species===species))
    .reduce((a,d)=>a+d.p,0);
}
// Human-readable reasons: what each member answers and what answers it back.
function explain(dex,team,opponentSix,candidate){
  const name=i=>team[i].species;
  const answers=opponentSix.map((o,k)=>{
    const by=candidate.three.slice().sort((a,b)=>candidate.values[b].offense[k]-candidate.values[a].offense[k])[0];
    return {foe:o,by:name(by),value:Math.round(candidate.values[by].offense[k])};
  });
  const counterRisk=candidate.three.map(i=>{
    const k=candidate.values[i].exposure.indexOf(Math.max(...candidate.values[i].exposure));
    return {member:name(i),worstFoe:opponentSix[k],exposure:Math.round(candidate.values[i].exposure[k])};
  });
  const m=candidate.mega;
  return {
    three:candidate.three.map(name),score:Math.round(candidate.score*10)/10,
    mega:m==null?null:{member:name(m),form:ownForm(dex,team[m]).species,ability:ownForm(dex,team[m]).ability,
      speed:ownStat(dex,team[m],'spe')},
    weather:candidate.weather,
    weakestAnswer:answers.slice().sort((a,b)=>a.value-b.value)[0],
    answers,counterRisk,
    components:Object.fromEntries(Object.entries(candidate.components)
      .map(([k,v])=>[k,typeof v==='number'?Math.round(v*10)/10:v]))
  };
}
function compareInclusion(dex,team,opponentSix,species,ranked=rankRationalPreview(dex,team,opponentSix)){
  const has=c=>c.three.some(i=>team[i].species===species);
  const withBest=ranked.find(has),withoutBest=ranked.find(c=>!has(c));
  return {species,with:withBest&&explain(dex,team,opponentSix,withBest),
    without:withoutBest&&explain(dex,team,opponentSix,withoutBest),
    margin:withBest&&withoutBest?Math.round((withBest.score-withoutBest.score)*10)/10:null};
}
module.exports={WEIGHT,SAMPLE,rankRationalPreview,chooseRationalPreview,selectionDistribution,
  probabilityIncluding,explain,compareInclusion,trioWeather};
