#!/usr/bin/env node
'use strict';
// PR #70 request: minimum non-regression of the opt-in turn-AI Encore guard
// (lab.js encoreGuard) outside case A. Old vs guard with the SAME saved picks
// (PR #67 legal-search-v2-compare JSON), same seeds, side reversal, rival
// three forcedA / forcedB / rival legacy preview. Plus one NEW public six not
// used in earlier PRs (setup-heavy so Encore matters, written before this run;
// sets are hand-written legal M-C hypotheses, not observed ladder sets).
// Our side reads the public log only; the rival's sets never reach it.
// Heuristic AI vs heuristic AI, NOT a ladder win rate.
//   SHOWDOWN_DIR=... OUT=output/encore-guard-nonregression.json node encore-guard-nonregression.js
const fs=require('node:fs');
const path=require('node:path');
const {hashSeed,load,normalize,prelim}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {caseList}=require('./legal-search-v2-compare');
const {battle}=require('./encore-lead-audit');
const {facts}=require('./encore-turn-p0-audit');
const {misplaysV3,anyTag}=require('./misplay-tags-v3');
const FORMAT='gen9championsbssregmc';
const SAVED=path.join(__dirname,'reports','data','legal-search-v2-compare-20261030.json');
const SEED_BASES=[7400000,7500000,7600000];
const strip=log=>log.split('\n').filter(l=>!l.startsWith('|t:|')).join('\n');// timestamps differ run to run
const set=(species,item,ability,nature,evs,moves)=>({species,item,ability,nature,evs,moves});
// NEW public six (PR #70). One Mega (Lucario), item clause, 66 points max.
function newSix(){
  return {id:'NEW_setup_dd_np',gi:9,team:[
    set('Dragonite','Lum Berry','Multiscale','Adamant',{hp:2,atk:32,spe:32},['Dragon Dance','Extreme Speed','Earthquake','Fire Punch']),
    set('Gyarados','Sitrus Berry','Intimidate','Jolly',{hp:2,atk:32,spe:32},['Dragon Dance','Waterfall','Earthquake','Taunt']),
    set('Lucario','Lucarionite Z','Inner Focus','Timid',{hp:2,spa:32,spe:32},['Aura Sphere','Dark Pulse','Flash Cannon','Nasty Plot']),
    set('Hippowdon','Leftovers','Sand Stream','Impish',{hp:32,def:32,spd:2},['Earthquake','Yawn','Stealth Rock','Slack Off']),
    set('Gholdengo','Air Balloon','Good as Gold','Modest',{hp:2,spa:32,spe:32},['Shadow Ball','Make It Rain','Nasty Plot','Thunderbolt']),
    set('Skarmory','Rocky Helmet','Sturdy','Impish',{hp:32,def:32,spd:2},['Roost','Spikes','Brave Bird','Whirlwind']),
  ],forcedA:['Dragonite','Gyarados','Hippowdon'],forcedB:['Lucario','Gholdengo','Skarmory']};
}
async function main(){
  const sim=load();const saved=JSON.parse(fs.readFileSync(SAVED,'utf8'));
  const validator=sim.TeamValidator.get(FORMAT);const N=newSix();prelim(N.team,N.id);
  const problems=validator.validateTeam(normalize(N.team));if(problems?.length)throw Error(N.id+': '+problems.join('; '));
  const own=reportedLive();const cases=[];
  for(const c of caseList()){if(c.id==='A_golisopod')continue;const sc=saved.cases[c.id];if(sc)cases.push({...c,picks:sc.picks});}
  // NEW six: our three from the legacy preview AI on the public six (null), plus the Primarina trio.
  cases.push({...N,picks:{legacyPreview:null,primarinaTrio:['Primarina','Metagross','Garchomp']}});
  const out={showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:FORMAT,newSix:N,cases:{}};
  for(const c of cases){
    const rivals={forcedA:c.forcedA,forcedB:c.forcedB,rivalLegacy:null};const res={};
    for(const [policy,three] of Object.entries(c.picks)){
      const p=res[policy]={three:three?three.join('/'):'legacy preview',old:[0,0],guard:[0,0],cleanOld:[0,0],cleanGuard:[0,0],
        flips:{winToLoss:0,lossToWin:0},differentGames:0,ownEncore:{old:0,guard:0},winsWithRivalStay:{old:0,guard:0},ownEncoreFail:{old:0,guard:0}};
      for(const [rname,foeThree] of Object.entries(rivals))for(const base of SEED_BASES)for(const s of [0,1])for(const reverse of [false,true]){
        const seed=hashSeed(base+c.gi*1000+s*10);const r={};
        for(const [ai,ownOptions] of [['old',{}],['guard',{encoreGuard:true}]]){
          const b=await battle(sim,structuredClone(own),structuredClone(c.team),seed,{ownThree:three,foeThree,reverse,script:null,ownOptions});
          if(b.errors)throw Error('choice errors '+c.id+' '+policy);
          const v3=misplaysV3(b.log,{requests:b.reqLog}),f=facts(b.log,b.ownSide,b.foeSide);
          p[ai][0]+=b.won;p[ai][1]++;
          const ck=ai==='old'?'cleanOld':'cleanGuard';if(!anyTag(v3[b.foeSide])){p[ck][0]+=b.won;p[ck][1]++;}
          if(b.won&&((v3[b.foeSide].encoreStay||0)+(v3[b.foeSide].lockedStay||0))>0)p.winsWithRivalStay[ai]++;
          p.ownEncore[ai]+=f.ownEncore;p.ownEncoreFail[ai]+=f.ownEncoreFail;r[ai]=b;
        }
        if(r.old.won!==r.guard.won)p.flips[r.old.won?'winToLoss':'lossToWin']++;
        if(strip(r.old.log)!==strip(r.guard.log))p.differentGames++;
      }
      console.log(c.id.padEnd(22),policy.padEnd(16),p.three.padEnd(32),'old',p.old.join('/'),'guard',p.guard.join('/'),
        'flips',p.flips.winToLoss+'↓/'+p.flips.lossToWin+'↑','diffGames',p.differentGames,'ownEncore',p.ownEncore.old+'→'+p.ownEncore.guard,'fail',p.ownEncoreFail.old+'→'+p.ownEncoreFail.guard,'winsWithRivalStay',p.winsWithRivalStay.old+'→'+p.winsWithRivalStay.guard);
    }
    out.cases[c.id]=res;
  }
  const file=process.env.OUT||path.join(__dirname,'output','encore-guard-nonregression.json');
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(out,null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={newSix};
