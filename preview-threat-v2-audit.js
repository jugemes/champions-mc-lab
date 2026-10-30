#!/usr/bin/env node
'use strict';
// PR #60 audit for previewPolicy:'threat-aware-v2' (repair of PR #58).
// Evidence kinds, kept apart:
//  1. PREVIEW: what each policy selects from the public six only.
//  2. SWEEP: our fixed (three, lead) against EVERY rival three x lead (20x3)
//     in real pinned-Showdown battles. This is an audit oracle for the
//     experimenter, never an input of any preview policy.
//  3. BATTLE: old vs new policy, same seeds, both sides, rival conditions
//     legacy / threat-aware-v2 / forcedA / forcedB.
// Heuristic baseline turn AI on both sides. NOT a ladder win rate.
const fs=require('node:fs');
const path=require('node:path');
const {Bot,normalize,hashSeed,load,chooseThree}=require('./lab');
const {choosePreview,seededRandom}=require('./preview-policy');
const {matchup}=require('./lab');
const {chooseStrategicPreview}=require('./preview-strategic');
const {chooseThreatAwarePreview}=require('./preview-threat-aware');
const {chooseThreatAwareV2,explainThreatAwareV2}=require('./preview-threat-aware-v2');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {holdoutGroups}=require('./holdout-v2-teams');
const {SCENARIOS}=require('./preview-threat-audit');
const FORMAT='gen9championsbssregmc';
const TRIPLES=(()=>{const t=[];for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<6;c++)t.push([a,b,c]);return t;})();

function policies(dex,team,six,seed){
  const pick=idx=>idx.map(i=>team[i-1].species);
  return {
    legacy:pick(chooseThree(dex,team,six)),
    stochastic:pick(choosePreview(dex,team,six,seededRandom(seed,'p1'),matchup)),
    strategic:pick(chooseStrategicPreview(dex,team,six,seededRandom(seed,'p1'),matchup)),
    'threat-aware':pick(chooseThreatAwarePreview(dex,team,six)),
    'threat-aware-v2':pick(chooseThreatAwareV2(dex,team,six)),
  };
}
// One real battle. ownForced/foeForced are experiment conditions (lead first),
// never information given to a preview policy.
async function battle(sim,own,foe,seed,{ownPolicy='legacy',foePolicy='legacy',ownForced=null,foeForced=null,reverse=false,keepLog=false}){
  const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
  const dex=sim.Dex.mod('champions');
  const trace={choices:[],selections:[],errors:[]};
  const [p1,p2]=reverse?[foe,own]:[own,foe];
  const ownSide=reverse?'p2':'p1',foeSide=reverse?'p1':'p2';
  const mk=(stream,team,side)=>side===ownSide
    ?new Bot(stream,dex,team,side,trace,ownForced,null,{previewPolicy:ownPolicy,seed})
    :new Bot(stream,dex,team,side,trace,foeForced,null,{previewPolicy:foePolicy,seed});
  const b1=mk(streams.p1,p1,'p1'),b2=mk(streams.p2,p2,'p2');
  let winner='',turns=0;const log=[];
  const watch=(async()=>{for await(const msg of streams.omniscient){
    if(keepLog)log.push(msg);
    for(const line of msg.split('\n')){
      if(line.startsWith('|win|'))winner=line.slice(5);
      if(line.startsWith('|turn|'))turns=Number(line.slice(6));
    }
  }})();
  const r1=b1.run(),r2=b2.run();
  await streams.omniscient.write('>start '+JSON.stringify({formatid:FORMAT,seed})+
    '\n>player p1 '+JSON.stringify({name:'p1',team:normalize(p1)})+
    '\n>player p2 '+JSON.stringify({name:'p2',team:normalize(p2)}));
  await Promise.all([watch,r1,r2]);
  if(!winner)throw Error('no winner '+JSON.stringify(trace.errors));
  const sel=side=>trace.selections.find(x=>x.side===side);
  return {won:winner===ownSide,turns,errors:trace.errors.length,own:sel(ownSide).chosen,foe:sel(foeSide).chosen,
    log:keepLog?log.join('\n'):undefined};
}
// T1-T3 of a saved log, public protocol lines only.
function firstTurns(log,n=3){
  const out=[];let turn=0;
  for(const line of log.split('\n')){
    if(line.startsWith('|turn|'))turn=Number(line.slice(6));
    if(turn>n)break;
    if(/^\|(switch|move|-mega|-boost|faint|-weather|-damage|-activate|cant)\|/.test(line))out.push('T'+turn+' '+line);
  }
  return out;
}
const allRivalConfigs=six=>TRIPLES.flatMap(t=>t.map(lead=>[six[lead],...t.filter(i=>i!==lead).map(i=>six[i])]));
async function sweep(sim,team,foe,ownConfigs,{seeds=1,seedBase=6100000}={}){
  const six=foe.map(p=>p.species),rivals=allRivalConfigs(six),out=[];
  for(const own of ownConfigs){
    const rows=[];
    for(const rv of rivals)for(let s=0;s<seeds;s++)for(const reverse of [false,true]){
      const seed=hashSeed(seedBase+s*7+rivals.indexOf(rv)*31);
      const r=await battle(sim,structuredClone(team),structuredClone(foe),seed,{ownForced:own,foeForced:rv,reverse});
      rows.push({rival:rv.join('/'),won:r.won});
    }
    const byRival={};
    for(const r of rows){byRival[r.rival]=byRival[r.rival]||0;byRival[r.rival]+=r.won;}
    const per=Object.values(byRival).map(w=>w/(2*seeds));
    const sorted=[...per].sort((a,b)=>a-b);
    out.push({own:own.join('/'),wins:rows.filter(r=>r.won).length,n:rows.length,
      worst10:Number((sorted.slice(0,10).reduce((a,b)=>a+b,0)/10).toFixed(3)),
      zeroRivals:per.filter(x=>x===0).length,byRival});
  }
  return out;
}
async function compare(sim,team,gs,{seeds=2,seedBase=6200000,ownPolicies,modes}){
  const rows=[];
  for(const g of gs){
    const gi=gs.indexOf(g);
    const all={'rival-legacy':{foePolicy:'legacy'},'rival-v2':{foePolicy:'threat-aware-v2'},
      forcedA:{foeForced:g.forcedA},forcedB:{foeForced:g.forcedB}};
    for(const ownPolicy of ownPolicies)for(const mode of modes){
      const m=all[mode];if(m.foeForced&&!m.foeForced.length)continue;
      for(let s=0;s<seeds;s++)for(const reverse of [false,true]){
        const seed=hashSeed(seedBase+gi*1000+s*10);
        const r=await battle(sim,structuredClone(team),structuredClone(g.team),seed,
          {ownPolicy,foePolicy:m.foePolicy||'legacy',foeForced:m.foeForced||null,reverse});
        delete r.log;
        rows.push({group:g.name,ownPolicy,mode,seed:seed.join('-'),reverse,...r});
      }
    }
  }
  return rows;
}
function table(rows){
  const agg={};
  for(const r of rows){const k=r.group+'|'+r.mode+'|'+r.ownPolicy;agg[k]=agg[k]||{w:0,n:0,picks:new Set()};agg[k].w+=r.won;agg[k].n++;agg[k].picks.add(r.own.join('/'));}
  return agg;
}
async function main(){
  const sim=load(),dex=sim.Dex.mod('champions'),team=reportedLive(),before=JSON.stringify(team);
  const outDir=path.join(__dirname,'output','preview-threat-v2-audit');
  fs.mkdirSync(outDir,{recursive:true});
  const part=process.env.V2_PART||'preview';
  const tag=process.env.V2_TAG||part;
  const result={part,tag,showdown:process.env.SHOWDOWN_SHA||'see SHOWDOWN_DIR git HEAD',format:FORMAT,
    note:'Heuristic baseline turn AI on both sides; NOT a ladder win rate.'};
  if(part==='preview'){
    result.preview={};
    for(const [k,six] of [...Object.entries(SCENARIOS),...groups.map(g=>[g.name,g.team.map(p=>p.species)]),
      ...holdoutGroups.map(g=>[g.name,g.team.map(p=>p.species)])]){
      result.preview[k]={publicSix:six,policies:policies(dex,team,six,[2026,10,30,1]),
        v2:explainThreatAwareV2(dex,team,six,{top:k in SCENARIOS?8:3})};
      console.log(k.padEnd(34),Object.entries(result.preview[k].policies).map(([p,x])=>p+'='+x.join('/')).join(' | '));
    }
  }
  if(part==='sweep'){
    const gname=process.env.V2_GROUP||'01_M7_golisopod_balance';
    const g=[...groups,...holdoutGroups].find(x=>x.name===gname);
    const six=g.team.map(p=>p.species);
    const pol=policies(dex,team,six,[2026,10,30,1]);
    const extra=(process.env.V2_OWN||'').split(';').filter(Boolean).map(s=>s.split('/'));
    const configs=[...new Map([...Object.values(pol),...extra].map(c=>[c.join('/'),c])).values()];
    result.group=gname;result.policies=pol;
    result.sweep=await sweep(sim,team,g.team,configs,{seeds:Number(process.env.V2_SEEDS||1)});
    for(const s of result.sweep)console.log(s.own.padEnd(36),s.wins+'/'+s.n,'worst10',s.worst10,'zero',s.zeroRivals);
  }
  if(part==='compare'){
    const set=process.env.V2_SET||'main';
    const gs=set==='holdout'?holdoutGroups:groups;
    const ownPolicies=(process.env.V2_POLICIES||'legacy,strategic,threat-aware,threat-aware-v2').split(',');
    const modes=(process.env.V2_MODES||'rival-legacy,rival-v2,forcedA,forcedB').split(',');
    result.battles=await compare(sim,team,gs,{seeds:Number(process.env.V2_SEEDS||2),
      seedBase:Number(process.env.V2_SEED_BASE||6200000),ownPolicies,modes});
    if(result.battles.some(r=>r.errors))throw Error('choice errors in battles');
    for(const [k,v] of Object.entries(table(result.battles)))console.log(k.padEnd(58),v.w+'/'+v.n,[...v.picks].join(' ; '));
  }
  if(JSON.stringify(team)!==before)throw Error('live six mutated');
  fs.writeFileSync(path.join(outDir,'result-'+tag+'.json'),JSON.stringify(result,null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={battle,sweep,compare,firstTurns,allRivalConfigs,policies,table};
