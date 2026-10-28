'use strict';
// Claude audit candidate (Issue #13 / launch PR #18). OPT-IN, not a ladder predictor.
// Hypothesis under test: preview treated every rival as its BASE species, so a public
// Mega-capable species (e.g. Golisopod -> Bug/Steel Def175) was under-rated. The rival's
// held item is hidden, so the robust public-information choice is MINIMAX over forms:
// our offense vs a rival = min over its possible forms, our exposure = max over forms.
// No weights, no usage rates. Only the six public rival species names are read.
const {softmaxPick}=require('./preview-policy');
const {ownMatchup,ownExposure,megaFormOf}=require('./own-form');
const {WEIGHT,SAMPLE,trioWeather}=require('./preview-rational');
// Base form first, then every legal-in-dex Mega form of the same base species.
function foeMegaForms(dex,name){
  const sp=dex.species.get(name);
  if(!sp.exists||sp.isMega)return [name];
  const forms=dex.species.all().filter(s=>s.isMega&&s.baseSpecies===sp.baseSpecies&&s.requiredItem
    &&dex.items.get(s.requiredItem).exists).map(s=>s.name);
  return [sp.name,...forms];
}
function memberValues(dex,team,i,sixForms,megaIndex,weather){
  const set=team[i],mega=i===megaIndex,own=weather.setter[i];
  const blend=f=>{
    if(own)return f(own);
    if(!weather.shared)return f('');
    const k=WEIGHT.teammateWeather;
    return k*f(weather.shared)+(1-k)*f('');
  };
  return {
    offense:sixForms.map(forms=>Math.min(...forms.map(o=>blend(w=>Math.max(...set.moves.map(m=>ownMatchup(dex,set,o,m,{mega,weather:w}))))))),
    exposure:sixForms.map(forms=>Math.max(...forms.map(o=>blend(w=>ownExposure(dex,set,o,{mega,weather:w})))))
  };
}
function scoreTrio(dex,team,three,six,sixForms,megaIndex){
  const weather=trioWeather(dex,team,three,megaIndex);
  const values=Object.fromEntries(three.map(i=>[i,memberValues(dex,team,i,sixForms,megaIndex,weather)]));
  const coverage=six.map((_,o)=>Math.max(...three.map(i=>values[i].offense[o])));
  const counter=six.map((_,o)=>Math.min(...three.map(i=>values[i].exposure[o])));
  const mean=coverage.reduce((a,b)=>a+b,0)/six.length,floor=Math.min(...coverage);
  const defensive=counter.reduce((a,b)=>a+b,0)/six.length;
  const scarf=three.some(i=>team[i].item==='Choice Scarf');
  const score=mean+WEIGHT.floor*floor-WEIGHT.defensive*defensive+(scarf?WEIGHT.scarf:0);
  const leads=three.map(i=>{
    const attack=values[i].offense.reduce((a,b)=>a+b,0)/six.length;
    const risk=values[i].exposure.reduce((a,b)=>a+b,0)/six.length;
    return {i,score:attack-WEIGHT.leadRisk*risk};
  }).sort((x,y)=>y.score-x.score||x.i-y.i);
  return {three,score,leads,mega:megaIndex,weather,values,coverage,counter};
}
function rankFoeMega(dex,team,six){
  if(team.length!==6||six.length!==6)throw Error('six + six public species required');
  const sixForms=six.map(n=>foeMegaForms(dex,n));
  const out=[];
  for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<6;c++){
    const three=[a,b,c],options=[null,...three.filter(i=>megaFormOf(dex,team[i]))];
    out.push(options.map(m=>scoreTrio(dex,team,three,six,sixForms,m)).sort((x,y)=>y.score-x.score)[0]);
  }
  return out.sort((x,y)=>y.score-x.score||x.three.join('').localeCompare(y.three.join('')));
}
function chooseFoeMegaPreview(dex,team,six,random){
  const ranked=rankFoeMega(dex,team,six),best=ranked[0].score;
  const pool=ranked.filter(x=>x.score>=best-SAMPLE.range).slice(0,SAMPLE.top);
  const choice=softmaxPick(pool,random,SAMPLE.temperature);
  const top=choice.leads[0].score;
  const lead=softmaxPick(choice.leads.filter(x=>x.score>=top-SAMPLE.leadRange),random,SAMPLE.leadTemperature).i;
  const rest=choice.three.filter(i=>i!==lead).sort((a,b)=>
    choice.leads.find(x=>x.i===b).score-choice.leads.find(x=>x.i===a).score||a-b);
  return [lead,...rest].map(i=>i+1);
}
module.exports={foeMegaForms,rankFoeMega,chooseFoeMegaPreview};
