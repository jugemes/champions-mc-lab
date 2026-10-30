#!/usr/bin/env node
'use strict';
// Sensitivity of previewPolicy:'threat-aware-v2' picks to its unsourced
// weights (Scarf / Rocky Helmet / Mega-holder / rival temperature / coverage).
// Preview only (no battle). Output: how often the pick (three + lead) of each
// public six changes over the grid. Weights are hypotheses, not usage data.
const {load}=require('./lab');
const {chooseThreatAwareV2,DEFAULTS}=require('./preview-threat-aware-v2');
const {reportedLive}=require('./reported-live-roster-20261027');
const {SCENARIOS}=require('./preview-threat-audit');
const GRID={scarfWeight:[0.1,0.25,0.5],helmetWeight:[0.1,0.25,0.5],megaWeight:[0.5,0.65,0.8],
  temperature:[0.04,0.08,0.16],coverageWeight:[0.5,0.75]};
function main(){
  const dex=load().Dex.mod('champions'),team=reportedLive();
  const out={};
  for(const [k,six] of Object.entries(SCENARIOS)){
    const name=idx=>idx.map(i=>team[i-1].species).join('/');
    const base=name(chooseThreatAwareV2(dex,team,six));
    const rows=[];
    for(const [param,values] of Object.entries(GRID))for(const value of values){
      if(value===DEFAULTS[param])continue;
      rows.push({param,value,pick:name(chooseThreatAwareV2(dex,team,six,{[param]:value}))});
    }
    out[k]={base,changed:rows.filter(r=>r.pick!==base).length,total:rows.length,rows};
    console.log(k.padEnd(26),'default',base,'changed',out[k].changed+'/'+rows.length);
    for(const r of rows.filter(r=>r.pick!==base))console.log('   ',r.param,'=',r.value,'->',r.pick);
  }
  return out;
}
if(require.main===module){const r=main();require('node:fs').mkdirSync('output',{recursive:true});
  require('node:fs').writeFileSync('output/preview-threat-v2-sensitivity.json',JSON.stringify(r,null,1));}
module.exports={GRID,main};
