#!/usr/bin/env node
'use strict';
// PR #100 request item 5: replay the PR #97 (pr96-eval) AI-plan jobs of the
// immune-aware rival with the SAME seeds/sides/cells, with pr100-join-hook
// preloaded in the workers, and
//   (a) check determinism against the saved per-cell values, and
//   (b) join every pr98 `known` hit with the rival decision of that turn.
// Only the saved picks with plan 'ai' are replayed (T1/T2 tables need the
// selector re-run; they do not change the rival masker). No selector runs, no
// new FINAL evaluation: the PR #97 FINAL sixes are already spent.
//   PHASE=FINAL|DEV  WORKERS=4  ONLY=<regexp on six id>
// Usage: node pr100-join-audit.js > reports/data/pr100-join-aiplan-<phase>.json
// (the full pipeline replay incl. selector / T1-T2 games: node -r
//  ./pr100-join-hook.js pr96-eval.js, then pr100-join-summary.js)
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {load}=require('./lab');
const H=require('./holdout-20261031-pr96');
const X=require('./pr96-paired');
const E94=require('./pr94-eval');
const H92=require('./holdout-20261031-pr92'),H94=require('./holdout-20261031-pr94');
const {chooseThree}=require('./lab');const {rivalCandidates}=require('./preview-legal-search');
const MODELS=['rational','tm'];
const cellsFor=(model,a)=>model==='rational'?H92.rationalCellsPR92({...a,chooseThree,rivalCandidates}).cells:H94.tmCells(a).cells;
async function main(){
  const PHASE=process.env.PHASE||'FINAL',W=Number(process.env.WORKERS||4),only=process.env.ONLY?new RegExp(process.env.ONLY):null;
  const saved=JSON.parse(fs.readFileSync(`reports/data/pr96-eval-${PHASE.toLowerCase()}.json`,'utf8'));
  const sim=load(),dex=sim.Dex.mod('champions');
  const own=require('./reported-live-roster-20261027').reportedLive(),ownSpecies=own.map(p=>p.species);
  const sixes=PHASE==='FINAL'?Object.entries(H.unseenSixesPR96()).map(([id,x])=>({id,ace:x.ace,hyps:x.hypotheses}))
    :(()=>{const d=E94.devSixes();for(const x of E94.finalSixes())d.push(x);return d.map(x=>({id:x.id,ace:x.ace,hyps:x.hyps}));})();
  const evalBase=PHASE==='FINAL'?H.FINAL_SEED_BASE:H.DEV_SEED_BASE;
  const J=[],teams=[];
  for(const [ui,x] of sixes.entries()){
    if(only&&!only.test(x.id))continue;
    const sel=saved.sixes[x.id].selection,distinct=new Map();
    for(const k of ['legacy','quick','v2','pr93','pr95','pr96']){if(!sel[k])continue;(distinct.get(sel[k])||distinct.set(sel[k],[]).get(sel[k])).push(k);}
    Object.entries(x.hyps).forEach(([k,t],hi)=>{
      const ti=teams.push(t)-1;
      MODELS.forEach((model,mi)=>{
        const cells=cellsFor(model,{dex,team:t,ownSpecies,ace:x.ace});
        for(const [pick,pols] of distinct)cells.forEach((c,ci)=>H.BRANCHES.forEach((branch,bi)=>H.SEEDS.forEach(s=>{
          const base={six:x.id,hyp:k,model,pols,team:ti,own:pick.split('>'),foe:c.foe,cell:c.src,ci,branch,s,plan:{},keyVer:'pr96',immuneAware:true};
          J.push({...base,seed:H.evalSeed(evalBase,ui,hi,mi,ci,bi,s),reverse:H.sideOf(s)});
        })));
      });
    });
  }
  const file=path.join(os.tmpdir(),`pr100-join-${process.pid}.jsonl`);fs.writeFileSync(file,'');
  process.env.PR100_JOIN_FILE=file;
  const hook=path.join(__dirname,'pr100-join-hook.js');
  process.execArgv.push('-r',hook);// forked pr96 workers inherit it
  const t0=Date.now();const R=await X.runGames96(own,teams,J,{workers:W});const seconds=Math.round((Date.now()-t0)/1000);
  // (a) determinism vs saved byCell (aware rival, plan ai)
  let compared=0,diff=[];
  const groups={};J.forEach((j,i)=>{for(const pol of j.pols){const key=[j.six,j.hyp,j.model,pol,j.cell].join('|');(groups[key]||(groups[key]=[])).push(R[i].won);}});
  for(const [key,w] of Object.entries(groups)){const [six,hyp,model,pol,cell]=key.split('|');
    const sv=saved.sixes[six].hyps[hyp].byModel[model]['aware:'+pol]?.byCell?.[cell];if(!sv)continue;compared++;
    const v=+(w.reduce((a,b)=>a+b,0)/w.length).toFixed(3);if(v!==sv.v||w.length!==sv.n)diff.push({key,saved:sv.v,replay:v,n:w.length});}
  // (b) join
  const rows=fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
  const battles=rows.filter(r=>r.hits),counts=rows.filter(r=>r.final).reduce((s,r)=>s+r.count,0);
  const hits=battles.flatMap(b=>b.hits.map(h=>({...h,b})));
  const tab=(arr,f)=>arr.reduce((o,x)=>{const k=f(x);o[k]=(o[k]||0)+1;return o;},{});
  const byCls=tab(hits,h=>h.cls),byClsT=tab(hits,h=>(h.turn<=2?'T1-2':'T3+')+' | '+h.cls),forcedBy=tab(hits.filter(h=>h.cls==='forced'),h=>h.forcedBy);
  const byWhy=tab(hits,h=>h.cls+' | '+h.move+' -> '+h.target);
  const ex={};for(const h of hits){const k=h.cls+'|'+(h.forcedBy||'');if((ex[k]||(ex[k]=[])).length<3)ex[k].push({seed:h.b.seed,reverse:h.b.reverse,own:h.b.own,foe:h.b.foe,turn:h.turn,move:h.move,target:h.target,decision:h.decision,lines:h.b.lines});}
  const knownBattles=new Set(battles.filter(b=>b.hits.some(h=>h.turn>=3)).map(b=>b.n+':'+b.pid)).size;
  console.log(JSON.stringify({phase:PHASE,showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:'gen9championsbssregmc',
    scope:'PR #97 eval jobs, immune-aware rival (pr96 immuneAware), saved picks with plan ai, same seeds/sides/cells; pairedOnly jobs and T1/T2 plans not replayed',
    jobs:J.length,battlesCounted:counts,seconds,determinism:{cellsCompared:compared,differences:diff.length,first:diff.slice(0,5)},
    known:{battles:battles.length,battlesWithT3plus:knownBattles,hits:hits.length,byClass:byCls,byClassTurn:byClsT,forcedBy,byClassMove:byWhy},
    examples:ex,note:'Heuristic AI vs heuristic AI. NOT a ladder win rate. Audit of the masker only; does not change any selector result.'},null,1));
  fs.unlinkSync(file);
}
main().catch(e=>{console.error(e);process.exit(1);});
