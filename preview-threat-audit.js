#!/usr/bin/env node
'use strict';
// Issue #20 / PR #56 audit: legacy/stochastic/strategic vs opt-in threat-aware
// preview on the reported live six. Two kinds of evidence, kept apart:
//  1. PREVIEW: what each policy selects from the public six only (no battle).
//  2. BATTLE: real pinned-Showdown games, baseline turn AI on both sides. The
//     rival's true sets are fixtures used to RUN the battle; preview never
//     sees them (the Bot only receives |poke| species lines).
// Heuristic AI vs heuristic AI. NOT a ladder win rate.
const fs=require('node:fs');
const path=require('node:path');
const {Bot,normalize,hashSeed,load,matchup,chooseThree}=require('./lab');
const {choosePreview,seededRandom}=require('./preview-policy');
const {chooseStrategicPreview}=require('./preview-strategic');
const {explainThreatAwarePreview,chooseThreatAwarePreview}=require('./preview-threat-aware');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {opponents}=require('./preview-opponents');
const FORMAT='gen9championsbssregmc';
// Public sixes. A/B/C were written in PR #46/#53 before any hidden three.
const SCENARIOS={
  A_golisopod_mimikyu:['Golisopod','Garchomp','Primarina','Mimikyu','Hippowdon','Gholdengo'],
  B_lucario_z_corviknight:['Lucario','Garchomp','Primarina','Mimikyu','Archaludon','Corviknight'],
  C_charizard_x_y:['Charizard','Garchomp','Primarina','Mimikyu','Gholdengo','Baxcalibur'],
  // docs/REAL-BATTLE-CASES-2026-10-27.md case B (lost: Hydreigon led into Indeedee).
  real_B_indeedee:['Indeedee','Hippowdon','Garchomp','Umbreon','Gengar','Gyarados'],
};
const HOLDOUT=Object.fromEntries([
  ...groups.slice(4).map(g=>['holdout_'+g.name,g.team.map(p=>p.species)]),
  ...Object.entries(opponents).map(([k,t])=>['pool_'+k,t.map(p=>p.species)]),
]);
function policies(dex,team,six,seed){
  const pick=idx=>idx.map(i=>team[i-1].species);
  return {
    legacy:pick(chooseThree(dex,team,six)),
    stochastic:pick(choosePreview(dex,team,six,seededRandom(seed,'p1'),matchup)),
    strategic:pick(chooseStrategicPreview(dex,team,six,seededRandom(seed,'p1'),matchup)),
    'threat-aware':pick(chooseThreatAwarePreview(dex,team,six)),
  };
}
function previewPart(dex,team){
  const out={};
  for(const [k,six] of Object.entries({...SCENARIOS,...HOLDOUT})){
    out[k]={publicSix:six,policies:policies(dex,team,six,[2026,10,30,1]),
      threatAware:explainThreatAwarePreview(dex,team,six,{top:k in SCENARIOS?20:3})};
  }
  return out;
}
// Real Battle with optional forced rival three (an experiment condition, not
// information given to OUR preview).
async function battle(sim,own,foe,seed,{ownPolicy,foePolicy,foeForced,reverse}){
  const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
  const dex=sim.Dex.mod('champions');
  const trace={choices:[],selections:[],errors:[]};
  const [p1,p2]=reverse?[foe,own]:[own,foe];
  const ownSide=reverse?'p2':'p1',foeSide=reverse?'p1':'p2';
  const mk=(stream,team,side)=>side===ownSide
    ?new Bot(stream,dex,team,side,trace,null,null,{previewPolicy:ownPolicy,seed})
    :new Bot(stream,dex,team,side,trace,foeForced||null,null,{previewPolicy:foePolicy,seed});
  const b1=mk(streams.p1,p1,'p1'),b2=mk(streams.p2,p2,'p2');
  let winner='',turns=0,megas=[],log=[];
  const watch=(async()=>{for await(const msg of streams.omniscient){
    log.push(msg);
    for(const line of msg.split('\n')){
      if(line.startsWith('|win|'))winner=line.slice(5);
      if(line.startsWith('|turn|'))turns=Number(line.slice(6));
      if(line.startsWith('|detailschange|')&&line.includes('-Mega'))megas.push(line.split('|')[2].slice(0,2)+':'+line.split('|')[3].split(',')[0]);
    }
  }})();
  const r1=b1.run(),r2=b2.run();
  await streams.omniscient.write('>start '+JSON.stringify({formatid:FORMAT,seed})+
    '\n>player p1 '+JSON.stringify({name:'p1',team:normalize(p1)})+
    '\n>player p2 '+JSON.stringify({name:'p2',team:normalize(p2)}));
  await Promise.all([watch,r1,r2]);
  if(!winner)throw Error('no winner '+JSON.stringify(trace.errors));
  const sel=side=>trace.selections.find(x=>x.side===side);
  return {won:winner===ownSide,turns,errors:trace.errors.length,
    own:sel(ownSide).chosen,foe:sel(foeSide).chosen,
    foeMega:megas.filter(m=>m.startsWith(foeSide)).map(m=>m.slice(3)),log:log.join('\n')};
}
const BATTLE_GROUPS=['01_M7_golisopod_balance','02_M7_lucarioZ_offense','03_M7_charizardY_offense','04_M7_charizardX_offense',
  '05_M7_salamence_balance','06_M7_golisopod_basculegion','07_M7_baxcalibur_offense','08_M7_metagross_balance',
  '09_M7_gyarados_megagarchompZ','10_M7_lucario_hazard','11_M7_psychic_terrain','12_M7_rain','13_M7_stall','14_M7_salamence_setup'];
async function battlePart(sim,team,{seeds=2,seedBase=5600000,ownPolicies=['legacy','strategic','threat-aware'],logDir=null}={}){
  const rows=[];
  for(const gname of BATTLE_GROUPS){
    const g=groups.find(x=>x.name===gname),gi=BATTLE_GROUPS.indexOf(gname);
    const modes={'rival-legacy':{foePolicy:'legacy'},'rival-threat-aware':{foePolicy:'threat-aware'},
      forcedA:{foeForced:g.forcedA},forcedB:{foeForced:g.forcedB}};
    for(const ownPolicy of ownPolicies)for(const [mode,m] of Object.entries(modes))
      for(let s=0;s<seeds;s++)for(const reverse of [false,true]){
        const seed=hashSeed(seedBase+gi*1000+s*10);
        const r=await battle(sim,structuredClone(team),structuredClone(g.team),seed,{ownPolicy,foePolicy:m.foePolicy||'legacy',foeForced:m.foeForced,reverse});
        if(logDir&&!r.won&&gi<4){
          fs.mkdirSync(logDir,{recursive:true});
          fs.writeFileSync(path.join(logDir,[gname.slice(0,2),ownPolicy,mode,s,reverse?'rev':'fwd'].join('_')+'.log'),r.log);
        }
        delete r.log;
        rows.push({group:gname,ownPolicy,mode,seed:seed.join('-'),reverse,...r});
      }
  }
  return rows;
}
function summarize(rows){
  const key=r=>r.group.slice(0,2)+'|'+r.ownPolicy+'|'+r.mode;
  const agg={};
  for(const r of rows){const k=key(r);agg[k]=agg[k]||{w:0,n:0,picks:new Set()};agg[k].w+=r.won;agg[k].n++;agg[k].picks.add(r.own.join('/'));}
  return Object.entries(agg).map(([k,v])=>k+' '+v.w+'/'+v.n+' picks='+[...v.picks].join(' ; '));
}
async function main(){
  const sim=load(),dex=sim.Dex.mod('champions'),team=reportedLive(),before=JSON.stringify(team);
  const outDir=path.join(__dirname,'output','preview-threat-audit');
  fs.mkdirSync(outDir,{recursive:true});
  const preview=previewPart(dex,team);
  const seeds=Number(process.env.AUDIT_SEEDS||2),seedBase=Number(process.env.AUDIT_SEED_BASE||5600000);
  const ownPolicies=(process.env.AUDIT_POLICIES||'legacy,strategic,threat-aware').split(',');
  const tag=process.env.AUDIT_TAG||'default';
  const rows=await battlePart(sim,team,{seeds,seedBase,ownPolicies,logDir:path.join(outDir,'loss-logs-'+tag)});
  if(JSON.stringify(team)!==before)throw Error('live six mutated');
  if(rows.some(r=>r.errors))throw Error('choice errors in battles');
  const result={tag,seedBase,seeds,ownPolicies,showdown:process.env.SHOWDOWN_SHA||'see SHOWDOWN_DIR git HEAD',format:FORMAT,
    note:'Heuristic baseline turn AI on both sides; NOT a ladder win rate.',preview,battles:rows};
  fs.writeFileSync(path.join(outDir,'result-'+tag+'.json'),JSON.stringify(result,null,1));
  for(const [k,v] of Object.entries(preview))console.log(k.padEnd(34),Object.entries(v.policies).map(([p,x])=>p+'='+x.join('/')).join(' | '));
  console.log(summarize(rows).join('\n'));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={SCENARIOS,HOLDOUT,policies,previewPart,battle,battlePart,summarize,BATTLE_GROUPS};
