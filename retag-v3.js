#!/usr/bin/env node
'use strict';
// PR #68 request item 4: re-tag the PR #67 saved compare games with
// misplay-tags-v3 (Encore-aware). The saved JSON keeps only tags, so every
// game is REPLAYED from the saved picks with the same seeds / sides / rival
// threes (no preview search re-run) and checked against the saved row
// (won, turns, rival three, v2 foe tags) before v3 is applied. The old JSON
// is read only, never rewritten. Heuristic AI vs heuristic AI: NOT a ladder
// win rate.
//   SHOWDOWN_DIR=... OUT=output/retag-v3.json node retag-v3.js
const fs=require('node:fs');
const path=require('node:path');
const {hashSeed,load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {caseList}=require('./legal-search-v2-compare');
const {battle}=require('./encore-lead-audit');
const {misplaysV2,anyTag:anyTagV2}=require('./misplay-tags-v2');
const {misplaysV3,anyTag:anyTagV3}=require('./misplay-tags-v3');
const SAVED=process.env.SAVED||path.join(__dirname,'reports','data','legal-search-v2-compare-20261030.json');
const SEED_BASES=[7400000,7500000,7600000];
const nz=o=>Object.fromEntries(Object.entries(o).filter(([,v])=>v));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function main(){
  const sim=load();const saved=JSON.parse(fs.readFileSync(SAVED,'utf8'));
  const own=reportedLive();const out={source:path.basename(SAVED),showdown:saved.showdown,cases:{}};
  let mismatches=0;
  for(const c of caseList()){
    const sc=saved.cases[c.id];if(!sc)continue;
    const rivals={forcedA:c.forcedA,forcedB:c.forcedB,rivalLegacy:null};
    const done=new Map(),sum={};
    for(const [policy,three] of Object.entries(sc.picks)){
      const p=sum[policy]={three:three.join('/'),total:[0,0],cleanV2:[0,0],cleanV3:[0,0],
        foeV3Games:{},ownV3Games:{},encoreGames:0,cells:{}};
      for(const [rname,foeForced] of Object.entries(rivals))for(const base of SEED_BASES)for(const s of [0,1])for(const reverse of [false,true]){
        const seed=hashSeed(base+c.gi*1000+s*10),k=three.join('/')+'|'+rname+'|'+seed.join('-')+'|'+reverse;
        let r=done.get(k);
        if(!r){r=await battle(sim,structuredClone(own),structuredClone(c.team),seed,{ownThree:three,foeThree:foeForced,reverse,script:null});done.set(k,r);}
        const v2=misplaysV2(r.log),v3=misplaysV3(r.log,{requests:r.reqLog});
        const foeSide=r.foeSide;
        const fV3=v3[foeSide],oV3=v3[r.ownSide];
        p.total[0]+=r.won;p.total[1]++;
        if(!anyTagV2(v2[foeSide])){p.cleanV2[0]+=r.won;p.cleanV2[1]++;}
        if(!anyTagV3(fV3)){p.cleanV3[0]+=r.won;p.cleanV3[1]++;}
        for(const [t,v] of Object.entries(nz(fV3)))p.foeV3Games[t]=(p.foeV3Games[t]||0)+1;
        for(const [t,v] of Object.entries(nz(oV3)))p.ownV3Games[t]=(p.ownV3Games[t]||0)+1;
        if(/\|-start\|p[12]a: [^|]+\|Encore/.test(r.log))p.encoreGames++;
        const cl=p.cells[rname]||(p.cells[rname]={foe:new Set(),w:0,n:0,cleanV2:[0,0],cleanV3:[0,0],stayedLocked:0});
        cl.foe.add(r.foe.join('/'));cl.w+=r.won;cl.n++;
        if(!anyTagV2(v2[foeSide])){cl.cleanV2[0]+=r.won;cl.cleanV2[1]++;}
        if(!anyTagV3(fV3)){cl.cleanV3[0]+=r.won;cl.cleanV3[1]++;}
        cl.stayedLocked+=(fV3.encoreStay||0)+(fV3.lockedStay||0)>0;
      }
      for(const cl of Object.values(p.cells))cl.foe=[...cl.foe];
      // reproduction check against the saved summary (v2 definitions)
      const old=sc.summary[policy];
      const ok=same(old.total,p.total)&&same(old.clean,p.cleanV2)&&Object.entries(old.cells).every(([k,v])=>v.w===p.cells[k].w&&v.cleanW===p.cells[k].cleanV2[0]&&v.cleanN===p.cells[k].cleanV2[1]);
      p.reproducesSavedV2=ok;if(!ok)mismatches++;
      console.log(c.id.padEnd(22),policy.padEnd(16),p.three.padEnd(32),'all',p.total.join('/'),'cleanV2',p.cleanV2.join('/'),'cleanV3',p.cleanV3.join('/'),
        'encoreGames',p.encoreGames,ok?'repro-ok':'REPRO-MISMATCH',
        Object.entries(p.cells).map(([k,v])=>k+' '+v.w+'/'+v.n+' v2 '+v.cleanV2.join('/')+' v3 '+v.cleanV3.join('/')+(v.stayedLocked?' stayedLocked '+v.stayedLocked:'')).join(' | '));
    }
    out.cases[c.id]={public:sc.public,summary:sum};
  }
  out.reproductionMismatches=mismatches;
  const file=process.env.OUT||path.join(__dirname,'output','retag-v3.json');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(out,null,1));
  if(mismatches)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
