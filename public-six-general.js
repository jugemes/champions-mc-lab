#!/usr/bin/env node
'use strict';
// PR #78 request (ChatGPT review #5717571567 of PR #77): a GENERAL public-six
// preview entry. PR #77's public-six-preview.js had a matrix only for the A
// six and fell back to legacy chooseThree everywhere else (security 0/6 on
// B / C-Y / E / an unknown six). Opt-in, research only, NOT adopted.
//
// Inputs: the rival's six PUBLIC species names (strings), our six full sets,
// and a search seed base. Nothing else: no rival set, item, three, log or
// true hypothesis is an argument (an object in publicSix throws).
//
// Bounded staged search, every game a full pinned-Showdown battle:
//   0 hypotheses  legal-role-hypotheses v2 (one complete legal set per
//                 role; Mega Y Solar Beam, Psychic Surge Expanding Force, Scarf,
//                 Lum/Sitrus/Sash...) -> coverageScenarios: every (species,
//                 threat tag) appears in >=1 whole-team scenario. Each scenario
//                 team passes TeamValidator. No usage weights.
//   1 rival cells from the RIVAL's view (its scenario sets vs our public
//                 species): legacy pick + top trios + for every species the
//                 best trio containing it, each member as lead (so Mega
//                 Charizard-Y / Indeedee / Lucario leads are never cut).
//   2 screen      all 60 own picks (20 trios x 3 leads) x all cells, 1 game per
//                 cell (side alternates with the cell), rival = base AI +
//                 rational switch out of an Encore lock.
//   3 refine      top N1 picks by mean and by worst-scenario mean: R2 games per
//                 cell (both sides) x rival T1/T2 branches ai/attack/setup/
//                 switch on a SHARED seed; the rival is credited with its best
//                 branch per seed.
//   4 policy      robust mixture x = argmax min_cell (x P)_cell (the rival
//                 best-responds to our policy, not to our realised draw).
//   5 expansion   one bounded best-response round: every scenario x all 60
//                 rival picks vs the support (ai branch, 2 games); rival picks
//                 below the security are added as cells, refined like stage 3,
//                 and x is re-solved.
// A game's pick is a seededRandom(seed) draw from the EMITTED support (the
// solved x without entries below EMIT_MIN, renormalised); security / mean are
// reported for that emitted support and, separately, for the raw x.
// PR #80 (ChatGPT review #5718315491 of PR #79): a saved or memoised search is
// reused only if its whole policy identity matches (engine SHA actually loaded,
// format, code revision of every repo module the search runs, search params,
// our turn AI, own six incl. level/IVs); otherwise it is rejected with the
// reasons, and without an allowed offline search the entry returns an
// explained immediate fallback instead of a stale policy. The draw no longer
// depends on the side we sit on (sideDependentDraw:true reproduces PR #79).
// Heuristic AI vs heuristic AI. NOT a ladder win rate.
const path=require('node:path');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {fork,execFileSync}=require('node:child_process');
const {load,hashSeed,normalize,chooseThree}=require('./lab');
const {legalRoleHypotheses,coverageScenarios}=require('./legal-role-hypotheses');
const {rivalCandidates,toLabTeam,BRANCHES}=require('./preview-legal-search');
const {seededRandom}=require('./preview-policy');
const {colMin}=require('./robust-preview');
const {picks,label}=require('./a-preview-matrix-audit');
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640';
const FORMAT='gen9championsbssregmc';
// Our turn AI = PR #77 pr76 (encoreGuard speedSafe + public Mega ability + public HP/status).
const OWN_AI={encoreGuard:'speedSafe',publicMegaAbility:true,publicCondition:true,ownCondition:true};
const DEFAULTS={maxScenarios:6,n1:8,r2:2,addOwn:4,maxAdd:24,branches:['ai','attack','setup','switch'],expand:true,seedBase:7810000,workers:3};
const SEARCH_VERSION='general-v2';
const EMIT_MIN=0.03;
const keyOf=six=>six.slice().sort().join('|');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
// Own six as the battle actually receives it. lab.normalize plays every set at
// level 50 with IV 31 and drops any other field, so a roster that states
// another level/IV (or gender, tera, happiness, ...) would be simulated as
// something it is not: reject it instead of hashing it as equal (PR #80 item 2;
// the real ladder IVs are unverified). The hash covers the normalised sets in
// roster and move order (move order reaches the turn AI's move indices).
const OWN_KEYS=new Set(['name','species','item','ability','nature','evs','moves','level','ivs']);
function assertSupportedOwn(team){
  for(const p of team){
    const extra=Object.keys(p).filter(k=>!OWN_KEYS.has(k));
    if(extra.length)throw Error(p.species+': unsupported set field(s) '+extra.join(',')+' (the simulation drops them)');
    if(p.level!=null&&p.level!==50)throw Error(p.species+': level '+p.level+' unsupported (simulated at 50)');
    const iv=Object.entries(p.ivs||{}).filter(([,v])=>v!==31);
    if(iv.length)throw Error(p.species+': IV '+iv.map(([k,v])=>k+'='+v).join(',')+' unsupported (simulated at 31)');
  }
}
const ownHash=team=>{assertSupportedOwn(team);return sha(JSON.stringify(normalize(team).map(({name,...p})=>p))).slice(0,16);};
// Engine identity = the commit of the Showdown checkout actually loaded.
const engineMemo={};
function engineSha(){
  const dir=process.env.SHOWDOWN_DIR||'';
  if(!(dir in engineMemo)){
    try{engineMemo[dir]=execFileSync('git',['-C',dir,'rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}
    catch{engineMemo[dir]='unknown';}
  }
  return engineMemo[dir];
}
// Code revision = sha of every repo module the search and its battle workers
// load (listed by a fresh child process, so the list does not depend on what
// the caller happened to require). Any edit to the scenario generator, rival
// cells, turn AI, battle harness or this file changes it.
const CODE_ROOTS=['./public-six-general','./encore-lead-audit','./encore-turn-p0-audit','./misplay-tags-v3'];
let codeMemo=null;
function codeRevision(){
  if(codeMemo)return codeMemo;
  const list=JSON.parse(execFileSync(process.execPath,['-e',
    'for(const r of '+JSON.stringify(CODE_ROOTS)+')require(require("path").join('+JSON.stringify(__dirname)+',r));'+
    'console.log(JSON.stringify(Object.keys(require.cache).filter(f=>f.startsWith('+JSON.stringify(__dirname+path.sep)+')&&!f.includes("node_modules"))))'],
    {encoding:'utf8',cwd:__dirname,env:{...process.env,SHOWDOWN_DIR:''}}));
  const files=Object.fromEntries(list.map(f=>[path.relative(__dirname,f),sha(fs.readFileSync(f)).slice(0,12)]).sort((a,b)=>a[0]<b[0]?-1:1));
  return codeMemo={hash:sha(JSON.stringify(files)).slice(0,16),files};
}
// Everything that changes a search result except the worker count.
const searchParams=(opts={})=>{const {workers,...p}={...DEFAULTS,...opts};return p;};
function policyIdentity(own,opts={}){
  return {version:SEARCH_VERSION,showdown:engineSha(),format:FORMAT,code:codeRevision().hash,ownAI:OWN_AI,params:searchParams(opts),ownHash:ownHash(own)};
}
const identityKey=id=>sha(JSON.stringify(id)).slice(0,16);

// Rival turn script: T1/T2 branch (BRANCHES from preview-legal-search; switch on T1 only),
// and on an Encore lock with a switch available, the rational switch (PR #73/#75).
// PR #80 item 5: 'utility' = the rival's first usable recovery / Encore /
// hazard / status move (null -> base AI), so those lines are tried too.
const UTILITY=new Set(['recover','roost','slackoff','moonlight','synthesis','morningsun','wish','painsplit','shoreup','softboiled',
  'encore','taunt','stealthrock','spikes','toxicspikes','stickyweb','willowisp','thunderwave','toxic','yawn','trick','haze','leechseed','destinybond']);
const RIVAL_BRANCHES={...BRANCHES,utility:(bot,req)=>{
  const a=req.active?.[0];if(!a)return null;
  const i=a.moves.findIndex(m=>!m.disabled&&UTILITY.has(String(m.id||m.move).toLowerCase().replace(/[^a-z]/g,'')));
  return i<0?null:'move '+(i+1)+(a.canMegaEvo?' mega':'');
}};
function rivalScript(branch,dex,requested){
  const {ratSwitch}=require('./encore-turn-p0-audit');
  return (req,bot,info)=>{
    if(info.lockReason==='encore'&&info.canSwitch)return ratSwitch(req,bot,dex,{encore:true});
    if(branch==='ai'||info.turn>2||branch==='switch'&&info.turn!==1||info.locked)return null;
    const c=RIVAL_BRANCHES[branch](bot,req);
    if(c&&requested)requested.push({turn:info.turn,branch,choice:c,active:bot.getSet(req.side.pokemon.find(p=>p.active)).species,
      move:/^move /.test(c)?req.active[0].moves[Number(c.split(' ')[1])-1].move:null});
    return c;
  };
}
// Requested T1/T2 rival action vs the engine log: executed | preempted (the
// mover fainted / could not move first) | forcedOut (left the field before
// moving, e.g. Emergency Exit) | mismatch.
function checkRequested(log,foeSide,requested){
  const turns={};let t=0;
  for(const line of log.split('\n')){if(line.startsWith('|turn|')){t=Number(line.slice(6));continue;}(turns[t]||(turns[t]=[])).push(line);}
  return requested.map(r=>{
    const L=turns[r.turn]||[],me=foeSide+'a: ';
    if(r.move){
      if(L.some(l=>l.startsWith('|move|'+me)&&l.split('|')[3]===r.move))return 'executed';
      if(L.some(l=>l.startsWith('|faint|'+me)||l.startsWith('|cant|'+me)))return 'preempted';
      // forced out before moving (Emergency Exit, Eject Button/Pack, phazing, ...)
      const out=L.findIndex(l=>/^\|(switch|drag)\|/.test(l)&&l.startsWith('|'+l.split('|')[1]+'|'+me));
      if(out>=0&&!L.slice(0,out).some(l=>l.startsWith('|move|'+me)))return 'forcedOut';
      return 'mismatch';
    }
    return L.some(l=>l.startsWith('|switch|'+me)&&!l.startsWith('|switch|'+me+r.active))?'executed':
      L.some(l=>l.startsWith('|faint|'+me))?'preempted':'mismatch';
  });
}
// ---- worker pool: each job = one full game ----
async function workerMain(){
  const {battle}=require('./encore-lead-audit');
  const {misplaysV3,anyTag}=require('./misplay-tags-v3');
  const sim=load(),dex=sim.Dex.mod('champions');
  process.on('message',async({own,teams,jobs,keepLog})=>{
    const out=[];
    for(const j of jobs){
      const requested=[];
      const g=await battle(sim,structuredClone(own),structuredClone(teams[j.team]),j.seed,
        {ownThree:j.own,foeThree:j.foe,reverse:j.reverse,script:rivalScript(j.branch||'ai',dex,requested),ownOptions:OWN_AI});
      if(g.errors)throw Error('choice errors '+JSON.stringify(j));
      const r={id:j.id,won:g.won?1:0,turns:g.turns};
      if(keepLog){
        const {earlyLines}=require('./encore-lead-audit');
        const tags=misplaysV3(g.log,{requests:g.reqLog});
        r.requested=requested.map((q,k)=>({...q,result:checkRequested(g.log,g.foeSide,requested)[k]}));
        r.foeTagged=anyTag(tags[g.foeSide]);r.ownTagged=anyTag(tags[g.ownSide]);
        r.aceMega=g.log.includes('|detailschange|'+g.foeSide+'a: ');r.sun=g.log.includes('|-weather|SunnyDay');
        r.t1t2=earlyLines(g.log,g.ownSide,2);
      }
      out.push(r);
    }
    process.send(out);
  });
}
async function runGames(own,teams,jobs,{workers=DEFAULTS.workers,keepLog=false}={}){
  if(!jobs.length)return [];
  jobs.forEach((j,i)=>{j.id=i;});
  const W=Math.max(1,Math.min(workers,jobs.length)),chunks=[...Array(W)].map(()=>[]);
  jobs.forEach((j,i)=>chunks[i%W].push(j));
  const parts=await Promise.all(chunks.map(c=>new Promise((res,rej)=>{
    const w=fork(__filename,['--psg-worker'],{env:process.env});
    w.on('message',m=>{res(m);w.kill();});w.on('error',rej);
    w.on('exit',code=>{if(code)rej(Error('worker exit '+code));});
    w.send({own,teams,jobs:c,keepLog});
  })));
  const byId=[];for(const r of parts.flat())byId[r.id]=r;
  return byId;
}
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
// max_x min_j (xM)_j with the mean as a 1e-3 tie-breaker; exponentiated
// supergradient ascent as in robust-preview.js, best iterate kept.
function maxmin(M,iters=4000){
  const m=M.length,n=M[0].length;let x=Array(m).fill(1/m),best={f:-1,x};
  const rowMean=M.map(r=>mean(r));
  for(let t=1;t<=iters;t++){
    let jm=0,vm=Infinity,avg=0;
    for(let j=0;j<n;j++){let v=0;for(let i=0;i<m;i++)v+=x[i]*M[i][j];avg+=v/n;if(v<vm){vm=v;jm=j;}}
    const f=vm+1e-3*avg;if(f>best.f+1e-12)best={f,x:x.slice()};
    const eta=0.5/Math.sqrt(t);
    x=x.map((a,i)=>a*Math.exp(eta*(M[i][jm]+1e-3*rowMean[i])));const s=x.reduce((a,b)=>a+b);x=x.map(a=>a/s);
  }
  return best.x;
}
// The support a game actually draws from: x without entries below EMIT_MIN,
// renormalised and rounded to 1e-4 with the rounding residual on the largest
// entry, so the saved p are exactly the executed probabilities (sum 1).
function emitSupport(x,min=EMIT_MIN){
  const keep=x.map((p,k)=>({k,p})).filter(e=>e.p>=min),tot=keep.reduce((s,e)=>s+e.p,0);
  const out=keep.map(e=>({k:e.k,p:Math.round(e.p/tot*1e4)/1e4})).sort((a,b)=>b.p-a.p||a.k-b.k);
  out[0].p=Math.round((1-out.slice(1).reduce((s,e)=>s+e.p,0))*1e4)/1e4;
  return out;
}
// security / securityAll / mean of a policy vector y over the surviving rows.
function policyMetrics(y,P,surv,cells,live){
  const v=ci=>surv.reduce((s,oi,k)=>s+y[k]*P[oi][ci],0),all=cells.map((_,ci)=>v(ci));
  return {security:live.length?Math.min(...live.map(v)):0,securityAll:Math.min(...all),mean:mean(all)};
}
// ---- the search ----
async function searchPublicSix({sim,own,publicSix,opts={}}){
  if(!Array.isArray(publicSix)||publicSix.length!==6||publicSix.some(x=>typeof x!=='string'))
    throw Error('publicSix must be the six public species names (strings) only');
  // Canonical order: the scenario builder and rival cells depend on species
  // order, so the same public six listed in another order gave another search
  // (found by the PR #78 test). Sorted names make the search order-free.
  publicSix=publicSix.slice().sort();
  const identity=policyIdentity(own,opts);
  if(identity.showdown!==SHOWDOWN)throw Error('Showdown checkout is '+identity.showdown+', the search is pinned to '+SHOWDOWN);
  const o={...DEFAULTS,...opts},t0=Date.now(),dex=sim.Dex.mod('champions');
  const validator=sim.TeamValidator.get(FORMAT);
  // 0 hypotheses / scenarios
  const hyps=publicSix.map(s=>legalRoleHypotheses(sim,s,{version:'v2'}));
  const cov=coverageScenarios(hyps,{max:o.maxScenarios});
  const teams=cov.scenarios.map(toLabTeam);
  teams.forEach((t,i)=>{const p=validator.validateTeam(normalize(t));if(p?.length)throw Error('scenario '+i+' illegal: '+p.join('; '));});
  // 1 rival cells (rival's view of OUR public species)
  const ownSpecies=own.map(p=>p.species),cells=[];
  teams.forEach((sc,si)=>{for(const r of rivalCandidates(dex,sc,ownSpecies,2,'all',{truncate:false}))cells.push({si,foe:r.three,src:'view'});});
  const O=picks(own),games={screen:0,refine:0,expansion:0};
  // 2 screen
  const seedOf=(ci,rep)=>hashSeed(o.seedBase+ci*16+rep);
  let jobs=[];
  O.forEach((pk,oi)=>cells.forEach((c,ci)=>jobs.push({oi,ci,team:c.si,own:pk,foe:c.foe,seed:seedOf(ci,0),reverse:ci%2===1})));
  let res=await runGames(own,teams,jobs,o);games.screen=jobs.length;
  const S=O.map(()=>cells.map(()=>0));jobs.forEach((j,k)=>{S[j.oi][j.ci]=res[k].won;});
  const scenMean=(row,cs)=>Math.min(...teams.map((_,si)=>{const v=cs.map((c,ci)=>c.si===si?row[ci]:null).filter(x=>x!=null);return v.length?mean(v):1;}));
  const byMean=O.map((_,i)=>i).sort((a,b)=>mean(S[b])-mean(S[a])||a-b);
  const byWorst=O.map((_,i)=>i).sort((a,b)=>scenMean(S[b],cells)-scenMean(S[a],cells)||mean(S[b])-mean(S[a])||a-b);
  const surv=[...new Set([...byMean.slice(0,Math.ceil(o.n1/2)),...byWorst.slice(0,Math.ceil(o.n1/2)),...byMean])].slice(0,o.n1);
  // 3 refine: R2 reps x branches, rival credited with its best branch per rep
  async function refine(cellIdx){
    const jobs=[];
    for(const oi of surv)for(const ci of cellIdx)for(let rep=0;rep<o.r2;rep++)for(const branch of o.branches)
      jobs.push({oi,ci,rep,branch,team:cells[ci].si,own:O[oi],foe:cells[ci].foe,seed:seedOf(ci,1+rep),reverse:(ci+rep)%2===1});
    const r=await runGames(own,teams,jobs,o);games.refine+=jobs.length;
    const worst={};jobs.forEach((j,k)=>{const key=j.oi+','+j.ci+','+j.rep;worst[key]=Math.min(worst[key]??1,r[k].won);});
    for(const oi of surv)for(const ci of cellIdx){P[oi][ci]=mean([...Array(o.r2)].map((_,rep)=>worst[oi+','+ci+','+rep]));}
  }
  const P=O.map(()=>[]);
  await refine(cells.map((_,ci)=>ci));
  // 4 policy. A cell that no evaluated pick ever wins makes max-min flat at 0
  // (PR #78 dev run, first version: A/B/C came out as a uniform 1/8 mixture
  // with nothing learned). Such cells are reported as unanswered and left out
  // of the max-min; ties in the min are broken by the mean (weight 1e-3, a
  // tie-breaker only). securityAll keeps them in.
  let unanswered=[],live=[];
  const solveX=()=>{
    live=cells.map((_,ci)=>ci).filter(ci=>surv.some(oi=>P[oi][ci]>0));
    unanswered=cells.map((_,ci)=>ci).filter(ci=>!live.includes(ci));
    const M=surv.map(oi=>live.map(ci=>P[oi][ci])),full=surv.map(oi=>cells.map((_,ci)=>P[oi][ci]));
    const x=live.length?maxmin(M):surv.map(()=>1/surv.length);
    return {x,security:live.length?colMin(x,M):0,securityAll:colMin(x,full)};
  };
  const mixVal=ci=>surv.reduce((s,oi,k)=>s+pol.x[k]*P[oi][ci],0);
  // 4b our side answers the binding cells (bounded): up to o.addOwn picks
  // outside the survivors with the most screen wins on the cells at or near
  // the security (and the unanswered ones) join and are refined on every cell.
  const answers=[];
  async function answer(stage){
    const bind=cells.map((_,ci)=>ci).filter(ci=>unanswered.includes(ci)||mixVal(ci)<=pol.security+0.05);
    const cand=O.map((_,oi)=>oi).filter(oi=>!surv.includes(oi));
    const sc=oi=>bind.reduce((t,ci)=>t+S[oi][ci],0);
    const fresh=cand.sort((a,b)=>sc(b)-sc(a)||mean(S[b])-mean(S[a])||a-b).slice(0,o.addOwn).filter(oi=>sc(oi)>0);
    answers.push({stage,bindingCells:bind.length,added:fresh.map(oi=>({pick:label(O[oi]),screenWinsOnBinding:sc(oi)+'/'+bind.length}))});
    if(!fresh.length)return;
    const keep=[...surv,...fresh];for(const oi of fresh)P[oi]=[];
    surv.splice(0,surv.length,...fresh);await refine(cells.map((_,ci)=>ci));
    surv.splice(0,surv.length,...keep);pol=solveX();
  }
  let pol=solveX();
  await answer('view cells');
  // 5 one bounded best-response round over ALL 60 rival picks per scenario
  const expansion={added:[],checked:0};
  if(o.expand){
    const sup=surv.map((oi,k)=>({oi,p:pol.x[k]})).filter(s=>s.p>=EMIT_MIN);
    const mass=sup.reduce((s,a)=>s+a.p,0),jobs=[];
    teams.forEach((sc,si)=>picks(sc).forEach((fp,fj)=>sup.forEach(s=>{for(let rep=0;rep<2;rep++)
      jobs.push({si,fj,oi:s.oi,rep,team:si,own:O[s.oi],foe:fp,seed:hashSeed(o.seedBase+500000+si*1000+fj*4+rep),reverse:rep===1});})));
    const r=await runGames(own,teams,jobs,o);games.expansion+=jobs.length;
    const val={};jobs.forEach((j,k)=>{const key=j.si+','+j.fj;const w=sup.find(s=>s.oi===j.oi).p/mass;val[key]=(val[key]||0)+w*r[k].won/2;});
    expansion.checked=Object.keys(val).length;
    const have=new Set(cells.map(c=>c.si+'|'+c.foe.join()));
    const add=Object.entries(val).filter(([,v])=>v<pol.security-1e-9).sort((a,b)=>a[1]-b[1]).slice(0,o.maxAdd);
    const newIdx=[];
    for(const [key,v] of add){const [si,fj]=key.split(',').map(Number),foe=picks(teams[si])[fj];
      if(have.has(si+'|'+foe.join()))continue;
      cells.push({si,foe,src:'bestResponse'});newIdx.push(cells.length-1);expansion.added.push({scenario:si,rival:label(foe),value:+v.toFixed(3)});}
    if(newIdx.length){
      // screen all 60 own picks on the added cells, refine survivors there, re-solve, answer
      const sj=[];O.forEach((pk,oi)=>newIdx.forEach(ci=>sj.push({oi,ci,team:cells[ci].si,own:pk,foe:cells[ci].foe,seed:seedOf(ci,0),reverse:ci%2===1})));
      const sr=await runGames(own,teams,sj,o);games.expansion+=sj.length;
      sj.forEach((j,k)=>{S[j.oi][j.ci]=sr[k].won;});
      await refine(newIdx);pol=solveX();
      await answer('best-response cells');
    }
  }
  // emitted (executed) vs raw policy, both measured on the same refined cells
  const emitted=emitSupport(pol.x),y=surv.map((_,k)=>emitted.find(e=>e.k===k)?.p||0);
  const support=emitted.map(e=>({pick:label(O[surv[e.k]]),oi:surv[e.k],p:e.p}));
  const exec=policyMetrics(y,P,surv,cells,live),raw=policyMetrics(pol.x,P,surv,cells,live);
  const execVal=ci=>surv.reduce((s,oi,k)=>s+y[k]*P[oi][ci],0);
  const rowOf=oi=>cells.map((_,ci)=>P[oi][ci]);
  const pure=surv.map(oi=>({pick:label(O[oi]),worstCell:Math.min(...rowOf(oi)),worstScenario:+scenMean(rowOf(oi),cells).toFixed(3),mean:+mean(rowOf(oi)).toFixed(3)}))
    .sort((a,b)=>b.worstScenario-a.worstScenario||b.mean-a.mean);
  const worstCells=cells.map((c,ci)=>({scenario:c.si,rival:label(c.foe),src:c.src,v:+execVal(ci).toFixed(3)}))
    .sort((a,b)=>a.v-b.v).slice(0,6);
  return {...identity,publicSix,publicKey:keyOf(publicSix),codeFiles:codeRevision().files,workers:o.workers,rivalAI:'base + rational switch when Encore-locked; T1/T2 branches '+o.branches.join('/'),
    scenarios:teams.map(t=>t.map(p=>p.species+'@'+p.item+':'+p.moves.join('/'))),coverage:cov.coverage,
    cells:cells.map(c=>({scenario:c.si,rival:label(c.foe),src:c.src})),
    survivors:surv.map(oi=>label(O[oi])),support,emitMin:EMIT_MIN,
    security:+exec.security.toFixed(3),securityAll:+exec.securityAll.toFixed(3),mean:+exec.mean.toFixed(3),
    raw:{support:surv.map((oi,k)=>({pick:label(O[oi]),p:+pol.x[k].toFixed(4)})).filter(s=>s.p>0).sort((a,b)=>b.p-a.p),
      droppedMass:+surv.reduce((s,_,k)=>s+(y[k]?0:pol.x[k]),0).toFixed(4),
      security:+raw.security.toFixed(3),securityAll:+raw.securityAll.toFixed(3),mean:+raw.mean.toFixed(3)},
    unanswered:unanswered.map(ci=>({scenario:cells[ci].si,rival:label(cells[ci].foe),src:cells[ci].src})),answers,pure,worstCells,expansion,
    games:{...games,total:games.screen+games.refine+games.expansion},seconds:Math.round((Date.now()-t0)/1000),
    note:'Rival sets are role-template hypotheses (no usage weights). security/securityAll/mean are for the EMITTED support (what games draw from); raw.* for the solved x. Security = min over rival cells of our expected win fraction under the mixture, NOT a single-pick guarantee. Heuristic AI vs heuristic AI, NOT a ladder win rate.'};
}
// Entry used in a game: publicSix strings + own six + game seed. Cache order:
// a saved result whose whole policy identity matches (cacheCheck) -> the
// in-process memo for the same identity -> an offline search only when
// allowSearch is true (106-158 s per six on 4 workers in PR #79, so not during
// a live preview) -> otherwise an immediate explained fallback (A registered
// matrix or legacy chooseThree via public-six-preview.js). A rejected saved
// result is never used and its reasons are returned.
const memo={};
function cacheCheck(saved,publicSix,own,opts={}){
  if(!saved)return {ok:false,reasons:['no saved result']};
  const id=policyIdentity(own,opts),why=[],same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  if(saved.version!==id.version)why.push('version '+saved.version+' != '+id.version);
  if(saved.publicKey!==keyOf(publicSix))why.push('another public six');
  if(saved.ownHash!==id.ownHash)why.push('another own six');
  if(saved.showdown!==SHOWDOWN)why.push('saved engine '+saved.showdown+' != pinned '+SHOWDOWN);
  if(id.showdown!==SHOWDOWN)why.push('loaded engine '+id.showdown+' != pinned '+SHOWDOWN);
  if(saved.format!==FORMAT)why.push('format '+saved.format+' != '+FORMAT);
  if(saved.code!==id.code){
    const now=codeRevision().files,old=saved.codeFiles||{};
    const diff=[...new Set([...Object.keys(now),...Object.keys(old)])].filter(f=>now[f]!==old[f]).sort();
    why.push('code revision '+saved.code+' != '+id.code+(!saved.codeFiles?' (no file list saved)':diff.length?' ('+diff.slice(0,8).join(', ')+(diff.length>8?', +'+(diff.length-8)+' more':'')+')':''));
  }
  if(!same(saved.params,id.params))why.push('search params differ: saved '+JSON.stringify(saved.params)+' vs '+JSON.stringify(id.params));
  if(!same(saved.ownAI,id.ownAI))why.push('own turn AI differs');
  const sup=Array.isArray(saved.support)?saved.support:[];
  if(!sup.length||Math.abs(sup.reduce((a,b)=>a+b.p,0)-1)>1e-6)why.push('support missing or not normalised');
  else if(sup.some(x=>x.pick.split(/[>/]/).some(n=>!own.some(p=>p.species===n))))why.push('support pick outside own six');
  return {ok:!why.length,reasons:why};
}
const usableSaved=(saved,publicSix,own,opts={})=>cacheCheck(saved,publicSix,own,opts).ok;
async function choosePublicSixGeneral({sim,own,publicSix,seed,side='p1',saved=null,opts={},allowSearch=false,sideDependentDraw=false}){
  if(!Array.isArray(publicSix)||publicSix.length!==6||publicSix.some(x=>typeof x!=='string'))
    throw Error('publicSix must be the six public species names (strings) only');
  const k=keyOf(publicSix)+'#'+identityKey(policyIdentity(own,opts));
  let s=null,cache=null,cacheRejected=null;
  if(saved){const c=cacheCheck(saved,publicSix,own,opts);if(c.ok){s=saved;cache='saved';}else cacheRejected=c.reasons;}
  if(!s&&memo[k]){s=memo[k];cache='memo';}
  if(!s&&allowSearch){s=memo[k]=await searchPublicSix({sim,own,publicSix,opts});cache='searched';}
  if(!s){
    const {choosePublicSixPreview}=require('./public-six-preview');
    const fb=choosePublicSixPreview({dex:sim.Dex.mod('champions'),own,publicSix,seed,side});
    return {status:'fallback',cache:'miss',cacheRejected,fallback:fb.status==='registered'?'registered '+fb.id:fb.policy,fallbackReason:fb.reason??null,pick:fb.pick,selection:fb.selection,
      reason:'no valid offline search for this (public six, own six, engine, code, params); live search not run (allowSearch=false)',
      warning:'fallback is not the searched policy: legacy chooseThree had security 0 on 17/18 PR #79 hypotheses'};
  }
  // PR #80 item 4: the draw does not depend on the side we sit on, so a p1/p2
  // pair of games with one seed plays one pick. sideDependentDraw reproduces PR #79.
  const r=seededRandom(seed,sideDependentDraw?side:'p1')(),tot=s.support.reduce((a,b)=>a+b.p,0);
  let i=0,acc=0;for(;i<s.support.length-1;i++){acc+=s.support[i].p/tot;if(r<acc)break;}
  const pick=s.support[i].pick.split(/[>/]/);
  return {status:'general',cache,policy:'robust mixture over staged full-game search',draw:+r.toFixed(6),pick,
    selection:pick.map(n=>own.findIndex(p=>p.species===n)+1),pickProbability:+(s.support[i].p/tot).toFixed(4),
    support:s.support.map(x=>[x.pick,x.p]),security:s.security,securityRaw:s.raw?.security??null,games:s.games.total,seconds:s.seconds,
    notCovered:'rival sets outside the role-template scenarios; rival T3+ deviations; human play; security is for the mixture, not this single pick'};
}
// PR #80 item 4: deterministic sampled-policy regression. Our 3+lead is drawn
// ONCE, then held with the rival 3+lead, the rival sets and the seed fixed
// while our side is seated as p1 and as p2. Separate from Monte Carlo policy
// evaluation (public-six-general-eval.js), which fixes each pick across sides.
async function sideFixedRegression({sim,own,saved,publicSix,seed,rivalTeam,rivalPick,branch='ai'}){
  const d=await choosePublicSixGeneral({sim,own,publicSix,seed,saved});
  if(d.status!=='general')throw Error('no valid saved policy: '+JSON.stringify(d.cacheRejected));
  const jobs=[false,true].map(reverse=>({team:0,own:d.pick,foe:rivalPick,seed,reverse,branch}));
  const r=await runGames(own,[rivalTeam],jobs,{workers:2,keepLog:true});
  return {pick:d.pick,pickProbability:d.pickProbability,rival:rivalPick,seed,
    games:r.map((g,n)=>({side:jobs[n].reverse?'p2':'p1',won:g.won,turns:g.turns,t1t2:g.t1t2,requested:g.requested}))};
}
async function main(){
  const sim=load();
  const {reportedLive}=require('./reported-live-roster-20261027');
  const {caseList}=require('./legal-search-v2-compare');
  const own=reportedLive(),want=(process.env.CASES||'B_lucarioZ').split(',');
  const sixes={};
  for(const c of caseList())sixes[c.id]=c.team.map(p=>p.species);
  if(process.env.HOLDOUT){const {holdoutSixes}=require('./holdout-20261031-general');for(const [k,v] of Object.entries(holdoutSixes()))sixes[k]=v.publicSix;}
  if(process.env.HOLDOUT_PR80){const {holdoutSixPR80}=require('./holdout-20261031-pr80');for(const [k,v] of Object.entries(holdoutSixPR80()))sixes[k]=v.publicSix;}
  const out={};
  for(const id of want){
    if(!sixes[id])throw Error('unknown six '+id);
    const s=await searchPublicSix({sim,own,publicSix:sixes[id],opts:{workers:Number(process.env.WORKERS||DEFAULTS.workers)}});
    out[id]=s;
    console.log(id,'security',s.security,'raw',s.raw.security,'mean',s.mean,'rawMean',s.raw.mean,'dropped',s.raw.droppedMass,'all',s.securityAll,'unanswered',s.unanswered.length,'games',JSON.stringify(s.games),s.seconds+'s','cells',s.cells.length,'added',s.expansion.added.length);
    console.log('  support',JSON.stringify(s.support.map(x=>[x.pick,x.p])));
    console.log('  worst',JSON.stringify(s.worstCells.slice(0,3)));
    console.log('  legacy',chooseThree(sim.Dex.mod('champions'),own,sixes[id]).map(n=>own[n-1].species).join('/'));
  }
  if(process.env.OUT){fs.mkdirSync(path.dirname(process.env.OUT),{recursive:true});fs.writeFileSync(process.env.OUT,JSON.stringify(out,null,1));}
}
if(process.argv.includes('--psg-worker'))workerMain();
else if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={searchPublicSix,choosePublicSixGeneral,usableSaved,cacheCheck,policyIdentity,identityKey,engineSha,codeRevision,searchParams,
  emitSupport,policyMetrics,sideFixedRegression,assertSupportedOwn,runGames,rivalScript,checkRequested,keyOf,ownHash,OWN_AI,DEFAULTS,SEARCH_VERSION,EMIT_MIN,SHOWDOWN,FORMAT};
