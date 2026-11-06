#!/usr/bin/env node
'use strict';
// PR #72 request item 5: boundary of the PR #70 encoreGuard ("foe has not
// moved since it came in" = foeLastMoveTurn<0) in full pinned-Showdown games.
// The UNGUARDED turn AI plays; at every decision where it picks Encore we
// record, from the bot's public state at decision time, whether
//   v1  = PR #70 guard (foeEncored || foeLastMoveTurn<0) would have blocked it
//   v2  = encoreGuard 'speed' (block a fresh foe only when we might move first)
// and read the engine's actual outcome from the log (-start Encore / -fail /
// the foe switched the same turn). A v1 block on an Encore that SUCCEEDED is a
// false positive; an allowed Encore that failed is a false negative.
// Cases: A forcedA/forcedB and the PR #67 saved picks for the other cases.
// Heuristic AI vs heuristic AI, NOT a ladder win rate.
//   SHOWDOWN_DIR=... OUT=output/encore-guard-boundary.json node encore-guard-boundary-audit.js
const fs=require('node:fs');
const path=require('node:path');
const {hashSeed,load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {caseList}=require('./legal-search-v2-compare');
const {battle}=require('./encore-lead-audit');
const SAVED=path.join(__dirname,'reports','data','legal-search-v2-compare-20261030.json');
const SEED_BASES=[7400000,7500000,7600000];

// Record the guard predicates at every move decision; never change the choice.
// Our Encore on turn t is the |move| line of turn t (Encore cannot be forced).
function probe(state){
  return (req,bot)=>{
    if(req.teamPreview||req.forceSwitch||!req.active)return null;
    const side=req.side.pokemon,my=bot.getSet(side.find(p=>p.active)),g=bot.encoreGuard;
    bot.encoreGuard='speed';const v2=bot.encoreWouldFail(my,side);
    bot.encoreGuard=true;const v1=bot.encoreWouldFail(my,side);
    bot.encoreGuard=g;
    state[bot.turn]={foe:bot.foeActive,v1,v2,fresh:bot.foeLastMoveTurn<0,foeEncored:bot.foeEncored};
    return null;
  };
}
function ownEncoreTurns(log,ownSide){
  let turn=0;const t=[];
  for(const line of log.split('\n')){const a=line.split('|');
    if(a[1]==='turn')turn=Number(a[2]);
    else if(a[1]==='move'&&a[2]?.startsWith(ownSide)&&a[3]==='Encore'&&!/\[from\]/.test(line))t.push(turn);}
  return t;
}
// Engine outcome of our Encore on turn t: 'start' | 'fail' | 'foeSwitched' | 'notUsed'.
function outcome(log,ownSide,foeSide,t){
  let turn=0,used=false,sw=false;
  for(const line of log.split('\n')){
    const a=line.split('|');
    if(a[1]==='turn'){turn=Number(a[2]);continue;}
    if(turn!==t)continue;
    if((a[1]==='switch'||a[1]==='drag')&&a[2]?.startsWith(foeSide)&&!used)sw=true;
    if(a[1]==='move'&&a[2]?.startsWith(ownSide)&&a[3]==='Encore')used=true;
    else if(used&&a[1]==='-start'&&a[2]?.startsWith(foeSide)&&/Encore$/.test(a[3]||''))return 'start';
    else if(used&&(a[1]==='-fail'||a[1]==='-miss'||a[1]==='-immune'||a[1]==='-activate'))return sw?'foeSwitched':'fail';
    else if(used&&a[1]==='move')return sw?'foeSwitched':'fail';
  }
  return used?(sw?'foeSwitched':'fail'):'notUsed';
}
async function run({out}={}){
  const sim=load();const saved=JSON.parse(fs.readFileSync(SAVED,'utf8'));
  const own=reportedLive();const rows=[];
  const jobs=[];
  for(const c of caseList()){
    const picks=c.id==='A_golisopod'
      ?{primarinaLead:['Primarina','Metagross','Garchomp']}
      :Object.fromEntries(Object.entries(saved.cases[c.id]?.picks||{}).filter(([,t])=>t&&t.includes('Primarina')));
    for(const [policy,three] of Object.entries(picks))for(const [rn,foeThree] of [['forcedA',c.forcedA],['forcedB',c.forcedB]])
      jobs.push({c,policy,three,rn,foeThree});
  }
  for(const j of jobs)for(const base of SEED_BASES)for(const s of [0,1])for(const reverse of [false,true]){
    const seed=hashSeed(base+j.c.gi*1000+s*10);const state={};
    const r=await battle(sim,structuredClone(own),structuredClone(j.c.team),seed,{ownThree:j.three,foeThree:j.foeThree,reverse,script:null,
      ownOptions:{script:probe(state)}});
    for(const t of ownEncoreTurns(r.log,r.ownSide)){
      const o=outcome(r.log,r.ownSide,r.foeSide,t);
      rows.push({case:j.c.id,policy:j.policy,rival:j.rn,seed:seed.join('-'),reverse,turn:t,...state[t],outcome:o});
    }
  }
  const sum={};
  for(const x of rows){
    const k=[x.v1?'v1block':'v1allow',x.v2?'v2block':'v2allow',x.outcome].join('|');sum[k]=(sum[k]||0)+1;
  }
  const res={showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:'gen9championsbssregmc',
    note:'Unguarded own turn AI; v1/v2 = would the guard have blocked this Encore (public state at decision time). outcome from the engine log.',
    summary:sum,
    falsePositiveV1:rows.filter(x=>x.v1&&x.outcome==='start').length,
    falsePositiveV2:rows.filter(x=>x.v2&&x.outcome==='start').length,
    failAllowedV1:rows.filter(x=>!x.v1&&x.outcome==='fail').length,
    failAllowedV2:rows.filter(x=>!x.v2&&x.outcome==='fail').length,
    rows};
  if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(res,null,1));}
  return res;
}
async function main(){
  const res=await run({out:process.env.OUT||path.join(__dirname,'output','encore-guard-boundary.json')});
  console.log(JSON.stringify(res.summary,null,1));
  for(const k of ['falsePositiveV1','falsePositiveV2','failAllowedV1','failAllowedV2'])console.log(k,res[k]);
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={run,outcome,probe,ownEncoreTurns};
