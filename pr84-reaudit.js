#!/usr/bin/env node
'use strict';
// PR #84 (ChatGPT review #5719818884 of PR #83). NEW pinned-Showdown battles.
//   R  reproduce PR #83 stage1 / stage2 / test on the SAME seeds, cells, branches
//      and sides, with the saved PR #83 table (reports/data/pr82-eval-table.json)
//      and the saved cells/policies (reports/data/pr82-eval.json; PR #83 stage0
//      only chose the cells, so it is not rerun). Reproduction is checked
//      against the saved counts (forced-fidelity bad 28, requested compare,
//      per-case means) before anything else is read.
//   S  every game: switch causes for BOTH sides on every turn (pr84-switch-cause),
//      PR #83 voluntarySwitch vs V3 disagreements, requested-rival check V2 vs
//      V3, own forced-action fidelity V2 vs V3 with the turn's log lines for
//      every mismatch, and rival utilityRational 'irrational' moves with the
//      lines between the choice point and the move.
//   C  public-condition key (pr84-public-cond-entry): stage1 / stage2 rerun with
//      the V3 key (T1 by the V3 T1 table), V3 tables built on the same TRAIN
//      games, aliasing count of PR #83 keys that mix public conditions.
//   H  frozen policies on predeclared holdout cells (holdout-20261031-pr84.js,
//      committed before this ran) with fresh HOLD seeds: human1 base,
//      human1+PR83 entry, human1+V3 entry, general mixture, legacy.
// Heuristic AI vs heuristic AI, small samples. NOT a ladder win rate.
//   SHOWDOWN_DIR=... OUT=reports/data/pr84-reaudit.json node pr84-reaudit.js
const fs=require('node:fs');
const path=require('node:path');
const {fork}=require('node:child_process');
const {load,hashSeed,chooseThree,normalize}=require('./lab');
const M=require('./pr82-switch-utility-t1t2');
const V3=require('./pr84-switch-cause');
const C=require('./pr84-public-cond-entry');
const E=require('./pr82-eval');
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640';
const FORMAT='gen9championsbssregmc';
const {BRANCHES}=E;
const TRAIN=[0,1],TEST=[0,1],HOLD=[0,1];
const trainSeed=(ci,s)=>hashSeed(8200000+ci*100+s),testSeed=(ci,s)=>hashSeed(8250000+ci*100+s);
const {holdoutCells,HOLD_SEED_BASE}=require('./holdout-20261031-pr84');
const holdSeed=(ci,s)=>hashSeed(HOLD_SEED_BASE+ci*100+s);
const LINE=/^\|(move|switch|drag|faint|cant|-activate|-enditem|-start|-end|-fail|-immune|-mega|detailschange|-damage)\|/;

// ---------------- worker ----------------
function causesAllTurns(log){
  const T=M.splitTurns(log),out={},dis=[];
  for(const [t,L] of Object.entries(T)){if(Number(t)<1)continue;
    for(const s of ['p1','p2']){const me=s+'a: ';
      for(const e of V3.switchEvents(L,me))out[e.cause+(e.by?':'+e.by:'')]=(out[e.cause+(e.by?':'+e.by:'')]||0)+1;
      const a=M.voluntarySwitch(L,me),b=V3.voluntarySwitchV3(L,me);
      if((a?M.baseName(a):null)!==(b||null))dis.push({turn:Number(t),side:s,v2:a?M.baseName(a):null,v3:b,lines:L.filter(l=>LINE.test(l)).slice(0,14)});}}
  return {causes:out,disagree:dis};
}
function script(j,tables,rec){
  // PR #83 script for PR #83 behaviour (identical choices); V3 entry when j.v3.
  const t2=j.v3?null:tables.v2;
  const base=E.ownScript(j.v3?{...j,entry:null}:j,t2,rec);
  let lead=null;rec.obs3={};rec.decisions3=[];
  return (req,bot,info)=>{
    if(info.turn<=2){
      const legal=M.legalActions(req);
      if(info.turn===1)lead=bot.foeActive;
      const obs={publicSix:j.publicSix,ownThree:j.own,turn:info.turn,rivalActive:bot.foeActive,
        ownActive:M.baseName(req.side.pokemon.find(p=>p.active).details),legal:legal.map(a=>a.label),cond:C.condFromBot(req,bot)};
      if(info.turn===2)obs.rivalT1={lead,action:bot.foeLastMoveTurn===1&&bot.lastMove?'move:'+bot.lastMove:
        M.baseName(bot.foeActive)!==M.baseName(lead)?'changed:'+M.baseName(bot.foeActive):'none'};
      rec.obs3[info.turn]=C.obsKeyV3(obs);
      const forcedNow=j.force&&j.force.turn===info.turn;
      if(j.v3&&!forcedNow&&j.entry&&(j.entry==='both'||j.entry==='t1'&&info.turn===1)){
        const d=C.decideEarlyV3(tables.v3,obs);
        rec.decisions3.push({turn:info.turn,status:d.status,action:d.action,key:d.key});
        if(d.status==='rule')return legal.find(a=>a.label===d.action).choice;
      }
    }
    return base(req,bot,info);
  };
}
function workerMain(){
  const {battle}=require('./encore-lead-audit');
  const {OWN_AI,checkRequested,rivalScript}=require('./public-six-general');
  const sim=load(),dex=sim.Dex.mod('champions');
  process.on('message',async({own,teams,jobs,tables})=>{
    const out=[];
    for(const j of jobs){
      const requested=[],rec={forced:{},decisions:[],obs:{}};
      const rs=j.branch==='utility'?rivalScript('utility',dex,requested):M.rivalScriptV2(j.branch,dex,requested);
      const g=await battle(sim,structuredClone(own),structuredClone(teams[j.team]),j.seed,
        {ownThree:j.own,foeThree:j.foe,reverse:j.reverse,script:rs,ownOptions:{...OWN_AI,script:script(j,tables,rec)}});
      if(g.errors)throw Error('choice errors '+JSON.stringify(j));
      const v1=checkRequested(g.log,g.foeSide,requested);
      const v2=M.checkRequestedV2(g.log,g.foeSide,requested,{rival3:j.foe});
      const v3=V3.checkRequestedV3(g.log,g.foeSide,requested,{rival3:j.foe});
      const T=M.splitTurns(g.log);
      const fc=Object.entries(rec.forced).map(([t,l])=>{t=Number(t);
        const r={turn:t,label:l,executed:l?M.executedOwn(g.log,g.ownSide,t):null,executed3:l?V3.executedOwnV3(g.log,g.ownSide,t):null};
        const ok=x=>x===l||(/^move:/.test(l)&&(x==='none'||/^forcedOut:/.test(x)));
        if(l&&l!=='=base'&&!ok(r.executed)){const own=g.ownSide+'a: ',L=T[t]||[];
          r.lines=L.filter(x=>LINE.test(x)).slice(0,16);
          const mi=L.findIndex(x=>x.startsWith('|move|'+own));
          r.encoreBeforeOwnMove=L.slice(0,mi<0?L.length:mi).some(x=>x.startsWith('|-start|'+own)&&/Encore/.test(x));
          r.ownEncoredAtStart=(T[t-1]||[]).some(x=>x.startsWith('|-start|'+own)&&/Encore/.test(x));}
        return r;});
      const util=M.utilityAudit(g.log,g.foeSide,dex);
      const utilIrr=j.branch==='utilityRational'?util.filter(u=>u.rational==='irrational').map(u=>({...u,
        lines:(T[u.turn]||[]).filter(x=>LINE.test(x)).slice(0,12)})):[];
      out.push({id:j.id,won:g.won?1:0,turns:g.turns,rec,requested:requested.map((q,k)=>({turn:q.turn,choice:q.choice,move:q.move,target:q.target??null,v1:v1[k],v2:v2[k],v3:v3[k]})),
        utility:util.map(u=>({rational:u.rational})),utilIrr,ownForcedCheck:fc,sw:causesAllTurns(g.log)});
    }
    process.send(out);
  });
}
async function runGames(own,teams,jobs,{workers=4,tables={}}={}){
  if(!jobs.length)return [];
  jobs.forEach((j,i)=>{j.id=i;});
  const W=Math.max(1,Math.min(workers,jobs.length)),chunks=[...Array(W)].map(()=>[]);
  jobs.forEach((j,i)=>chunks[i%W].push(j));
  const parts=await Promise.all(chunks.map(c=>new Promise((res,rej)=>{
    const w=fork(__filename,['--pr84-worker'],{env:process.env});
    w.on('message',m=>{res(m);w.kill();});w.on('error',rej);
    w.on('exit',code=>{if(code)rej(Error('worker exit '+code));});
    w.send({own,teams,jobs:c,tables});
  })));
  const byId=[];for(const r of parts.flat())byId[r.id]=r;
  return byId;
}
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const inc=(o,k,n=1)=>{o[k]=(o[k]||0)+n;};

// utilityRational only picks moves its own public check calls rational at
// the choice point; an irrational move in that branch is either the base-AI
// fallback (branch returned null) or a state change earlier in the turn.
// (PR #86: moved out of main() unchanged so the saved labels can be re-checked.)
function utilCause(u){
  const L=u.lines,mv=L.findIndex(l=>l.startsWith('|move|')&&l.split('|')[3]===u.move&&l.split('|')[2].endsWith(u.user));
  const before=L.slice(0,mv<0?L.length:mv);
  return before.some(l=>/^\|(switch|drag)\|/.test(l)&&!l.includes(u.user))?'ex-post: target replaced before the move':
    before.some(l=>/^\|(-status|-sidestart)\|/.test(l)||/\[from\] (brn|psn|tox|par)$/.test(l)||/Synchronize/.test(l))?'ex-post: status/hazard set earlier this turn':
    'decision-time irrational: base-AI fallback (branch had no rational utility move)';
}
async function main(){
  const sim=load(),dex=sim.Dex.mod('champions');
  const {reportedLive}=require('./reported-live-roster-20261027');
  const {picks,label}=require('./a-preview-matrix-audit');
  const saved=JSON.parse(fs.readFileSync('reports/data/pr82-eval.json','utf8'));
  const savedTable=JSON.parse(fs.readFileSync('reports/data/pr82-eval-table.json','utf8'));
  const own=reportedLive(),W=Number(process.env.WORKERS||4);
  const CS=E.allCases();
  const teams=CS.map(c=>c.team);
  const validator=sim.TeamValidator.get(FORMAT);
  for(const c of CS){const p=validator.validateTeam(normalize(c.team));if(p?.length)throw Error(c.six+'/'+c.hyp+': '+p.join('; '));}
  const O=picks(own),pickOf=l=>O.find(o=>label(o)===l);
  const T0=Date.now(),lap=s=>console.log(s,Math.round((Date.now()-T0)/1000)+'s');
  const only=process.env.ONLY?new RegExp(process.env.ONLY):null;   // smoke runs only
  const meta=CS.map((c,ci)=>{
    const sc=saved.cases[ci];
    if(sc.six!==c.six||sc.hyp!==c.hyp)throw Error('case order differs from saved PR #83 at '+ci);
    const legacy=chooseThree(dex,c.team,own.map(p=>p.species)).map(n=>c.team[n-1].species);
    return {ci,six:c.six,hyp:c.hyp,publicSix:c.team.map(p=>p.species),human1:sc.human1,pol:sc.policies,
      cells:sc.cells.map(x=>({src:x.src,foe:x.rival.split('/')})),rivalLegacy:legacy,ace:c.ace,saved:sc};
  }).filter(m=>!only||only.test(m.six+'/'+m.hyp));
  const byCi=Object.fromEntries(meta.map(m=>[m.ci,m]));
  const cellJobs=(m,cells,seedOf,seeds,extra)=>{const out=[];
    cells.forEach(c=>BRANCHES.forEach(branch=>seeds.forEach(s=>[false,true].forEach(reverse=>
      out.push({ci:m.ci,team:m.ci,foe:c.foe,cell:c.src,branch,s,seed:seedOf(m.ci,s),reverse,publicSix:m.publicSix,...extra})))));return out;};
  const cond=(m,j)=>m.hyp+'|'+j.cell+':'+j.foe.join('/')+'|'+j.branch;
  const tables={v2:savedTable};
  // ---- R/C stage 1 (shared: forced T1 has no entry) ----
  const j1=meta.flatMap(m=>[-1,0,1,2,3,4,5].flatMap(k=>cellJobs(m,m.cells,trainSeed,TRAIN,{own:pickOf(m.human1),force:{turn:1,k}})));
  const r1=await runGames(own,teams,j1,{workers:W,tables});lap('stage1 '+j1.length);
  const g1=j1.map((j,k)=>({key:r1[k].rec.obs[1],label:r1[k].rec.forced[1],cond:cond(byCi[j.ci],j),won:r1[k].won})).filter(g=>g.key&&g.label);
  const t1v2=M.buildTable(g1);
  const g1v3=j1.map((j,k)=>({key:r1[k].rec.obs3[1],label:r1[k].rec.forced[1],cond:cond(byCi[j.ci],j),won:r1[k].won})).filter(g=>g.key&&g.label);
  const t1v3=M.buildTable(g1v3);
  // ---- R stage 2 (PR #83: T1 by saved table) / C stage 2 (T1 by V3 T1 table) ----
  const j2=meta.flatMap(m=>[-1,0,1,2,3,4,5].flatMap(k=>cellJobs(m,m.cells,trainSeed,TRAIN,{own:pickOf(m.human1),entry:'t1',force:{turn:2,k}})));
  const r2=await runGames(own,teams,j2,{workers:W,tables});lap('stage2 '+j2.length);
  const g2=j2.map((j,k)=>({key:r2[k].rec.obs[2],label:r2[k].rec.forced[2],cond:cond(byCi[j.ci],j),won:r2[k].won})).filter(g=>g.key&&g.label);
  const t2v2=M.buildTable(g2);
  const j2c=j2.map(j=>({...j,v3:true}));
  const r2c=await runGames(own,teams,j2c,{workers:W,tables:{v3:t1v3}});lap('stage2-v3 '+j2c.length);
  const g2v3=j2c.map((j,k)=>({key:r2c[k].rec.obs3[2],label:r2c[k].rec.forced[2],cond:cond(byCi[j.ci],j),won:r2c[k].won})).filter(g=>g.key&&g.label);
  const t2v3=M.buildTable(g2v3);
  const v3table={rules:{...t1v3.rules,...t2v3.rules},params:t1v3.params,built:'train seeds 8200000+ci*100+{0,1}, both sides, V3 public-condition key'};
  tables.v3=v3table;
  const rebuilt={rules:{...t1v2.rules,...t2v2.rules}};
  const tableSame=JSON.stringify(Object.keys(rebuilt.rules).sort().map(k=>[k,rebuilt.rules[k].status,rebuilt.rules[k].action]))===
    JSON.stringify(Object.keys(savedTable.rules).sort().map(k=>[k,savedTable.rules[k].status,savedTable.rules[k].action]));
  // aliasing: a PR #83 key whose train games span several V3 public conditions
  const alias={};
  const pairs=[...j1.map((j,k)=>[r1[k].rec.obs[1],r1[k].rec.obs3[1]]),...j2.map((j,k)=>[r2[k].rec.obs[2],r2[k].rec.obs3[2]])];
  for(const [a,b] of pairs){if(!a||!b)continue;const s=alias[a]||(alias[a]=new Set());s.add(b.split('#').slice(-2).join('#'));}
  const ruleKeys=Object.keys(savedTable.rules).filter(k=>savedTable.rules[k].status==='rule');
  const aliasing={pr83Keys:Object.keys(alias).length,multiCondition:Object.values(alias).filter(s=>s.size>1).length,
    pr83RulesMultiCondition:ruleKeys.filter(k=>alias[k]&&alias[k].size>1).length,pr83Rules:ruleKeys.length,
    examples:ruleKeys.filter(k=>alias[k]&&alias[k].size>1).slice(0,6).map(k=>({key:k,action:savedTable.rules[k].action,conds:[...alias[k]].slice(0,4)}))};
  // ---- R test (PR #83 policies, saved table) + V3 entry ----
  const jt=[];
  for(const m of meta){
    const pk=[...new Set(Object.values(m.pol).flatMap(p=>Object.keys(p)))];
    for(const p of pk)jt.push(...cellJobs(m,m.cells,testSeed,TEST,{own:pickOf(p),pick:p}));
    jt.push(...cellJobs(m,m.cells,testSeed,TEST,{own:pickOf(m.human1),pick:m.human1,entry:'both'}));
    jt.push(...cellJobs(m,m.cells,testSeed,TEST,{own:pickOf(m.human1),pick:m.human1,entry:'both',v3:true}));
  }
  const rt=await runGames(own,teams,jt,{workers:W,tables});lap('test '+jt.length);
  // ---- H holdout cells, HOLD seeds, frozen tables ----
  const jh=[];
  for(const m of meta){
    m.hold=holdoutCells({picks:picks(teams[m.ci]),label,legacy:m.rivalLegacy,ace:m.ace,used:m.cells.map(c=>c.foe)});
    const pk=[m.human1,...Object.keys(m.pol.general),...Object.keys(m.pol.legacy)].filter((v,i,a)=>a.indexOf(v)===i);
    for(const p of pk)jh.push(...cellJobs(m,m.hold,holdSeed,HOLD,{own:pickOf(p),pick:p}));
    jh.push(...cellJobs(m,m.hold,holdSeed,HOLD,{own:pickOf(m.human1),pick:m.human1,entry:'both'}));
    jh.push(...cellJobs(m,m.hold,holdSeed,HOLD,{own:pickOf(m.human1),pick:m.human1,entry:'both',v3:true}));
  }
  const rh=await runGames(own,teams,jh,{workers:W,tables});lap('holdout '+jh.length);
  // ---------------- summaries ----------------
  const all=[...r1,...r2,...r2c,...rt,...rh];
  // forced fidelity, PR #83 definition on stage1+stage2 (reproduction) and V3
  const fid={v2:{ok:0,bad:0},v3:{ok:0,bad:0},bad:[]};
  for(const r of [...r1,...r2])for(const f of r.ownForcedCheck)if(f.label&&f.label!=='=base'){
    const ok2=f.executed===f.label||(/^move:/.test(f.label)&&f.executed==='none');fid.v2[ok2?'ok':'bad']++;
    const ok3=f.executed3===f.label||(/^move:/.test(f.label)&&(f.executed3==='none'||/^forcedOut:/.test(f.executed3)));fid.v3[ok3?'ok':'bad']++;
    if(!ok2)fid.bad.push({...f,why:f.encoreBeforeOwnMove?'rival Encore landed this turn before our move':f.ownEncoredAtStart?'already Encored':/^forcedOut:/.test(f.executed3)?'forced exit before our move':'other'});
  }
  fid.byWhy={};for(const b of fid.bad)inc(fid.byWhy,b.why);
  // requested rival actions: V2 vs V3, R stages only (same games as PR #83)
  const reqR=[...r1,...r2,...rt.filter((r,k)=>!jt[k].v3)].flatMap(r=>r.requested);
  const cmp={},cmp23={};
  for(const q of reqR){inc(cmp,(q.move?'move':'switch')+' v1='+q.v1+' v2='+q.v2.result+(q.v2.effect?'/'+q.v2.effect:''));
    inc(cmp23,(q.move?'move':'switch')+' v2='+q.v2.result+' v3='+q.v3.result);}
  const reqAll=all.flatMap(r=>r.requested),cmpAll={};for(const q of reqAll)inc(cmpAll,(q.move?'move':'switch')+' v2='+q.v2.result+' v3='+q.v3.result);
  const fe=reqAll.filter(q=>q.v3.result==='forcedExit'||q.v2.result!==q.v3.result).slice(0,10);
  // switch causes over every turn of every game (both sides) and V2/V3 voluntary disagreements
  const causes={};let dis=[];for(const r of all){for(const [k,v] of Object.entries(r.sw.causes))inc(causes,k,v);dis=dis.concat(r.sw.disagree);}
  const disBy={};for(const d of dis)inc(disBy,'v2='+(d.v2?'switch':'null')+' v3='+(d.v3?'switch':'null'));
  // utilityRational irrational (test stage, same as PR #83 count 18)
  const ui=rt.filter((r,k)=>!jt[k].v3).flatMap((r,k)=>r.utilIrr);
  const uiBy={};for(const u of ui){const why=utilCause(u);u.cause=why;inc(uiBy,u.why+' | '+why);}
  // policy values
  const summarize=(J,R,m,cells,extraKeys)=>{
    const G=J.map((j,k)=>({j,r:R[k]})).filter(x=>x.j.ci===m.ci);
    const val=(pick,ent)=>{const X=G.filter(x=>x.j.pick===pick&&(x.j.entry?(x.j.v3?'v3':'v2'):'')===ent);
      const per={};for(const x of X){const c=x.j.cell+'|'+x.j.branch;(per[c]||(per[c]=[])).push(x.r.won);}
      return {per:Object.fromEntries(Object.entries(per).map(([c,v])=>[c,mean(v)])),mean:mean(X.map(x=>x.r.won)),n:X.length};};
    const polVal=(x,ent='')=>{const ks=Object.keys(x),V=ks.map(k=>val(k,ent));if(V.some(v=>!v.n))return null;
      const cs=Object.keys(V[0].per),col=cs.map(c=>ks.reduce((s,k,i)=>s+x[k]*V[i].per[c],0));
      const byCell={};cells.forEach(c=>{byCell[c.src]=+mean(cs.filter(z=>z.startsWith(c.src+'|')).map(z=>col[cs.indexOf(z)])).toFixed(3);});
      return {mean:+ks.reduce((s,k,i)=>s+x[k]*V[i].mean,0).toFixed(3),zeroCellBranch:col.filter(v=>v===0).length,cellBranches:col.length,byCell};};
    const out={};
    for(const n of extraKeys)if(m.pol[n])out[n]=polVal(m.pol[n]);
    out['human1+entryPR83']=polVal(m.pol.human1,'v2');out['human1+entryV3']=polVal(m.pol.human1,'v3');
    const dec=G.filter(x=>x.j.entry).flatMap(x=>x.j.v3?x.r.rec.decisions3.map(d=>({...d,v:'v3'})):x.r.rec.decisions.map(d=>({...d,v:'v2'})));
    const dc={};for(const d of dec)inc(dc,d.v+':'+d.status);
    return {...out,decisions:dc};
  };
  const cases=meta.map(m=>({six:m.six,hyp:m.hyp,human1:m.human1,
    test:summarize(jt,rt,m,m.cells,['human1','general','top2','legacy','quick']),
    savedTest:Object.fromEntries(Object.entries(m.saved.summary).map(([k,v])=>[k,v.mean])),
    holdCells:m.hold.map(c=>c.src+':'+c.foe.join('/')),
    hold:summarize(jh,rh,m,m.hold,['human1','general','legacy'])}));
  const repro={tableSame,forcedFidelityBad:{saved:saved.forcedFidelity.bad,now:fid.v2.bad},
    requestedCompareSame:JSON.stringify(Object.entries(cmp).sort())===JSON.stringify(Object.entries(saved.requestedCompare).sort()),
    meansSame:cases.every(c=>['human1','general','top2','legacy','quick'].every(k=>Math.abs((c.test[k]?.mean??-1)-c.savedTest[k])<1e-3)&&Math.abs(c.test['human1+entryPR83'].mean-c.savedTest['human1+entry'])<1e-3)};
  const agg=(k,part)=>{const v=cases.map(c=>c[part][k]).filter(Boolean);return {mean:+mean(v.map(x=>x.mean)).toFixed(3),zeroCellBranch:v.reduce((s,x)=>s+x.zeroCellBranch,0)+'/'+v.reduce((s,x)=>s+x.cellBranches,0)};};
  const aggregate={test:Object.fromEntries(['human1','human1+entryPR83','human1+entryV3','general','top2','legacy','quick'].map(k=>[k,agg(k,'test')])),
    hold:Object.fromEntries(['human1','human1+entryPR83','human1+entryV3','general','legacy'].map(k=>[k,agg(k,'hold')]))};
  const rl=Object.values(v3table.rules);
  const out={showdown:SHOWDOWN,format:FORMAT,own:'reportedLive (reported-live-roster-20261027.js)',branches:BRANCHES,
    seeds:{train:'hashSeed(8200000+ci*100+{0,1})',test:'hashSeed(8250000+ci*100+{0,1})',hold:'hashSeed('+HOLD_SEED_BASE+'+ci*100+{0,1})',sides:'both'},
    games:{stage1:j1.length,stage2:j2.length,stage2v3:j2c.length,test:jt.length,hold:jh.length,total:all.length},seconds:Math.round((Date.now()-T0)/1000),
    reproduction:repro,forcedFidelity:{v2:fid.v2,v3:fid.v3,byWhy:fid.byWhy,bad:fid.bad},
    requested:{pr83Compare:cmp,v2v3:cmp23,v2v3AllGames:cmpAll,examples:fe},
    switchCauses:{allTurnsBothSides:causes,voluntaryDisagreeV2V3:disBy,disagreeExamples:dis.slice(0,8)},
    utilityRationalIrrational:{n:ui.length,byCause:uiBy,examples:ui.slice(0,6)},
    v3Table:{rules:rl.length,rule:rl.filter(r=>r.status==='rule').length,base:rl.filter(r=>r.status==='base').length,uncovered:rl.filter(r=>r.status==='uncovered').length,
      t1:Object.keys(t1v3.rules).length,t2:Object.keys(t2v3.rules).length},
    pr83Table:{rules:Object.keys(savedTable.rules).length,t1:Object.keys(t1v2.rules).length,t2:Object.keys(t2v2.rules).length},
    aliasing,aggregate,cases,
    note:'AI vs AI on constructed hypotheses; per cell x branch 2 seeds x 2 sides. NOT a ladder win rate.'};
  if(process.env.OUT){fs.mkdirSync(path.dirname(process.env.OUT),{recursive:true});fs.writeFileSync(process.env.OUT,JSON.stringify(out,null,1));
    fs.writeFileSync(process.env.OUT.replace(/\.json$/,'-v3table.json'),JSON.stringify(v3table,null,1));}
  console.log(JSON.stringify({games:out.games,seconds:out.seconds,reproduction:repro,fid:{v2:fid.v2,v3:fid.v3,byWhy:fid.byWhy},cmp23,causes,disBy,uiBy,v3Table:out.v3Table,aliasing:{...aliasing,examples:undefined},aggregate},null,1));
}
if(process.argv.includes('--pr84-worker'))workerMain();
else if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={script,causesAllTurns,utilCause,runGames};
