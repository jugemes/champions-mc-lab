'use strict';
// Opt-in public-six -> three preview policy: previewPolicy:'threat-aware'.
// Inputs are ONLY (a) our own six known sets and (b) six opposing public
// species names. Rival moves, items, abilities, points, the hidden three and
// the omniscient battle are never read. It is a heuristic, NOT an oracle, and
// it does not change legacy/stochastic/strategic.
//
// Model in three steps:
// 1. Every public rival species becomes several PUBLIC variants that the
//    rules allow: base form, base form holding Choice Scarf, each Mega form
//    (at most one Mega per rival three). Investment is the max-investment
//    hypothesis (32 points, boosting nature), moves are STAB plus learnable
//    coverage (learnset is public game data, not that player's set).
// 2. The rival chooses three and a lead from OUR public six, with the same
//    public-only model (they cannot see our sets either). We keep several
//    rational rival hypotheses, not one guess.
// 3. Each of our 20 threes x 3 leads (60) is scored against every hypothesis:
//    a one-to-one answer assignment (one of ours per rival member, so one
//    Scarf Garchomp cannot be counted against two threats), the lead duel,
//    and the worst hypothesis. No species is hard-coded.
const {knownStat,estimateDamage,effectiveness}=require('./damage');
const canon=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const SCARF_WEIGHT=0.25;
// Defaults widen the rival hypotheses and add a floor over all six public
// rivals, so a rival three outside the hypotheses is not free. sixWeight:0,
// keep:6, temperature:0.05 was the first (narrower) development setting.
const DEFAULTS={keep:10,temperature:0.08,sixWeight:0.25};

function maxStat(dex,species,stat){
  const s=dex.species.get(species);
  return stat==='hp'?s.baseStats.hp+32+75:Math.floor((s.baseStats[stat]+32+20)*1.1);
}
function fixedAbility(species){
  const values=Object.values(species.abilities||{}).filter(Boolean);
  return values.length===1?values[0]:'';
}
// Public variants of one rival species. Weights are hypotheses, not usage data.
// A non-Mega form with several legal abilities is split per ability (equal
// weight): the ability list is public game data, which one is held is not.
function publicVariants(dex,name){
  const base=dex.species.get(name);
  if(!base.exists)throw Error('Unknown public species '+name);
  const megas=(base.otherFormes||[]).map(f=>dex.species.get(f)).filter(f=>f.exists&&f.isMega);
  const abilities=[...new Set(Object.values(base.abilities||{}).filter(Boolean))];
  const out=[];
  for(const ability of abilities.length?abilities:['']){
    const w=1/Math.max(1,abilities.length);
    out.push({species:base.name,form:base.name,mega:false,scarf:false,weight:w,ability});
    out.push({species:base.name,form:base.name,mega:false,scarf:true,weight:SCARF_WEIGHT*w,ability});
  }
  for(const m of megas)out.push({species:base.name,form:m.name,mega:true,scarf:false,weight:1,ability:fixedAbility(m)});
  return out;
}
const coverageCache=new Map();
// opts.priorityKeys (v2): keep the best PRIORITY move of each type apart, so
// e.g. Sucker Punch is not overwritten by a stronger non-priority Dark move.
// Default off = the PR #58 behaviour, unchanged.
function coverageMoves(dex,form,{priorityKeys=false}={}){
  const key=canon(form)+(priorityKeys?'|prio':'');
  if(coverageCache.has(key))return coverageCache.get(key);
  const species=dex.species.get(form);
  let pool=new Set();
  try{pool=dex.species.getMovePool(species.id);}catch{}
  if(!pool.size&&species.baseSpecies)try{pool=dex.species.getMovePool(dex.species.get(species.baseSpecies).id);}catch{}
  const best={};
  for(const id of pool){
    const m=dex.moves.get(id);
    if(!m.exists||m.category==='Status'||!m.basePower||m.basePower>=150)continue;
    if(m.flags?.charge||m.selfdestruct||m.ohko||m.isZ||m.isMax)continue;
    if(m.id==='solarbeam'||m.id==='solarblade')continue; // only in sun, handled below
    const k=m.type+m.category+(priorityKeys&&m.priority>0?'prio':''),acc=typeof m.accuracy==='number'?m.accuracy/100:1;
    const value=Math.min(m.basePower,100)*acc;
    if(!best[k]||best[k].value<value)best[k]={type:m.type,category:m.category,basePower:Math.min(m.basePower,100)*acc,
      priority:m.priority,contact:Boolean(m.flags?.contact),useDef:m.overrideOffensiveStat==='def',value};
  }
  const out=Object.values(best);
  // Reliable recovery is learnable-move data, again a possibility only.
  out.recovery=[...pool].some(id=>{const m=dex.moves.get(id);
    return m.category==='Status'&&m.heal&&m.heal[0]/m.heal[1]>=0.5&&m.target==='self';});
  // Largest learnable self attack/special-attack boost (Swords Dance = 2).
  out.setup=Math.max(0,...[...pool].map(id=>{const m=dex.moves.get(id);
    const b=m.category==='Status'&&m.target==='self'&&m.boosts||{};return Math.max(b.atk||0,b.spa||0);}));
  coverageCache.set(key,out);
  return out;
}
function rawDamage(power,attack,defence,mult){
  return (Math.floor(Math.floor(22*power*attack/defence)/50)+2)*mult;
}
// Public-only attack of a variant on a (public or known) defender.
// opts.weather (v2): 'sun'|'sand'|'none' from the scenario's weather setters.
// Undefined = PR #58 behaviour (sun only from the attacker's own Drought, and
// the Sand Force branch never fires).
function variantAttack(dex,v,defender,{knownDefender,weather,priorityKeys=false}){
  const form=dex.species.get(v.form),def=dex.species.get(defender.species);
  const hp=knownDefender?knownStat(dex,defender,'hp'):maxStat(dex,defender.species,'hp')-32;
  const ability=canon(v.ability);
  const sun=weather===undefined?ability==='drought':weather==='sun';
  const sand=weather==='sand';
  const moves=[];
  for(const type of form.types)for(const category of ['Physical','Special'])
    moves.push({type,category,basePower:90,stab:true,contact:category==='Physical'});
  for(const m of coverageMoves(dex,v.form,{priorityKeys}))moves.push({...m,stab:form.types.includes(m.type)});
  if(sun)moves.push({type:'Grass',category:'Special',basePower:120,stab:false});
  let stab=0,coverage=0,priority=0,physical=0,special=0;
  for(const m of moves){
    const eff=effectiveness(dex,m,def,{foeAbility:knownDefender?defender.ability:fixedAbility(def),foeItem:knownDefender?defender.item:''});
    if(!eff)continue;
    const stat=m.category==='Physical'?'atk':'spa',dstat=m.category==='Physical'?'def':'spd';
    const atk=maxStat(dex,v.form,m.useDef?'def':stat);
    const dfn=knownDefender?knownStat(dex,defender,dstat):Math.floor((def.baseStats[dstat]+20)*1.0);
    let mult=eff*(m.stab?(ability==='adaptability'?2:1.5):1);
    if(ability==='toughclaws'&&m.contact)mult*=1.3;
    if(ability==='aerilate'&&m.type==='Normal')mult*=1.2*1.5;
    if(sun&&m.type==='Fire')mult*=1.5;
    if(sun&&m.type==='Water')mult*=0.5;
    if(sand&&ability==='sandforce'&&['Rock','Ground','Steel'].includes(m.type))mult*=1.3;
    // Average roll: the rival's attack is already the max-investment case.
    const frac=rawDamage(m.basePower,atk,dfn,mult)*0.925/hp;
    if(m.stab)stab=Math.max(stab,frac);else coverage=Math.max(coverage,frac);
    if(m.category==='Physical')physical=Math.max(physical,frac);else special=Math.max(special,frac);
    if(m.priority>0)priority=Math.max(priority,frac);
  }
  return {stab,coverage,priority,physical,special,worst:Math.max(stab,coverage)};
}
function ownForm(dex,set){
  const item=dex.items.get(set.item);
  if(item.megaStone){
    const mega=typeof item.megaStone==='string'?item.megaStone:Object.values(item.megaStone)[0];
    const form=dex.species.get(mega);
    if(form.exists)return {...set,species:form.name,ability:fixedAbility(form)||set.ability};
  }
  return set;
}
function ownItemMult(dex,set,move){
  const item=canon(set.item);
  if(item==='lifeorb')return 1.3;
  if(item==='choiceband'&&move.category==='Physical')return 1.5;
  if(item==='choicespecs'&&move.category==='Special')return 1.5;
  if(canon(set.ability)==='toughclaws'&&move.flags?.contact)return 1.3;
  return 1;
}
// Our known set attacking a public variant: damage RANGE over the rival's
// unknown points/nature, from damage.js.
function ownAttack(dex,set,v){
  let best={min:0,max:0},prio={min:0};
  for(const name of set.moves){
    const move=dex.moves.get(name);
    if(move.category==='Status')continue;
    const hit=estimateDamage(dex,set,v.form,name,{foeAbility:v.ability});
    if(hit.immune)continue;
    // Mid of the range over the rival's unknown bulk; accuracy kept apart.
    const k=ownItemMult(dex,set,move);
    const r={min:hit.mid*k,max:hit.max*k,move:move.name,accuracy:hit.accuracy,category:move.category};
    if(r.min*r.accuracy>best.min*(best.accuracy||1))best=r;
    if(move.priority>0&&r.min>prio.min)prio=r;
  }
  return {best,prio};
}
function hitsToKO(frac){return frac<=0?99:Math.ceil(1/Math.max(frac,1e-6)-1e-9);}
// Duel value in [0,1] for one of OUR known sets vs one PUBLIC rival variant.
// free: we enter safely (after a KO); swap: we enter by taking one hit first.
// opts (v2 only; defaults = PR #58): weather, priorityKeys, encore (our known
// Encore, when we outspeed, turns a rival setup turn into a lock instead of a
// boost, so the setup penalty is dropped), speedSpread (the rival's speed
// investment is hidden: average the max-invested and the uninvested neutral
// speed cases instead of assuming max speed only).
function duel(dex,own,v,opts={}){
  if(opts.speedSpread){
    const hi=duel(dex,own,v,{...opts,speedSpread:false,rivalSpeed:'max'});
    const lo=duel(dex,own,v,{...opts,speedSpread:false,rivalSpeed:'none'});
    const avg=k=>(hi[k]+lo[k])/2;
    return {...hi,value:avg('value'),free:avg('free'),swap:avg('swap'),faster:avg('faster'),
      encoreLock:hi.encoreLock||lo.encoreLock,speedCases:{max:hi,none:lo}};
  }
  const set=ownForm(dex,own);
  const mine=ownAttack(dex,set,v);
  const theirs=variantAttack(dex,v,set,{knownDefender:true,weather:opts.weather,priorityKeys:opts.priorityKeys});
  const ourSpe=knownStat(dex,set,'spe')*(canon(own.item)==='choicescarf'?1.5:1);
  const theirSpe=(opts.rivalSpeed==='none'?dex.species.get(v.form).baseStats.spe+20:maxStat(dex,v.form,'spe'))*(v.scarf?1.5:1);
  const faster=ourSpe>theirSpe?1:ourSpe===theirSpe?0.5:0;
  // Public ability effects of this variant on our attacks.
  const ab=canon(v.ability);
  const intimidate=ab==='intimidate'&&mine.best.category==='Physical'&&canon(own.ability)!=='clearbody'?2/3:1;
  let ours=hitsToKO(mine.best.min*intimidate),oursPrio=hitsToKO(mine.prio.min*intimidate);
  if(ab==='disguise'){ours++;oursPrio++;}
  if((ab==='sturdy'||ab==='multiscale')&&ours===1){ours=2;oursPrio=Math.max(2,oursPrio);}
  // Our own Will-O-Wisp: a known move, useful only into a physical attacker
  // that is not Fire type. One turn spent, physical damage halved after it.
  const wisp=set.moves.some(m=>canon(m)==='willowisp')&&!dex.species.get(v.form).types.includes('Fire')
    &&theirs.physical>=theirs.special&&!['guts','magicguard'].includes(ab);
  const acc=(mine.best.accuracy||1)**Math.min(ours,3);
  // Race in turns: diff>0 means we KO first. Continuous so near-misses differ
  // from blowouts; speed is worth half a turn.
  const race=(turnsUs,turnsThem)=>{
    const diff=(turnsThem-turnsUs)+(faster-0.5);
    return diff>0?Math.min(1,0.7+0.3*diff):Math.max(0,0.3+0.3*diff);
  };
  // Learnable coverage is a possibility, not that player's set: half the
  // value assumes STAB only, half assumes the worst learnable coverage.
  const burned=hit=>hit>=1?99:1+hitsToKO((1-hit)/(hit/2));
  const raceSlow=(turnsUs,turnsThem)=>{
    const diff=(turnsThem-turnsUs)-0.5;
    return diff>0?Math.min(1,0.7+0.3*diff):Math.max(0,0.3+0.3*diff);
  };
  const branch=(hit,prio=0,setup=0)=>{
    let them=hitsToKO(hit);
    let free=Math.max(race(ours,them)*acc,oursPrio===1?1:0);
    // Rival priority moves first regardless of speed; a learnable setup
    // move spends one turn and multiplies the following hits.
    const f=1+0.5*Math.min(2,setup);
    if(prio>0)free=Math.min(free,Math.max(raceSlow(ours,hitsToKO(prio))*acc,oursPrio===1?1:0));
    if(setup&&ours>1){
      const boosted=1+hitsToKO(hit*f);
      free=Math.min(free,race(ours,boosted)*acc);
      if(prio>0)free=Math.min(free,raceSlow(ours,1+hitsToKO(prio*f))*acc);
      them=Math.min(them,boosted);
    }
    let swap=hit>=1?0:race(ours,Math.max(0,them-1))*acc*(1-Math.min(0.5,hit/2));
    if(wisp){
      // 85% accuracy; after the burn the race restarts with one turn lost.
      free=Math.max(free,0.85*race(ours+1,burned(hit))*acc);
      if(hit<0.5)swap=Math.max(swap,0.85*race(ours+1,Math.max(0,burned(hit)-1))*acc*(1-hit/2));
    }
    return {free,swap,them};
  };
  const stab=branch(theirs.stab);
  // Pessimistic branch: worst learnable coverage AND learnable recovery,
  // which turns a 2-3HKO that cannot outpace 50% healing into a stall.
  const plainOurs=ours;
  if(coverageMoves(dex,v.form).recovery&&ours>1)ours=mine.best.min*intimidate>=0.5?ours+1:99;
  const pool=coverageMoves(dex,v.form,{priorityKeys:opts.priorityKeys});
  const encoreLock=opts.encore&&faster===1&&set.moves.some(m=>canon(m)==='encore');
  const cov=branch(Math.max(theirs.stab,theirs.coverage),theirs.priority,encoreLock?0:pool.setup);
  ours=plainOurs;
  const free=(stab.free+cov.free)/2,swap=(stab.swap+cov.swap)/2;
  const value=0.6*free+0.4*swap;
  return {value,free,swap,faster,setup:pool.setup,encoreLock,priority:Number(theirs.priority.toFixed(3)),ourHits:ours,theirHits:cov.them,theirStabHits:stab.them,move:mine.best.move||'',
    theirWorst:Number(theirs.worst.toFixed(3)),ourMin:Number(mine.best.min.toFixed(3))};
}
// Public-vs-public duel used for the RIVAL'S selection: both sides unknown.
function publicDuel(dex,a,b){
  const atk=variantAttack(dex,a,{species:b.form},{knownDefender:false});
  const def=variantAttack(dex,b,{species:a.form},{knownDefender:false});
  const aS=maxStat(dex,a.form,'spe')*(a.scarf?1.5:1),bS=maxStat(dex,b.form,'spe')*(b.scarf?1.5:1);
  const first=aS>bS?1:aS===bS?0.5:0;
  const race=(x,y)=>{const diff=(hitsToKO(y)-hitsToKO(x))+(first-0.5);
    return diff>0?Math.min(1,0.7+0.3*diff):Math.max(0,0.3+0.3*diff);};
  return (race(atk.stab,def.stab)+race(atk.worst,def.worst))/2;
}
const TRIPLES=(()=>{const t=[];for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<6;c++)t.push([a,b,c]);return t;})();
const PERMS=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
function weightedMean(xs){const w=xs.reduce((s,x)=>s+x.w,0);return xs.reduce((s,x)=>s+x.v*x.w,0)/(w||1);}
// Value of one public species against another (variants combined: a quarter
// the worst plausible variant, the rest the weighted typical one).
function combine(values){
  return 0.25*Math.min(...values.map(x=>x.v))+0.75*weightedMean(values);
}
// Step 2: the rival's rational threes/leads from OUR PUBLIC six (names only).
// The rival knows its own sets, so its member is scored at its best plausible
// variant (at most one Mega per three); OUR members stay uncertain to it.
function rivalHypotheses(dex,ownPublic,rivalSix,{keep=DEFAULTS.keep,temperature=DEFAULTS.temperature}={}){
  const ourVar=ownPublic.map(n=>publicVariants(dex,n));
  const theirVar=rivalSix.map(n=>publicVariants(dex,n));
  const vsOurs=t=>ourVar.map(ov=>combine(ov.map(o=>({v:publicDuel(dex,t,o),w:o.weight}))));
  const best=rows=>rows[0].map((_,j)=>Math.max(...rows.map(r=>r[j])));
  const plain=theirVar.map(tv=>best(tv.filter(t=>!t.mega).map(vsOurs)));
  const mega=theirVar.map(tv=>{const m=tv.filter(t=>t.mega);return m.length?best(m.map(vsOurs)):null;});
  const ranked=[];
  for(const three of TRIPLES){
    let top=null;
    for(const holder of [null,...three.filter(i=>mega[i])]){
      const row=i=>i===holder?mega[i]:plain[i];
      const answer=ownPublic.map((_,j)=>Math.max(...three.map(i=>row(i)[j])));
      const mean=answer.reduce((a,b)=>a+b,0)/answer.length,floor=Math.min(...answer);
      const score=mean+0.35*floor;
      if(!top||score>top.score)top={three,score,holder,
        leads:three.map(i=>({i,score:row(i).reduce((a,b)=>a+b,0)/row(i).length}))
          .sort((a,b)=>b.score-a.score||a.i-b.i)};
    }
    ranked.push(top);
  }
  ranked.sort((a,b)=>b.score-a.score||a.three.join('').localeCompare(b.three.join('')));
  const top=ranked.slice(0,keep),first=top[0].score;
  const weights=top.map(x=>Math.exp((x.score-first)/temperature)),sum=weights.reduce((a,b)=>a+b,0);
  return top.map((x,k)=>{
    const lw=x.leads.map(l=>Math.exp((l.score-x.leads[0].score)/(3*temperature))),ls=lw.reduce((a,b)=>a+b,0);
    return {three:x.three.map(i=>rivalSix[i]),score:x.score,weight:weights[k]/sum,
      likelyMega:x.holder==null?null:rivalSix[x.holder],
      leads:x.leads.map((l,n)=>({species:rivalSix[l.i],p:lw[n]/ls}))};
  });
}
// Mega assignments for a rival three: at most one Mega; non-Mega members may
// be base or Scarf. Mega-capable members are equally likely to be the Mega.
function megaScenarios(dex,three){
  const capable=three.filter(n=>publicVariants(dex,n).some(v=>v.mega));
  const out=[{mega:null,w:capable.length?0.35:1}];
  for(const n of capable)out.push({mega:n,w:0.65/capable.length});
  return out;
}
function threatValue(dex,own,name,megaHolder,cache){
  const key=own.species+'|'+name+'|'+(megaHolder===name);
  if(cache.has(key))return cache.get(key);
  const vars=publicVariants(dex,name).filter(v=>megaHolder===name?v.mega:!v.mega);
  const rows=vars.map(v=>({v:duel(dex,own,v).value,w:v.weight,variant:v}));
  const out={value:combine(rows),worst:rows.reduce((a,b)=>a.v<=b.v?a:b)};
  cache.set(key,out);
  return out;
}
// Step 3: one of our threes + lead against one rival hypothesis.
function evaluateAgainst(dex,team,three,lead,hyp,cache){
  const scen=megaScenarios(dex,hyp.three);
  const per=scen.map(sc=>{
    const mat=three.map(i=>hyp.three.map(n=>threatValue(dex,team[i],n,sc.mega,cache).value));
    let best=null;
    for(const p of PERMS){
      const vals=p.map((ownIdx,r)=>mat[ownIdx][r]);
      const s=0.5*Math.min(...vals)+0.5*vals.reduce((a,b)=>a+b,0)/3;
      if(!best||s>best.s)best={s,p,vals};
    }
    const backup=hyp.three.map((_,r)=>Math.max(...three.map((_,k)=>mat[k][r])));
    // Lead: the duel against each rival lead, or a safe swap to the bench.
    const li=three.indexOf(lead);
    const leadValue=hyp.leads.reduce((s,l)=>{
      const r=hyp.three.indexOf(l.species);
      const stay=mat[li][r];
      const pivot=Math.max(...three.filter(i=>i!==lead).map(i=>
        duel(dex,team[i],publicVariants(dex,l.species).find(v=>sc.mega===l.species?v.mega:!v.mega&&!v.scarf)).swap));
      // The lead's loss also costs the answer it was assigned to.
      const reserved=best.p.indexOf(li);
      const cost=reserved>=0&&reserved!==r&&stay<0.5?0.15:0;
      return s+l.p*(Math.max(stay,0.8*pivot)-cost);
    },0);
    return {w:sc.w,mega:sc.mega,assign:best,backup,leadValue,
      score:0.55*best.s+0.15*backup.reduce((a,b)=>a+b,0)/3+0.3*leadValue};
  });
  const score=0.5*Math.min(...per.map(x=>x.score))+0.5*weightedMean(per.map(x=>({v:x.score,w:x.w})));
  const worst=per.reduce((a,b)=>a.score<=b.score?a:b);
  return {score,worst,per};
}
function rankThreatAwarePreview(dex,team,opponentSix,options={}){
  if(team.length!==6||!Array.isArray(opponentSix)||opponentSix.length!==6||opponentSix.some(s=>typeof s!=='string'))
    throw Error('Threat-aware preview requires own six sets and exactly six public rival species names');
  const opt={...DEFAULTS,...options};
  const hyps=rivalHypotheses(dex,team.map(p=>p.species),opponentSix,opt);
  const cache=new Map(),rows=[];
  // Every public rival, any mega status: value of our best answer in three.
  const anyForm=(i,n)=>Math.min(threatValue(dex,team[i],n,null,cache).value,
    publicVariants(dex,n).some(v=>v.mega)?threatValue(dex,team[i],n,n,cache).value:1);
  for(const three of TRIPLES){
    const six=opponentSix.map(n=>Math.max(...three.map(i=>anyForm(i,n))));
    const sixFloor=0.5*Math.min(...six)+0.5*six.reduce((a,b)=>a+b,0)/6;
    const leads=three.map(lead=>{
      const vs=hyps.map(h=>({h,r:evaluateAgainst(dex,team,three,lead,h,cache)}));
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
function chooseThreatAwarePreview(dex,team,opponentSix,options={}){
  const top=rankThreatAwarePreview(dex,team,opponentSix,options).ranked[0];
  const lead=top.leads[0].i;
  return [lead,...top.three.filter(i=>i!==lead)].map(i=>i+1);
}
// Human-readable log: rank, lead, rival hypotheses, assigned answers and the
// hypothesis that hurts each candidate most (= why it was or was not chosen).
function explainThreatAwarePreview(dex,team,opponentSix,{top=20,...options}={}){
  const {hypotheses,ranked}=rankThreatAwarePreview(dex,team,opponentSix,options);
  const publicSix=opponentSix;
  const name=i=>team[i].species;
  const fmt=x=>Number(x.toFixed(3));
  return {
    publicSix:[...opponentSix],
    hypotheses:hypotheses.map(h=>({three:h.three,weight:fmt(h.weight),likelyMega:h.likelyMega,
      leads:h.leads.map(l=>l.species+':'+fmt(l.p)).join(' ')})),
    ranked:ranked.slice(0,top).map((c,rank)=>{
      const best=c.leads[0];
      const answers=best.vs.map(({h,r})=>{
        const w=r.worst;
        return {rival:h.three.join('/'),mega:w.mega||'none',score:fmt(r.score),
          answers:h.three.map((n,k)=>n+'<-'+name(c.three[w.assign.p[k]])+'('+fmt(w.assign.vals[k])+')').join(', ')};
      });
      return {rank:rank+1,selected:c.three.map(name),lead:name(best.i),score:fmt(c.score),
        mean:fmt(best.mean),floor:fmt(best.floor),sixFloor:fmt(best.sixFloor),
        publicSixAnswers:publicSix.map((n,k)=>n+':'+fmt(best.six[k])).join(' '),
        leadScores:c.leads.map(l=>name(l.i)+':'+fmt(l.score)).join(' '),
        weakestRival:best.weakest.h.three.join('/'),answers};
    })
  };
}
module.exports={DEFAULTS,publicVariants,duel,publicDuel,rivalHypotheses,rankThreatAwarePreview,
  chooseThreatAwarePreview,explainThreatAwarePreview,coverageMoves,variantAttack,combine,weightedMean,
  maxStat,fixedAbility,hitsToKO,TRIPLES,PERMS,canon};
