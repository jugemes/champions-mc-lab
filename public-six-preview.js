#!/usr/bin/env node
'use strict';
// PR #76 P0-B (ChatGPT review of PR #75): robust-preview.js is an analysis of
// ONE precomputed public six (A_golisopod, H0/H1 matrices). This is the
// reproducible preview ENTRY point used in a game:
//   input   the rival's public six species names (strings only; an object with
//           item/moves/ability throws), our own six, a seed, our side
//   registered six  (same species set as a registry entry AND our six equal to
//           the roster the matrix was simulated with): sample one pick from
//           the robust mixture max_x min_h min_j (x P_h)_j over the entry's
//           legal hypotheses with seededRandom(seed,side); the log carries the
//           hypothesis set, weights (none: robust), support, security per
//           hypothesis, the draw, and what is NOT covered
//   otherwise       explicit fallback to legacy chooseThree (public six only),
//           status 'fallback' with the reason; a matrix is never reused for a
//           different six or a different own roster
// Hidden rival three, items, moves or the true hypothesis are not arguments.
// Heuristic AI vs heuristic AI matrices, NOT a ladder win rate.
const path=require('node:path');
const crypto=require('node:crypto');
const {seededRandom}=require('./preview-policy');
const {canonical}=require('./tactics');
const MATRIX_A=path.join(__dirname,'reports','data','a-preview-matrix-20261030.json');
// Species of the A_golisopod public six (environment-m7-teams.js 01_M7_golisopod_balance).
const A_SIX=['Golisopod','Garchomp','Primarina','Mimikyu','Hippowdon','Gholdengo'];
const keyOf=six=>six.map(canonical).sort().join('|');
const ownHash=team=>crypto.createHash('sha256').update(JSON.stringify(team.map(p=>[p.species,p.item,p.ability,p.nature,p.evs,[...p.moves].sort()]))).digest('hex').slice(0,16);
const REGISTRY=[{id:'A_golisopod',publicSix:A_SIX,matrix:MATRIX_A,hypotheses:['H0','H1'],policy:'robust',
  // reportedLive (reported-live-roster-20261027.js) is what PR #73 simulated.
  ownRoster:()=>require('./reported-live-roster-20261027').reportedLive(),
  notCovered:'only H0 (Mega Golisopod + Scarf Garchomp) and H1 (Mega Garchomp-Z + Lum Golisopod) simulated; every other legal set of this six is unevaluated. PR #75 holdout H2 (Scarf Gholdengo + Yache Garchomp): security 0.151 on 0.983 of the policy mass (see reports/data/pr76-h2-bounds-20261031.json for the bound with the remaining mass)'}];
const cache={};
function mixture(entry){
  if(cache[entry.id])return cache[entry.id];
  const {matrices,solve,colMin}=require('./robust-preview');
  const {P,ownPicks}=matrices(entry.matrix);
  const Ps=entry.hypotheses.map(h=>P[h]);
  const best=solve(Ps,null,entry.policy);
  return cache[entry.id]={x:best.x,ownPicks,security:Object.fromEntries(entry.hypotheses.map(h=>[h,+colMin(best.x,P[h]).toFixed(3)])),
    ownHash:ownHash(entry.ownRoster())};
}
function legacyFallback(dex,own,publicSix,reason){
  const {chooseThree}=require('./lab');
  const idx=chooseThree(dex,own,publicSix);
  return {status:'fallback',reason,policy:'legacy chooseThree (public six only)',selection:idx,pick:idx.map(n=>own[n-1].species)};
}
function choosePublicSixPreview({dex,own,publicSix,seed,side='p1',registry=REGISTRY}){
  if(!Array.isArray(publicSix)||publicSix.length!==6||publicSix.some(x=>typeof x!=='string'))
    throw Error('publicSix must be the six public species names (strings) only');
  const entry=registry.find(e=>keyOf(e.publicSix)===keyOf(publicSix));
  if(!entry)return legacyFallback(dex,own,publicSix,'no registered matrix for this public six');
  const m=mixture(entry);
  if(ownHash(own)!==m.ownHash)return legacyFallback(dex,own,publicSix,'own six differs from the roster the '+entry.id+' matrix was simulated with');
  const r=seededRandom(seed,side)();
  let i=0,acc=0;for(;i<m.x.length-1;i++){acc+=m.x[i];if(r<acc)break;}
  const pick=m.ownPicks[i].split(/[>/]/);
  const selection=pick.map(n=>own.findIndex(p=>p.species===n)+1);
  if(selection.some(n=>n<1))throw Error('matrix pick not in own team '+m.ownPicks[i]);
  return {status:'registered',id:entry.id,policy:entry.policy,hypotheses:entry.hypotheses,weights:null,
    draw:+r.toFixed(6),pickIndex:i,pickProbability:+m.x[i].toFixed(4),selection,pick,
    support:m.x.map((p,k)=>[m.ownPicks[k],+p.toFixed(3)]).filter(([,p])=>p>=0.03).sort((a,b)=>b[1]-a[1]),
    security:m.security,notCovered:entry.notCovered};
}
module.exports={choosePublicSixPreview,REGISTRY,keyOf,ownHash,A_SIX};
