'use strict';
// Research-only public-six robust selection. This is NOT a Showdown-exact
// future-turn solver, usage-rate model, or default ranked-battle policy.
// The only opposing input is six publicly shown species names.
const {publicCoverageBand}=require('./public-coverage-band');
const {canonical}=require('./tactics');
const round=x=>+x.toFixed(3);
function choosePublicRobustPreview(sim,own,publicSix,matchup){
  if(own.length!==6||publicSix.length!==6||publicSix.some(s=>typeof s!=='string'))
    throw Error('publicRobust requires own six known sets and six public opposing species');
  const dex=sim.Dex.mod('champions');
  const attacks=own.map(p=>publicSix.map(s=>Math.max(...p.moves.map(m=>matchup(dex,p,s,m)))));
  const bands=own.map(p=>publicSix.map(s=>publicCoverageBand(sim,p,s)));
  // These are possibility screens, NOT probabilities. A hypothetical legal
  // coverage move and hypothetical Scarf are never asserted to coexist.
  const exposure=bands.map(row=>row.map(b=>{
    const speed=b.speed.canOutspeedUnboosted?1:
      b.speed.canOutspeedWithScarf?.7:.35;
    return 100*Math.min(2.5,b.worstPossible)*speed;
  }));
  const answers=own.map((p,i)=>publicSix.map((s,j)=>attacks[i][j]-.65*exposure[i][j]));
  const mean=arr=>arr.reduce((a,b)=>a+b,0)/arr.length;
  const candidates=[];
  for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<6;c++){
    const three=[a,b,c],perFoe=publicSix.map((s,j)=>{
      const sorted=three.map(i=>answers[i][j]).sort((x,y)=>y-x);
      return {foe:s,best:sorted[0],second:sorted[1]};
    });
    const worst=perFoe.slice().sort((x,y)=>x.best-y.best).slice(0,3);
    const mega=three.filter(i=>Boolean(dex.items.get(own[i].item).megaStone)).length;
    const score=.55*mean(perFoe.map(x=>x.best))+
      .45*mean(worst.map(x=>x.best))+
      .15*mean(perFoe.map(x=>x.second))+
      (three.some(i=>canonical(own[i].item)==='choicescarf')?6:0)-
      Math.max(0,mega-1)*25;
    const leads=three.map(i=>{
      const vs=publicSix.map((s,j)=>attacks[i][j]-.85*exposure[i][j]);
      const worstThree=vs.slice().sort((x,y)=>x-y).slice(0,3);
      return {i,score:.6*mean(vs)+.4*mean(worstThree)};
    }).sort((x,y)=>y.score-x.score||x.i-y.i);
    candidates.push({three,score,leads,
      weakPublicFoes:worst.map(x=>({species:x.foe,answer:round(x.best)}))});
  }
  candidates.sort((x,y)=>y.score-x.score||x.three.join('').localeCompare(y.three.join('')));
  const best=candidates[0],lead=best.leads[0].i;
  const rest=best.three.filter(i=>i!==lead).sort((a,b)=>
    best.leads.find(x=>x.i===b).score-best.leads.find(x=>x.i===a).score||a-b);
  return {selection:[lead,...rest].map(i=>i+1),
    status:'research-only',
    top:candidates.slice(0,3).map(c=>({three:c.three.map(i=>own[i].species),
      score:round(c.score),weakPublicFoes:c.weakPublicFoes})),
    warning:'Uncalibrated public legal-coverage upper bound; no item/move frequencies or engine-exact turn search'};
}
module.exports={choosePublicRobustPreview};
