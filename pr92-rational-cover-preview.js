'use strict';
// PR #92 request (ChatGPT review #5721340698 of PR #91): close the gap between
// the guard's internal score and the rival rational 3+lead cells WITHOUT the
// post-hoc oracle. Research opt-in, NOT adopted; pr88-guarded-preview.js and
// pr90-guarded-preview-v2.js are NOT changed (saved results stay reproducible).
// Written AFTER holdout-20261031-pr92.js (N1/N2, seeds, verdict rule) was
// committed (1910153).
//
// Diagnosis (pinned Showdown, public six only, no battle needed; PR #92 report):
//   G1 role coverage   pr88 uses coverageScenarios max 4. On A it leaves
//                      Garchomp:scarf and Gholdengo:scarf uncovered, on F2
//                      Feraligatr:scarf and Noivern:scarf. A/H0's real loss line
//                      is exactly Scarf Garchomp behind Primarina.
//   G2 speed setup     the role template takes the FIRST setup move of
//                      SETUP (Swords Dance before Dragon Dance), so Mega
//                      Feraligatr is never a Dragon Dance sweeper (F2/a loss).
//   G3 rival threes    rivalCandidates gives legacy + top two + "best three
//                      containing X": every F2 guard three contains Mudsdale,
//                      so Hatterene/Infernape/Feraligatr (F2/a's real loss
//                      cell) never appears. In every F2 scenario it is the
//                      SECOND-best rankTrios three containing the Mega-capable
//                      Feraligatr. (A first try, "core-break" = best three
//                      without each legacy member, did NOT produce it on any
//                      scenario and was dropped before any battle.)
//   G4 aggregation     guard score = worst SCENARIO mean over 12+ cells, so a
//                      0-win cell is averaged away (A: 0.729 internal vs a 0
//                      external cell).
//   G5 candidates      only legacy + the search's top 3 are guarded; a pick
//                      outside them can never be chosen.
// Fix (all inputs = the six public species strings; rival sets are hypotheses
// built from public learnsets, NEVER the evaluated rival's sets):
//   1 scenarios  v2 role hypotheses + a speed-setup variant of each setup set
//                (Dragon Dance / Quiver Dance / Shell Smash / ... when legal),
//                coverageScenarios max 8 (full (species, tag) coverage) +
//                pr88 alt-category scenarios.
//   2 cells      per scenario: rivalCandidates(2,'all') as before, plus
//                MEGA-ACE threes: for each species holding a Mega Stone in
//                that scenario (public: it can Mega), the top MEGA_ACE_TOP
//                rankTrios threes containing it, every member as lead.
//   3 screen     ALL 60 own 3+leads on every cell, rival branch ai, 1 seed.
//   4 guard      top K by screen (CVaR, mean) + legacy, every cell x rival
//                branches ai/attack/setup/switch x 2 independent seeds (one
//                side each: same-seed sides duplicate, PR #91).
//   5 score      cell value = mean over branch x seed; CVaR25 = mean of the
//                lowest quarter of cell values (cell-level, not scenario
//                mean); tie: mean. Legacy is replaced only by an eligible
//                candidate (CVaR >= legacy + MARGIN, mean >= legacy - SLACK).
//   budget       measured; over budgetSeconds -> 'abstain' with the legacy
//                pick (NOT a safety claim). Hard kill: guardedPreviewHard
//                pattern (child process group).
// Heuristic AI vs heuristic AI on constructed sets. NOT a ladder win rate.
const {fork}=require('node:child_process');
const {hashSeed}=require('./lab');
const G=require('./public-six-general');
const GP=require('./pr88-guarded-preview');
const {legalRoleHypotheses,coverageScenarios,coherenceProblems}=require('./legal-role-hypotheses');
const {toLabTeam,rivalCandidates,rankTrios}=require('./preview-legal-search');
const {picks,label}=require('./a-preview-matrix-audit');
const COVER={maxScenarios:8,k:6,branches:['ai','attack','setup','switch'],seeds:2,cvarQ:0.25,margin:0.05,meanSlack:0.02,megaAceTop:2,cellRule:'all',speedSetup:true,altRatio:0.85};
// FROZEN before the PR #92 FINAL (N1/N2) run, by the rule committed with it:
// the variant with the higher DEV mean of proposed + T1/T2 table
// (reports/data/pr92-eval-dev-{rational,all}.json: 0.799 vs 0.748).
const FROZEN={...COVER,cellRule:'rational'};
const SPEED_SETUP=['dragondance','quiverdance','shellsmash','shiftgear','victorydance','tidyup','coil'];
const NONSPEED_SETUP=new Set(['swordsdance','nastyplot','calmmind','bulkup','irondefense']);
const id=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const EPS=1e-9;
function assertPublicSix(publicSix){
  if(!Array.isArray(publicSix)||publicSix.length!==6||publicSix.some(x=>typeof x!=='string'))
    throw Error('publicSix must be the six public species names (strings) only');
}
// G2: a speed-setup copy of every setup hypothesis whose setup move does not
// raise Speed, when the species legally has one. Validator + coherence checked;
// tagged 'speedsetup' so coverageScenarios must place it in some scenario.
function withSpeedSetup(sim,hyp){
  const dex=sim.Dex.mod('champions'),v=new sim.TeamValidator('gen9championsbssregmc');
  const pool=new Set(dex.species.getMovePool(dex.species.get(hyp.species).id));
  const out=[];
  for(const s of hyp.sets){
    if(s.role!=='setup')continue;
    const i=s.moves.findIndex(m=>NONSPEED_SETUP.has(id(m)));if(i<0)continue;
    const cat=dex.moves.get(s.moves.find(m=>dex.moves.get(m).category!=='Status')||s.moves[0]).category;
    const sp=SPEED_SETUP.find(m=>pool.has(m)&&(cat==='Physical'?dex.moves.get(m).boosts?.atk:dex.moves.get(m).boosts?.spa)&&dex.moves.get(m).boosts?.spe);
    if(!sp||s.moves.some(m=>id(m)===sp))continue;
    const c=structuredClone(s);c.moves[i]=dex.moves.get(sp).name;c.role='speedsetup';c.rationale=(s.rationale||'')+' [PR92 speed setup]';
    const {form,role,rationale,speedPoints,problems,tags,provenance,...set}=c;
    const p=[...(v.validateSet(structuredClone(set),{})||[]),...coherenceProblems(dex,set,{formName:form})];
    if(p.length)continue;
    c.tags=[...new Set([...s.tags,'speedsetup'])];out.push(c);
  }
  return {...hyp,sets:[...hyp.sets,...out]};
}
function scenarioTeamsPR92(sim,publicSix,o=COVER){
  const hyps=publicSix.slice().sort().map(s=>{const h=legalRoleHypotheses(sim,s,{version:'v2'});return o.speedSetup?withSpeedSetup(sim,h):h;});
  const cs=coverageScenarios(hyps,{max:o.maxScenarios});
  return {teams:cs.scenarios.map(toLabTeam),coverage:cs.coverage};
}
// G3: rival threes from the rival's view of OUR public six, on one hypothesis
// team: the pr88 rule + mega-ace threes.
function rivalCellsPR92(dex,team,ownSpecies,o=COVER){
  const out=[],seen=new Set();
  const add=(three,src)=>{const k=three.join('/');if(seen.has(k))return;seen.add(k);out.push({foe:three,src});};
  for(const r of rivalCandidates(dex,team,ownSpecies,2,'all',{truncate:false}))add(r.three,'view');
  if(o.megaAceTop){
    const ranked=rankTrios(dex,team,ownSpecies);
    team.forEach((p,m)=>{if(!dex.items.get(p.item).megaStone)return;
      for(const r of ranked.filter(x=>x.idx.includes(m)).slice(0,o.megaAceTop)){
        const three=r.idx.map(i=>team[i].species);
        for(const l of three)add([l,...three.filter(x=>x!==l)],'megaAce');}});
  }
  return out;
}
// cellRule 'rational': the rival's own rule (holdout-20261031-pr88
// rationalCells: legacy / view1 / view2 / aceLead / aceBack) applied to each
// HYPOTHESIS team, once per Mega-Stone holder as the ace (no holder: the
// first species of the rival legacy three), plus the mega-ace threes with the
// rankTrios lead only. Only hypothesis teams and our public species are used.
function rivalCellsRational(dex,team,ownSpecies,o=COVER){
  const {rationalCells}=require('./holdout-20261031-pr88');const {chooseThree}=require('./lab');
  const out=[],seen=new Set(),add=(three,src)=>{const k=three.join('/');if(seen.has(k))return;seen.add(k);out.push({foe:three,src});};
  const aces=team.filter(p=>dex.items.get(p.item).megaStone).map(p=>p.species);
  if(!aces.length)aces.push(team[chooseThree(dex,team,ownSpecies)[0]-1].species);
  for(const ace of aces)for(const c of rationalCells({dex,team,ownSpecies,ace,chooseThree,rivalCandidates}).cells)add(c.foe,c.src);
  const ranked=rankTrios(dex,team,ownSpecies);
  team.forEach((p,m)=>{if(!dex.items.get(p.item).megaStone)return;
    for(const r of ranked.filter(x=>x.idx.includes(m)).slice(0,o.megaAceTop))add(r.lead.map(i=>team[i].species),'megaAce');});
  return out;
}
function cvar(vals,q){const s=vals.slice().sort((a,b)=>a-b),n=Math.max(1,Math.ceil(s.length*q));return mean(s.slice(0,n));}
function decidePR92(scores,o=COVER){
  const L=scores.find(s=>s.legacy);if(!L)throw Error('decidePR92: legacy candidate missing');
  const ok=scores.filter(s=>!s.legacy&&s.cvar>=L.cvar+o.margin-EPS&&s.mean>=L.mean-o.meanSlack-EPS)
    .sort((a,b)=>b.cvar-a.cvar||b.mean-a.mean||a.pick.localeCompare(b.pick));
  if(!ok.length)return {pick:L.pick,reason:'legacy kept: no candidate with CVaR >= '+L.cvar+'+'+o.margin+' and mean >= '+L.mean+'-'+o.meanSlack,eligible:[]};
  return {pick:ok[0].pick,reason:'eligible '+ok.length+'; best CVaR '+ok[0].cvar+' mean '+ok[0].mean+' vs legacy '+L.cvar+'/'+L.mean,eligible:ok.map(s=>s.pick)};
}
function scoreRows(cand,cells,jobs,res){
  return cand.map((pk,k)=>{
    const byCell=cells.map(()=>[]);
    jobs.forEach((j,i)=>{if(j.k===k)byCell[j.ci].push(res[i].won);});
    const cv=byCell.map(v=>mean(v));
    return {pick:pk,cellValues:cv};
  });
}
async function coverPreview({sim,own,publicSix,seedBase,workers=4,budgetSeconds=300,opts={}}){
  assertPublicSix(publicSix);
  const t0=Date.now(),dex=sim.Dex.mod('champions'),o={...COVER,...opts},ownSpecies=own.map(p=>p.species);
  const leg=GP.legacyPick(dex,own,publicSix);
  const O=picks(own),legLabel=label(O.find(p=>p[0]===leg[0]&&p.slice().sort().join()===leg.slice().sort().join()));
  const {teams,coverage}=scenarioTeamsPR92(sim,publicSix,o);
  const alt=o.altRatio?GP.altCategoryScenarios(sim,publicSix,teams[0],o.altRatio):[];
  for(const a of alt)teams.push(a.team);
  const cells=[];
  teams.forEach((t,si)=>{for(const c of (o.cellRule==='rational'?rivalCellsRational:rivalCellsPR92)(dex,t,ownSpecies,o))cells.push({si,...c});});
  // 3 screen: every own pick, every cell, rival ai, one seed (side alternates by cell)
  const sj=[];
  O.forEach((pk,k)=>cells.forEach((c,ci)=>sj.push({k,ci,team:c.si,own:pk,foe:c.foe,branch:'ai',seed:hashSeed(seedBase+ci*16),reverse:ci%2===1})));
  const sr=await G.runGames(own,teams,sj,{workers});
  const screen=scoreRows(O.map(label),cells,sj,sr).map(r=>({pick:r.pick,cvar:+cvar(r.cellValues,o.cvarQ).toFixed(3),mean:+mean(r.cellValues).toFixed(3)}))
    .sort((a,b)=>b.cvar-a.cvar||b.mean-a.mean||a.pick.localeCompare(b.pick));
  const cand=[legLabel,...screen.map(s=>s.pick).filter(p=>p!==legLabel).slice(0,o.k)];
  // 4 guard: independent seeds, one side each
  const jobs=[];
  cand.forEach((pk,k)=>cells.forEach((c,ci)=>o.branches.forEach((branch,bi)=>{for(let s=0;s<o.seeds;s++)
    jobs.push({k,ci,team:c.si,own:pk.split(/[>/]/),foe:c.foe,branch,seed:hashSeed(seedBase+500000+ci*64+bi*8+s),reverse:(s+ci)%2===1});})));
  const gr=await G.runGames(own,teams,jobs,{workers});
  const scores=scoreRows(cand,cells,jobs,gr).map((r,k)=>{
    const worst=r.cellValues.map((v,ci)=>({v,ci})).sort((a,b)=>a.v-b.v).slice(0,3)
      .map(x=>({v:+x.v.toFixed(3),scenario:cells[x.ci].si,rival:cells[x.ci].foe.join('/'),src:cells[x.ci].src}));
    return {pick:r.pick,legacy:k===0,cvar:+cvar(r.cellValues,o.cvarQ).toFixed(3),mean:+mean(r.cellValues).toFixed(3),
      zeroCells:r.cellValues.filter(v=>v===0).length,worstCells:worst};
  });
  const seconds=+((Date.now()-t0)/1000).toFixed(1);
  const meta={legacy:legLabel,seconds,budgetSeconds,games:{screen:sj.length,guard:jobs.length},scenarios:teams.length,coverage,
    altScenarios:alt.map(a=>a.species+':'+a.category),cells:cells.length,megaAceCells:cells.filter(c=>c.src==='megaAce').length,
    screenTop:screen.slice(0,8),scores};
  if(seconds>budgetSeconds)return {status:'abstain',pick:leg,label:legLabel,reason:'over budget '+seconds+'s > '+budgetSeconds+'s: legacy pick, NOT a safety claim',...meta};
  const d=decidePR92(scores,o);
  return {status:d.pick===legLabel?'legacy':'cover',pick:d.pick.split(/[>/]/),label:d.pick,reason:d.reason,eligible:d.eligible,...meta,
    // for the T1/T2 table: public-derived scenario teams and cells only
    _teams:teams,_cells:cells};
}
// Hard deadline: run in a detached child process group, SIGKILL at the budget.
function coverPreviewHard({own,publicSix,seedBase,workers=4,budgetSeconds=300,opts={},dex}){
  try{assertPublicSix(publicSix);}catch(e){return Promise.reject(e);}
  const t0=Date.now(),leg=GP.legacyPick(dex,own,publicSix);
  return new Promise((res,rej)=>{
    const c=fork(__filename,['--pr92-child'],{env:process.env,detached:true});
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
    try{process.send({result:await coverPreview({sim:load(),...m})});}
    catch(e){process.send({error:String(e.stack||e)});}
  });
}
if(process.argv.includes('--pr92-child'))childMain();
module.exports={COVER,FROZEN,withSpeedSetup,scenarioTeamsPR92,rivalCellsPR92,rivalCellsRational,cvar,decidePR92,coverPreview,coverPreviewHard,assertPublicSix};
