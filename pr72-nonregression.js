#!/usr/bin/env node
'use strict';
// PR #72: non-regression of the new opt-in turn-AI options outside case A.
//   v1   = PR #71 {encoreGuard:true}
//   new  = {encoreGuard:'speed', publicMegaAbility:true}
//   base = {} (no guard), reference only
// Same PR #67 saved picks (deduplicated), same seeds x side reversal, rival
// forcedA / forcedB / rival legacy preview, plus the PR #71 NEW public six.
// Holdouts: B, C-Y, C-X, Indeedee scarf/sash, E (NEW_realE_sun), HOLD_sun,
// HOLD_psychic, NEW_setup_dd_np. Heuristic AI vs heuristic AI, NOT a ladder win rate.
//   SHOWDOWN_DIR=... OUT=output/pr72-nonregression.json node pr72-nonregression.js
const fs=require('node:fs');
const path=require('node:path');
const {hashSeed,load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {caseList}=require('./legal-search-v2-compare');
const {battle}=require('./encore-lead-audit');
const {facts}=require('./encore-turn-p0-audit');
const {newSix}=require('./encore-guard-nonregression');
const SAVED=path.join(__dirname,'reports','data','legal-search-v2-compare-20261030.json');
const SEED_BASES=[7400000,7500000,7600000];
const AIS={base:{},v1:{encoreGuard:true},new:{encoreGuard:'speed',publicMegaAbility:true}};
const strip=log=>log.split('\n').filter(l=>!l.startsWith('|t:|')).join('\n');
async function main(){
  const sim=load();const saved=JSON.parse(fs.readFileSync(SAVED,'utf8'));const own=reportedLive();
  const cases=caseList().filter(c=>c.id!=='A_golisopod').map(c=>({...c,picks:saved.cases[c.id]?.picks||{}}));
  const N=newSix();cases.push({...N,picks:{legacyPreview:null,primarinaTrio:['Primarina','Metagross','Garchomp']}});
  const out={showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:'gen9championsbssregmc',ais:AIS,cases:{}};
  const total={base:[0,0],v1:[0,0],new:[0,0],flipsV1toNew:{winToLoss:0,lossToWin:0},diffV1New:0,games:0};
  for(const c of cases){
    const seen=new Set(),res={};
    for(const [policy,three] of Object.entries(c.picks)){
      const key=three?three.join('/'):'legacy';if(seen.has(key))continue;seen.add(key);
      const p=res[policy]={three:key,base:[0,0],v1:[0,0],new:[0,0],flips:{winToLoss:0,lossToWin:0},differentGames:0,ownEncoreFail:{base:0,v1:0,new:0},flipSeeds:[]};
      for(const [rname,foeThree] of Object.entries({forcedA:c.forcedA,forcedB:c.forcedB,rivalLegacy:null}))
      for(const base of SEED_BASES)for(const s of [0,1])for(const reverse of [false,true]){
        const seed=hashSeed(base+c.gi*1000+s*10),r={};
        for(const [ai,ownOptions] of Object.entries(AIS)){
          const b=await battle(sim,structuredClone(own),structuredClone(c.team),seed,{ownThree:three,foeThree,reverse,script:null,ownOptions});
          if(b.errors)throw Error('choice errors '+c.id+' '+policy+' '+ai);
          p[ai][0]+=b.won;p[ai][1]++;total[ai][0]+=b.won;total[ai][1]++;
          p.ownEncoreFail[ai]+=facts(b.log,b.ownSide,b.foeSide).ownEncoreFail;r[ai]=b;
        }
        total.games++;
        if(r.v1.won!==r.new.won){const k=r.v1.won?'winToLoss':'lossToWin';p.flips[k]++;total.flipsV1toNew[k]++;
          p.flipSeeds.push({rival:rname,seed:seed.join('-'),reverse,v1:r.v1.won,new:r.new.won});}
        if(strip(r.v1.log)!==strip(r.new.log)){p.differentGames++;total.diffV1New++;}
      }
      console.log(c.id.padEnd(22),policy.padEnd(16),key.padEnd(32),'base',p.base.join('/'),'v1',p.v1.join('/'),'new',p.new.join('/'),
        'flips v1->new',p.flips.winToLoss+'↓/'+p.flips.lossToWin+'↑','diff',p.differentGames,'encFail',Object.values(p.ownEncoreFail).join('/'));
    }
    out.cases[c.id]=res;
  }
  out.total=total;console.log('TOTAL',JSON.stringify(total));
  const file=process.env.OUT||path.join(__dirname,'output','pr72-nonregression.json');
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(out,null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
