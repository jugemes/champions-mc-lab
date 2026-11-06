'use strict';
// PR #94 request (ChatGPT review #5721596824 of PR #93), item 3: the N2/a and
// A/H1 regressions of the PR #93 cover selector. Research opt-in, NOT adopted;
// pr92-rational-cover-preview.js is NOT changed (PR #93 stays reproducible).
//
// Diagnosis (pinned Showdown, N2 public six only, reports/pr94-*.md §2):
//   D1 irrational rival play counted as our win. Inside the selector the rival
//      heuristic AI's Mega Heracross (CC/Megahorn/EQ/Stone Edge) used
//      Earthquake into our Levitate Rotom-Wash on T1 (16/16 seeds, ai and
//      attack branch): Rotom-Wash lead won 16/16 internally. Levitate is
//      Rotom-Wash's ONLY ability, so the immunity is public. pr86 rational()
//      only audits utility moves, so neither the guard nor the evaluator
//      dropped these games.
//   D2 the hypothesis ignores the Mega forme's fixed ability. attackValue uses
//      the average 3.5 hits for Pin Missile / Rock Blast although
//      Heracross-Mega has Skill Link (5 hits), so Mega Heracross never had
//      them. With them (Jolly, as the template) the Rotom-Wash lead won 1/16
//      on the attack branch.
// Fix (inputs = the six public species strings; rival sets are hypotheses):
//   1 scenarios  PR #92 scenarios + a MEGA-ABILITY copy of each Mega set whose
//                attacks change when the moves are valued under the Mega
//                forme's single public ability (Skill Link 5 hits, Tough Claws
//                contact, Strong Jaw bite, Iron Fist punch, Mega Launcher
//                pulse, Sharpness slicing, Technician <=60 BP, Sheer Force
//                secondary). Validator + coherence checked; tag 'megaability'.
//   2 rational   a guard game counts only if rational94: pr86 rational() AND
//                no rival attack in T1/T2 that was immune for a PUBLIC reason
//                (type chart, or the only ability of our visible forme).
//   3 decision   'cvar' (PR #92: CVaR25 of cell values) or 'floor' (max worst
//                cell, then CVaR25, then mean). Frozen on DEV before FINAL.
// Seeds include cell and branch (pr94-t1t2 jobSeed).
// Heuristic AI vs heuristic AI on constructed sets. NOT a ladder win rate.
const {fork}=require('node:child_process');
const P=require('./pr92-rational-cover-preview');
const T=require('./pr94-t1t2');
const GP=require('./pr88-guarded-preview');
const P86=require('./pr86-eval');
const {legalRoleHypotheses,coverageScenarios,coherenceProblems,movePool,pickAttacks}=require('./legal-role-hypotheses');
const {toLabTeam}=require('./preview-legal-search');
const {picks,label}=require('./a-preview-matrix-audit');
const COVER94={...P.FROZEN,megaAbility:true,rationalOnly:true,decision:'cvar',k:6};
const id=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const EPS=1e-9;
// Power multiplier of a move under a fixed ability (move data only).
const ABILITY_BOOST={
  skilllink:m=>Array.isArray(m.multihit)?m.multihit[1]/((m.multihit[0]+m.multihit[1])/2):1,
  toughclaws:m=>m.flags?.contact?1.3:1, strongjaw:m=>m.flags?.bite?1.5:1, ironfist:m=>m.flags?.punch?1.2:1,
  megalauncher:m=>m.flags?.pulse?1.5:1, sharpness:m=>m.flags?.slicing?1.5:1,
  technician:m=>m.basePower&&m.basePower<=60?1.5:1, sheerforce:m=>m.secondaries?1.3:1,
};
function megaAbilityCond(dex,form,pool){
  const ab=Object.values(form.abilities).map(id);if(ab.length!==1||!ABILITY_BOOST[ab[0]])return null;
  const f=ABILITY_BOOST[ab[0]],cond={};
  for(const mid of pool){const m=dex.moves.get(mid);
    if(m.category==='Status'||!m.basePower||m.flags?.charge||m.flags?.recharge)continue;
    const x=f(m);if(x>1)cond[m.id]=m.basePower*x;}
  return Object.keys(cond).length?{ability:ab[0],cond}:null;
}
function withMegaAbility(sim,hyp){
  const dex=sim.Dex.mod('champions'),v=new sim.TeamValidator('gen9championsbssregmc');
  const pool=movePool(dex,hyp.species),out=[];
  for(const s of hyp.sets){
    const form=dex.species.get(s.form);if(!form.isMega)continue;
    const mc=megaAbilityCond(dex,form,pool);if(!mc)continue;
    const cat=form.baseStats.atk>=form.baseStats.spa?'Physical':'Special';
    const isAtk=m=>{const d=dex.moves.get(m);return d.category===cat&&d.basePower>0&&!(d.priority>0);};
    const keep=s.moves.filter(m=>!isAtk(m)),n=s.moves.length-keep.length;if(!n)continue;
    const att=pickAttacks(dex,form,pool,cat,n,{cond:mc.cond}).map(m=>dex.moves.get(m).name);
    const moves=[...keep.filter(m=>dex.moves.get(m).category==='Status'),...att,...keep.filter(m=>dex.moves.get(m).category!=='Status')];
    if(moves.map(id).sort().join()===s.moves.map(id).sort().join())continue;
    const c=structuredClone(s);c.moves=moves;c.role=s.role+'+megaability';c.rationale=(s.rationale||'')+' [PR94 '+mc.ability+']';
    const {form:fn,role,rationale,speedPoints,problems,tags,provenance,...set}=c;
    const p=[...(v.validateSet(structuredClone(set),{})||[]),...coherenceProblems(dex,set,{formName:fn})];
    if(p.length)continue;
    c.tags=[...new Set([...s.tags,'megaability'])];out.push(c);
  }
  return {...hyp,sets:[...hyp.sets,...out]};
}
function scenarioTeamsPR94(sim,publicSix,o=COVER94){
  const hyps=publicSix.slice().sort().map(s=>{let h=legalRoleHypotheses(sim,s,{version:'v2'});
    if(o.speedSetup)h=P.withSpeedSetup(sim,h);if(o.megaAbility)h=withMegaAbility(sim,h);return h;});
  const cs=coverageScenarios(hyps,{max:o.maxScenarios+(o.megaAbility?2:0)});
  return {teams:cs.scenarios.map(toLabTeam),coverage:cs.coverage};
}
const rational94=(j,r)=>P86.rational(j,r)&&!(r.immune||[]).some(x=>x.turn<=2);
function decidePR94(scores,o=COVER94){
  if(o.decision==='cvar')return P.decidePR92(scores,o);
  const L=scores.find(s=>s.legacy);if(!L)throw Error('decidePR94: legacy candidate missing');
  const ok=scores.filter(s=>!s.legacy&&s.worst>=L.worst-EPS&&s.cvar>=L.cvar+o.margin-EPS&&s.mean>=L.mean-o.meanSlack-EPS)
    .sort((a,b)=>b.worst-a.worst||b.cvar-a.cvar||b.mean-a.mean||a.pick.localeCompare(b.pick));
  if(!ok.length)return {pick:L.pick,reason:'legacy kept (floor)',eligible:[]};
  return {pick:ok[0].pick,reason:'floor: worst '+ok[0].worst+' CVaR '+ok[0].cvar+' vs legacy '+L.worst+'/'+L.cvar,eligible:ok.map(s=>s.pick)};
}
function cellValues(cands,cells,jobs,res,o){
  return cands.map((pk,k)=>{
    const byCell=cells.map(()=>[]);
    jobs.forEach((j,i)=>{if(j.k===k&&(!o.rationalOnly||rational94(j,res[i])))byCell[j.ci].push(res[i].won);});
    // a cell with no rational game keeps its all-game value (never dropped silently)
    const fb=cells.map((c,ci)=>byCell[ci].length?null:jobs.map((j,i)=>j.k===k&&j.ci===ci?res[i].won:null).filter(x=>x!=null));
    return byCell.map((v,ci)=>v.length?mean(v):mean(fb[ci]));
  });
}
async function coverPreview94({sim,own,publicSix,seedBase,workers=4,budgetSeconds=300,opts={}}){
  P.assertPublicSix(publicSix);
  const t0=Date.now(),dex=sim.Dex.mod('champions'),o={...COVER94,...opts},ownSpecies=own.map(p=>p.species);
  const leg=GP.legacyPick(dex,own,publicSix);
  const O=picks(own),legLabel=label(O.find(p=>p[0]===leg[0]&&p.slice().sort().join()===leg.slice().sort().join()));
  const {teams,coverage}=scenarioTeamsPR94(sim,publicSix,o);
  const alt=o.altRatio?GP.altCategoryScenarios(sim,publicSix,teams[0],o.altRatio):[];
  for(const a of alt)teams.push(a.team);
  const cells=[];
  teams.forEach((t,si)=>{for(const c of P.rivalCellsRational(dex,t,ownSpecies,o))cells.push({si,...c});});
  const sj=[];
  O.forEach((pk,k)=>cells.forEach((c,ci)=>sj.push({k,ci,team:c.si,own:pk,foe:c.foe,branch:'ai',seed:T.jobSeed(seedBase,ci,0,0),reverse:ci%2===1,plan:{}})));
  const sr=await T.runGames94(own,teams,sj,{workers});
  const sv=cellValues(O.map(label),cells,sj,sr,o);
  const screen=O.map(label).map((pick,k)=>({pick,cvar:+P.cvar(sv[k],o.cvarQ).toFixed(3),mean:+mean(sv[k]).toFixed(3)}))
    .sort((a,b)=>b.cvar-a.cvar||b.mean-a.mean||a.pick.localeCompare(b.pick));
  const cand=[legLabel,...screen.map(s=>s.pick).filter(p=>p!==legLabel).slice(0,o.k)];
  const jobs=[];
  cand.forEach((pk,k)=>cells.forEach((c,ci)=>o.branches.forEach((branch,bi)=>{for(let s=0;s<o.seeds;s++)
    jobs.push({k,ci,team:c.si,own:pk.split(/[>/]/),foe:c.foe,branch,seed:T.jobSeed(seedBase+500000,ci,bi,s),reverse:(s+ci)%2===1,plan:{}});})));
  const gr=await T.runGames94(own,teams,jobs,{workers});
  const cv=cellValues(cand,cells,jobs,gr,o);
  const scores=cand.map((pick,k)=>{
    const r=cv[k],w=r.map((v,ci)=>({v,ci})).sort((a,b)=>a.v-b.v);
    return {pick,legacy:k===0,cvar:+P.cvar(r,o.cvarQ).toFixed(3),mean:+mean(r).toFixed(3),worst:+w[0].v.toFixed(3),zeroCells:r.filter(v=>v===0).length,
      worstCells:w.slice(0,3).map(x=>({v:+x.v.toFixed(3),scenario:cells[x.ci].si,rival:cells[x.ci].foe.join('/'),src:cells[x.ci].src}))};
  });
  const rat=jobs.filter((j,i)=>rational94(j,gr[i])).length,imm=gr.filter(r=>(r.immune||[]).length).length;
  const seconds=+((Date.now()-t0)/1000).toFixed(1);
  const meta={legacy:legLabel,seconds,budgetSeconds,opts:{decision:o.decision,megaAbility:o.megaAbility,rationalOnly:o.rationalOnly},
    games:{screen:sj.length,guard:jobs.length,guardRational94:rat,guardPublicImmune:imm},scenarios:teams.length,coverage,
    cells:cells.length,screenTop:screen.slice(0,8),scores};
  if(seconds>budgetSeconds)return {status:'abstain',pick:leg,label:legLabel,reason:'over budget '+seconds+'s > '+budgetSeconds+'s: legacy pick, NOT a safety claim',...meta};
  const d=decidePR94(scores,o);
  return {status:d.pick===legLabel?'legacy':'cover94',pick:d.pick.split(/[>/]/),label:d.pick,reason:d.reason,eligible:d.eligible,...meta,_teams:teams,_cells:cells};
}
function coverPreview94Hard({own,publicSix,seedBase,workers=4,budgetSeconds=300,opts={},dex}){
  try{P.assertPublicSix(publicSix);}catch(e){return Promise.reject(e);}
  const t0=Date.now(),leg=GP.legacyPick(dex,own,publicSix);
  return new Promise((res,rej)=>{
    const c=fork(__filename,['--pr94-child'],{env:process.env,detached:true});
    let done=false;
    const fin=(f,v)=>{if(done)return;done=true;clearTimeout(timer);try{process.kill(-c.pid,'SIGKILL');}catch{}f(v);};
    const timer=setTimeout(()=>fin(res,{status:'abstain',pick:leg,seconds:+((Date.now()-t0)/1000).toFixed(1),budgetSeconds,
      reason:'hard deadline '+budgetSeconds+'s: selector killed, legacy pick, NOT a safety claim'}),budgetSeconds*1000);
    c.on('message',m=>m.error?fin(rej,Error(m.error)):fin(res,{...m.result,seconds:+((Date.now()-t0)/1000).toFixed(1),budgetSeconds}));
    c.on('exit',code=>{if(!done)fin(rej,Error('selector child exit '+code));});
    c.send({own,publicSix,seedBase,workers,budgetSeconds,opts});
  });
}
function childMain(){
  const {load}=require('./lab');
  process.on('message',async m=>{
    try{process.send({result:await coverPreview94({sim:load(),...m})});}
    catch(e){process.send({error:String(e.stack||e)});}
  });
}
if(process.argv.includes('--pr94-child'))childMain();
module.exports={COVER94,ABILITY_BOOST,megaAbilityCond,withMegaAbility,scenarioTeamsPR94,rational94,decidePR94,coverPreview94,coverPreview94Hard};
