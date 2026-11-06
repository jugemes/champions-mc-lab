#!/usr/bin/env node
'use strict';
// PR #72: short machine-readable summary of the saved PR #72 data files, so a
// reviewer can check the report without downloading the large JSONs.
//   node pr72-summary.js  -> reports/data/pr72-summary-20261030.json
const fs=require('node:fs');
const path=require('node:path');
const R=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'reports','data',f),'utf8'));
const m=R('a-preview-matrix-20261030.json'),b=R('a-branch-audit-20261030.json'),h=R('a-preview-holdout-seeds-20261030.json');
const n=R('pr72-nonregression-20261030.json'),e=R('encore-guard-boundary-20261030.json'),old=R('encore-turn-p0-audit-20261030.json');
const out={showdown:m.showdown,format:m.format,note:'Heuristic AI vs heuristic AI, NOT a ladder win rate.',
  pr71AuditCount:{rows:old.rows.length,perOwnAI:Object.fromEntries(['old','guard'].map(a=>[a,old.rows.filter(r=>r.ai===a).length])),
    rationalRows:old.rows.filter(r=>r.rational).length,referenceToGarchompRows:old.rows.filter(r=>r.t1==='toGarchomp').length},
  matrix:{},branch:{},holdoutSeeds:{},nonregression:n.total,encoreGuardBoundary:{summary:e.summary,falsePositiveV1:e.falsePositiveV1,falsePositiveV2:e.falsePositiveV2,failAllowedV1:e.failAllowedV1,failAllowedV2:e.failAllowedV2}};
for(const [k,g] of Object.entries(m.grids)){const a=g.analysis;
  out.matrix[k]={games:g.rows?g.rows.length:3600*12,value:a.value,gap:a.gap,rivalEq:a.foeEq.filter(x=>x.p>=0.05),ownEq:a.ownEq.filter(x=>x.p>=0.05),
    ref:Object.fromEntries(['Primarina>Metagross/Garchomp','Garchomp>Metagross/Primarina','Tyranitar>Metagross/Primarina'].map(p=>[p,a.own.find(o=>o.pick===p).vsEq]))};}
for(const s of b.summary){const k=s.hyp+'|'+s.own;const t=out.branch[k]||(out.branch[k]={aiOnly:[0,0],worstRational:[0,0],pairs:[]});
  const [a,an]=s.aiOnly.split('/').map(Number),[w,wn]=s.worstRational.split('/').map(Number);
  t.aiOnly[0]+=a;t.aiOnly[1]+=an;t.worstRational[0]+=w;t.worstRational[1]+=wn;t.pairs.push({rival:s.foe,aiOnly:s.aiOnly,worstRational:s.worstRational,topBeatenBy:s.topBeatenBy.slice(0,2)});}
for(const [hyp,r] of Object.entries(h.results))out.holdoutSeeds[hyp]=r.own.map(o=>({pick:o.pick,inSample:o.inSample,freshSeeds:o.outOfSample}));
fs.writeFileSync(path.join(__dirname,'reports','data','pr72-summary-20261030.json'),JSON.stringify(out,null,1));
console.log(JSON.stringify({matrix:Object.fromEntries(Object.entries(out.matrix).map(([k,v])=>[k,v.value])),nonregression:out.nonregression,pr71:out.pr71AuditCount}));
