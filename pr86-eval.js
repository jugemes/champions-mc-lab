#!/usr/bin/env node
'use strict';
// PR #86 (ChatGPT review #5720466858 of PR #85). New pinned-Showdown battles.
//   R      rebuild the PR #85 V3 table on the SAME train seeds / cells /
//          branches / sides through pr84-reaudit's own worker (byte-identical
//          code path) and compare it with reports/data/pr84-reaudit-v3table.json.
//          The rebuilt TRAIN games feed the leave-one-cell-out gate (pr86-safe-entry).
//   DEV    22 known hypotheses x DEV cells (holdout-20261031-pr86.js) x 6
//          branches x 2 seeds x both sides, every gate; picks the gate by the
//          rule declared in pr86-safe-entry.js and writes the freeze file.
//   FINAL  same on FINAL cells/seeds with the frozen gate (run once).
//   UNSEEN three public sixes absent from the repo: our 3+lead from the public
//          six only (livePreview: cache miss -> legacy; and the bounded quick
//          search, timed), rival rational cells, base AI vs V3 entry vs frozen
//          gate (all must be 'uncovered' -> identical games).
// Paired: every gate game has an abstain twin with the same seed/side/cell/branch.
// Heuristic AI vs heuristic AI, small samples. NOT a ladder win rate.
//   SHOWDOWN_DIR=... PHASE=R,DEV node pr86-eval.js     -> reports/data/pr86-dev.json
//   SHOWDOWN_DIR=... PHASE=FINAL,UNSEEN node pr86-eval.js -> reports/data/pr86-final.json
const fs=require('node:fs');
const {fork}=require('node:child_process');
const {load,hashSeed,chooseThree,normalize}=require('./lab');
const M=require('./pr82-switch-utility-t1t2');
const C=require('./pr84-public-cond-entry');
const E=require('./pr82-eval');
const R84=require('./pr84-reaudit');
const S=require('./pr86-safe-entry');
const H=require('./holdout-20261031-pr86');
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640';
const FORMAT='gen9championsbssregmc';
const {BRANCHES}=E;
const SEEDS=[0,1],trainSeed=(ci,s)=>hashSeed(8200000+ci*100+s);
const FREEZE='reports/data/pr86-gate-freeze.json';
const T13=/^\|(turn|move|switch|drag|faint|cant|-activate|-enditem|-start|-end|-fail|-immune|-mega|-weather|-fieldstart|-sidestart|-status|-boost|-unboost|-damage|-heal|win)\|/;

// ---------------- worker ----------------
function gateScript(j,table,loco,rec){
  const base=E.ownScript({...j,entry:null},null,{forced:{},decisions:[],obs:{}});
  let lead=null;rec.decisions=[];
  return (req,bot,info)=>{
    if(info.turn<=2&&j.gate){
      const legal=M.legalActions(req);
      if(info.turn===1)lead=bot.foeActive;
      const obs={publicSix:j.publicSix,ownThree:j.own,turn:info.turn,rivalActive:bot.foeActive,
        ownActive:M.baseName(req.side.pokemon.find(p=>p.active).details),legal:legal.map(a=>a.label),cond:C.condFromBot(req,bot)};
      if(info.turn===2)obs.rivalT1={lead,action:bot.foeLastMoveTurn===1&&bot.lastMove?'move:'+bot.lastMove:
        M.baseName(bot.foeActive)!==M.baseName(lead)?'changed:'+M.baseName(bot.foeActive):'none'};
      const d=S.safeDecide(table,obs,{gate:j.gate,loco});
      rec.decisions.push({turn:info.turn,status:d.status,action:d.action,tabled:d.tabled??null,key:d.key??null});
      if(d.status==='rule')return legal.find(a=>a.label===d.action).choice;
    }
    return base(req,bot,info);
  };
}
function workerMain(){
  const {battle}=require('./encore-lead-audit');
  const {OWN_AI,rivalScript}=require('./public-six-general');
  const sim=load(),dex=sim.Dex.mod('champions');
  process.on('message',async({own,teams,jobs,table,loco})=>{
    const out=[],L=new Set(loco||[]);
    for(const j of jobs){
      const requested=[],rec={};
      const rs=j.branch==='utility'?rivalScript('utility',dex,requested):M.rivalScriptV2(j.branch,dex,requested);
      const g=await battle(sim,structuredClone(own),structuredClone(teams[j.team]),j.seed,
        {ownThree:j.own,foeThree:j.foe,reverse:j.reverse,script:rs,ownOptions:{...OWN_AI,script:gateScript(j,table,L,rec)}});
      if(g.errors)throw Error('choice errors '+JSON.stringify(j));
      const util=M.utilityAudit(g.log,g.foeSide,dex);
      const fired=rec.decisions.some(d=>d.status==='rule');
      const T=M.splitTurns(g.log);
      out.push({id:j.id,won:g.won?1:0,turns:g.turns,decisions:rec.decisions,irrational:util.filter(u=>u.rational==='irrational').map(u=>u.turn+':'+u.move),
        lines:fired||j.keepLines?[1,2,3].flatMap(t=>(T[t]||[]).filter(x=>T13.test(x)).map(x=>'T'+t+' '+x)).slice(0,40):null});
    }
    process.send(out);
  });
}
async function runGames(own,teams,jobs,{workers=4,table=null,loco=[]}={}){
  if(!jobs.length)return [];
  jobs.forEach((j,i)=>{j.id=i;});
  const W=Math.max(1,Math.min(workers,jobs.length)),chunks=[...Array(W)].map(()=>[]);
  jobs.forEach((j,i)=>chunks[i%W].push(j));
  const parts=await Promise.all(chunks.map(c=>new Promise((res,rej)=>{
    const w=fork(__filename,['--pr86-worker'],{env:process.env});
    w.on('message',m=>{res(m);w.kill();});w.on('error',rej);
    w.on('exit',code=>{if(code)rej(Error('worker exit '+code));});
    w.send({own,teams,jobs:c,table,loco});
  })));
  const byId=[];for(const r of parts.flat())byId[r.id]=r;
  return byId;
}
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const r3=x=>x==null?null:+x.toFixed(3);
const inc=(o,k,n=1)=>{o[k]=(o[k]||0)+n;};
const rational=(j,r)=>j.branch!=='utility'&&!r.irrational.filter(x=>Number(x.split(':')[0])<=2).length;

// per gate: mean (all / rational), paired flips vs abstain, per hypothesis, decisions, examples
function summarize(J,Rs,gates,groupKey){
  const pairKey=j=>[groupKey(j),j.cell,j.foe.join('/'),j.branch,j.s,j.reverse].join('|');
  const ref={};J.forEach((j,k)=>{if(j.gate==='abstain')ref[pairKey(j)]=Rs[k];});
  const out={};
  for(const g of gates){
    const X=J.map((j,k)=>({j,r:Rs[k]})).filter(x=>x.j.gate===g);
    const byH={},flip={gateWon:0,gateLost:0},dec={},ex=[];
    for(const {j,r} of X){
      const h=groupKey(j),b=byH[h]||(byH[h]={all:[],rat:[],ref:[],refRat:[]});
      const a=ref[pairKey(j)];b.all.push(r.won);b.ref.push(a.won);
      if(rational(j,r)&&rational(j,a)){b.rat.push(r.won);b.refRat.push(a.won);}
      for(const d of r.decisions)inc(dec,'T'+d.turn+':'+d.status);
      if(r.won!==a.won){flip[r.won?'gateWon':'gateLost']++;
        if(!r.won&&ex.length<6&&r.lines)ex.push({hyp:h,cell:j.cell+':'+j.foe.join('/'),branch:j.branch,seed:j.seed,reverse:j.reverse,
          fired:r.decisions.filter(d=>d.status==='rule').map(d=>'T'+d.turn+' '+d.action),gateLines:r.lines});}
    }
    const per=Object.fromEntries(Object.entries(byH).map(([h,b])=>[h,{n:b.all.length,mean:r3(mean(b.all)),abstain:r3(mean(b.ref)),
      nRat:b.rat.length,meanRat:r3(mean(b.rat)),abstainRat:r3(mean(b.refRat))}]));
    const P=Object.values(per),hm=f=>r3(mean(P.map(f).filter(v=>v!=null)));
    out[g]={hypMean:hm(p=>p.mean),hypMeanRat:hm(p=>p.meanRat),abstainHypMean:hm(p=>p.abstain),abstainHypMeanRat:hm(p=>p.abstainRat),
      worse:P.filter(p=>p.meanRat-p.abstainRat<-0.05).length,better:P.filter(p=>p.meanRat-p.abstainRat>0.05).length,
      worseAll:P.filter(p=>p.mean-p.abstain<-0.05).length,betterAll:P.filter(p=>p.mean-p.abstain>0.05).length,
      games:X.length,pairedFlips:flip,decisions:dec,rulesFired:X.reduce((s,x)=>s+x.r.decisions.filter(d=>d.status==='rule').length,0),perHyp:per,lossExamples:ex};
  }
  return out;
}
function choose(sum){
  const a=sum.abstain;
  const ok=S.GATES.filter(g=>g!=='abstain'&&sum[g].hypMeanRat>=a.hypMeanRat&&sum[g].worse<=sum[g].better)
    .sort((x,y)=>sum[y].hypMeanRat-sum[x].hypMeanRat||sum[x].rulesFired-sum[y].rulesFired);
  return {gate:ok[0]||'abstain',eligible:ok,rule:'max rational 22-hyp mean among gates with mean >= abstain and worse<=better (|diff|>0.05); none -> abstain'};
}

async function main(){
  const sim=load(),dex=sim.Dex.mod('champions');
  const {reportedLive}=require('./reported-live-roster-20261027');
  const {picks,label}=require('./a-preview-matrix-audit');
  const saved=JSON.parse(fs.readFileSync('reports/data/pr82-eval.json','utf8'));
  const savedV3=JSON.parse(fs.readFileSync('reports/data/pr84-reaudit-v3table.json','utf8'));
  const savedHold=JSON.parse(fs.readFileSync('reports/data/pr84-reaudit.json','utf8'));
  const own=reportedLive(),W=Number(process.env.WORKERS||4),PH=new Set((process.env.PHASE||'R,DEV').split(','));
  const validator=sim.TeamValidator.get(FORMAT);
  const CS=E.allCases(),teams=CS.map(c=>c.team);
  for(const c of CS){const p=validator.validateTeam(normalize(c.team));if(p?.length)throw Error(c.six+'/'+c.hyp+': '+p.join('; '));}
  const O=picks(own),pickOf=l=>O.find(o=>label(o)===l);
  const T0=Date.now(),lap=s=>console.log(s,Math.round((Date.now()-T0)/1000)+'s');
  const meta=CS.map((c,ci)=>{
    const sc=saved.cases[ci];if(sc.six!==c.six||sc.hyp!==c.hyp)throw Error('case order differs at '+ci);
    const legacy=chooseThree(dex,c.team,own.map(p=>p.species)).map(n=>c.team[n-1].species);
    const hc=savedHold.cases[ci];if(hc.six!==c.six||hc.hyp!==c.hyp)throw Error('hold case order differs at '+ci);
    const used=[...sc.cells.map(x=>x.rival.split('/')),...hc.holdCells.map(x=>x.split(':')[1].split('/'))];
    return {ci,six:c.six,hyp:c.hyp,publicSix:c.team.map(p=>p.species),human1:sc.human1,legacy,ace:c.ace,used,
      cells:sc.cells.map(x=>({src:x.src,foe:x.rival.split('/')}))};
  });
  const cellJobs=(m,cells,seedOf,extra)=>{const out=[];
    cells.forEach(c=>BRANCHES.forEach(branch=>SEEDS.forEach(s=>[false,true].forEach(reverse=>
      out.push({ci:m.ci,team:m.ci,foe:c.foe,cell:c.src,branch,s,seed:seedOf(m.ci,s),reverse,publicSix:m.publicSix,...extra})))));return out;};
  const result={showdown:SHOWDOWN,format:FORMAT,own:'reportedLive (reported-live-roster-20261027.js)',branches:BRANCHES,gates:S.GATES,
    note:'AI vs AI, constructed hypotheses, 2 seeds x 2 sides per cell x branch. NOT a ladder win rate.'};
  let freeze=fs.existsSync(FREEZE)?JSON.parse(fs.readFileSync(FREEZE,'utf8')):null;
  // ---------------- R: rebuild the V3 table through the PR #85 worker ----------------
  if(PH.has('R')){
    const cond=(m,j)=>m.hyp+'|'+j.cell+':'+j.foe.join('/')+'|'+j.branch;
    const byCi=Object.fromEntries(meta.map(m=>[m.ci,m]));
    const j1=meta.flatMap(m=>[-1,0,1,2,3,4,5].flatMap(k=>cellJobs(m,m.cells,trainSeed,{own:pickOf(m.human1),force:{turn:1,k}})));
    const r1=await R84.runGames(own,teams,j1,{workers:W,tables:{v2:{rules:{}}}});lap('R stage1 '+j1.length);
    const g1=j1.map((j,k)=>({key:r1[k].rec.obs3[1],label:r1[k].rec.forced[1],cond:cond(byCi[j.ci],j),won:r1[k].won})).filter(g=>g.key&&g.label);
    const t1=M.buildTable(g1);
    const j2=meta.flatMap(m=>[-1,0,1,2,3,4,5].flatMap(k=>cellJobs(m,m.cells,trainSeed,{own:pickOf(m.human1),entry:'t1',force:{turn:2,k},v3:true})));
    const r2=await R84.runGames(own,teams,j2,{workers:W,tables:{v3:t1}});lap('R stage2-v3 '+j2.length);
    const g2=j2.map((j,k)=>({key:r2[k].rec.obs3[2],label:r2[k].rec.forced[2],cond:cond(byCi[j.ci],j),won:r2[k].won})).filter(g=>g.key&&g.label);
    const t2=M.buildTable(g2);
    const table={rules:{...t1.rules,...t2.rules},params:t1.params,built:savedV3.built};
    const sig=t=>JSON.stringify(Object.keys(t.rules).sort().map(k=>[k,t.rules[k].status,t.rules[k].action??null]));
    const same=sig(table)===sig(savedV3);
    if(!same)throw Error('rebuilt V3 table differs from saved PR #85 table: stop (no gate from a non-reproduced table)');
    const loco=S.locoKeys([...g1,...g2],savedV3);
    const rules=Object.entries(savedV3.rules).filter(([,r])=>r.status==='rule');
    freeze={showdown:SHOWDOWN,table:'reports/data/pr84-reaudit-v3table.json (rebuilt identical: '+same+')',train:{stage1:j1.length,stage2v3:j2.length},
      rules:rules.length,t1Rules:rules.filter(([k])=>/#T1#/.test(k)).length,locoPass:[...loco.pass].sort(),locoDetail:loco.detail,gate:null};
    result.R={tableRebuiltIdentical:same,rules:rules.length,t1Rules:freeze.t1Rules,locoPass:loco.pass.size,
      locoFailReasons:Object.values(loco.detail).reduce((o,d)=>(inc(o,d.replace(/[:(].*$/,'').trim()),o),{})};
    // saved utility-cause labels vs current utilCause (6 saved examples; the full
    // 77,136-game rerun with the fixed classifier is NOT done here)
    result.R.utilCauseSavedExamples=savedHold.utilityRationalIrrational.examples.map(e=>({move:e.move,saved:e.cause,now:R84.utilCause(e),same:R84.utilCause(e)===e.cause}));
  }
  if(!freeze)throw Error('no '+FREEZE+': run PHASE=R first');
  const table=savedV3,loco=freeze.locoPass;
  const gateRun=async(name,cellsOf,seedBase,gates)=>{
    const seedOf=(ci,s)=>hashSeed(seedBase+ci*100+s),J=[];
    for(const m of meta){m[name]=cellsOf({picks:picks(teams[m.ci]),label,legacy:m.legacy,ace:m.ace,used:m.used});
      for(const g of gates)J.push(...cellJobs(m,m[name],seedOf,{own:pickOf(m.human1),gate:g}));}
    const Rs=await runGames(own,teams,J,{workers:W,table,loco});lap(name+' '+J.length);
    const hk=j=>meta[j.ci].six+'/'+meta[j.ci].hyp;
    return {games:J.length,seeds:'hashSeed('+seedBase+'+ci*100+{0,1}), both sides',
      cells:Object.fromEntries(meta.map(m=>[m.six+'/'+m.hyp,m[name].map(c=>c.src+':'+c.foe.join('/'))])),summary:summarize(J,Rs,gates,hk)};
  };
  if(PH.has('DEV')){
    result.DEV=await gateRun('dev',H.devCells,H.DEV_SEED_BASE,S.GATES);
    result.DEV.choice=choose(result.DEV.summary);
    freeze.gate=result.DEV.choice.gate;freeze.devChoice=result.DEV.choice;
    freeze.devTable=Object.fromEntries(S.GATES.map(g=>[g,{hypMeanRat:result.DEV.summary[g].hypMeanRat,worse:result.DEV.summary[g].worse,better:result.DEV.summary[g].better,rulesFired:result.DEV.summary[g].rulesFired}]));
    fs.writeFileSync(FREEZE,JSON.stringify(freeze,null,1));
  }
  if(PH.has('FINAL')){
    if(!freeze.gate)throw Error('gate not frozen');
    result.frozenGate=freeze.gate;
    result.FINAL=await gateRun('final',H.finalCells,H.FINAL_SEED_BASE,S.GATES);
  }
  if(PH.has('UNSEEN')){
    const U=H.unseenSixesPR86(),G=require('./public-six-general'),out={};
    const gates=['abstain','v3',freeze.gate].filter((v,i,a)=>a.indexOf(v)===i);
    let ui=0;const J=[],uteams=[];
    for(const [id,x] of Object.entries(U)){
      const publicSix=x.hypotheses.a.map(p=>p.species);
      for(const t of Object.values(x.hypotheses)){const p=validator.validateTeam(normalize(t));if(p?.length)throw Error(id+': '+p.join('; '));}
      const t0=Date.now(),lp=await M.livePreview({sim,own,publicSix,seed:hashSeed(H.UNSEEN_SEED_BASE+ui*100),budgetSeconds:0});
      const tLegacy=(Date.now()-t0)/1000;
      const qp=await M.livePreview({sim,own,publicSix,seed:hashSeed(H.UNSEEN_SEED_BASE+ui*100),budgetSeconds:M.QUICK_SECONDS,workers:W});
      const ownLegacy=lp.pick,ownQuick=qp.pick;
      out[id]={publicSix,ace:x.ace,preview:{legacy:{path:lp.path,status:lp.status,cache:lp.cache,pick:ownLegacy,seconds:+tLegacy.toFixed(2),warning:lp.warning??null},
        quick:{path:qp.path,pick:ownQuick,seconds:qp.seconds,games:qp.games,uncertainty:qp.uncertainty}},hyps:{}};
      for(const [k,t] of Object.entries(x.hypotheses)){
        const ti=uteams.push(t)-1;
        const legacy=chooseThree(dex,t,own.map(p=>p.species)).map(n=>t[n-1].species);
        const cells=H.unseenCells({picks:picks(t),label,legacy,ace:x.ace});
        out[id].hyps[k]={rivalLegacy:legacy,cells:cells.map(c=>c.src+':'+c.foe.join('/'))};
        const seedOf=(_,s)=>hashSeed(H.UNSEEN_SEED_BASE+ui*100+s);
        for(const [pk,ownThree] of [['legacy',ownLegacy],['quick',ownQuick]]){
          const gs=pk==='legacy'?gates:['abstain'];
          for(const g of gs)cells.forEach(c=>BRANCHES.forEach(branch=>SEEDS.forEach(s=>[false,true].forEach(reverse=>
            J.push({ci:ui,six:id,hyp:k,team:ti,foe:c.foe,cell:c.src,branch,s,seed:seedOf(ui,s),reverse,publicSix,own:ownThree,pick:pk,gate:g,keepLines:g==='abstain'&&pk==='legacy'&&branch==='ai'&&s===0&&!reverse})))));
        }
      }
      ui++;
    }
    const Rs=await runGames(own,uteams,J,{workers:W,table,loco});lap('unseen '+J.length);
    // identical-game check: every gate game equals its abstain twin (all uncovered)
    const key=j=>[j.six,j.hyp,j.cell,j.branch,j.s,j.reverse,j.pick].join('|'),ref={};
    J.forEach((j,k)=>{if(j.gate==='abstain')ref[key(j)]=Rs[k];});
    const dec={},diff=[];
    J.forEach((j,k)=>{for(const d of Rs[k].decisions)inc(dec,j.gate+':T'+d.turn+':'+d.status);
      if(j.gate!=='abstain'&&(Rs[k].won!==ref[key(j)].won||Rs[k].turns!==ref[key(j)].turns))diff.push(key(j)+'|'+j.gate);});
    for(const [id,o] of Object.entries(out))for(const [k,h] of Object.entries(o.hyps)){
      const X=J.map((j,i)=>({j,r:Rs[i]})).filter(x=>x.j.six===id&&x.j.hyp===k&&x.j.gate==='abstain');
      h.byPick={};
      for(const pk of ['legacy','quick']){const Y=X.filter(x=>x.j.pick===pk);
        const per={};for(const x of Y){(per[x.j.cell]||(per[x.j.cell]={all:[],rat:[]})).all.push(x.r.won);if(rational(x.j,x.r))per[x.j.cell].rat.push(x.r.won);}
        h.byPick[pk]={own:Y[0]?.j.own.join('>'),mean:r3(mean(Y.map(x=>x.r.won))),meanRat:r3(mean(Y.filter(x=>rational(x.j,x.r)).map(x=>x.r.won))),
          zeroCellBranch:Object.entries(Y.reduce((o,x)=>{const c=x.j.cell+'|'+x.j.branch;(o[c]||(o[c]=[])).push(x.r.won);return o;},{})).filter(([,v])=>mean(v)===0).map(([c])=>c),
          byCell:Object.fromEntries(Object.entries(per).map(([c,v])=>[c,{mean:r3(mean(v.all)),meanRat:r3(mean(v.rat))}]))};}
      h.aiLogs=J.map((j,i)=>({j,r:Rs[i]})).filter(x=>x.j.six===id&&x.j.hyp===k&&x.j.keepLines).map(x=>({cell:x.j.cell,won:x.r.won,lines:x.r.lines}));
    }
    result.UNSEEN={games:J.length,gates,decisions:dec,gateDiffersFromAbstain:diff.length,diffExamples:diff.slice(0,5),sixes:out};
  }
  result.seconds=Math.round((Date.now()-T0)/1000);
  const file=process.env.OUT||(PH.has('FINAL')||PH.has('UNSEEN')?'reports/data/pr86-final.json':'reports/data/pr86-dev.json');
  fs.writeFileSync(file,JSON.stringify(result,null,1));
  const brief=x=>x&&Object.fromEntries(Object.entries(x.summary).map(([g,s])=>[g,{hypMeanRat:s.hypMeanRat,abstainRat:s.abstainHypMeanRat,hypMean:s.hypMean,worse:s.worse,better:s.better,flips:s.pairedFlips,fired:s.rulesFired}]));
  console.log(JSON.stringify({R:result.R&&{...result.R,utilCauseSavedExamples:undefined},DEV:brief(result.DEV),choice:result.DEV?.choice,FINAL:brief(result.FINAL),
    UNSEEN:result.UNSEEN&&{decisions:result.UNSEEN.decisions,differ:result.UNSEEN.gateDiffersFromAbstain},seconds:result.seconds},null,1));
}
if(process.argv.includes('--pr86-worker'))workerMain();
else if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={gateScript,summarize,choose};
