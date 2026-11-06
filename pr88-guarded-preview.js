'use strict';
// PR #88 request P0-2 (ChatGPT review #5720659334 of PR #87): our 3 + lead
// from the rival's PUBLIC six only, research opt-in, NOT adopted. Written after
// holdout-20261031-pr88.js (new unseen sixes / seeds) was committed.
//
// PR #86 result it answers: the quick search (pr82 livePreview) fixed U2/a
// (legacy 0.396 -> quick 0.979) but regressed U1/b (0.972 -> 0.778): quick
// takes pure[0] of a 2-scenario, ai-branch-only search with no comparison to
// the legacy pick. Here the legacy pick is a mandatory candidate and is
// replaced only when a candidate beats it on the SAME cells / seeds / sides.
//
// Inputs: publicSix (six species strings; anything else throws), our six,
// a seed base. No rival set / item / three / log / result is an argument.
//   1 search   public-six-general searchPublicSix with MED params (4
//              role-template scenarios covering every (species, threat tag),
//              rival cells from the rival's view incl. every member as lead,
//              ai+attack rival T1 branches, no expansion).
//   2 guard    candidates = legacy chooseThree pick + the search's top K pure
//              picks (by worst-scenario mean). Each is replayed on every search
//              cell x rival branches ai/attack/setup/switch x 2 new seeds,
//              sides alternating, the same jobs for every candidate (paired).
//              Score per candidate: worst scenario mean (scenario = one
//              role-template rival team), then mean.
//   2b alt     (added after the PR #88 DEV run, BEFORE the FINAL run) the role
//              templates give each species ONE attacking category (atk >= spa),
//              so a special Life Orb Kommo-o (U1/a) was never a scenario and the
//              guard swapped legacy (0.90) for a pick that lost to it (0.38).
//              For every public species whose lower attacking stat is >=
//              ALT_RATIO of the higher one, one extra scenario = scenario 0
//              with that species as an other-category Life Orb attacker
//              (pickAttacks, TeamValidator-checked); its rival cells come from
//              the rival's view like the search's (every member as lead).
//   3 choose   best candidate by (worst scenario, mean). It replaces legacy only
//              if worst >= legacy worst + MARGIN and mean >= legacy mean -
//              MEAN_SLACK; otherwise legacy stays ('legacy kept').
//   timeout    if the search + guard is not done in budgetSeconds (measured),
//              the result is status 'abstain' with the legacy pick and the
//              measured time; abstain is NOT called safe.
// Heuristic AI vs heuristic AI on constructed rival sets. NOT a ladder win rate.
const {chooseThree,normalize}=require('./lab');
const G=require('./public-six-general');
const {legalRoleHypotheses,coverageScenarios}=require('./legal-role-hypotheses');
const {toLabTeam,rivalCandidates}=require('./preview-legal-search');
const {movePool,pickAttacks}=require('./legal-role-hypotheses');
const {picks,label}=require('./a-preview-matrix-audit');
const {hashSeed}=require('./lab');
const MED={maxScenarios:4,n1:6,r2:1,branches:['ai','attack'],expand:false,addOwn:0};
const GUARD={altRatio:0.85,k:3,branches:['ai','attack','setup','switch'],reps:2,margin:0.10,meanSlack:0.02};
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
function legacyPick(dex,own,publicSix){
  return chooseThree(dex,own,publicSix).map(n=>own[n-1].species);
}
// the same scenario teams searchPublicSix built (sorted names, v2 hypotheses)
function scenarioTeams(sim,publicSix,max){
  const hyps=publicSix.slice().sort().map(s=>legalRoleHypotheses(sim,s,{version:'v2'}));
  return coverageScenarios(hyps,{max}).scenarios.map(toLabTeam);
}
const ITEMS=['Life Orb','Shell Bell','Expert Belt','Sitrus Berry','Lum Berry','White Herb'];
function altCategoryScenarios(sim,publicSix,base,ratio){
  const dex=sim.Dex.mod('champions'),v=sim.TeamValidator.get('gen9championsbssregmc'),out=[];
  for(const name of publicSix.slice().sort()){
    const sp=dex.species.get(name),{atk,spa}=sp.baseStats;
    if(Math.min(atk,spa)/Math.max(atk,spa)<ratio)continue;
    const cat=atk>=spa?'Special':'Physical',pool=movePool(dex,sp.name),mv=pickAttacks(dex,sp,pool,cat,4);
    if(mv.length===3&&pool.includes('protect'))mv.push('protect');
    const moves=mv.map(m=>dex.moves.get(m).name);
    if(moves.length!==4)continue;
    const team=structuredClone(base),i=team.findIndex(p=>p.species===sp.name),held=new Set(team.filter((_,j)=>j!==i).map(p=>p.item));
    team[i]={species:sp.name,item:ITEMS.find(x=>!held.has(x)),ability:team[i].ability,nature:cat==='Physical'?'Jolly':'Timid',
      evs:cat==='Physical'?{hp:2,atk:32,spe:32}:{hp:2,spa:32,spe:32},moves};
    const p=v.validateTeam(normalize(team));
    if(p?.length)continue;
    out.push({species:sp.name,category:cat,team});
  }
  return out;
}
function decide(scores,o=GUARD){
  const L=scores.find(s=>s.legacy),best=scores.slice().sort((a,b)=>b.worst-a.worst||b.mean-a.mean||(a.legacy?-1:1))[0];
  if(best.legacy)return {pick:L.pick,reason:'legacy is best'};
  if(best.worst>=L.worst+o.margin-1e-9&&best.mean>=L.mean-o.meanSlack-1e-9)return {pick:best.pick,reason:'candidate worst '+best.worst+' >= legacy '+L.worst+'+'+o.margin};
  return {pick:L.pick,reason:'legacy kept: best candidate '+best.worst+'/'+best.mean+' vs legacy '+L.worst+'/'+L.mean+' below margin'};
}
async function guardedPreview({sim,own,publicSix,seedBase,workers=4,budgetSeconds=120,opts={}}){
  if(!Array.isArray(publicSix)||publicSix.length!==6||publicSix.some(x=>typeof x!=='string'))
    throw Error('publicSix must be the six public species names (strings) only');
  const t0=Date.now(),dex=sim.Dex.mod('champions'),o={...GUARD,...opts.guard};
  const leg=legacyPick(dex,own,publicSix);
  const s=await G.searchPublicSix({sim,own,publicSix,opts:{...MED,...opts.search,seedBase,workers}});
  const teams=scenarioTeams(sim,publicSix,(opts.search?.maxScenarios)||MED.maxScenarios);
  const check=teams.map(t=>t.map(p=>p.species+'@'+p.item+':'+p.moves.join('/')));
  if(JSON.stringify(check)!==JSON.stringify(s.scenarios))throw Error('scenario rebuild differs from the search');
  const O=picks(own),legLabel=label(O.find(p=>p[0]===leg[0]&&p.slice().sort().join()===leg.slice().sort().join()));
  const cand=[legLabel,...s.pure.map(p=>p.pick).filter(p=>p!==legLabel).slice(0,o.k)];
  const cells=s.cells.map(c=>({si:c.scenario,foe:c.rival.split(/[>/]/)}));
  const alt=o.altRatio?altCategoryScenarios(sim,publicSix,teams[0],o.altRatio):[];
  for(const a of alt){const si=teams.push(a.team)-1;
    for(const r of rivalCandidates(dex,a.team,own.map(p=>p.species),2,'all',{truncate:false}))cells.push({si,foe:r.three});}
  const jobs=[];
  cand.forEach((pk,k)=>cells.forEach((c,ci)=>o.branches.forEach(branch=>{for(let rep=0;rep<o.reps;rep++)
    jobs.push({k,ci,team:c.si,own:pk.split(/[>/]/),foe:c.foe,branch,seed:hashSeed(seedBase+300000+ci*16+rep),reverse:(ci+rep)%2===1});})));
  const r=await G.runGames(own,teams,jobs,{workers});
  const scores=cand.map((pk,k)=>{
    const X=jobs.map((j,i)=>({j,w:r[i].won})).filter(x=>x.j.k===k);
    const bySc=teams.map((_,si)=>mean(X.filter(x=>cells[x.j.ci].si===si).map(x=>x.w)));
    const byCell=cells.map((_,ci)=>mean(X.filter(x=>x.j.ci===ci).map(x=>x.w)));
    return {pick:pk,legacy:k===0,worst:+Math.min(...bySc).toFixed(3),mean:+mean(X.map(x=>x.w)).toFixed(3),
      zeroCells:byCell.filter(v=>v===0).length,byScenario:bySc.map(v=>+v.toFixed(3))};
  });
  const seconds=+((Date.now()-t0)/1000).toFixed(1);
  if(seconds>budgetSeconds)return {status:'abstain',pick:leg,legacy:legLabel,seconds,reason:'over budget '+seconds+'s > '+budgetSeconds+'s: legacy pick, NOT a safety claim',scores};
  const d=decide(scores,o);
  return {status:d.pick===legLabel?'legacy':'guarded',pick:d.pick.split(/[>/]/),label:d.pick,legacy:legLabel,reason:d.reason,seconds,
    games:{search:s.games.total,guard:jobs.length},scenarios:s.scenarios.length,altScenarios:alt.map(a=>a.species+':'+a.category+':'+a.team.find(p=>p.species===a.species).moves.join('/')),cells:cells.length,scores};
}
module.exports={guardedPreview,decide,legacyPick,scenarioTeams,altCategoryScenarios,MED,GUARD};
