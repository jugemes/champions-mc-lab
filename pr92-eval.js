#!/usr/bin/env node
'use strict';
// PR #92: compare legacy / quick / guarded (#89 pr88) / v2 (#91 pr90) /
// proposed (pr92 cover) and proposed + T1/T2 table on the SAME rival rational
// 3+lead cells, rival T1/T2 branches and seeds (holdout-20261031-pr92):
//   cells   rationalCellsPR92 (pr88 rule + view3) from the RIVAL's view
//   branch  pr82-eval BRANCHES; rational = pr86-eval rational()
//   seeds   4 independent seeds per (cell, branch), ONE side each (n = seeds)
// Every selector receives ONLY the six public species strings.
//   PHASE=DEV    A (H0/H1/H2), C (X/Y), F2 (a/b), F3 (a): diagnosis / dev,
//                NOT unseen. legacy/quick/guarded/v2 picks = the saved
//                pr88/pr90 picks (selectors not re-run); proposed is run.
//                eval seeds hashSeed(9420000+ui*100+s), selector 9430000+ui*1000.
//   PHASE=FINAL  N1/N2 (predeclared 1910153), run ONCE; every selector is run
//                (timed); selector seeds 9410000+ui*1000, T1/T2 9415000+ui*1000,
//                eval seeds hashSeed(9400000+ui*100+s).
// Heuristic AI vs heuristic AI on constructed sets. NOT a ladder win rate.
const fs=require('node:fs');
const {load,hashSeed,chooseThree,normalize}=require('./lab');
const E=require('./pr82-eval');
const P86=require('./pr86-eval');
const M=require('./pr82-switch-utility-t1t2');
const GP=require('./pr88-guarded-preview');
const V2=require('./pr90-guarded-preview-v2');
const H=require('./holdout-20261031-pr92');
const H88=require('./holdout-20261031-pr88');
const P=require('./pr92-rational-cover-preview');
const T=require('./pr92-t1t2');
const {sixesFor}=require('./pr88-selection-eval');
const {rivalCandidates}=require('./preview-legal-search');
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',FORMAT='gen9championsbssregmc';
const DEV_SELECT_BASE=9430000;
// DEV: COVER=rational -> cellRule 'rational' (development variant, see report).
// FINAL: always the FROZEN variant (no env override).
const COVER_OPTS=process.env.PHASE==='FINAL'?{cellRule:P.FROZEN.cellRule}:process.env.COVER==='rational'?{cellRule:'rational'}:{};
const DEV_IDS={A_golisopod:'DEV',C_charizard:'DEV',F2_feraligatr:'FINAL',F3_glimmora:'FINAL'};
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null,r3=x=>x==null?null:+x.toFixed(3);
const pk=p=>Array.isArray(p)?p.join('>'):p.replace(/\//g,'>');
function devSixes(){
  const out=[];
  for(const [id,ph] of Object.entries(DEV_IDS)){
    const x=sixesFor(ph).find(s=>s.id===id),s88=JSON.parse(fs.readFileSync('reports/data/pr88-selection-'+ph.toLowerCase()+'.json','utf8')).sixes[id];
    const s90=JSON.parse(fs.readFileSync('reports/data/pr90-selection-'+ph.toLowerCase()+'.json','utf8')).sixes[id];
    const hyps=id==='F3_glimmora'?{a:x.hyps.a}:x.hyps;
    out.push({id,ace:x.ace,hyps,saved:{legacy:pk(s88.selection.legacy.pick),quick:pk(s88.selection.quick.pick),guarded:pk(s88.selection.guarded.pick),v2:pk(s90.v2.pick)}});
  }
  return out;
}
function finalSixes(){return Object.entries(H.unseenSixesPR92()).map(([id,x])=>({id,ace:x.ace,hyps:x.hypotheses,saved:null}));}
async function main(){
  const sim=load(),dex=sim.Dex.mod('champions'),validator=sim.TeamValidator.get(FORMAT);
  const own=require('./reported-live-roster-20261027').reportedLive(),ownSpecies=own.map(p=>p.species);
  const PHASE=process.env.PHASE||'DEV',W=Number(process.env.WORKERS||4);
  const only=process.env.ONLY?new RegExp(process.env.ONLY):null;
  const sixes=(PHASE==='FINAL'?finalSixes():devSixes()).filter(x=>!only||only.test(x.id));
  const evalBase=PHASE==='FINAL'?H.FINAL_SEED_BASE:H.DEV_SEED_BASE,selBase=PHASE==='FINAL'?H.SEARCH_SEED_BASE:DEV_SELECT_BASE;
  const out={},J=[],teams=[],T0=Date.now();
  for(const [ui,x] of sixes.entries()){
    const publicSix=Object.values(x.hyps)[0].map(p=>p.species);
    for(const t of Object.values(x.hyps)){if(JSON.stringify(t.map(p=>p.species))!==JSON.stringify(publicSix))throw Error(x.id+' hyps differ');
      const p=validator.validateTeam(normalize(t));if(p?.length)throw Error(x.id+': '+p.join('; '));}
    // ---- selectors: the six public species strings only ----
    const sel={},sec={};
    if(x.saved)Object.assign(sel,x.saved);
    else{
      let t0=Date.now();sel.legacy=pk(GP.legacyPick(dex,own,publicSix.slice()));sec.legacy=(Date.now()-t0)/1000;
      const qp=await M.livePreview({sim,own,publicSix:publicSix.slice(),seed:hashSeed(selBase+ui*100),budgetSeconds:M.QUICK_SECONDS,workers:W});sel.quick=pk(qp.pick);sec.quick=qp.seconds;
      const g=await GP.guardedPreview({sim,own,publicSix:publicSix.slice(),seedBase:selBase+ui*1000,workers:W});sel.guarded=pk(g.pick);sec.guarded=g.seconds;
      const v=await V2.guardedPreviewHard({dex,own,publicSix:publicSix.slice(),seedBase:selBase+ui*1000,workers:W,budgetSeconds:120});sel.v2=pk(v.pick);sec.v2=v.seconds;
    }
    const cp=await P.coverPreviewHard({dex,own,publicSix:publicSix.slice(),seedBase:selBase+ui*1000,workers:W,budgetSeconds:300,opts:COVER_OPTS});
    sel.proposed=pk(cp.pick);sec.proposed=cp.seconds;
    let tt=null;
    if(cp._teams){tt=await T.buildT1T2({sim,own,pick:cp.pick,teams:cp._teams,cells:cp._cells,seedBase:selBase+5000+ui*1000,workers:W});}
    console.log(x.id,JSON.stringify(sel),JSON.stringify(sec),'T1T2',tt?tt.seconds+'s '+Object.values(tt.table).filter(a=>a!=='ai').length+' forced rules':'none');
    const {_teams,_cells,...cpOut}=cp;
    out[x.id]={publicSix,ace:x.ace,selection:sel,selectorSeconds:sec,proposed:cpOut,t1t2:tt?{table:tt.table,rules:T.humanRules(tt.table,tt.stats),stats:tt.stats,games:tt.games,seconds:tt.seconds}:null,hyps:{}};
    // ---- evaluation on the rival's real sets (never shown to a selector) ----
    const plans={...Object.fromEntries(Object.entries(sel).map(([k,v])=>[k,{pick:v,plan:{}}]))};
    if(tt)plans.proposedT1T2={pick:sel.proposed,plan:{table:tt.table}};
    for(const [k,t] of Object.entries(x.hyps)){
      const ti=teams.push(t)-1;
      const rc=H.rationalCellsPR92({dex,team:t,ownSpecies,ace:x.ace,chooseThree,rivalCandidates});
      out[x.id].hyps[k]={rivalLegacy:rc.legacy,cells:rc.cells.map(c=>c.src+':'+c.foe.join('/'))};
      // identical (pick, plan) share games
      const distinct=new Map();for(const [pol,v] of Object.entries(plans)){const key=v.pick+'#'+JSON.stringify(v.plan);(distinct.get(key)||distinct.set(key,{...v,pols:[]}).get(key)).pols.push(pol);}
      for(const [key,v] of distinct)rc.cells.forEach(c=>E.BRANCHES.forEach(branch=>H.SEEDS.forEach(s=>
        J.push({six:x.id,hyp:k,key,pols:v.pols,team:ti,own:v.pick.split('>'),foe:c.foe,cell:c.src,branch,s,seed:hashSeed(evalBase+ui*100+s),reverse:H.sideOf(s),
          plan:v.plan,ace:x.ace,keepLines:branch==='ai'||branch==='attack'}))));
    }
  }
  const tSel=Math.round((Date.now()-T0)/1000);
  const Rs=await T.runGamesPR92(own,teams,J,{workers:W});
  const tGames=Math.round((Date.now()-T0)/1000)-tSel;
  const summary={};
  for(const [id,o] of Object.entries(out))for(const [k,h] of Object.entries(o.hyps)){
    h.byPolicy={};
    const pols=[...new Set(J.filter(j=>j.six===id&&j.hyp===k).flatMap(j=>j.pols))];
    for(const pol of pols){
      const X=J.map((j,i)=>({j,r:Rs[i]})).filter(z=>z.j.six===id&&z.j.hyp===k&&z.j.pols.includes(pol));
      const rat=X.filter(z=>P86.rational(z.j,z.r));
      const cell={};for(const z of rat)(cell[z.j.cell]||(cell[z.j.cell]=[])).push(z.r.won);
      // independent n: one game per (cell, branch, seed); side is fixed by seed
      const aceCells=rat.filter(z=>z.j.foe.includes(z.j.ace)),noAce=rat.filter(z=>!z.j.foe.includes(z.j.ace));
      const worstCell=Object.entries(cell).map(([c,v])=>[c,mean(v)]).sort((a,b)=>a[1]-b[1])[0];
      h.byPolicy[pol]={pick:X[0].j.own.join('>'),plan:X[0].j.plan.table?'T1T2':'ai',meanRat:r3(mean(rat.map(z=>z.r.won))),nRat:rat.length,
        worstCellRat:r3(worstCell?worstCell[1]:null),worstCell:worstCell?worstCell[0]:null,
        byCellRat:Object.fromEntries(Object.entries(cell).map(([c,v])=>[c,r3(mean(v))])),
        aceBroughtRat:r3(mean(aceCells.map(z=>z.r.won))),aceAbsentRat:r3(mean(noAce.map(z=>z.r.won))),
        tableUse:pol==='proposedT1T2'?{T1:X.filter(z=>z.r.used[1]&&!String(z.r.used[1]).startsWith('unavailable')).length,T2:X.filter(z=>z.r.used[2]&&!String(z.r.used[2]).startsWith('unavailable')).length,n:X.length}:undefined,
        lossLines:X.filter(z=>z.j.cell===worstCell?.[0]&&z.j.branch==='ai'&&z.j.s===0).map(z=>({foe:z.j.foe.join('>'),seed:z.j.seed,reverse:z.j.reverse,won:z.r.won,turns:z.r.turns,aceMega:z.r.aceMega,keys:z.r.keys,used:z.r.used,lines:(z.r.lines||[]).slice(0,24)}))};
      (summary[pol]||(summary[pol]=[])).push({h:id+'/'+k,meanRat:h.byPolicy[pol].meanRat,worstCellRat:h.byPolicy[pol].worstCellRat});
    }
  }
  const agg=Object.fromEntries(Object.entries(summary).map(([p,v])=>[p,{hyps:v.length,meanRat:r3(mean(v.map(x=>x.meanRat))),worstCellMean:r3(mean(v.map(x=>x.worstCellRat))),
    zeroWorstCells:v.filter(x=>x.worstCellRat===0).length,perHyp:Object.fromEntries(v.map(x=>[x.h,[x.meanRat,x.worstCellRat]]))}]));
  // predeclared verdict rule (holdout-20261031-pr92 item 6), FINAL only
  let verdict=null;
  if(PHASE==='FINAL'){
    // the declared rule is on 'proposed' (pick, base AI play); the same rule
    // is also reported for 'proposedT1T2' (pick + T1/T2 table).
    verdict={rule:'NOT READY if any FINAL hyp: proposed worstCellRat = 0, or meanRat < max(legacy,v2) - 0.15'};
    for(const pol of ['proposed','proposedT1T2']){const fails=[];
      for(const [id,o] of Object.entries(out))for(const [k,h] of Object.entries(o.hyps)){const b=h.byPolicy,pr=b[pol];if(!pr)continue;
        if(pr.worstCellRat===0)fails.push(id+'/'+k+': worstCellRat 0 ('+pr.worstCell+')');
        const ref=Math.max(b.legacy.meanRat,b.v2.meanRat);if(pr.meanRat<ref-0.15)fails.push(id+'/'+k+': meanRat '+pr.meanRat+' < max(legacy,v2) '+ref+' - 0.15');}
      verdict[pol]={fails,pass:!fails.length};}
  }
  const result={showdown:SHOWDOWN,format:FORMAT,phase:PHASE,coverOpts:COVER_OPTS,evalSeedBase:evalBase,selectorSeedBase:selBase,seeds:H.SEEDS,sides:'one side per seed (reverse = s%2)',
    own:'reportedLive',branches:E.BRANCHES,games:J.length,seconds:{selectionAndTables:tSel,evalGames:tGames},summary:agg,verdict,sixes:out,
    note:'Selectors see only the six public species strings; T1/T2 tables are built from the selector public-derived scenarios and executed against the real sets. AI vs AI, NOT a ladder win rate.'};
  const file=process.env.OUT||'reports/data/pr92-eval-'+PHASE.toLowerCase()+'.json';
  fs.writeFileSync(file,JSON.stringify(result,null,1));
  console.log(JSON.stringify({summary:agg,verdict,seconds:result.seconds,games:J.length},null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={devSixes,finalSixes};
