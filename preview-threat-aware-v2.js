'use strict';
// Opt-in public-six -> three preview policy, revision 2:
// previewPolicy:'threat-aware-v2'. PR #58 ('threat-aware') is left as is so
// its results stay reproducible; v2 reuses its public duel model and fixes the
// inconsistencies found in review #5710360938 / #5710364911 and PR #59:
//  1. One rival individual = ONE variant (form, item, ability) inside a
//     scenario. The rival's own selection scores each member at the single
//     variant that is best for it over our whole six (not the best variant
//     per column), and our evaluation enumerates consistent variant
//     scenarios (item clause: at most one Choice Scarf per rival three).
//  2. The Mega holder is fixed by the hypothesis: every (three, Mega holder)
//     pair is its own hypothesis; no second, independent Mega draw.
//  3. The lead is scored per scenario against the SAME rival lead variant
//     for staying and for pivoting; the pivot takes the rival's move aimed at
//     our lead (a predicted resist is credited, a weak entry is not); pivoting
//     gives a rival that can set up a free turn; and the worst plausible rival
//     lead counts, not only the mean.
//  4. Learnable priority moves are kept apart from same-type stronger moves
//     (Sucker Punch was lost behind other Dark moves in PR #58).
//  5. Weather comes from the scenario's setters (rival variants and our known
//     sets; for two leads the slower setter's weather stays), so Sand Force and
//     Drought apply only where that weather is up.
//  6. Our known Encore, used faster, cancels a rival setup line.
// Inputs are still ONLY our six known sets and six public rival species
// names. No species-name bonuses or forced picks.
const T=require('./preview-threat-aware');
const {knownStat}=require('./damage');
const {publicVariants,duel,publicDuel,coverageMoves,combine,weightedMean,maxStat,TRIPLES,PERMS,canon}=T;
const DEFAULTS={keep:12,temperature:0.08,sixWeight:0.25,leadWorst:0.5,pivotTempo:0.8,setupTempo:0.55,maxScenarios:64};
const OPTS={priorityKeys:true,encore:true,speedSpread:true};

const varCache=new Map();
function variantsOf(dex,name){
  if(!varCache.has(name))varCache.set(name,publicVariants(dex,name));
  return varCache.get(name);
}
const WEATHER_ABILITY={drought:'sun',sandstream:'sand'};
const weatherOfAbility=a=>WEATHER_ABILITY[canon(a)]||null;
// Weather in a scenario: both sides' known/hypothesised setters. One setter
// kind -> that weather; contested -> 'none' (neither can be relied on).
function sideWeather(abilities){
  const w=[...new Set(abilities.map(weatherOfAbility).filter(Boolean))];
  return w.length===1?w[0]:w.length?'contested':null;
}
function scenarioWeather(rivalVars,ownSets){
  const r=sideWeather(rivalVars.map(v=>v.ability)),o=sideWeather(ownSets.map(ownAbility));
  if(r&&o&&r!==o)return 'none';
  const w=r||o;
  return !w||w==='contested'?'none':w;
}
// Two leads: abilities trigger in speed order, the slower setter's stays.
function leadWeather(dex,own,v){
  const ow=weatherOfAbility(ownAbility(own)),rw=weatherOfAbility(v.ability);
  if(!ow||!rw)return ow||rw||'none';
  const ourSpe=knownStat(dex,ownMegaForm(dex,own),'spe'),theirSpe=maxStat(dex,v.form,'spe');
  return ourSpe<theirSpe?ow:ourSpe>theirSpe?rw:'none';
}
function ownMegaForm(dex,set){
  const item=dex.items.get(set.item);
  if(item.megaStone){
    const mega=typeof item.megaStone==='string'?item.megaStone:Object.values(item.megaStone)[0];
    const form=dex.species.get(mega);
    if(form.exists)return {...set,species:form.name,ability:T.fixedAbility(form)||set.ability};
  }
  return set;
}
function ownAbility(set){return set.megaAbility||set.ability;}

// ---- 1. Rival's selection (from OUR public names), one variant per member.
function rivalHypotheses(dex,ownPublic,rivalSix,{keep=DEFAULTS.keep,temperature=DEFAULTS.temperature}={}){
  const ourVar=ownPublic.map(n=>variantsOf(dex,n));
  const row=v=>ourVar.map(ov=>combine(ov.map(o=>({v:publicDuel(dex,v,o),w:o.weight}))));
  const rowScore=r=>r.reduce((a,b)=>a+b,0)/r.length+0.35*Math.min(...r);
  // The rival knows its own set: its single best variant over our whole six.
  const bestOf=vs=>{
    let top=null;
    for(const v of vs){const r=row(v),s=rowScore(r);if(!top||s>top.s)top={v,r,s};}
    return top;
  };
  // Scarf has no cost in this public model, so it would always look best;
  // the item clause allows at most one Scarf per three, chosen jointly below.
  const plain=rivalSix.map(n=>bestOf(variantsOf(dex,n).filter(v=>!v.mega&&!v.scarf)));
  const scarf=rivalSix.map(n=>bestOf(variantsOf(dex,n).filter(v=>!v.mega&&v.scarf)));
  const mega=rivalSix.map(n=>{const m=variantsOf(dex,n).filter(v=>v.mega);return m.length?bestOf(m):null;});
  const ranked=[];
  for(const three of TRIPLES)for(const holder of [null,...three.filter(i=>mega[i])]){
    let top=null;
    for(const scarfHolder of [null,...three.filter(i=>i!==holder)]){
      const pick=i=>i===holder?mega[i]:i===scarfHolder?scarf[i]:plain[i];
      const answer=ownPublic.map((_,j)=>Math.max(...three.map(i=>pick(i).r[j])));
      const score=answer.reduce((a,b)=>a+b,0)/answer.length+0.35*Math.min(...answer);
      if(!top||score>top.score)top={three,holder,score,
        leads:three.map(i=>({i,score:pick(i).r.reduce((a,b)=>a+b,0)/pick(i).r.length}))
          .sort((a,b)=>b.score-a.score||a.i-b.i),
        rivalBest:three.map(i=>pick(i).v)};
    }
    ranked.push(top);
  }
  ranked.sort((a,b)=>b.score-a.score||a.three.join('').localeCompare(b.three.join(''))||(a.holder??-1)-(b.holder??-1));
  const top=ranked.slice(0,keep),first=top[0].score;
  const weights=top.map(x=>Math.exp((x.score-first)/temperature)),sum=weights.reduce((a,b)=>a+b,0);
  return top.map((x,k)=>{
    const lw=x.leads.map(l=>Math.exp((l.score-x.leads[0].score)/(3*temperature))),ls=lw.reduce((a,b)=>a+b,0);
    return {three:x.three.map(i=>rivalSix[i]),score:x.score,weight:weights[k]/sum,
      mega:x.holder==null?null:rivalSix[x.holder],
      rivalBest:x.rivalBest.map(v=>v.form+(v.scarf?'@Scarf':'')+(v.ability?'/'+v.ability:'')),
      leads:x.leads.map((l,n)=>({species:rivalSix[l.i],p:lw[n]/ls}))};
  });
}
// ---- 2. Consistent variant scenarios of one rival hypothesis (for US).
function scenarios(dex,hyp,maxScenarios=DEFAULTS.maxScenarios){
  const opts=hyp.three.map(n=>variantsOf(dex,n).filter(v=>hyp.mega===n?v.mega:!v.mega));
  let out=[{vars:[],w:1}];
  for(const o of opts){
    const next=[];
    for(const s of out)for(const v of o){
      const vars=[...s.vars,v];
      if(vars.filter(x=>x.scarf).length>1)continue;
      next.push({vars,w:s.w*v.weight});
    }
    out=next;
  }
  out.sort((a,b)=>b.w-a.w);
  out=out.slice(0,maxScenarios);
  const sum=out.reduce((a,b)=>a+b.w,0);
  return out.map(s=>({...s,w:s.w/sum}));
}
function duelCached(dex,own,v,weather,cache,entry){
  const key=own.species+'|'+v.form+'|'+v.ability+'|'+v.scarf+'|'+weather+(entry?'|'+entry.stab.toFixed(4)+'/'+entry.cov.toFixed(4):'');
  if(!cache.has(key))cache.set(key,duel(dex,own,v,{...OPTS,weather,entry}));
  return cache.get(key);
}
// What a bench member takes when it switches in on the rival's move aimed at
// our lead: the rival's best move into the lead (STAB-only and any learnable
// move, the same two branches as the duel), priced on the bench member.
function entryHits(dex,v,lead,bench,weather,cache){
  const key='entry|'+lead.species+'|'+bench.species+'|'+v.form+'|'+v.ability+'|'+weather;
  if(cache.has(key))return cache.get(key);
  const o={knownDefender:true,weather,priorityKeys:true,detail:true};
  const L=T.variantAttack(dex,v,ownMegaForm(dex,lead),o).detail,B=T.variantAttack(dex,v,ownMegaForm(dex,bench),o).detail;
  const pick=f=>{let bi=-1;L.forEach((m,k)=>{if(f(m)&&(bi<0||m.frac>L[bi].frac))bi=k;});return bi;};
  const s=pick(m=>m.stab),c=pick(()=>true);
  const out={stab:s<0?0:B[s].frac,cov:c<0?0:B[c].frac};
  cache.set(key,out);
  return out;
}
// ---- 3. One of our threes + lead against one hypothesis.
function evaluateAgainst(dex,team,three,lead,hyp,cache,opt){
  const scen=scenarios(dex,hyp,opt.maxScenarios);
  const sets=three.map(i=>team[i]);
  const li=three.indexOf(lead);
  const per=scen.map(sc=>{
    const weather=scenarioWeather(sc.vars,sets);
    const D=(k,r)=>duelCached(dex,team[three[k]],sc.vars[r],weather,cache);
    const mat=three.map((_,k)=>hyp.three.map((_,r)=>D(k,r).value));
    let best=null;
    for(const p of PERMS){
      const vals=p.map((k,r)=>mat[k][r]);
      const s=0.5*Math.min(...vals)+0.5*vals.reduce((a,b)=>a+b,0)/3;
      if(!best||s>best.s)best={s,p,vals};
    }
    const backup=hyp.three.map((_,r)=>Math.max(...three.map((_,k)=>mat[k][r])));
    // Lead vs each rival lead, with the SAME variant for stay and pivot.
    const leadRows=hyp.leads.map(l=>{
      const r=hyp.three.indexOf(l.species),v=sc.vars[r];
      // Both leads enter together: the free (no entry hit) race, in the
      // weather the two leads actually leave up.
      const stay=duelCached(dex,team[lead],v,leadWeather(dex,team[lead],v),cache).free;
      // Pivot: the bench takes the hit aimed at our lead; a rival that can set
      // up gets the turn.
      const tempo=coverageMoves(dex,v.form,{priorityKeys:true}).setup>0?opt.setupTempo:opt.pivotTempo;
      const pivot=Math.max(...three.filter(i=>i!==lead).map(i=>
        duelCached(dex,team[i],v,weather,cache,entryHits(dex,v,team[lead],team[i],weather,cache)).swap))*tempo;
      const reserved=best.p.indexOf(li);
      const cost=reserved>=0&&reserved!==r&&stay<0.5?0.15:0;
      return {species:l.species,p:l.p,stay,pivot,value:Math.max(stay,pivot)-cost};
    });
    const mean=leadRows.reduce((s,x)=>s+x.p*x.value,0);
    // Worst rival lead that the rival would plausibly use (p >= 0.15).
    const plausible=leadRows.filter(x=>x.p>=0.15);
    const worst=Math.min(...(plausible.length?plausible:leadRows).map(x=>x.value));
    const leadValue=(1-opt.leadWorst)*mean+opt.leadWorst*worst;
    return {w:sc.w,vars:sc.vars,weather,assign:best,backup,leadValue,leadRows,
      score:0.55*best.s+0.15*backup.reduce((a,b)=>a+b,0)/3+0.3*leadValue};
  });
  const score=combine(per.map(x=>({v:x.score,w:x.w})));
  const worst=per.reduce((a,b)=>a.score<=b.score?a:b);
  const leadValue=combine(per.map(x=>({v:x.leadValue,w:x.w})));
  return {score,worst,leadValue,n:per.length};
}
function rankThreatAwarePreviewV2(dex,team,opponentSix,options={}){
  if(team.length!==6||!Array.isArray(opponentSix)||opponentSix.length!==6||opponentSix.some(s=>typeof s!=='string'))
    throw Error('Threat-aware preview requires own six sets and exactly six public rival species names');
  const opt={...DEFAULTS,...options};
  const hyps=rivalHypotheses(dex,team.map(p=>p.species),opponentSix,opt);
  const cache=new Map(),rows=[];
  // Floor over all six public rivals, every variant (any Mega status).
  const anyForm=(i,n)=>combine(variantsOf(dex,n).map(v=>({v:duelCached(dex,team[i],v,'none',cache).value,w:v.weight})));
  for(const three of TRIPLES){
    const six=opponentSix.map(n=>Math.max(...three.map(i=>anyForm(i,n))));
    const sixFloor=0.5*Math.min(...six)+0.5*six.reduce((a,b)=>a+b,0)/6;
    const leads=three.map(lead=>{
      const vs=hyps.map(h=>({h,r:evaluateAgainst(dex,team,three,lead,h,cache,opt)}));
      const mean=vs.reduce((s,x)=>s+x.h.weight*x.r.score,0);
      const floor=Math.min(...vs.map(x=>x.r.score));
      const megaCount=three.filter(i=>dex.items.get(team[i].item).megaStone).length;
      const score=(1-opt.sixWeight)*(0.6*mean+0.4*floor)+opt.sixWeight*sixFloor-(megaCount>1?0.05:0);
      const weakest=vs.reduce((a,b)=>a.r.score<=b.r.score?a:b);
      return {i:lead,score,mean,floor,sixFloor,six,weakest,vs};
    }).sort((a,b)=>b.score-a.score||a.i-b.i);
    rows.push({three,score:leads[0].score,leads});
  }
  rows.sort((a,b)=>b.score-a.score||a.three.join('').localeCompare(b.three.join('')));
  return {hypotheses:hyps,ranked:rows};
}
function chooseThreatAwarePreviewV2(dex,team,opponentSix,options={}){
  const top=rankThreatAwarePreviewV2(dex,team,opponentSix,options).ranked[0];
  const lead=top.leads[0].i;
  return [lead,...top.three.filter(i=>i!==lead)].map(i=>i+1);
}
function explainThreatAwarePreviewV2(dex,team,opponentSix,{top=20,...options}={}){
  const {hypotheses,ranked}=rankThreatAwarePreviewV2(dex,team,opponentSix,options);
  const name=i=>team[i].species,fmt=x=>Number(x.toFixed(3));
  return {
    publicSix:[...opponentSix],
    hypotheses:hypotheses.map(h=>({three:h.three,weight:fmt(h.weight),mega:h.mega,rivalBest:h.rivalBest,
      leads:h.leads.map(l=>l.species+':'+fmt(l.p)).join(' ')})),
    ranked:ranked.slice(0,top).map((c,rank)=>{
      const best=c.leads[0];
      return {rank:rank+1,selected:c.three.map(name),lead:name(best.i),score:fmt(c.score),
        mean:fmt(best.mean),floor:fmt(best.floor),sixFloor:fmt(best.sixFloor),
        leadScores:c.leads.map(l=>name(l.i)+':'+fmt(l.score)).join(' '),
        leadValues:c.leads.map(l=>name(l.i)+':'+fmt(l.vs.reduce((s,x)=>s+x.h.weight*x.r.leadValue,0))).join(' '),
        weakestRival:best.weakest.h.three.join('/')+(best.weakest.h.mega?' mega='+best.weakest.h.mega:''),
        weakestScenario:best.weakest.r.worst.vars.map(v=>v.form+(v.scarf?'@Scarf':'')+'/'+v.ability).join(', ')};
    })
  };
}
module.exports={DEFAULTS,rivalHypotheses,scenarios,scenarioWeather,leadWeather,rankThreatAwarePreviewV2,
  chooseThreatAwarePreviewV2,explainThreatAwarePreviewV2};
