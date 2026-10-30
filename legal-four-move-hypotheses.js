'use strict';
// Research-only public-learnset candidate generator. NEVER observes an actual
// opponent set, a hidden selection, a held item or an omniscient Battle.
// Each candidate is a single *coherent four-move set*, validated against the
// project's pinned Champions TeamValidator. This is NOT a probability model:
// no ladder usage counts are implied by shortlist rank.
const KEY_MOVES=new Set(['suckerpunch','firstimpression','aquajet','bulletpunch',
  'shadowsneak','extremespeed','fakeout','encore','willowisp','swordsdance',
  'dragondance','nastyplot','quiverdance','recover','roost','slackoff',
  'uturn','voltswitch','flipturn','stealthrock','thunderwave',
  'ironhead','knockoff','earthquake','moonblast','dazzlinggleam']);
const stat=(sp,category)=>category==='Physical'?sp.baseStats.atk:sp.baseStats.spa;
function moveScore(dex,sp,id){
  const m=dex.moves.get(id);
  if(!m.exists||m.isZ||m.isMax||m.ohko)return -1000;
  if(m.category==='Status'){
    const boosts=m.boosts||{};
    const setup=Math.max(boosts.atk||0,boosts.spa||0);
    const heal=m.heal&&m.target==='self'?10:0;
    return 15+setup*13+heal+(KEY_MOVES.has(id)?20:0);
  }
  if(!m.basePower)return -1000;
  const acc=typeof m.accuracy==='number'?m.accuracy/100:1;
  const power=Math.min(120,m.basePower)*acc;
  const typeBonus=sp.types.includes(m.type)?22:0;
  const prio=Math.max(0,m.priority)*28;
  const attack=stat(sp,m.category);
  const preference=attack/16;
  return power*0.6+typeBonus+prio+preference+(KEY_MOVES.has(id)?15:0);
}
function shortlist(dex,species,limit=16){
  const sp=dex.species.get(species);
  if(!sp.exists)throw Error('Unknown species: '+species);
  const src=sp.isMega?dex.species.get(sp.baseSpecies):sp;
  let pool=dex.species.getMovePool(src.id);
  if(!(pool instanceof Set))pool=new Set(pool||[]);
  if(!pool.size)throw Error('No public move pool: '+species);
  const scored=[...pool].map(id=>({id,score:moveScore(dex,sp,id)}))
    .filter(x=>x.score>=0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  const selected=scored.slice(0,Math.max(4,limit)).map(x=>x.id);
  // Reserve strong public tactical possibilities that otherwise lose to raw
  // power. No move is treated as the opponent's *observed* actual move.
  const anchors=scored.filter(x=>KEY_MOVES.has(x.id));
  for(const a of anchors){
    if(selected.includes(a.id))continue;
    // Replace only the lowest-ranked non-anchor, not the previous anchor.
    const i=selected.findLastIndex(id=>!KEY_MOVES.has(id));
    if(i<0)break;
    selected[i]=a.id;
  }
  return [...new Set(selected)].sort();
}
function quartets(pool){
  const out=[];
  for(let a=0;a<pool.length-3;a++)for(let b=a+1;b<pool.length-2;b++)
    for(let c=b+1;c<pool.length-1;c++)for(let d=c+1;d<pool.length;d++)
      out.push([pool[a],pool[b],pool[c],pool[d]]);
  return out;
}
function legalFourMoveHypotheses(dex,validator,species,{
  item='Sitrus Berry',ability,nature='Adamant',points={hp:2,atk:32,spe:32},
  maxCandidates=24,movePoolLimit=16,
}={}){
  const sp=dex.species.get(species);
  if(!sp.exists)throw Error('Unknown species: '+species);
  const base=sp.isMega?dex.species.get(sp.baseSpecies):sp;
  const ab=ability||base.abilities['0'];
  const pool=shortlist(dex,species,movePoolLimit);
  const results=[],rejected={};let considered=0;
  // Order by a transparent heuristic, but do not call it a prior probability.
  const combinations=quartets(pool).map(moves=>({
    moves,score:moves.reduce((n,id)=>n+moveScore(dex,sp,id),0),
  })).sort((a,b)=>b.score-a.score||a.moves.join().localeCompare(b.moves.join()));
  for(const candidate of combinations){
    considered++;
    const set={species:base.name,item,ability:ab,nature,level:50,
      evs:{hp:points.hp||0,atk:points.atk||0,def:points.def||0,
        spa:points.spa||0,spd:points.spd||0,spe:points.spe||0},
      moves:candidate.moves.map(x=>dex.moves.get(x).name)};
    const problems=validator.validateSet(structuredClone(set),{});
    if(problems?.length){
      const first=problems[0];
      rejected[first]=(rejected[first]||0)+1;
      continue;
    }
    results.push({species:base.name,item,ability:ab,moves:set.moves,
      score:candidate.score,validated:true});
    if(results.length>=maxCandidates)break;
  }
  return {species:base.name,form:sp.name,source:'public-showdown-learnset',
    note:'Hypothetical legal four-move candidate; not a real opponent set or usage probability.',
    pool,considered,rejected,sets:results};
}
module.exports={moveScore,shortlist,quartets,legalFourMoveHypotheses};
