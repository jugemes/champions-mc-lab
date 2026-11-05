#!/usr/bin/env node
'use strict';
// PR #90 request P0-2: is a weak hypothesis (A/H0, A/H2, C/X, C/Y, F2/a, F3/a)
// a SELECTOR failure or a ROSTER limit? POST-HOC diagnosis, NOT a selector:
// every own 3+lead (60) is played on the SAME rival rational cells / branches /
// seeds / sides as pr88-selection-eval (same seed bases), so the saved legacy /
// quick / guarded numbers reproduce, and the best own pick is an upper bound
// that USES the rival's real sets (hidden at preview). It must not be used to
// choose a pick or to tune a selector; FINAL sixes stay FINAL.
// FRESH=1: replay only the saved top-5 (+ the pr88 guarded pick) of each
// hypothesis on NEW seeds (FRESH_SEED_BASE) to measure the max-of-60 winner's
// curse; writes reports/data/pr90-ceiling-fresh.json.
// Heuristic AI vs heuristic AI on constructed sets. NOT a ladder win rate.
const FRESH=process.env.FRESH==='1',FRESH_SEED_BASE=9200000;
const fs=require('node:fs');
const {load,hashSeed,chooseThree}=require('./lab');
const E=require('./pr82-eval');
const P86=require('./pr86-eval');
const H=require('./holdout-20261031-pr88');
const {sixesFor}=require('./pr88-selection-eval');
const {rivalCandidates}=require('./preview-legal-search');
const {picks,label}=require('./a-preview-matrix-audit');
const TARGET={DEV:{A_golisopod:['H0','H2'],C_charizard:['X','Y']},FINAL:{F2_feraligatr:['a'],F3_glimmora:['a']}};
const same=(a,b)=>{const x=a.split(/[>/]/),y=b.split(/[>/]/);return x[0]===y[0]&&x.slice().sort().join()===y.slice().sort().join();};
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null,r3=x=>x==null?null:+x.toFixed(3);
async function main(){
  const sim=load(),dex=sim.Dex.mod('champions'),own=require('./reported-live-roster-20261027').reportedLive(),ownSpecies=own.map(p=>p.species);
  const W=Number(process.env.WORKERS||4),O=picks(own),out={},T0=Date.now();
  for(const PHASE of ['DEV','FINAL']){
    const base=FRESH?FRESH_SEED_BASE+(PHASE==='FINAL'?50000:0):PHASE==='FINAL'?H.SEL_FINAL_SEED_BASE:H.SEL_DEV_SEED_BASE;
    const prev=FRESH?JSON.parse(fs.readFileSync('reports/data/pr90-ceiling.json','utf8')).results:null;
    const saved=JSON.parse(fs.readFileSync('reports/data/pr88-selection-'+PHASE.toLowerCase()+'.json','utf8'));
    for(const [ui,x] of sixesFor(PHASE).entries()){
      if(!TARGET[PHASE][x.id])continue;
      for(const k of TARGET[PHASE][x.id]){
        const t=x.hyps[k],rc=H.rationalCells({dex,team:t,ownSpecies,ace:x.ace,chooseThree,rivalCandidates});
        const J=[];
        const keep=prev?new Set([...prev[x.id+'/'+k].top5.map(r=>r.label),label(O.find(p=>same(label(p),saved.sixes[x.id].hyps[k].picks.guarded)))]):null;
        for(const pk of O.filter(p=>!keep||keep.has(label(p))))rc.cells.forEach(c=>E.BRANCHES.forEach(branch=>[0,1].forEach(s=>[false,true].forEach(reverse=>
          J.push({pk:label(pk),team:0,own:pk,foe:c.foe,cell:c.src,branch,s,seed:hashSeed(base+ui*100+s),reverse,publicSix:t.map(p=>p.species)})))));
        const R=await P86.runGames(own,[t],J,{workers:W,table:{rules:{}},loco:[]});
        const rows=O.filter(p=>!keep||keep.has(label(p))).map(pk=>{const L=label(pk),X=J.map((j,i)=>({j,r:R[i]})).filter(z=>z.j.pk===L),rat=X.filter(z=>P86.rational(z.j,z.r));
          const cell={};for(const z of rat)(cell[z.j.cell]||(cell[z.j.cell]=[])).push(z.r.won);
          return {label:L,meanRat:r3(mean(rat.map(z=>z.r.won))),worstCellRat:r3(Math.min(...Object.values(cell).map(mean))),
            byCellRat:Object.fromEntries(Object.entries(cell).map(([c,v])=>[c,r3(mean(v))]))};}).sort((a,b)=>b.meanRat-a.meanRat||b.worstCellRat-a.worstCellRat);
        const h=saved.sixes[x.id].hyps[k],chk={};
        for(const [pol,b] of Object.entries(h.byPolicy)){const row=rows.find(r=>same(r.label,b.pick));
          chk[pol]={pick:b.pick,savedMeanRat:b.meanRat,rerunMeanRat:row?.meanRat??null,rank:row?rows.indexOf(row)+1:null};}
        out[x.id+'/'+k]={phase:PHASE,cells:rc.cells.map(c=>c.src+':'+c.foe.join('/')),games:J.length,reproduce:chk,
          top5:rows.slice(0,5),bestWorstCell:rows.slice().sort((a,b)=>b.worstCellRat-a.worstCellRat||b.meanRat-a.meanRat).slice(0,3),
          picksAbove0_8:rows.filter(r=>r.meanRat>=0.8).length};
        console.log(x.id+'/'+k,'top',rows[0].label,rows[0].meanRat,rows[0].worstCellRat,'| reproduce',JSON.stringify(chk));
      }
    }
  }
  fs.writeFileSync(process.env.OUT||(FRESH?'reports/data/pr90-ceiling-fresh.json':'reports/data/pr90-ceiling.json'),JSON.stringify({showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:'gen9championsbssregmc',
    fresh:FRESH,seedBase:FRESH?FRESH_SEED_BASE:'pr88 DEV/FINAL',seconds:Math.round((Date.now()-T0)/1000),branches:E.BRANCHES,results:out,
    note:'POST-HOC upper bound using the rival real sets: diagnosis only, NOT a selector, NOT tuning. AI vs AI, NOT a ladder win rate.'},null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
