#!/usr/bin/env node
'use strict';
// PR #59 / Issue #20: same-seed comparison of legacy / strategic /
// threat-aware (PR #58) / threat-aware-v2 on pinned Showdown. Rival choice
// conditions are kept apart: rival-legacy, rival-threat-aware (v1),
// rival-threat-aware-v2, forcedA (ace three), forcedB (cycle three). Groups:
// environment-m7-teams 01-14 (A/B/C + PR #58 holdouts) and the PR #59
// holdout sixes (holdout-20261030.js, written before v2 was run on them).
// Baseline turn AI both sides. NOT a ladder win rate.
const fs=require('node:fs');
const path=require('node:path');
const {hashSeed,load}=require('./lab');
const {battle,BATTLE_GROUPS}=require('./preview-threat-audit');
const {turnLines}=require('./threat-lead-counterfactual');
const {groups}=require('./environment-m7-teams');
const {teams:holdoutTeams}=require('./holdout-20261030');
const {reportedLive}=require('./reported-live-roster-20261027');
const SEED_BASES=[5600000,5700000,5800000];
function allGroups(){
  const env=BATTLE_GROUPS.map(n=>groups.find(g=>g.name===n));
  const hold=Object.entries(holdoutTeams()).map(([name,t])=>({name:'H_'+name,team:t.team,forcedA:t.forcedA,forcedB:t.forcedB}));
  return [...env,...hold];
}
const MODES={'rival-legacy':{foePolicy:'legacy'},'rival-threat-aware':{foePolicy:'threat-aware'},
  'rival-threat-aware-v2':{foePolicy:'threat-aware-v2'},forcedA:{forced:'forcedA'},forcedB:{forced:'forcedB'}};
async function run(sim,{policies,modes=Object.keys(MODES),groupFilter=null}){
  const team=reportedLive(),before=JSON.stringify(team),rows=[];
  const gs=allGroups().filter(g=>!groupFilter||groupFilter.test(g.name));
  for(const [gi,g] of gs.entries())for(const ownPolicy of policies)for(const mode of modes){
    const m=MODES[mode];
    for(const base of SEED_BASES)for(let s=0;s<2;s++)for(const reverse of [false,true]){
      // Same seed formula as preview-threat-audit.js for groups 01-14.
      const idx=BATTLE_GROUPS.indexOf(g.name),k=idx>=0?idx:100+gi;
      const seed=hashSeed(base+k*1000+s*10);
      const r=await battle(sim,structuredClone(team),structuredClone(g.team),seed,
        {ownPolicy,foePolicy:m.foePolicy||'legacy',foeForced:m.forced?g[m.forced]:null,reverse});
      const row={group:g.name,ownPolicy,mode,seedBase:base,seed:seed.join('-'),reverse,won:r.won,turns:r.turns,errors:r.errors,own:r.own,foe:r.foe,foeMega:r.foeMega};
      const keyLog=rows.some(x=>x.group===g.name&&x.ownPolicy===ownPolicy&&x.mode===mode&&x.t1to4);
      if(!r.won&&!keyLog)row.t1to4=turnLines(r.log);
      rows.push(row);
    }
  }
  if(JSON.stringify(team)!==before)throw Error('live six mutated');
  if(rows.some(r=>r.errors))throw Error('choice errors in battles');
  return rows;
}
function table(rows,{policies,modes}){
  const cell=(f)=>{const x=rows.filter(f);return x.filter(r=>r.won).length+'/'+x.length;};
  const lines=[];
  lines.push('| policy | '+modes.join(' | ')+' | A/B/C 01-04 | env holdout 05-14 | PR59 holdout H_* |');
  lines.push('|'+'---|'.repeat(modes.length+4));
  for(const p of policies)lines.push('| '+p+' | '+modes.map(m=>cell(r=>r.ownPolicy===p&&r.mode===m)).join(' | ')+' | '+
    cell(r=>r.ownPolicy===p&&/^0[1-4]_/.test(r.group))+' | '+cell(r=>r.ownPolicy===p&&/^(0[5-9]|1[0-4])_/.test(r.group))+' | '+
    cell(r=>r.ownPolicy===p&&r.group.startsWith('H_'))+' |');
  return lines.join('\n');
}
function perGroup(rows,{policies,modes}){
  const out=[];
  for(const g of [...new Set(rows.map(r=>r.group))])for(const m of modes){
    const parts=policies.map(p=>{const x=rows.filter(r=>r.group===g&&r.mode===m&&r.ownPolicy===p);
      return p+'='+x.filter(r=>r.won).length+'/'+x.length+'['+[...new Set(x.map(r=>r.own.join('/')))].join(';')+']';});
    const foe=[...new Set(rows.filter(r=>r.group===g&&r.mode===m).map(r=>r.foe.join('/')))].join(';');
    out.push(g+' '+m+' foe='+foe+' :: '+parts.join(' '));
  }
  return out;
}
async function main(){
  const sim=load();
  const policies=(process.env.AUDIT_POLICIES||'legacy,strategic,threat-aware,threat-aware-v2').split(',');
  const modes=(process.env.AUDIT_MODES||Object.keys(MODES).join(',')).split(',');
  const groupFilter=process.env.AUDIT_GROUPS?new RegExp(process.env.AUDIT_GROUPS):null;
  const rows=await run(sim,{policies,modes,groupFilter});
  const out={showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:'gen9championsbssregmc',seedBases:SEED_BASES,policies,modes,
    note:'Baseline turn AI on both sides; NOT a ladder win rate. t1to4 = first loss per cell.',rows};
  const file=process.env.OUT||path.join(__dirname,'output','threat-audit-v2.json');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(out));
  console.log(table(rows,{policies,modes}));
  console.log(perGroup(rows,{policies,modes}).join('\n'));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={allGroups,MODES,run,table,perGroup,SEED_BASES};
