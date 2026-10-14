'use strict';
// Public six-to-three decision policy. Not an oracle or human-rank-trained AI.
// Rival's hidden sets / three selected species are NEVER passed to this module.
const {publicThreat}=require('./threat');
// Avoid lab <-> policy cycle: pass a public-set matchup scorer from the caller.

function seededRandom(seed,side='p1'){
  if(!Array.isArray(seed)||seed.length!==4)throw Error('Expected four-number public seed');
  let x=seed.reduce((h,v)=>(Math.imul(h^Number(v),16777619)>>>0),side==='p1'?2166136261:32452843)||1;
  return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
}
function softmaxPick(items,random,temperature){
  if(!items.length)throw Error('Nothing to choose');
  const best=Math.max(...items.map(x=>x.score));
  const weights=items.map(x=>Math.exp((x.score-best)/temperature));
  let ticket=random()*weights.reduce((a,b)=>a+b,0);
  for(let i=0;i<items.length;i++){ticket-=weights[i];if(ticket<0)return items[i];}
  return items[items.length-1];
}
function rankPreview(dex,team,opponentSix,matchup){
  if(team.length!==6||opponentSix.length!==6||opponentSix.some(s=>typeof s!=='string'))
    throw Error('Preview requires own six sets and exactly six public rival species');
  // Cache only own known move/ability information and public opposing species.
  const offense=team.map(p=>opponentSix.map(o=>Math.max(...p.moves.map(m=>matchup(dex,p,o,m)))));
  const exposure=team.map(p=>opponentSix.map(o=>publicThreat(dex,p.species,o)));
  const candidates=[];
  for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<6;c++){
    const three=[a,b,c];
    const coverage=opponentSix.map((_,o)=>Math.max(...three.map(i=>offense[i][o])));
    const counter=opponentSix.map((_,o)=>Math.min(...three.map(i=>exposure[i][o])));
    const mean=coverage.reduce((x,y)=>x+y,0)/6;
    const floor=Math.min(...coverage);
    const defensive=counter.reduce((x,y)=>x+y,0)/6;
    const megaCount=three.filter(i=>Boolean(dex.items.get(team[i].item).megaStone)).length;
    const scarf=three.some(i=>team[i].item==='Choice Scarf');
    const score=mean+0.22*floor-defensive/5+(scarf?7:0)-Math.max(0,megaCount-1)*28;
    const leads=three.map(i=>{
      const attack=offense[i].reduce((x,y)=>x+y,0)/6;
      const risk=exposure[i].reduce((x,y)=>x+y,0)/6;
      return {i,score:attack-0.28*risk};
    }).sort((x,y)=>y.score-x.score||x.i-y.i);
    candidates.push({three,score,leads});
  }
  return candidates.sort((x,y)=>y.score-x.score||x.three.join('').localeCompare(y.three.join('')));
}
function choosePreview(dex,team,opponentSix,random,matchup){
  const ranked=rankPreview(dex,team,opponentSix,matchup);
  const best=ranked[0].score;
  // Sample only credible choices; score-weighted, not uniform random team picking.
  const plausible=ranked.filter(x=>x.score>=best-20).slice(0,8);
  const choice=softmaxPick(plausible,random,8);
  const leadBest=choice.leads[0].score;
  const plausibleLeads=choice.leads.filter(x=>x.score>=leadBest-12);
  const lead=softmaxPick(plausibleLeads,random,6).i;
  const rest=choice.three.filter(x=>x!==lead).sort((a,b)=>{
    const la=choice.leads.find(x=>x.i===a).score,lb=choice.leads.find(x=>x.i===b).score;
    return lb-la||a-b;
  });
  return [lead,...rest].map(i=>i+1);
}
module.exports={seededRandom,softmaxPick,rankPreview,choosePreview};
