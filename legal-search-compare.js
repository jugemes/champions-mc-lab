#!/usr/bin/env node
'use strict';
// PR #64 audit harness: legacy vs strategic vs legal-search PREVIEW picks.
// 1. Each policy picks our three + lead from our six and the rival's PUBLIC
//    species names only (legal-search additionally runs short pinned-Showdown
//    branches against its OWN legal hypotheses, never the case sets).
// 2. Each pick is then played in full pinned-Showdown games against the case
//    team's actual hypothesis sets, with the rival three forced to forcedA /
//    forcedB or chosen by the rival's own legacy preview. Same seeds and side
//    reversal for every policy. Baseline turn AI on both sides.
// 3. Every game is tagged with rival/own turn-AI misplays (setup spam, Encore
//    repeat, choice-locked into an immunity). Wins in flagged games are
//    reported separately and must not be read as preview strength.
// Heuristic AI vs heuristic AI. NOT a ladder win rate.
const fs=require('node:fs');
const path=require('node:path');
const {Bot,normalize,hashSeed,load,chooseThree,matchup}=require('./lab');
const {seededRandom}=require('./preview-policy');
const {chooseStrategicPreview}=require('./preview-strategic');
const {chooseLegalSearch}=require('./preview-legal-search');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {teams:holdout59}=require('./holdout-20261030');
const {teams:holdoutClaude}=require('./holdout-20261030-claude');
const FORMAT='gen9championsbssregmc';
const SHOWDOWN='3a766f2cfb5e51c1e428cfe87d0dba91a8f01640';
const SEED_BASES=[7400000,7500000,7600000];
const SETUP=new Set(['Swords Dance','Dragon Dance','Nasty Plot','Calm Mind','Quiver Dance','Bulk Up','Shell Smash']);
function caseList(){
  const g=n=>groups.find(x=>x.name===n);
  const h=holdout59(),c=holdoutClaude();
  return [
    {id:'A_golisopod',gi:0,...g('01_M7_golisopod_balance')},
    {id:'B_lucarioZ',gi:1,...g('02_M7_lucarioZ_offense')},
    {id:'C_charizardY',gi:2,...g('03_M7_charizardY_offense')},
    {id:'C_charizardX',gi:3,...g('04_M7_charizardX_offense')},
    {id:'Real_indeedee_scarf',gi:4,...h.realB_indeedee_scarf},
    {id:'Real_indeedee_sash',gi:5,...h.realB_indeedee_sash},
    {id:'NEW_realE_sun',gi:6,holdout:true,...c.claude_realE_sun},
  ];
}
// Turn-AI misplay tags per side, from the public battle log.
function misplays(log){
  const out={p1:{setupSpam:0,encoreRepeat:0,immuneRepeat:0},p2:{setupSpam:0,encoreRepeat:0,immuneRepeat:0}};
  const last={p1:[],p2:[]};let pending=null;
  for(const line of log.split('\n')){
    const a=line.split('|');
    if(a[1]==='move'){
      const side=a[2].slice(0,2),user=a[2].slice(5),move=a[3];
      const h=last[side];h.push({user,move,immune:false});
      const n=h.length;
      if(SETUP.has(move)&&n>=3&&h.slice(-3).every(x=>x.user===user&&x.move===move))out[side].setupSpam++;
      if(move==='Encore'&&n>=2&&h[n-2].user===user&&h[n-2].move==='Encore')out[side].encoreRepeat++;
      pending={side,entry:h[n-1]};
    } else if(a[1]==='-immune'&&pending){
      pending.entry.immune=true;
      const h=last[pending.side],n=h.length;
      if(n>=2&&h[n-2].immune&&h[n-2].user===h[n-1].user&&h[n-2].move===h[n-1].move)out[pending.side].immuneRepeat++;
    } else if(a[1]==='switch'||a[1]==='turn')pending=null;
  }
  return out;
}
const flagged=m=>m.setupSpam+m.encoreRepeat+m.immuneRepeat>0;
async function battle(sim,own,foe,seed,{ownForced,foeForced,reverse}){
  const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
  const dex=sim.Dex.mod('champions');
  const trace={choices:[],selections:[],errors:[]};
  const [p1,p2]=reverse?[foe,own]:[own,foe];
  const ownSide=reverse?'p2':'p1',foeSide=reverse?'p1':'p2';
  const mk=(stream,team,side)=>new Bot(stream,dex,team,side,trace,side===ownSide?ownForced:(foeForced||null),null,{previewPolicy:'legacy',seed});
  const b1=mk(streams.p1,p1,'p1'),b2=mk(streams.p2,p2,'p2');
  let winner='',turns=0;const log=[];
  const watch=(async()=>{for await(const msg of streams.omniscient){log.push(msg);
    for(const line of msg.split('\n')){if(line.startsWith('|win|'))winner=line.slice(5);if(line.startsWith('|turn|'))turns=Number(line.slice(6));}}})();
  const r1=b1.run(),r2=b2.run();
  await streams.omniscient.write('>start '+JSON.stringify({formatid:FORMAT,seed})+
    '\n>player p1 '+JSON.stringify({name:'p1',team:normalize(p1)})+'\n>player p2 '+JSON.stringify({name:'p2',team:normalize(p2)}));
  await Promise.all([watch,r1,r2]);
  if(!winner)throw Error('no winner '+JSON.stringify(trace.errors));
  const text=log.join('\n'),m=misplays(text);
  const sel=s=>trace.selections.find(x=>x.side===s);
  return {won:winner===ownSide,turns,errors:trace.errors.length,foe:sel(foeSide).chosen,
    ownMisplay:m[ownSide],foeMisplay:m[foeSide],log:text,ownSide};
}
function earlyLines(log,ownSide,maxTurn=3){
  const out=[];let turn=0;
  for(const line of log.split('\n')){
    if(line.startsWith('|turn|')){turn=Number(line.slice(6));if(turn>maxTurn)break;out.push('T'+turn);continue;}
    const a=line.split('|');
    if(['move','switch','faint','-mega','-weather'].includes(a[1]))
      out.push(a.slice(1,4).join('|').replace(new RegExp(ownSide+'a: ','g'),'OWN:').replace(/p[12]a: /g,'RIVAL:'));
  }
  return out;
}
async function picksFor(sim,own,foeSpecies,c){
  const dex=sim.Dex.mod('champions');
  const names=idx=>idx.map(n=>own[n-1].species);
  const t=Date.now();
  const ls=await chooseLegalSearch(sim,own,foeSpecies,{seedBase:7300000+c.gi*10000});
  const ms=Date.now()-t;
  const v1=await chooseLegalSearch(sim,own,foeSpecies,{seedBase:7300000+c.gi*10000,rivalLeads:'best'});
  return {
    picks:{
      legacy:names(chooseThree(dex,own,foeSpecies)),
      strategic:names(chooseStrategicPreview(dex,own,foeSpecies,seededRandom(hashSeed(7200000+c.gi),'p1'),matchup)),
      'legal-search-v1':v1.chosen,
      'legal-search':ls.chosen,
    },
    search:{ms,cells:ls.cells.map(x=>({scenario:x.si,rival:x.three})),scenarios:ls.scenarios,
      top:ls.table.slice(0,5).map(x=>({three:x.three,score:+x.score.toFixed(3),min:+x.min.toFixed(3),mean:+x.mean.toFixed(3),
        worst:{rival:x.worstCell.rival,scenario:x.worstCell.scenario,branch:x.worstCell.worstBranch,value:+x.worstCell.value.toFixed(3)}}))},
  };
}
async function runCase(sim,c){
  const own=reportedLive(),foeSpecies=c.team.map(p=>p.species);
  const {picks,search}=await picksFor(sim,own,foeSpecies,c);
  const rivals={forcedA:c.forcedA,forcedB:c.forcedB,rivalLegacy:null};
  const rows=[],samples=[];
  const done=new Map();
  for(const [policy,three] of Object.entries(picks)){
    const key=three.join('/');
    for(const [rname,foeForced] of Object.entries(rivals))for(const base of SEED_BASES)for(const s of [0,1])for(const reverse of [false,true]){
      const seed=hashSeed(base+c.gi*1000+s*10);
      const k=key+'|'+rname+'|'+seed.join('-')+'|'+reverse;
      let r=done.get(k);
      if(!r){r=await battle(sim,structuredClone(own),structuredClone(c.team),seed,{ownForced:three,foeForced,reverse});done.set(k,r);}
      if(r.errors)throw Error('choice errors '+c.id+' '+k);
      rows.push({policy,three:key,rival:rname,foe:r.foe.join('/'),seed:seed.join('-'),reverse,won:r.won,turns:r.turns,
        foeMisplay:flagged(r.foeMisplay),ownMisplay:flagged(r.ownMisplay)});
      if(!r.won&&!samples.some(x=>x.three===key&&x.rival===rname))
        samples.push({three:key,rival:rname,foe:r.foe.join('/'),seed:seed.join('-'),reverse,t1to3:earlyLines(r.log,r.ownSide)});
    }
  }
  return {picks,search,rows,lossSamples:samples};
}
function summarize(rows){
  const by={};
  for(const r of rows){
    const p=by[r.policy]||(by[r.policy]={three:r.three,total:[0,0],clean:[0,0],cells:{}});
    p.total[0]+=r.won;p.total[1]++;
    if(!r.foeMisplay){p.clean[0]+=r.won;p.clean[1]++;}
    const c=p.cells[r.rival]||(p.cells[r.rival]={foe:new Set(),w:0,n:0,foeMisplayWins:0});
    c.foe.add(r.foe);c.w+=r.won;c.n++;if(r.won&&r.foeMisplay)c.foeMisplayWins++;
  }
  for(const p of Object.values(by)){
    for(const c of Object.values(p.cells))c.foe=[...c.foe];
    p.worstCell=Object.entries(p.cells).sort((a,b)=>a[1].w/a[1].n-b[1].w/b[1].n)[0][0];
  }
  return by;
}
async function main(){
  const sim=load();
  const only=process.env.CASES?new RegExp(process.env.CASES):null;
  const out={showdown:SHOWDOWN,format:FORMAT,seedBases:SEED_BASES,own:'reportedLive() (docs/REAL-BATTLE-CASES-2026-10-27.md)',
    note:'Preview picks use rival PUBLIC species only. Full games: baseline turn AI both sides, 6 seeds x side-reverse per rival three. NOT a ladder win rate. Same seed reused across policies, so cells sharing a three share games.',
    cases:{}};
  for(const c of caseList().filter(c=>!only||only.test(c.id))){
    const r=await runCase(sim,c);
    const sum=summarize(r.rows);
    out.cases[c.id]={holdout:Boolean(c.holdout),public:c.team.map(p=>p.species),picks:r.picks,search:r.search,summary:sum,
      failingSeeds:r.rows.filter(x=>!x.won).map(x=>[x.policy,x.rival,x.seed,x.reverse?'rev':'fwd',x.foe].join(' ')),
      lossSamples:r.lossSamples};
    for(const [p,s] of Object.entries(sum))
      console.log(c.id.padEnd(20),p.padEnd(13),s.three.padEnd(32),'all',s.total.join('/'),'noFoeMisplay',s.clean.join('/'),
        Object.entries(s.cells).map(([k,v])=>k+' '+v.w+'/'+v.n+(v.foeMisplayWins?'('+v.foeMisplayWins+'mis)':'')).join(' | '));
  }
  const file=process.env.OUT||path.join(__dirname,'output','legal-search-compare.json');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(out,null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={misplays,caseList,battle,summarize};
