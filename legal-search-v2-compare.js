#!/usr/bin/env node
'use strict';
// PR #66 request (re-audit of PR #65): legacy / strategic / legal-search (v1,
// PR #65 unchanged) / legal-search-v2 PREVIEW picks, then full pinned-Showdown
// games against each case's hidden hypothesis sets.
// - Preview inputs: our six sets + rival PUBLIC species names only.
// - Rival three: forcedA / forcedB / the rival's own legacy preview.
// - Same seeds and side reversal for every policy (reuses legal-search-compare
//   battle(); 3 seed bases x 2 x reverse = 12 games per cell).
// - Both sides' games are tagged with misplay-tags-v2; a win is "clean" only
//   if the RIVAL shows no tag. Own-side tags are reported too.
// - HOLD_* cases are public sixes never used by PR #65 (holdout-20261030.js
//   new_sun_balance / new_psychic_offense), added before v2 was run on them.
// Heuristic AI vs heuristic AI. NOT a ladder win rate.
//   SHOWDOWN_DIR=... CASES='^A_' OUT=output/v2-A.json node legal-search-v2-compare.js
const fs=require('node:fs');
const path=require('node:path');
const {hashSeed,load,chooseThree,matchup}=require('./lab');
const {seededRandom}=require('./preview-policy');
const {chooseStrategicPreview}=require('./preview-strategic');
const {chooseLegalSearch,shortBattle}=require('./preview-legal-search');
const {reportedLive}=require('./reported-live-roster-20261027');
const {teams:holdout59}=require('./holdout-20261030');
const {caseList:v1Cases,battle}=require('./legal-search-compare');
const {misplaysV2,anyTag,V1_TAGS}=require('./misplay-tags-v2');
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640';
const SEED_BASES=[7400000,7500000,7600000];
function caseList(){
  const h=holdout59();
  return [...v1Cases(),
    {id:'HOLD_sun_balance',gi:7,holdout:true,...h.new_sun_balance},
    {id:'HOLD_psychic_offense',gi:8,holdout:true,...h.new_psychic_offense}];
}
function earlyLines(log,ownSide,maxTurn=4){
  const out=[];let turn=0;
  for(const line of log.split('\n')){
    if(line.startsWith('|turn|')){turn=Number(line.slice(6));if(turn>maxTurn)break;out.push('T'+turn);continue;}
    const a=line.split('|');
    if(['move','switch','faint','-mega','-weather','-fieldstart','-prepare'].includes(a[1]))
      out.push(a.slice(1,4).join('|').replace(new RegExp(ownSide+'a: ','g'),'OWN:').replace(/p[12]a: /g,'RIVAL:'));
  }
  return out;
}
// P0-4 diagnostic: v1 gave each rival branch its own seed. Replaying ONLY
// the 'ai' branch under those four seeds shows how much of v1's "worst
// branch" is RNG; v2's shared seed holds the RNG fixed across branches.
async function seedConfound(sim,own,v2,{cells=12,seedBase}){
  const best=v2.table[0],rows=[];
  for(const p of best.per.slice(0,cells)){
    const c=v2.cells[p.cell];
    const sc=v2._scenarioTeams[c.si];
    const v1ai=[];
    for(let b=0;b<4;b++)v1ai.push((await shortBattle(sim,{own:structuredClone(own),ownThree:best.three,foe:structuredClone(sc),
      foeThree:c.three,seed:hashSeed(seedBase+p.cell*10+b),branch:'ai'})).value);
    const r0=p.byRep[0];
    rows.push({cell:p.cell,rival:c.three.join('/'),v1SameActionSpread:+(Math.max(...v1ai)-Math.min(...v1ai)).toFixed(3),
      v2BranchSpread:+(Math.max(...Object.values(r0.vals))-Math.min(...Object.values(r0.vals))).toFixed(3),
      v2RepSpread:+(Math.max(...p.byRep.map(x=>x.worst))-Math.min(...p.byRep.map(x=>x.worst))).toFixed(3)});
  }
  const avg=k=>+(rows.reduce((s,r)=>s+r[k],0)/rows.length).toFixed(3);
  return {rows,mean:{v1SameActionSpread:avg('v1SameActionSpread'),v2BranchSpread:avg('v2BranchSpread'),v2RepSpread:avg('v2RepSpread')}};
}
async function picksFor(sim,own,foeSpecies,c){
  const dex=sim.Dex.mod('champions');
  const names=idx=>idx.map(n=>own[n-1].species);
  const seedBase=7300000+c.gi*10000;
  const v1=await chooseLegalSearch(sim,own,foeSpecies,{seedBase});
  const t=Date.now();
  const v2=await chooseLegalSearch(sim,own,foeSpecies,{seedBase,version:'v2'});
  const ms=Date.now()-t;
  // keep scenario teams for the diagnostic only (not saved)
  const {legalRoleHypotheses,coverageScenarios}=require('./legal-role-hypotheses');
  const {toLabTeam}=require('./preview-legal-search');
  v2._scenarioTeams=coverageScenarios(foeSpecies.map(s=>legalRoleHypotheses(sim,s,{version:'v2'})),{max:8}).scenarios.map(toLabTeam);
  const confound=process.env.CONFOUND==='0'?null:await seedConfound(sim,own,v2,{seedBase});
  const top=v2.table.slice(0,6).map(x=>({three:x.three,score:+x.score.toFixed(3),min:+x.min.toFixed(3),mean:+x.mean.toFixed(3),
    rankMean:x.rankMean,rankMin:x.rankMin,
    worst:{rival:x.worstCell.rival,scenario:x.worstCell.scenario,value:+x.worstCell.value.toFixed(3),
      branches:x.worstCell.byRep.map(r=>r.worstBranch+':'+r.worst.toFixed(2)+(r.reverse?'(p2)':'(p1)'))}}));
  // Best option of each trio (lead chosen within the trio), to show the
  // ranks of trios v1 never evaluated (v1 only had its top 6 trios).
  const v1Trios=new Set(v1.table.map(x=>[...x.three].sort().join('/')));
  const byTrio={};
  for(const x of v2.table){const k=[...x.three].sort().join('/');if(!byTrio[k])byTrio[k]={trio:k,best:x.three.join('/'),score:+x.score.toFixed(3),
    rank:v2.table.indexOf(x)+1,inV1Pool:v1Trios.has(k)};}
  return {
    picks:{
      legacy:names(chooseThree(dex,own,foeSpecies)),
      strategic:names(chooseStrategicPreview(dex,own,foeSpecies,seededRandom(hashSeed(7200000+c.gi),'p1'),matchup)),
      'legal-search':v1.chosen,
      'legal-search-v2':v2.chosen,
    },
    v2:{ms,unverified:v2.unverified,evidence:v2.evidence,scenarios:v2.scenarios,top,trios:Object.values(byTrio),
      gap12:+(v2.table[0].score-v2.table[1].score).toFixed(3),
      v1Pick:{three:v1.chosen,v2Rank:v2.table.findIndex(x=>x.three.join()===v1.chosen.join())+1},confound},
  };
}
async function runCase(sim,c){
  const own=reportedLive(),foeSpecies=c.team.map(p=>p.species);
  const {picks,v2}=await picksFor(sim,own,foeSpecies,c);
  const rivals={forcedA:c.forcedA,forcedB:c.forcedB,rivalLegacy:null};
  const rows=[],samples=[],done=new Map();
  for(const [policy,three] of Object.entries(picks)){
    const key=three.join('/');
    for(const [rname,foeForced] of Object.entries(rivals))for(const base of SEED_BASES)for(const s of [0,1])for(const reverse of [false,true]){
      const seed=hashSeed(base+c.gi*1000+s*10);
      const k=key+'|'+rname+'|'+seed.join('-')+'|'+reverse;
      let r=done.get(k);
      if(!r){r=await battle(sim,structuredClone(own),structuredClone(c.team),seed,{ownForced:three,foeForced,reverse});
        const m=misplaysV2(r.log);r.tags={own:m[r.ownSide],foe:m[r.ownSide==='p1'?'p2':'p1']};done.set(k,r);}
      if(r.errors)throw Error('choice errors '+c.id+' '+k);
      const nz=o=>Object.fromEntries(Object.entries(o).filter(([,v])=>v));
      rows.push({policy,three:key,rival:rname,foe:r.foe.join('/'),seed:seed.join('-'),reverse,won:r.won,turns:r.turns,
        foeTags:nz(r.tags.foe),ownTags:nz(r.tags.own),foeMisplay:anyTag(r.tags.foe),foeMisplayV1:anyTag(r.tags.foe,V1_TAGS),ownMisplay:anyTag(r.tags.own)});
      if(!r.won&&!samples.some(x=>x.three===key&&x.rival===rname))
        samples.push({three:key,rival:rname,foe:r.foe.join('/'),seed:seed.join('-'),reverse,ownTags:nz(r.tags.own),t1to4:earlyLines(r.log,r.ownSide)});
    }
  }
  return {picks,v2,rows,lossSamples:samples};
}
function summarize(rows){
  const by={};
  for(const r of rows){
    const p=by[r.policy]||(by[r.policy]={three:r.three,total:[0,0],cleanV1:[0,0],clean:[0,0],ownTagged:0,foeTagCounts:{},ownTagCounts:{},cells:{}});
    p.total[0]+=r.won;p.total[1]++;
    if(!r.foeMisplayV1){p.cleanV1[0]+=r.won;p.cleanV1[1]++;}
    if(!r.foeMisplay){p.clean[0]+=r.won;p.clean[1]++;}
    if(r.ownMisplay)p.ownTagged++;
    for(const [k,v] of Object.entries(r.foeTags))p.foeTagCounts[k]=(p.foeTagCounts[k]||0)+(v>0);
    for(const [k,v] of Object.entries(r.ownTags))p.ownTagCounts[k]=(p.ownTagCounts[k]||0)+(v>0);
    const c=p.cells[r.rival]||(p.cells[r.rival]={foe:new Set(),w:0,n:0,cleanW:0,cleanN:0});
    c.foe.add(r.foe);c.w+=r.won;c.n++;if(!r.foeMisplay){c.cleanW+=r.won;c.cleanN++;}
  }
  for(const p of Object.values(by))for(const c of Object.values(p.cells))c.foe=[...c.foe];
  return by;
}
async function main(){
  const sim=load();
  const only=process.env.CASES?new RegExp(process.env.CASES):null;
  const out={showdown:SHOWDOWN,format:'gen9championsbssregmc',seedBases:SEED_BASES,own:'reportedLive() (docs/REAL-BATTLE-CASES-2026-10-27.md)',
    note:'Preview picks use rival PUBLIC species only. Full games: baseline turn AI both sides, 6 seeds x side-reverse per rival three. NOT a ladder win rate. Same seed reused across policies, so policies picking the same three share games.',
    cases:{}};
  for(const c of caseList().filter(c=>!only||only.test(c.id))){
    const r=await runCase(sim,c);
    const sum=summarize(r.rows);
    out.cases[c.id]={holdout:Boolean(c.holdout),public:c.team.map(p=>p.species),picks:r.picks,v2:r.v2,summary:sum,
      failingSeeds:r.rows.filter(x=>!x.won).map(x=>[x.policy,x.rival,x.seed,x.reverse?'rev':'fwd',x.foe].join(' ')),
      lossSamples:r.lossSamples};
    console.log(c.id,'v2 coverage',JSON.stringify(r.v2.evidence.coverage),'unverified',JSON.stringify(r.v2.unverified),'ms',r.v2.ms,'gap',r.v2.gap12);
    for(const [p,s] of Object.entries(sum))
      console.log(' ',p.padEnd(16),s.three.padEnd(32),'all',s.total.join('/'),'cleanV1',s.cleanV1.join('/'),'clean',s.clean.join('/'),
        Object.entries(s.cells).map(([k,v])=>k+' '+v.w+'/'+v.n+' clean '+v.cleanW+'/'+v.cleanN).join(' | '));
  }
  const file=process.env.OUT||path.join(__dirname,'output','legal-search-v2-compare.json');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(out,null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={caseList,summarize,seedConfound};
