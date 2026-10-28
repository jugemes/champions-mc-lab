'use strict';
/**
 * Construct opponent WHAT-IF sets from a fixed synthetic research catalog.
 * Only six PUBLIC species names are arguments. The private opponent Battle,
 * team, items, moves, selected three, etc. are never accepted.
 *
 * Catalog is intentionally NOT an empirical usage distribution. An existing
 * M-7 constructed fixture is only a legal, concrete hypothesis. Missing
 * species must fail closed, never be silently assigned made-up moves.
 */
const {groups}=require('./environment-m7-teams');
const {normalize}=require('./lab');
const FORMAT='gen9championsbssregmc';

function publicHypotheses(sim,publicSix,{limit=3}={}){
  if(!Array.isArray(publicSix)||publicSix.length!==6||
     publicSix.some(n=>typeof n!=='string'||!n.trim())||
     new Set(publicSix).size!==6)
    throw Error('exactly six distinct public species required');
  if(!Number.isInteger(limit)||limit<1||limit>12)throw Error('hypothesis limit must be 1..12');
  const dex=sim.Dex.mod('champions');
  const publicNames=publicSix.map(s=>{
    const d=dex.species.get(s);
    if(!d.exists||d.isMega)throw Error('unknown or pre-revealed Mega public species: '+s);
    return d.name;
  });
  if(new Set(publicNames).size!==6)throw Error('duplicate canonical species');
  const collections=new Map();
  for(const group of groups)for(const set of group.team){
    const d=dex.species.get(set.species);
    if(!d.exists)continue;
    const key=d.name;
    const options=collections.get(key)||[];
    const signature=JSON.stringify([set.species,set.item,set.ability,set.nature,set.evs,set.moves]);
    if(!options.some(x=>x.signature===signature))
      options.push({signature,set:structuredClone(set),source:group.name});
    collections.set(key,options);
  }
  const options=publicNames.map(n=>{
    const arr=collections.get(n)||[];
    if(!arr.length)throw Error('no explicitly documented synthetic sets for '+n);
    return arr;
  });
  // Bounded deterministic combination enumerator; every finished set passes
  // the pinned M-C TeamValidator. No invented probabilities or unseen moves.
  const validator=sim.TeamValidator.get(FORMAT);
  const results=[],chosen=[],items=new Set();
  let rejected=0;
  function dfs(i){
    if(results.length>=limit)return;
    if(i===6){
      const team=chosen.map(x=>structuredClone(x.set));
      if(validator.validateTeam(normalize(team))?.length){rejected++;return;}
      results.push({team,sources:chosen.map(x=>({species:x.set.species,source:x.source})),
        knowledge:'synthetic hypothesis from public six, NOT scouted sets',
        probability:null});
      return;
    }
    for(const x of options[i]){
      if(items.has(x.set.item))continue;
      items.add(x.set.item);chosen.push(x);dfs(i+1);
      chosen.pop();items.delete(x.set.item);
      if(results.length>=limit)return;
    }
  }
  dfs(0);
  if(!results.length)throw Error('no M-C legal item-distinct hypotheses for public six');
  return {publicSix:publicNames,assumptions:results,rejected,
    caveat:'synthetic catalog only; no item/move frequencies or co-occurrence probabilities'};
}
module.exports={publicHypotheses};
