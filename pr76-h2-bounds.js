#!/usr/bin/env node
'use strict';
// PR #76 P0-B: PR #75 reported H2 holdout security 0.151 for 'robust' after
// renormalising the policy over the evaluated own picks (coveredMass 0.983).
// Without renormalising, the unevaluated mass u=1-m can win 0..1 of every game:
//   lower = min_j sum_{i kept} x_i Q_ij            (unevaluated mass loses)
//   upper = min_j (sum_{i kept} x_i Q_ij + u)      (unevaluated mass wins)
// From the saved PR #75 rows only (no new games): reports/data/robust-preview-20261031.json.
// Heuristic AI vs heuristic AI, NOT a ladder win rate.
//   OUT=reports/data/pr76-h2-bounds-20261031.json node pr76-h2-bounds.js
const fs=require('node:fs');
const path=require('node:path');
const {matrices,policies}=require('./robust-preview');
function bounds(saved=require('./reports/data/robust-preview-20261031.json')){
  const {P,ownPicks}=matrices(),pols=policies(P,ownPicks),rows=saved.holdout.rows;
  const W={},N={};let F=0;
  for(const [oi,fi,,,won] of rows){const k=oi+','+fi;W[k]=(W[k]||0)+won;N[k]=(N[k]||0)+1;F=Math.max(F,fi+1);}
  const kept=[...new Set(rows.map(r=>r[0]))];
  const out={};
  for(const [name,p] of Object.entries(pols)){
    if(name.startsWith('oracle'))continue;
    const m=kept.reduce((s,i)=>s+p.x[i],0),u=1-m;
    const col=j=>kept.reduce((s,i)=>s+p.x[i]*W[i+','+j]/N[i+','+j],0);
    const cols=[...Array(F).keys()].map(col);
    out[name]={coveredMass:+m.toFixed(4),uncovered:+u.toFixed(4),renormalised:+(Math.min(...cols)/m).toFixed(3),
      lower:+Math.min(...cols).toFixed(3),upper:+Math.min(...cols.map(c=>c+u)).toFixed(3),
      uncoveredPicks:p.x.map((v,i)=>[ownPicks[i],+v.toFixed(4)]).filter(([,v],i)=>v>0.0005&&!kept.includes(i)).sort((a,b)=>b[1]-a[1]).slice(0,6)};
  }
  return {source:'reports/data/robust-preview-20261031.json (PR #75 H2 holdout rows, '+rows.length+' games)',
    note:'security over the 60 rival picks of the H2 holdout; NOT a ladder win rate.',policies:out};
}
if(require.main===module){const r=bounds();console.log(JSON.stringify(r.policies,null,1));
  if(process.env.OUT){fs.mkdirSync(path.dirname(process.env.OUT),{recursive:true});fs.writeFileSync(process.env.OUT,JSON.stringify(r,null,1));}}
module.exports={bounds};
