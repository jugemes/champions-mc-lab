'use strict';
// PR #90 request (ChatGPT review #5721083231 of PR #89): fixes to the PR #88
// guarded public-six selector. pr88-guarded-preview.js is NOT changed, so the
// saved PR #88 DEV/FINAL results stay reproducible; this is a separate opt-in
// research module, NOT adopted for real battles.
//   P0-1 same-seed sides  pr88 guard jobs used seed(ci,rep) with
//              reverse=(ci+rep)%2, so the left and right game of a cell had
//              DIFFERENT seeds (side and RNG confounded). Here every
//              (candidate, cell, branch, rep) seed is played on BOTH sides
//              (reverse false/true, same seed, same rival 3+lead, same branch);
//              pairs are asserted and the per-pair side asymmetry is reported.
//   P1-1 eligible filter  pr88 decide() took the single best-worst candidate
//              and fell back to legacy when that one failed MEAN_SLACK, even if
//              another candidate met both conditions. decideV2 filters eligible
//              candidates first (worst >= legacy worst + margin AND mean >=
//              legacy mean - slack), then takes the best (worst, mean).
//   budget     pr88 budgetSeconds was checked AFTER the search + guard finished
//              (no interruption). guardedPreviewHard runs the selector in a
//              detached child process group and SIGKILLs the whole group at
//              the deadline; the result is then 'abstain' with the legacy pick
//              (computed before the search, no battle), measured seconds, and
//              is NOT called safe.
// Inputs: the six public species strings only (as pr88). AI vs AI on
// constructed rival sets. NOT a ladder win rate.
const {fork}=require('node:child_process');
const GP=require('./pr88-guarded-preview');
const G=require('./public-six-general');
const {rivalCandidates}=require('./preview-legal-search');
const {picks,label}=require('./a-preview-matrix-audit');
const {hashSeed}=require('./lab');
// reps:2 x 2 sides = the pr88 two seeds, each on both sides (2x pr88 guard
// games). reps:1 x 2 sides (same game count as pr88) was run first and changed
// 3/9 picks through the lost second seed, not through side (see PR #90 report).
const GUARD_V2={...GP.GUARD,reps:2,pairedSides:true};
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const EPS=1e-9;
function eligible(s,L,o){return !s.legacy&&s.worst>=L.worst+o.margin-EPS&&s.mean>=L.mean-o.meanSlack-EPS;}
function decideV2(scores,o=GUARD_V2){
  const L=scores.find(s=>s.legacy);
  if(!L)throw Error('decideV2: legacy candidate missing');
  const ok=scores.filter(s=>eligible(s,L,o)).sort((a,b)=>b.worst-a.worst||b.mean-a.mean||a.pick.localeCompare(b.pick));
  if(!ok.length)return {pick:L.pick,reason:'legacy kept: no candidate with worst >= '+L.worst+'+'+o.margin+' and mean >= '+L.mean+'-'+o.meanSlack,eligible:[]};
  return {pick:ok[0].pick,reason:'eligible '+ok.length+'; best worst '+ok[0].worst+' mean '+ok[0].mean+' vs legacy '+L.worst+'/'+L.mean,eligible:ok.map(s=>s.pick)};
}
// Jobs for one candidate list: each seed on both sides when pairedSides.
function guardJobs(cand,cells,o,seedBase){
  const jobs=[];
  cand.forEach((pk,k)=>cells.forEach((c,ci)=>o.branches.forEach(branch=>{for(let rep=0;rep<o.reps;rep++){
    const seed=hashSeed(seedBase+300000+ci*16+rep);
    const sides=o.pairedSides?[false,true]:[(ci+rep)%2===1];
    for(const reverse of sides)jobs.push({k,ci,rep,team:c.si,own:pk.split(/[>/]/),foe:c.foe,branch,seed,reverse});
  }})));
  return jobs;
}
// Pair check: left and right of one (k,ci,branch,rep) share seed / foe / own /
// branch / scenario team and differ only in side. Throws otherwise.
function pairSides(jobs,res){
  const by=new Map();
  jobs.forEach((j,i)=>{const key=j.k+'|'+j.ci+'|'+j.branch+'|'+j.rep;(by.get(key)||by.set(key,[]).get(key)).push({j,w:res?res[i].won:null});});
  const pairs=[];
  for(const [key,v] of by){
    if(v.length!==2)throw Error('pairSides: '+key+' has '+v.length+' games');
    const [a,b]=v[0].j.reverse?[v[1],v[0]]:v;
    if(a.j.reverse||!b.j.reverse)throw Error('pairSides: '+key+' sides not left+right');
    for(const f of ['seed','team','branch'])if(a.j[f]!==b.j[f])throw Error('pairSides: '+key+' '+f+' differs');
    for(const f of ['foe','own'])if(a.j[f].join()!==b.j[f].join())throw Error('pairSides: '+key+' '+f+' differs');
    pairs.push({key,k:a.j.k,seed:a.j.seed,left:a.w,right:b.w});
  }
  return pairs;
}
async function guardedPreviewV2({sim,own,publicSix,seedBase,workers=4,opts={}}){
  if(!Array.isArray(publicSix)||publicSix.length!==6||publicSix.some(x=>typeof x!=='string'))
    throw Error('publicSix must be the six public species names (strings) only');
  const t0=Date.now(),dex=sim.Dex.mod('champions'),o={...GUARD_V2,...opts.guard};
  const leg=GP.legacyPick(dex,own,publicSix);
  const s=await G.searchPublicSix({sim,own,publicSix,opts:{...GP.MED,...opts.search,seedBase,workers}});
  const teams=GP.scenarioTeams(sim,publicSix,(opts.search?.maxScenarios)||GP.MED.maxScenarios);
  const check=teams.map(t=>t.map(p=>p.species+'@'+p.item+':'+p.moves.join('/')));
  if(JSON.stringify(check)!==JSON.stringify(s.scenarios))throw Error('scenario rebuild differs from the search');
  const O=picks(own),legLabel=label(O.find(p=>p[0]===leg[0]&&p.slice().sort().join()===leg.slice().sort().join()));
  const cand=[legLabel,...s.pure.map(p=>p.pick).filter(p=>p!==legLabel).slice(0,o.k)];
  const cells=s.cells.map(c=>({si:c.scenario,foe:c.rival.split(/[>/]/)}));
  const alt=o.altRatio?GP.altCategoryScenarios(sim,publicSix,teams[0],o.altRatio):[];
  for(const a of alt){const si=teams.push(a.team)-1;
    for(const r of rivalCandidates(dex,a.team,own.map(p=>p.species),2,'all',{truncate:false}))cells.push({si,foe:r.three});}
  const jobs=guardJobs(cand,cells,o,seedBase);
  const r=await G.runGames(own,teams,jobs,{workers});
  const pairs=o.pairedSides?pairSides(jobs,r):[];
  const scores=cand.map((pk,k)=>{
    const X=jobs.map((j,i)=>({j,w:r[i].won})).filter(x=>x.j.k===k);
    const bySc=teams.map((_,si)=>mean(X.filter(x=>cells[x.j.ci].si===si).map(x=>x.w)));
    const P=pairs.filter(p=>p.k===k);
    return {pick:pk,legacy:k===0,worst:+Math.min(...bySc).toFixed(3),mean:+mean(X.map(x=>x.w)).toFixed(3),
      byScenario:bySc.map(v=>+v.toFixed(3)),left:+mean(P.map(p=>p.left)).toFixed(3),right:+mean(P.map(p=>p.right)).toFixed(3),
      sideSplit:P.filter(p=>p.left!==p.right).length,pairs:P.length};
  });
  const d=decideV2(scores,o);
  return {status:d.pick===legLabel?'legacy':'guarded',pick:d.pick.split(/[>/]/),label:d.pick,legacy:legLabel,reason:d.reason,eligible:d.eligible,
    seconds:+((Date.now()-t0)/1000).toFixed(1),games:{search:s.games.total,guard:jobs.length},cells:cells.length,scores};
}
// Hard deadline: the selector runs in a detached child (its own process group,
// battle workers included) killed with SIGKILL at budgetSeconds.
function guardedPreviewHard({own,publicSix,seedBase,workers=4,budgetSeconds=120,opts={},dex}){
  if(!Array.isArray(publicSix)||publicSix.length!==6||publicSix.some(x=>typeof x!=='string'))
    return Promise.reject(Error('publicSix must be the six public species names (strings) only'));
  const t0=Date.now(),leg=GP.legacyPick(dex,own,publicSix);
  return new Promise((res,rej)=>{
    const c=fork(__filename,['--pr90-child'],{env:process.env,detached:true});
    let done=false;
    const fin=(f,v)=>{if(done)return;done=true;clearTimeout(timer);try{process.kill(-c.pid,'SIGKILL');}catch{}f(v);};
    const timer=setTimeout(()=>fin(res,{status:'abstain',pick:leg,seconds:+((Date.now()-t0)/1000).toFixed(1),budgetSeconds,
      reason:'hard deadline '+budgetSeconds+'s: selector killed, legacy pick, NOT a safety claim'}),budgetSeconds*1000);
    c.on('message',m=>m.error?fin(rej,Error(m.error)):fin(res,{...m.result,seconds:+((Date.now()-t0)/1000).toFixed(1),budgetSeconds}));
    c.on('exit',code=>{if(!done)fin(rej,Error('selector child exit '+code));});
    c.send({own,publicSix,seedBase,workers,opts});
  });
}
function childMain(){
  const {load}=require('./lab');
  process.on('message',async m=>{
    try{process.send({result:await guardedPreviewV2({sim:load(),...m})});}
    catch(e){process.send({error:String(e.stack||e)});}
  });
}
if(process.argv.includes('--pr90-child'))childMain();
module.exports={GUARD_V2,decideV2,guardJobs,pairSides,guardedPreviewV2,guardedPreviewHard};
