#!/usr/bin/env node
'use strict';
// PR #88 P0-2: our 3+lead from the rival PUBLIC six, compared on the same
// rival rational 3+lead cells / seeds / sides / T1-T2 branches:
//   legacy   lab chooseThree (current default)
//   quick    pr82 livePreview quick search pure[0] (PR #86 UNSEEN 'quick')
//   guarded  pr88-guarded-preview (legacy unless a candidate beats it on the
//            same cells by the declared margin)
//   human1   (known sixes only) saved full general-search pure[0] used by PR #86 DEV/FINAL
// Rival cells: holdout-20261031-pr88 rationalCells (rival's own sets vs our
// public six; legacy / view1 / view2 / aceLead / aceBack). Rival T1/T2: pr82-eval
// BRANCHES. Battles: pr86-eval worker (no gate = base AI), pinned Showdown.
// The selectors receive ONLY the six public species strings.
//   PHASE=DEV    known + PR #86 unseen sixes (A, B, C, U1, U2, U3): diagnosis;
//                these are no longer unseen. seeds hashSeed(8710000+..)
//   PHASE=FINAL  holdout-20261031-pr88 F1/F2/F3, run ONCE after the selector is
//                committed. seeds hashSeed(8690000+..)
// Heuristic AI vs heuristic AI, constructed sets. NOT a ladder win rate.
const fs=require('node:fs');
const {load,hashSeed,chooseThree,normalize}=require('./lab');
const M=require('./pr82-switch-utility-t1t2');
const E=require('./pr82-eval');
const P86=require('./pr86-eval');
const H86=require('./holdout-20261031-pr86');
const H=require('./holdout-20261031-pr88');
const GP=require('./pr88-guarded-preview');
const {rivalCandidates}=require('./preview-legal-search');
const {picks,label}=require('./a-preview-matrix-audit');
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',FORMAT='gen9championsbssregmc';
const SEEDS=[0,1];
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const r3=x=>x==null?null:+x.toFixed(3);
function sixesFor(phase){
  if(phase==='FINAL')return Object.entries(H.unseenSixesPR88()).map(([id,x])=>({id,ace:x.ace,hyps:x.hypotheses,human1:null}));
  const saved=JSON.parse(fs.readFileSync('reports/data/pr82-eval.json','utf8'));
  const by={};
  E.allCases().forEach((c,ci)=>{if(!/^(A_golisopod|B_lucarioZ|C_charizard)$/.test(c.six))return;
    const s=by[c.six]||(by[c.six]={id:c.six,ace:c.ace,hyps:{},human1:{}});s.hyps[c.hyp]=c.team;s.human1[c.hyp]=saved.cases[ci].human1;});
  for(const [id,x] of Object.entries(H86.unseenSixesPR86()))by[id]={id,ace:x.ace,hyps:x.hypotheses,human1:null};
  return Object.values(by);
}
async function main(){
  const sim=load(),dex=sim.Dex.mod('champions'),validator=sim.TeamValidator.get(FORMAT);
  const own=require('./reported-live-roster-20261027').reportedLive(),ownSpecies=own.map(p=>p.species);
  const PHASE=process.env.PHASE||'DEV',W=Number(process.env.WORKERS||4);
  const base=PHASE==='FINAL'?H.SEL_FINAL_SEED_BASE:H.SEL_DEV_SEED_BASE;
  const only=process.env.ONLY?new RegExp(process.env.ONLY):null;
  const sixes=sixesFor(PHASE).filter(x=>!only||only.test(x.id));
  const O=picks(own),T0=Date.now(),J=[],teams=[],out={};
  for(const [ui,x] of sixes.entries()){
    const publicSix=Object.values(x.hyps)[0].map(p=>p.species);
    for(const t of Object.values(x.hyps)){if(JSON.stringify(t.map(p=>p.species))!==JSON.stringify(publicSix))throw Error(x.id+' hyps differ in species');
      const p=validator.validateTeam(normalize(t));if(p?.length)throw Error(x.id+': '+p.join('; '));}
    // selectors: public six strings only
    let t0=Date.now();const leg=GP.legacyPick(dex,own,publicSix),tLeg=(Date.now()-t0)/1000;
    const qp=await M.livePreview({sim,own,publicSix:publicSix.slice(),seed:hashSeed(base+ui*100),budgetSeconds:M.QUICK_SECONDS,workers:W});
    const gp=await GP.guardedPreview({sim,own,publicSix:publicSix.slice(),seedBase:H.SEL_SEARCH_SEED_BASE+ui*1000,workers:W});
    const sel={legacy:{pick:leg,seconds:tLeg},quick:{pick:qp.pick,seconds:qp.seconds},
      guarded:{pick:gp.pick,seconds:gp.seconds,status:gp.status,reason:gp.reason,games:gp.games,scores:gp.scores}};
    console.log(x.id,'legacy',leg.join('>'),'quick',qp.pick.join('>'),qp.seconds+'s','guarded',gp.pick.join('>'),gp.seconds+'s',gp.reason);
    out[x.id]={publicSix,ace:x.ace,selection:sel,hyps:{}};
    for(const [k,t] of Object.entries(x.hyps)){
      const ti=teams.push(t)-1;
      const rc=H.rationalCells({dex,team:t,ownSpecies,ace:x.ace,chooseThree,rivalCandidates});
      const ps={legacy:leg,quick:qp.pick,guarded:gp.pick};if(x.human1)ps.human1=x.human1[k].split(/[>/]/);
      out[x.id].hyps[k]={rivalLegacy:rc.legacy,cells:rc.cells.map(c=>c.src+':'+c.foe.join('/')),picks:Object.fromEntries(Object.entries(ps).map(([a,b])=>[a,b.join('>')]))};
      // a pick is played once per distinct own three+lead: identical picks share games
      const distinct=[...new Set(Object.values(ps).map(p=>p.join('>')))];
      for(const pk of distinct)rc.cells.forEach(c=>E.BRANCHES.forEach(branch=>SEEDS.forEach(s=>[false,true].forEach(reverse=>
        J.push({six:x.id,hyp:k,team:ti,own:pk.split('>'),pk,foe:c.foe,cell:c.src,branch,s,seed:hashSeed(base+ui*100+s),reverse,publicSix,
          keepLines:branch==='ai'||branch==='attack'})))));
    }
  }
  const tSel=Math.round((Date.now()-T0)/1000);
  const Rs=await P86.runGames(own,teams,J,{workers:W,table:{rules:{}},loco:[]});
  const tGames=Math.round((Date.now()-T0)/1000)-tSel;
  const res=(six,hyp,pk)=>J.map((j,i)=>({j,r:Rs[i]})).filter(x=>x.j.six===six&&x.j.hyp===hyp&&x.j.pk===pk);
  const summary={};
  for(const [id,o] of Object.entries(out))for(const [k,h] of Object.entries(o.hyps)){
    h.byPolicy={};
    for(const [pol,pk] of Object.entries(h.picks)){
      const X=res(id,k,pk),rat=X.filter(x=>P86.rational(x.j,x.r));
      const cell={};for(const x of rat)(cell[x.j.cell]||(cell[x.j.cell]=[])).push(x.r.won);
      const cb={};for(const x of X){const c=x.j.cell+'|'+x.j.branch;(cb[c]||(cb[c]=[])).push(x.r.won);}
      h.byPolicy[pol]={pick:pk,mean:r3(mean(X.map(x=>x.r.won))),meanRat:r3(mean(rat.map(x=>x.r.won))),nRat:rat.length,
        worstCellRat:r3(Math.min(...Object.values(cell).map(mean))),byCellRat:Object.fromEntries(Object.entries(cell).map(([c,v])=>[c,r3(mean(v))])),
        zeroCellBranch:Object.entries(cb).filter(([,v])=>mean(v)===0).map(([c])=>c)};
      (summary[pol]||(summary[pol]=[])).push({h:id+'/'+k,meanRat:h.byPolicy[pol].meanRat,worstCellRat:h.byPolicy[pol].worstCellRat});
    }
    // small battle logs: worst cell of each policy, ai branch, seed 0, both sides
    h.logs={};
    for(const [pol,pk] of Object.entries(h.picks)){
      const worst=Object.entries(h.byPolicy[pol].byCellRat).sort((a,b)=>a[1]-b[1])[0]?.[0];
      h.logs[pol]=res(id,k,pk).filter(x=>x.j.cell===worst&&x.j.branch==='ai'&&x.j.s===0).map(x=>({own:pk,foe:x.j.foe.join('>'),cell:worst,
        seed:x.j.seed,reverse:x.j.reverse,side:x.r.side,won:x.r.won,turns:x.r.turns,requested:x.r.requested,lines:(x.r.lines||[]).slice(0,30)}));
    }
  }
  const agg=Object.fromEntries(Object.entries(summary).map(([p,v])=>[p,{hyps:v.length,meanRat:r3(mean(v.map(x=>x.meanRat))),worstCellMean:r3(mean(v.map(x=>x.worstCellRat))),
    perHyp:Object.fromEntries(v.map(x=>[x.h,x.meanRat]))}]));
  const result={showdown:SHOWDOWN,format:FORMAT,phase:PHASE,seedBase:base,own:'reportedLive',branches:E.BRANCHES,games:J.length,
    seconds:{selection:tSel,games:tGames},summary:agg,sixes:out,
    note:'Selectors see only the six public species strings. Rival 3+lead from the rival view (its own sets). AI vs AI, NOT a ladder win rate.'};
  const file=process.env.OUT||'reports/data/pr88-selection-'+PHASE.toLowerCase()+'.json';
  fs.writeFileSync(file,JSON.stringify(result,null,1));
  console.log(JSON.stringify({summary:Object.fromEntries(Object.entries(agg).map(([p,a])=>[p,{meanRat:a.meanRat,worstCellMean:a.worstCellMean,perHyp:a.perHyp}])),seconds:result.seconds,games:J.length},null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={sixesFor};
