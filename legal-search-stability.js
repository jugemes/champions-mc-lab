#!/usr/bin/env node
'use strict';
// Stability probe for preview-legal-search: same public six, same our six,
// only the short-branch seedBase changes. A preview AI whose pick flips with
// the seed is measuring branch noise, not matchup structure.
const {load}=require('./lab');
const {chooseLegalSearch}=require('./preview-legal-search');
const {reportedLive}=require('./reported-live-roster-20261027');
const {caseList}=require('./legal-search-compare');
async function main(){
  const sim=load(),own=reportedLive(),rows=[];
  for(const c of caseList()){
    const picks=[];
    for(const seedBase of [7300000,8300000,9300000]){
      const r=await chooseLegalSearch(sim,own,c.team.map(p=>p.species),{seedBase});
      picks.push(r.chosen.join('/')+' ('+r.table[0].score.toFixed(2)+' vs 2nd '+r.table[1].score.toFixed(2)+')');
    }
    rows.push({case:c.id,picks});
    console.log(c.id.padEnd(20),picks.join(' | '));
  }
  if(process.env.OUT)require('node:fs').writeFileSync(process.env.OUT,JSON.stringify(rows,null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
