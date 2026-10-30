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
function statProfiles(dex,moves,nature,points){
  // Champions 66 ability points. The rival's allocation is NOT publicly
  // known: never silently force a special attacker into Adamant/Atk32.
  if(nature||points)return [{nature:nature||'Hardy',points:points||{hp:2,atk:32,spe:32}}];
  const attacks=moves.map(x=>dex.moves.get(x)).filter(m=>m.category!=='Status');
  const physical=attacks.filter(m=>m.category==='Physical');
  const special=attacks.filter(m=>m.category==='Special');
  const p=physical.reduce((v,m)=>v+m.basePower,0);
  const s=special.reduce((v,m)=>v+m.basePower,0);
  const physicalProfiles=[
    {nature:'Jolly',points:{hp:2,atk:32,spe:32}},
    {nature:'Adamant',points:{hp:32,atk:32,spd:2}},
  ];
  const specialProfiles=[
    {nature:'Timid',points:{hp:2,spa:32,spe:32}},
    {nature:'Modest',points:{hp:32,spa:32,spd:2}},
  ];
  const bulk=[{nature:'Bold',points:{hp:32,def:32,spa:2}}];
  if(!attacks.length)return bulk;
  const profiles=p>s?[...physicalProfiles,...(s?specialProfiles:[])]:
    [...specialProfiles,...(p?physicalProfiles:[])];
  if(moves.some(id=>{const m=dex.moves.get(id);return m.category==='Status'&&m.heal;}))
    profiles.push(...bulk);
  return profiles;
}
function legalFourMoveHypotheses(dex,validator,species,{
  item='Sitrus Berry',ability,nature,points,
  maxCandidates=24,movePoolLimit=16,
}={}){
  if(typeof species!=='string'||!species.trim())throw Error('Unknown species: public name required');
  const sp=dex.species.get(species);
  if(!sp.exists)throw Error('Unknown species: '+species);
  const base=sp.isMega?dex.species.get(sp.baseSpecies):sp;
  const ab=ability||base.abilities['0'];
  const pool=shortlist(dex,species,movePoolLimit);
  const results=[],rejected={},covered=new Set(),seen=new Set();let considered=0;
  // The score is for enumerating diverse POSSIBLE sets, not a usage prior.
  const combinations=quartets(pool).map(moves=>({
    moves,score:moves.reduce((n,id)=>n+moveScore(dex,sp,id),0),
  })).sort((a,b)=>b.score-a.score||a.moves.join().localeCompare(b.moves.join()));
  function tryAdd(candidate,forceUnseen){
    const outMoves=candidate.moves.map(x=>dex.moves.get(x).name);
    for(const profile of statProfiles(dex,candidate.moves,nature,points)){
      if(results.length>=maxCandidates)return;
      const set={species:base.name,item,ability:ab,nature:profile.nature,level:50,
        evs:{hp:profile.points.hp||0,atk:profile.points.atk||0,def:profile.points.def||0,
          spa:profile.points.spa||0,spd:profile.points.spd||0,spe:profile.points.spe||0},
        moves:outMoves};
      const key=candidate.moves.join(',')+'/'+set.nature+'/'+Object.values(set.evs).join(',');
      if(seen.has(key))continue;
      seen.add(key);considered++;
      const validated=structuredClone(set);
      const problems=validator.validateSet(validated,{});
      if(problems?.length){
        rejected[problems[0]]=(rejected[problems[0]]||0)+1;
        continue;
      }
      results.push({...validated,score:candidate.score,validated:true});
      for(const id of candidate.moves)covered.add(id);
      // The role-coverage phase first ensures distinct public moves are
      // represented; subsequent passes add independent stat hypotheses.
      if(forceUnseen)return;
    }
  }
  // Avoid top-N truncation erasing important Encore/priority/recovery roles.
  // For each still-unrepresented move, first find the best LEGAL quartet
  // containing it, then fill remaining slots with diverse stat hypotheses.
  for(const id of pool){
    if(results.length>=maxCandidates)break;
    if(covered.has(id))continue;
    for(const candidate of combinations){
      if(!candidate.moves.includes(id))continue;
      const before=results.length;
      tryAdd(candidate,true);
      if(results.length>before)break;
    }
  }
  for(const candidate of combinations){
    if(results.length>=maxCandidates)break;
    tryAdd(candidate,false);
  }
  return {species:base.name,form:sp.name,source:'public-showdown-learnset',
    note:'Validated possible four-move set; not an observed rival, full-team legality, or a usage prior.',
    pool,unrepresentedMoves:pool.filter(id=>!covered.has(id)),considered,rejected,sets:results};
}
module.exports={moveScore,shortlist,quartets,legalFourMoveHypotheses};
