'use strict';
// #104 research-only public-six tempo candidate. No hidden opponent sets, item,
// moves or selection are read. No species-specific rules or occurrence priors.
// This is a heuristic hypothesis, NOT an engine-exact future-turn solver.
const {moveUtility}=require('./damage');
const {chooseThree,matchup}=require('./lab');

function chooseTempoPreview(dex,own,publicSix){
  if(own.length!==6||publicSix.length!==6||publicSix.some(s=>typeof s!=='string'))
    throw Error('publicTempo needs known own six and public opponent species six');
  const three=chooseThree(dex,own,publicSix).map(i=>i-1);
  // Isolate lead choice from the legacy three-member selection for attribution.
  // A lead must pressure multiple possible opponents; the min is a stress
  // floor, not a claimed probability of any opposing lead.
  const rows=three.map(i=>{
    const hits=publicSix.map(s=>Math.max(...own[i].moves.map(m=>matchup(dex,own[i],s,m))));
    const mean=hits.reduce((a,b)=>a+b,0)/hits.length;
    const floor=Math.min(...hits);
    return {i,species:own[i].species,mean,floor,score:.8*mean+.2*floor};
  }).sort((a,b)=>b.score-a.score||a.i-b.i);
  return {selection:rows.map(r=>r.i+1),rows,
    warning:'research-only: equal stress scenarios are not ladder frequencies'};
}

function chooseTempoMove(dex,own,foe,publicSix,available,info={}){
  if(!Array.isArray(publicSix)||!publicSix.length)return null;
  // Only moves which the real request says are currently legal are considered.
  const options=available.filter(x=>{
    const m=dex.moves.get(x.move);
    return m.exists&&m.category!=='Status';
  });
  if(options.length<2)return null; // Choice lock, Encore, no PP, etc.
  const switches=[...new Set(publicSix)].filter(s=>s!==foe);
  if(!switches.length)return null;
  const rows=options.map(x=>{
    const current=moveUtility(dex,own,foe,x.move,{...info,foeHP:info.foeHP});
    const vsSwitch=switches.map(s=>moveUtility(dex,own,s,x.move,{
      weather:info.weather,terrain:info.terrain,boosts:info.boosts,
      ...('knownOwnOffense' in info?{knownOwnOffense:info.knownOwnOffense,
        attackerItem:info.attackerItem,attackerAbility:info.attackerAbility}:{})
    }));
    const mean=vsSwitch.reduce((a,b)=>a+b,0)/vsSwitch.length;
    return {i:x.i,move:x.move,current,meanSwitch:mean,
      // The active foe dominates: speculative switches cannot outweigh an
      // immediate attack/KO by an arbitrarily large penalty.
      score:.85*current+.15*mean,
      immuneSwitches:vsSwitch.filter(v=>v===0).length};
  }).sort((a,b)=>b.score-a.score||b.current-a.current||a.i-b.i);
  return {i:rows[0].i,rows,warning:'possible public switch, not known selected three'};
}
module.exports={chooseTempoPreview,chooseTempoMove};
