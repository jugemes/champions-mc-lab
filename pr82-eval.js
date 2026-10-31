#!/usr/bin/env node
'use strict';
// PR #82 evaluation (ChatGPT review #5719297548 of PR #81). Every number is a
// NEW full pinned-Showdown battle run here (not a re-aggregation of saved JSON).
//   cases    dev A/B/C/Indeedee/E + holdout HX_rain/HX_gyarados/psychic/sun +
//            HX_sand + HX_fairy (pre-declared in holdout-20261031-pr82.js
//            before any run). Hidden sets only RUN battles.
//   preview  human1 = saved search pure[0]; general / top2 = saved emitted
//            support; legacy = chooseThree on the public six; quick = bounded
//            live search (QUICK params, timed). PR #81 searches for all but
//            HX_fairy (searched here with the unmodified PR #81 code).
//   rival    cells = its legacy pick + ace-lead pick (PR #77 rivalPicks) +
//            the 2 rival picks with the lowest human1 win rate in a stage-0
//            screen of all 60 rival picks (TRAIN seeds) = rational alternate
//            three/lead; T1/T2 branches ai/attack/setup/switch/utility (PR
//            #81, first utility move) /utilityRational (first RATIONAL one).
//   stage 1  TRAIN seeds: human1 with our T1 forced to every legal action ->
//            T1 table (decideEarly rules keyed by public observation only).
//   stage 2  TRAIN seeds: T1 by the stage-1 table (base AI if uncovered), T2
//            forced to every legal action -> T2 table.
//   test     fresh TEST seeds, same cells/branches/seeds/sides for every
//            policy: human1+base, human1+entry (T1/T2 table), general, top2,
//            legacy, quick (base turn AI). Requested rival actions are checked
//            with PR #81 checkRequested AND checkRequestedV2 on the same logs;
//            rival utility moves get rational/irrational/unknown labels.
// Heuristic AI vs heuristic AI, small samples. NOT a ladder win rate.
//   SHOWDOWN_DIR=... OUT=reports/data/pr82-eval.json node pr82-eval.js
const fs=require('node:fs');
const path=require('node:path');
const {fork}=require('node:child_process');
const {load,hashSeed,chooseThree,normalize}=require('./lab');
const M=require('./pr82-switch-utility-t1t2');
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640';
const FORMAT='gen9championsbssregmc';
const BRANCHES=['ai','attack','setup','switch','utility','utilityRational'];
const TRAIN=[0,1],TEST=[0,1];
const trainSeed=(ci,s)=>hashSeed(8200000+ci*100+s),testSeed=(ci,s)=>hashSeed(8250000+ci*100+s);
const {QUICK}=M;

// ---------------- worker ----------------
function workerMain(){
  const {battle}=require('./encore-lead-audit');
  const {OWN_AI,checkRequested,rivalScript}=require('./public-six-general');
  const sim=load(),dex=sim.Dex.mod('champions');
  process.on('message',async({own,teams,jobs,table})=>{
    const out=[];
    for(const j of jobs){
      const requested=[],rec={forced:{},decisions:[],obs:{}};
      const rs=j.branch==='utility'?rivalScript('utility',dex,requested):M.rivalScriptV2(j.branch,dex,requested);
      const g=await battle(sim,structuredClone(own),structuredClone(teams[j.team]),j.seed,
        {ownThree:j.own,foeThree:j.foe,reverse:j.reverse,script:rs,ownOptions:{...OWN_AI,script:ownScript(j,table,rec)}});
      if(g.errors)throw Error('choice errors '+JSON.stringify(j));
      const v1=checkRequested(g.log,g.foeSide,requested);
      const v2=M.checkRequestedV2(g.log,g.foeSide,requested,{rival3:j.foe});
      out.push({id:j.id,won:g.won?1:0,turns:g.turns,rec,
        own1:M.executedOwn(g.log,g.ownSide,1),own2:M.executedOwn(g.log,g.ownSide,2),
        requested:requested.map((q,k)=>({turn:q.turn,choice:q.choice,move:q.move,target:q.target??null,v1:v1[k],v2:v2[k]})),
        utility:M.utilityAudit(g.log,g.foeSide,dex),
        ownForcedCheck:Object.entries(rec.forced).map(([t,l])=>({turn:Number(t),label:l,executed:l?M.executedOwn(g.log,g.ownSide,Number(t)):null}))});
    }
    process.send(out);
  });
}
// Our T1/T2 script. Observations are built from OUR bot's public state only.
function ownScript(j,table,rec){
  let lead=null;
  return (req,bot,info)=>{
    if(info.turn>2)return null;
    const legal=M.legalActions(req);
    if(info.turn===1)lead=bot.foeActive;
    const obs={publicSix:j.publicSix,ownThree:j.own,turn:info.turn,rivalActive:bot.foeActive,
      ownActive:M.baseName(req.side.pokemon.find(p=>p.active).details),legal:legal.map(a=>a.label)};
    if(info.turn===2)obs.rivalT1={lead,action:bot.foeLastMoveTurn===1&&bot.lastMove?'move:'+bot.lastMove:
      M.baseName(bot.foeActive)!==M.baseName(lead)?'changed:'+M.baseName(bot.foeActive):'none'};
    rec.obs[info.turn]=M.obsKey({...obs,rivalT1Lead:obs.rivalT1?.lead,rivalT1:obs.rivalT1?.action});
    if(j.force&&j.force.turn===info.turn){if(j.force.k<0){rec.forced[info.turn]='=base';return null;}const a=legal[j.force.k];rec.forced[info.turn]=a?a.label:null;return a?a.choice:null;}
    if(j.entry&&(j.entry==='both'||Number(j.entry)===info.turn||j.entry==='t1'&&info.turn===1)){
      const d=M.decideEarly(table,obs);
      rec.decisions.push({turn:info.turn,obs,status:d.status,action:d.action,key:d.key});
      if(d.status==='rule')return legal.find(a=>a.label===d.action).choice;
    }
    return null;
  };
}
async function runGames(own,teams,jobs,{workers=4,table=null}={}){
  if(!jobs.length)return [];
  jobs.forEach((j,i)=>{j.id=i;});
  const W=Math.max(1,Math.min(workers,jobs.length)),chunks=[...Array(W)].map(()=>[]);
  jobs.forEach((j,i)=>chunks[i%W].push(j));
  const parts=await Promise.all(chunks.map(c=>new Promise((res,rej)=>{
    const w=fork(__filename,['--pr82-worker'],{env:process.env});
    w.on('message',m=>{res(m);w.kill();});w.on('error',rej);
    w.on('exit',code=>{if(code)rej(Error('worker exit '+code));});
    w.send({own,teams,jobs:c,table});
  })));
  const byId=[];for(const r of parts.flat())byId[r.id]=r;
  return byId;
}

// ---------------- cases / policies ----------------
function allCases(){
  const {cases}=require('./public-six-general-eval');
  const {holdoutSixPR82}=require('./holdout-20261031-pr82');
  const out=[...cases('dev'),...cases('holdout'),...cases('pr80')];
  for(const [id,h] of Object.entries(holdoutSixPR82()))for(const [k,t] of Object.entries(h.hypotheses))out.push({six:id,hyp:k,team:t,ace:h.ace});
  return out;
}
function loadSearches(files){
  const by={};
  for(const f of files)for(const s of Object.values(JSON.parse(fs.readFileSync(f,'utf8'))))by[s.publicKey]=s;
  return by;
}
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
async function main(){
  const sim=load(),dex=sim.Dex.mod('champions');
  const {reportedLive}=require('./reported-live-roster-20261027');
  const {picks,label}=require('./a-preview-matrix-audit');
  const {rivalPicks}=require('./public-six-holdout');
  const {keyOf,searchPublicSix}=require('./public-six-general');
  const own=reportedLive(),W=Number(process.env.WORKERS||4);
  const searches=loadSearches((process.env.SEARCH||'reports/data/pr80-search-dev-v2.json,reports/data/pr80-search-holdout-v2.json,reports/data/pr80-search-hxsand-v2.json,reports/data/pr82-search-hxfairy.json').split(','));
  const only=process.env.ONLY?new RegExp(process.env.ONLY):null;
  const CS=allCases().filter(c=>!only||only.test(c.six+'/'+c.hyp));
  const teams=CS.map(c=>c.team);
  const validator=sim.TeamValidator.get(FORMAT);
  for(const c of CS){const p=validator.validateTeam(normalize(c.team));if(p?.length)throw Error(c.six+'/'+c.hyp+': '+p.join('; '));}
  const O=picks(own),pickOf=l=>O.find(o=>label(o)===l);
  const T={start:Date.now()};
  // quick live-search policy per public six (P0-5), timed
  const quick={};
  for(const c of CS){
    const six=c.team.map(p=>p.species),k=keyOf(six);if(quick[k])continue;
    const s=await searchPublicSix({sim,own,publicSix:six,opts:{...QUICK,workers:W}});
    quick[k]={seconds:s.seconds,games:s.games.total,support:s.support.map(x=>[x.pick,x.p]),pure0:s.pure[0].pick,security:s.security};
    console.log('quick',c.six,s.seconds+'s',s.games.total,'games',quick[k].pure0);
  }
  // per-case meta
  const meta=CS.map((c,ci)=>{
    const six=c.team.map(p=>p.species),s=searches[keyOf(six)];
    if(!s)throw Error('no saved search for '+c.six);
    const legacy=chooseThree(dex,own,six).map(n=>own[n-1].species);
    const legacyLabel=label(O.find(o=>o[0]===legacy[0]&&o.slice().sort().join()===legacy.slice().sort().join()));
    const top=s.support.slice().sort((a,b)=>b.p-a.p).slice(0,2),tt=top.reduce((x,y)=>x+y.p,0);
    const pol={human1:{[s.pure[0].pick]:1},general:Object.fromEntries(s.support.map(x=>[x.pick,x.p])),
      top2:Object.fromEntries(top.map(x=>[x.pick,x.p/tt])),legacy:{[legacyLabel]:1},quick:{[quick[keyOf(six)].pure0]:1}};
    return {ci,six:c.six,hyp:c.hyp,publicSix:six,human1:s.pure[0].pick,pol,rp:rivalPicks(dex,c.team,own.map(p=>p.species),c.ace).picks};
  });
  // stage 0: all 60 rival picks vs human1 (TRAIN seeds) -> 2 alternate cells
  const j0=[];
  meta.forEach(m=>picks(teams[m.ci]).forEach((fp,fj)=>TRAIN.forEach(s=>[false,true].forEach(reverse=>
    j0.push({ci:m.ci,fj,team:m.ci,own:pickOf(m.human1),foe:fp,seed:trainSeed(m.ci,s),reverse,branch:'ai',publicSix:m.publicSix})))));
  const r0=await runGames(own,teams,j0,{workers:W});
  console.log('stage0',j0.length,'games',Math.round((Date.now()-T.start)/1000)+'s');
  for(const m of meta){
    const F=picks(teams[m.ci]),v=F.map((_,fj)=>mean(j0.map((j,k)=>j.ci===m.ci&&j.fj===fj?r0[k].won:null).filter(x=>x!=null)));
    m.rivalScreen={security:Math.min(...v),zero:v.filter(x=>x===0).length,of:v.length};
    const have=new Set(m.rp.map(r=>r.pick.join('/')));
    const alt=F.map((f,fj)=>({f,v:v[fj]})).filter(x=>!have.has(x.f.join('/'))).sort((a,b)=>a.v-b.v||(label(a.f)<label(b.f)?-1:1)).slice(0,2);
    m.cells=[...m.rp.map(r=>({src:r.src,foe:r.pick})),...alt.map((x,i)=>({src:'alt'+(i+1),foe:x.f,screen:x.v}))];
  }
  const cellJobs=(m,seedOf,seeds,extra)=>{const out=[];
    m.cells.forEach(c=>BRANCHES.forEach(branch=>seeds.forEach(s=>[false,true].forEach(reverse=>
      out.push({ci:m.ci,team:m.ci,foe:c.foe,cell:c.src,branch,s,seed:seedOf(m.ci,s),reverse,publicSix:m.publicSix,...extra})))));return out;};
  const cond=(m,j)=>m.hyp+'|'+j.cell+':'+j.foe.join('/')+'|'+j.branch;
  // stage 1: T1 forced over all legal actions (<=6: 4 moves + 2 switches)
  const j1=meta.flatMap(m=>[-1,0,1,2,3,4,5].flatMap(k=>cellJobs(m,trainSeed,TRAIN,{own:pickOf(m.human1),force:{turn:1,k}})));
  const r1=await runGames(own,teams,j1,{workers:W});
  console.log('stage1',j1.length,'games',Math.round((Date.now()-T.start)/1000)+'s');
  const g1=j1.map((j,k)=>({key:r1[k].rec.obs[1],label:r1[k].rec.forced[1],cond:cond(meta[j.ci],j),won:r1[k].won})).filter(g=>g.key&&g.label);
  const t1=M.buildTable(g1);
  // stage 2: T1 by table, T2 forced
  const j2=meta.flatMap(m=>[-1,0,1,2,3,4,5].flatMap(k=>cellJobs(m,trainSeed,TRAIN,{own:pickOf(m.human1),entry:'t1',force:{turn:2,k}})));
  const r2=await runGames(own,teams,j2,{workers:W,table:t1});
  console.log('stage2',j2.length,'games',Math.round((Date.now()-T.start)/1000)+'s');
  const g2=j2.map((j,k)=>({key:r2[k].rec.obs[2],label:r2[k].rec.forced[2],cond:cond(meta[j.ci],j),won:r2[k].won})).filter(g=>g.key&&g.label);
  const t2=M.buildTable(g2);
  const table={rules:{...t1.rules,...t2.rules},params:t1.params,built:'train seeds 8200000+ci*100+{0,1}, both sides'};
  // forced-action fidelity (own side): forced label vs executed
  const fid={ok:0,bad:0,examples:[]};
  for(const r of [...r1,...r2])for(const f of r.ownForcedCheck)if(f.label&&f.label!=='=base'){
    const ok=f.executed===f.label||(/^move:/.test(f.label)&&f.executed==='none');if(ok)fid.ok++;else{fid.bad++;if(fid.examples.length<5)fid.examples.push(f);}}
  // test stage
  const jt=[];
  for(const m of meta){
    const pk=[...new Set(Object.values(m.pol).flatMap(p=>Object.keys(p)))];
    for(const p of pk)jt.push(...cellJobs(m,testSeed,TEST,{own:pickOf(p),pick:p}));
    jt.push(...cellJobs(m,testSeed,TEST,{own:pickOf(m.human1),pick:m.human1,entry:'both'}));
  }
  const rt=await runGames(own,teams,jt,{workers:W,table});
  console.log('test',jt.length,'games',Math.round((Date.now()-T.start)/1000)+'s');
  // ---- summaries ----
  const cases=meta.map(m=>{
    const J=jt.map((j,k)=>({j,r:rt[k]})).filter(x=>x.j.ci===m.ci);
    const val=(pick,entry)=>{const G=J.filter(x=>x.j.pick===pick&&!!x.j.entry===entry);
      const per={};for(const x of G){const c=x.j.cell+'|'+x.j.branch;(per[c]||(per[c]=[])).push(x.r.won);}
      return {per:Object.fromEntries(Object.entries(per).map(([c,v])=>[c,mean(v)])),mean:mean(G.map(x=>x.r.won)),n:G.length};};
    const polVal=(x,entry=false)=>{const ks=Object.keys(x),V=ks.map(k=>val(k,entry));
      const cells=Object.keys(V[0].per),col=cells.map(c=>ks.reduce((s,k,i)=>s+x[k]*V[i].per[c],0));
      const byCell={};m.cells.forEach(c=>{byCell[c.src]=+mean(cells.filter(z=>z.startsWith(c.src+'|')).map(z=>col[cells.indexOf(z)])).toFixed(3);});
      return {mean:+ks.reduce((s,k,i)=>s+x[k]*V[i].mean,0).toFixed(3),worstCellBranch:+Math.min(...col).toFixed(3),
        zeroCellBranch:col.filter(v=>v===0).length+'/'+col.length,byCell,
        worst:cells.map((c,i)=>[c,+col[i].toFixed(2)]).sort((a,b)=>a[1]-b[1]).slice(0,3)};};
    const summary={};
    for(const [n,x] of Object.entries(m.pol))summary[n]=polVal(x);
    summary['human1+entry']=polVal(m.pol.human1,true);
    const ent=J.filter(x=>x.j.entry).flatMap(x=>x.r.rec.decisions);
    return {six:m.six,hyp:m.hyp,human1:m.human1,policies:m.pol,cells:m.cells.map(c=>({src:c.src,rival:c.foe.join('/'),screen:c.screen})),rivalScreen:m.rivalScreen,summary,
      entry:{decisions:ent.length,rule:ent.filter(d=>d.status==='rule').length,base:ent.filter(d=>d.status==='base').length,uncovered:ent.filter(d=>d.status==='uncovered').length,
        t1:ent.filter(d=>d.turn===1&&d.status==='rule').map(d=>d.key.split('#').slice(-1)[0]+' -> '+d.action).filter((v,i,a)=>a.indexOf(v)===i)}};
  });
  // requested check old vs new on every run game
  const reqAll=[...r1,...r2,...rt].flatMap(r=>r.requested);
  const cmp={};for(const q of reqAll){const k=(q.move?'move':'switch')+' v1='+q.v1+' v2='+q.v2.result+(q.v2.effect?'/'+q.v2.effect:'');cmp[k]=(cmp[k]||0)+1;}
  const wrongTarget=reqAll.filter(q=>q.v2.result==='wrongTarget').slice(0,10);
  const ineffective=reqAll.filter(q=>q.v2.effect&&q.v2.effect!=='effective').slice(0,10);
  // utility rationality per branch (test stage, all policies)
  const util={};
  jt.forEach((j,k)=>{for(const u of rt[k].utility){const key=j.branch+'|'+u.rational;util[key]=(util[key]||0)+1;}});
  const utilEx=jt.flatMap((j,k)=>rt[k].utility.filter(u=>u.rational==='irrational').map(u=>({branch:j.branch,six:meta[j.ci].six,...u}))).slice(0,12);
  // wins that depend on an irrational rival utility move (test, human1 base)
  const dep={};jt.forEach((j,k)=>{if(j.entry||j.pick!==meta[j.ci].human1)return;const irr=rt[k].utility.some(u=>u.rational==='irrational');
    const key=j.branch+(irr?'|irrational':'|none');const d=dep[key]||(dep[key]=[0,0]);d[0]+=rt[k].won;d[1]++;});
  // leakage audit: identical public observation -> identical decision, across hidden conditions
  const byObs={};
  jt.forEach((j,k)=>{for(const d of rt[k].rec.decisions){const o=JSON.stringify(d.obs);const b=byObs[o]||(byObs[o]={dec:new Set(),hidden:new Set()});
    b.dec.add(d.status+':'+d.action);b.hidden.add(meta[j.ci].hyp+'|'+j.foe.join('/')+'|'+j.branch);}});
  const leak={observations:Object.keys(byObs).length,multiHidden:Object.values(byObs).filter(b=>b.hidden.size>1).length,
    inconsistent:Object.values(byObs).filter(b=>b.dec.size>1).length};
  const rules=Object.values(table.rules);
  const out={showdown:SHOWDOWN,format:FORMAT,own:'reportedLive (reported-live-roster-20261027.js)',branches:BRANCHES,quickParams:QUICK,
    seeds:{train:'hashSeed(8200000+ci*100+{0,1})',test:'hashSeed(8250000+ci*100+{0,1})',sides:'both'},
    games:{stage0:j0.length,stage1:j1.length,stage2:j2.length,test:jt.length},seconds:Math.round((Date.now()-T.start)/1000),
    table:{rules:rules.length,rule:rules.filter(r=>r.status==='rule').length,base:rules.filter(r=>r.status==='base').length,uncovered:rules.filter(r=>r.status==='uncovered').length,params:table.params},
    forcedFidelity:fid,requestedCompare:cmp,wrongTarget,ineffective,utility:util,utilityIrrationalExamples:utilEx,winsByIrrationalUtility:dep,leak,quick,cases,
    note:'AI vs AI on constructed hypotheses; per cell x branch 2 seeds x 2 sides. worstCellBranch = min over rival cell x T1/T2 branch. NOT a ladder win rate.'};
  if(process.env.OUT){fs.mkdirSync(path.dirname(process.env.OUT),{recursive:true});fs.writeFileSync(process.env.OUT,JSON.stringify(out));
    fs.writeFileSync(process.env.OUT.replace(/\.json$/,'-table.json'),JSON.stringify(table,null,1));}
  console.log(JSON.stringify({games:out.games,seconds:out.seconds,table:out.table,fid,cmp,leak,util,dep},null,1));
  for(const c of cases)console.log(c.six+'/'+c.hyp,c.human1,Object.entries(c.summary).map(([n,s])=>n+' '+s.mean+'/'+s.worstCellBranch).join(' | '));
}
if(process.argv.includes('--pr82-worker'))workerMain();
else if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={ownScript,allCases,QUICK,BRANCHES};
