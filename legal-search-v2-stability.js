#!/usr/bin/env node
'use strict';
// Stability probe for legal-search v2 (same as legal-search-stability.js for
// v1): same public six and our six, only the short-branch seedBase changes.
//   SHOWDOWN_DIR=... CASES='^A_' SEEDS=8300000,9300000 node legal-search-v2-stability.js
const {load}=require('./lab');
const {chooseLegalSearch}=require('./preview-legal-search');
const {reportedLive}=require('./reported-live-roster-20261027');
const {caseList}=require('./legal-search-v2-compare');
async function main(){
  const sim=load(),own=reportedLive(),rows=[];
  const only=process.env.CASES?new RegExp(process.env.CASES):null;
  const seeds=(process.env.SEEDS||'8300000,9300000').split(',').map(Number);
  for(const c of caseList().filter(c=>!only||only.test(c.id))){
    for(const seedBase of seeds){
      const r=await chooseLegalSearch(sim,own,c.team.map(p=>p.species),{seedBase,version:'v2'});
      const row={case:c.id,seedBase,chosen:r.chosen.join('/'),score:+r.table[0].score.toFixed(3),second:r.table[1].three.join('/'),
        gap:+(r.table[0].score-r.table[1].score).toFixed(3),top5:r.table.slice(0,5).map(x=>x.three.join('/')+' '+x.score.toFixed(3))};
      rows.push(row);console.log(JSON.stringify(row));
    }
  }
  if(process.env.OUT)require('node:fs').writeFileSync(process.env.OUT,JSON.stringify(rows,null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
