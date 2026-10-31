#!/usr/bin/env node
'use strict';
// PR #94: compare legacy / quick / v2 (#91) / pr93 (+T1T2) / pr94 (+T1T2) on
// the SAME rival 3+lead cells, rival T1/T2 branches and seeds, under TWO rival
// models (holdout-20261031-pr94: 'rational' = pr92 rationalCellsPR92, 'tm' =
// the independent type-matchup model).
//   seeds   one per (six, hyp, model, cell, branch, s), s = 0..3, one side
//           each (reverse = s%2). Same-seed left/right is a separate check on
//           s = 0 (paired agreement), never pooled into n.
//   metric  meanRat94 (rational94 = pr86 rational AND no rival T1/T2 attack
//           into a public immunity); the old pr86 meanRat is also reported.
// Every selector receives ONLY the six public species strings.
//   PHASE=DEV    A/C/F2/F3 (pr92 devSixes) + N1/N2 (PR #93 FINAL, now DEV).
//                legacy/quick/v2/pr93 picks and the pr93 T1/T2 tables are the
//                SAVED ones (reports/data/pr92-eval-*.json); pr94 is run with
//                both decisions ('cvar', 'floor') to apply the freeze rule.
//   PHASE=FINAL  N3/N4 (predeclared bcc4b9e), run ONCE, every selector run.
// Heuristic AI vs heuristic AI on constructed sets. NOT a ladder win rate.
const fs=require('node:fs');
const {load,hashSeed,chooseThree,normalize}=require('./lab');
const E=require('./pr82-eval');
const M=require('./pr82-switch-utility-t1t2');
const GP=require('./pr88-guarded-preview');
const V2=require('./pr90-guarded-preview-v2');
const P92=require('./pr92-rational-cover-preview');
const T92=require('./pr92-t1t2');
const P86=require('./pr86-eval');
const H=require('./holdout-20261031-pr94');
const H92=require('./holdout-20261031-pr92');
const C=require('./pr94-cover-preview');
const T=require('./pr94-t1t2');
const {rivalCandidates}=require('./preview-legal-search');
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',FORMAT='gen9championsbssregmc';
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null,r3=x=>x==null?null:+x.toFixed(3);
const pk=p=>Array.isArray(p)?p.join('>'):p.replace(/\//g,'>');
const MODELS=['rational','tm'];
function devSixes(){
  const P92E=require('./pr92-eval');
  const dev=JSON.parse(fs.readFileSync('reports/data/pr92-eval-dev-rational.json','utf8')).sixes;
  const fin=JSON.parse(fs.readFileSync('reports/data/pr92-eval-final.json','utf8')).sixes;
  const out=P92E.devSixes().map(x=>({id:x.id,ace:x.ace,hyps:x.hyps,saved:{legacy:x.saved.legacy,quick:x.saved.quick,v2:x.saved.v2,pr93:dev[x.id].selection.proposed},table92:dev[x.id].t1t2?.table||null}));
  for(const [id,x] of Object.entries(H92.unseenSixesPR92()))
    out.push({id,ace:x.ace,hyps:x.hypotheses,saved:{legacy:fin[id].selection.legacy,quick:fin[id].selection.quick,v2:fin[id].selection.v2,pr93:fin[id].selection.proposed},table92:fin[id].t1t2?.table||null});
  return out;
}
function finalSixes(){return Object.entries(H.unseenSixesPR94()).map(([id,x])=>({id,ace:x.ace,hyps:x.hypotheses,saved:null,table92:null}));}
function cellsFor(model,{dex,team,ownSpecies,ace}){
  if(model==='rational')return H92.rationalCellsPR92({dex,team,ownSpecies,ace,chooseThree,rivalCandidates}).cells;
  return H.tmCells({dex,team,ownSpecies,ace}).cells;
}
function clusterSE(byCell){const v=Object.values(byCell).filter(x=>x!=null);if(v.length<2)return null;const m=mean(v);
  return Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1)/v.length);}
async function main(){
  const sim=load(),dex=sim.Dex.mod('champions'),validator=sim.TeamValidator.get(FORMAT);
  const own=require('./reported-live-roster-20261027').reportedLive(),ownSpecies=own.map(p=>p.species);
  const PHASE=process.env.PHASE||'DEV',W=Number(process.env.WORKERS||4);
  const only=process.env.ONLY?new RegExp(process.env.ONLY):null;
  const sixes=(PHASE==='FINAL'?finalSixes():devSixes()).filter(x=>!only||only.test(x.id));
  const evalBase=PHASE==='FINAL'?H.FINAL_SEED_BASE:H.DEV_SEED_BASE,selBase=PHASE==='FINAL'?H.SEARCH_SEED_BASE:H.DEV_SEARCH_BASE;
  const frozen=process.env.DECISION||null;// FINAL: the frozen decision (required)
  if(PHASE==='FINAL'&&!['cvar','floor'].includes(frozen))throw Error('FINAL needs DECISION=cvar|floor (frozen on DEV)');
  const out={},J=[],teams=[],T0=Date.now();
  for(const [ui,x] of sixes.entries()){
    const publicSix=Object.values(x.hyps)[0].map(p=>p.species);
    for(const t of Object.values(x.hyps)){if(JSON.stringify(t.map(p=>p.species))!==JSON.stringify(publicSix))throw Error(x.id+' hyps differ');
      const p=validator.validateTeam(normalize(t));if(p?.length)throw Error(x.id+': '+p.join('; '));}
    const sel={},sec={},plans={};
    let table92=x.table92;
    if(x.saved)Object.assign(sel,x.saved);
    else{
      let t0=Date.now();sel.legacy=pk(GP.legacyPick(dex,own,publicSix.slice()));sec.legacy=(Date.now()-t0)/1000;
      const qp=await M.livePreview({sim,own,publicSix:publicSix.slice(),seed:hashSeed(selBase+ui*100),budgetSeconds:M.QUICK_SECONDS,workers:W});sel.quick=pk(qp.pick);sec.quick=qp.seconds;
      const v=await V2.guardedPreviewHard({dex,own,publicSix:publicSix.slice(),seedBase:selBase+ui*1000,workers:W,budgetSeconds:120});sel.v2=pk(v.pick);sec.v2=v.seconds;
      const c93=await P92.coverPreviewHard({dex,own,publicSix:publicSix.slice(),seedBase:selBase+ui*1000,workers:W,budgetSeconds:300,opts:{cellRule:P92.FROZEN.cellRule}});
      sel.pr93=pk(c93.pick);sec.pr93=c93.seconds;
      if(c93._teams){const tt=await T92.buildT1T2({sim,own,pick:c93.pick,teams:c93._teams,cells:c93._cells,seedBase:selBase+5000+ui*1000,workers:W});table92=tt.table;sec.pr93T1T2=tt.seconds;}
    }
    // pr94: one selector run; the decision is applied to the same guard scores
    let t0=Date.now();
    const c94=await C.coverPreview94({sim,own,publicSix:publicSix.slice(),seedBase:selBase+ui*1000,workers:W,budgetSeconds:300});
    sec.pr94=+((Date.now()-t0)/1000).toFixed(1);
    const decisions={};
    for(const d of ['cvar','floor']){
      const r=c94.status==='abstain'?{pick:c94.label,reason:c94.reason}:C.decidePR94(c94.scores,{...C.COVER94,decision:d});
      decisions[d]={pick:pk(r.pick),reason:r.reason};}
    const t94={},rules94={};
    for(const d of (PHASE==='FINAL'?[frozen]:['cvar','floor'])){
      const p=decisions[d].pick;sel['pr94'+d]=p;
      if(!t94[p]&&c94._teams){t0=Date.now();const tt=await T.buildT1T2({sim,own,pick:p.split('>'),teams:c94._teams,cells:c94._cells,seedBase:selBase+5000+ui*1000,workers:W});
        t94[p]=tt;sec['pr94T1T2:'+p]=tt.seconds;rules94[p]={rules:T.humanRules(tt.table),nRules:tt.rules,keys:tt.keys,games:tt.games,seconds:tt.seconds};}
    }
    console.log(x.id,JSON.stringify(sel),JSON.stringify(sec));
    for(const [k,v] of Object.entries(sel))plans[k]={pick:v,plan:{}};
    if(table92)plans.pr93T1T2={pick:sel.pr93,plan:{table92}};
    for(const d of (PHASE==='FINAL'?[frozen]:['cvar','floor']))if(t94[sel['pr94'+d]])plans['pr94'+d+'T1T2']={pick:sel['pr94'+d],plan:{table:t94[sel['pr94'+d]].table}};
    const {_teams,_cells,...c94Out}=c94;
    out[x.id]={publicSix,ace:x.ace,selection:sel,selectorSeconds:sec,pr94:{...c94Out,decisions},t1t2:rules94,hyps:{}};
    const distinct=new Map();for(const [pol,v] of Object.entries(plans)){const key=v.pick+'#'+JSON.stringify(v.plan);(distinct.get(key)||distinct.set(key,{...v,pols:[]}).get(key)).pols.push(pol);}
    Object.entries(x.hyps).forEach(([k,t],hi)=>{
      const ti=teams.push(t)-1;out[x.id].hyps[k]={cells:{}};
      MODELS.forEach((model,mi)=>{
        const cells=cellsFor(model,{dex,team:t,ownSpecies,ace:x.ace});
        out[x.id].hyps[k].cells[model]=cells.map(c=>c.src+':'+c.foe.join('/'));
        for(const [key,v] of distinct)cells.forEach((c,ci)=>E.BRANCHES.forEach((branch,bi)=>H.SEEDS.forEach(s=>{
          const base={six:x.id,hyp:k,model,key,pols:v.pols,team:ti,own:v.pick.split('>'),foe:c.foe,cell:c.src,branch,s,plan:v.plan,ace:x.ace,keepLines:branch==='ai'&&s===0};
          J.push({...base,seed:H.evalSeed(evalBase,ui,hi,mi,ci,bi,s),reverse:H.sideOf(s)});
          if(s===0)J.push({...base,pairedOnly:true,keepLines:false,seed:H.evalSeed(evalBase,ui,hi,mi,ci,bi,s),reverse:!H.sideOf(s)});
        })));
      });
    });
  }
  const tSel=Math.round((Date.now()-T0)/1000);
  const Rs=await T.runGames94(own,teams,J,{workers:W});
  const tGames=Math.round((Date.now()-T0)/1000)-tSel;
  const R=J.map((j,i)=>({j,r:Rs[i]}));
  const seeds=new Set(J.filter(j=>!j.pairedOnly).map(j=>String(j.seed)));
  const summary={};
  for(const [id,o] of Object.entries(out))for(const [k,h] of Object.entries(o.hyps)){
    h.byModel={};
    for(const model of MODELS){
      const hm=h.byModel[model]={};
      const pols=[...new Set(J.filter(j=>j.six===id&&j.hyp===k&&j.model===model).flatMap(j=>j.pols))];
      for(const pol of pols){
        const X=R.filter(z=>z.j.six===id&&z.j.hyp===k&&z.j.model===model&&z.j.pols.includes(pol)&&!z.j.pairedOnly);
        const rat=X.filter(z=>C.rational94(z.j,z.r)),old=X.filter(z=>P86.rational(z.j,z.r));
        const cell={};for(const z of rat)(cell[z.j.cell]||(cell[z.j.cell]=[])).push(z.r.won);
        const byCell=Object.fromEntries(Object.entries(cell).map(([c,v])=>[c,mean(v)]));
        const worst=Object.entries(byCell).sort((a,b)=>a[1]-b[1])[0];
        const pair=R.filter(z=>z.j.pairedOnly&&z.j.six===id&&z.j.hyp===k&&z.j.model===model&&z.j.pols.includes(pol));
        const pairAgree=pair.map(z=>{const m=X.find(y=>y.j.s===0&&y.j.cell===z.j.cell&&y.j.branch===z.j.branch);return m?m.r.won===z.r.won:null;}).filter(v=>v!=null);
        hm[pol]={pick:X[0].j.own.join('>'),plan:X[0].j.plan.table?'pr94T1T2':X[0].j.plan.table92?'pr93T1T2':'ai',
          meanRat94:r3(mean(rat.map(z=>z.r.won))),nRat94:rat.length,n:X.length,seCell:r3(clusterSE(byCell)),
          worstCellRat94:r3(worst?worst[1]:null),worstCell:worst?worst[0]:null,byCellRat94:Object.fromEntries(Object.entries(byCell).map(([c,v])=>[c,r3(v)])),
          meanRatOld:r3(mean(old.map(z=>z.r.won))),nRatOld:old.length,publicImmuneGames:X.filter(z=>(z.r.immune||[]).length).length,
          aceBrought:r3(mean(X.map(z=>z.j.foe.includes(z.j.ace)?1:0))),aceBroughtRat94:r3(mean(rat.filter(z=>z.j.foe.includes(z.j.ace)).map(z=>z.r.won))),
          sameSeedSidesAgree:r3(mean(pairAgree.map(v=>v?1:0))),sameSeedPairs:pairAgree.length,
          use:X[0].j.plan.table?T.useSummary(X.map(z=>z.r)):X[0].j.plan.table92?{T1:X.filter(z=>z.r.used?.[1]&&!String(z.r.used[1]).startsWith('unavailable')).length,T2:X.filter(z=>z.r.used?.[2]&&!String(z.r.used[2]).startsWith('unavailable')).length,n:X.length}:undefined,
          lossLines:X.filter(z=>z.j.cell===worst?.[0]&&z.j.keepLines&&!z.r.won).slice(0,2).map(z=>({foe:z.j.foe.join('>'),seed:z.j.seed,reverse:z.j.reverse,turns:z.r.turns,keys:z.r.keys,used:z.r.used,immune:z.r.immune,lines:(z.r.lines||[]).slice(0,22)}))};
        (summary[model+':'+pol]||(summary[model+':'+pol]=[])).push({h:id+'/'+k,m:hm[pol].meanRat94,w:hm[pol].worstCellRat94});
      }
    }
  }
  const agg=Object.fromEntries(Object.entries(summary).map(([p,v])=>[p,{hyps:v.length,meanRat94:r3(mean(v.map(x=>x.m))),worstCellMean:r3(mean(v.map(x=>x.w))),zeroWorst:v.filter(x=>x.w===0).length,perHyp:Object.fromEntries(v.map(x=>[x.h,[x.m,x.w]]))}]));
  let freeze=null,verdict=null;
  if(PHASE==='DEV'){const a=agg['rational:pr94cvar']?.meanRat94??-1,b=agg['rational:pr94floor']?.meanRat94??-1;
    freeze={rule:'higher DEV mean meanRat94 (rational model); tie -> floor',cvar:a,floor:b,frozen:a>b?'cvar':'floor'};}
  if(PHASE==='FINAL'){
    const pol='pr94'+frozen,polT=pol+'T1T2',fails=[];
    for(const [id,o] of Object.entries(out))for(const [k,h] of Object.entries(o.hyps))for(const model of MODELS){const b=h.byModel[model];
      for(const p of [pol,polT]){const x=b[p];if(!x)continue;
        if(x.worstCellRat94===0)fails.push(p+' '+id+'/'+k+'/'+model+': worstCellRat94 0 ('+x.worstCell+')');
        const ref=Math.max(b.legacy.meanRat94,b.v2.meanRat94,b.pr93.meanRat94);if(x.meanRat94<ref-0.10-1e-9)fails.push(p+' '+id+'/'+k+'/'+model+': meanRat94 '+x.meanRat94+' < max(legacy,v2,pr93) '+ref+' - 0.10');}}
    const t2=R.filter(z=>!z.j.pairedOnly&&z.j.pols.includes(polT)&&String(z.r.used?.[2]).startsWith('rule:')).length;
    if(!t2)fails.push(polT+': 0 forced T2 rules over all FINAL evaluation battles');
    verdict={rule:'holdout-20261031-pr94 item 7',fails,pass:!fails.length,t2Forced:t2,
      t1Forced:R.filter(z=>!z.j.pairedOnly&&z.j.pols.includes(polT)&&String(z.r.used?.[1]).startsWith('rule:')).length};
  }
  const result={showdown:SHOWDOWN,format:FORMAT,phase:PHASE,decision:frozen,evalSeedBase:evalBase,selectorSeedBase:selBase,seeds:H.SEEDS,
    sides:'one side per seed (reverse = s%2); same-seed opposite side only as pairedOnly on s=0',distinctEvalSeeds:seeds.size,
    own:'reportedLive',branches:E.BRANCHES,models:MODELS,games:J.length,seconds:{selectionAndTables:tSel,evalGames:tGames},
    msPerGame:r3(mean(Rs.map(r=>r.ms))),summary:agg,freeze,verdict,sixes:out,
    note:'Selectors see only the six public species strings; T1/T2 tables are built from selector public-derived scenarios and executed against the real sets. AI vs AI, NOT a ladder win rate.'};
  const file=process.env.OUT||'reports/data/pr94-eval-'+PHASE.toLowerCase()+'.json';
  fs.writeFileSync(file,JSON.stringify(result,null,1));
  console.log(JSON.stringify({summary:Object.fromEntries(Object.entries(agg).map(([p,v])=>[p,[v.meanRat94,v.worstCellMean,v.zeroWorst]])),freeze,verdict,seconds:result.seconds,games:J.length,distinctEvalSeeds:seeds.size},null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={devSixes,finalSixes,cellsFor};
