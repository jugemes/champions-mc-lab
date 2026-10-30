#!/usr/bin/env node
'use strict';
// PR #59 / Issue #20: real pinned-Showdown counterfactuals for the PR #58
// counterexamples. OUR three and lead are forced (experiment condition) so
// that ONLY the lead differs between rows; the rival three is forced or
// chosen by its own preview policy. Baseline turn AI on both sides.
// Output: per-battle result + compact T1..T4 public event lines.
// Heuristic AI vs heuristic AI. NOT a ladder win rate.
const fs=require('node:fs');
const path=require('node:path');
const {Bot,normalize,hashSeed,load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {teams:holdoutTeams}=require('./holdout-20261030');
const findGroup=name=>groups.find(x=>x.name===name)||(()=>{const t=holdoutTeams()[name.replace(/^H_/,'')];
  return t&&{name,team:t.team,forcedA:t.forcedA,forcedB:t.forcedB};})();
const FORMAT='gen9championsbssregmc';
const SEED_BASES=[5600000,5700000,5800000];
const KEEP=new Set(['move','switch','drag','-damage','faint','-boost','-unboost','detailschange','-weather','cant','-status','-heal','-sidestart','-activate','-enditem','-ability','-immune','-crit','-supereffective','-resisted']);
function turnLines(log,maxTurn=4){
  const out=[];let turn=0;
  for(const line of log.split('\n')){
    if(line.startsWith('|turn|')){turn=Number(line.slice(6));if(turn>maxTurn)break;out.push('T'+turn);continue;}
    const a=line.split('|');
    if(!KEEP.has(a[1]))continue;
    // Drop the duplicated private HP lines of the omniscient stream.
    out.push(a.slice(1).filter(x=>!/^\[from\] |^\[of\] /.test(x)||true).join('|').replace(/\|\[still\]/g,''));
  }
  return out;
}
async function battle(sim,own,foe,seed,{ownForced,ownPolicy='legacy',foeForced=null,foePolicy='legacy',reverse=false}){
  const streams=sim.getPlayerStreams(new sim.BattleStream({noCatch:true}));
  const dex=sim.Dex.mod('champions');
  const trace={choices:[],selections:[],errors:[]};
  const [p1,p2]=reverse?[foe,own]:[own,foe];
  const ownSide=reverse?'p2':'p1';
  const mk=(stream,team,side)=>side===ownSide
    ?new Bot(stream,dex,team,side,trace,ownForced||null,null,{previewPolicy:ownPolicy,seed})
    :new Bot(stream,dex,team,side,trace,foeForced||null,null,{previewPolicy:foePolicy,seed});
  const b1=mk(streams.p1,p1,'p1'),b2=mk(streams.p2,p2,'p2');
  let winner='',turns=0;const log=[];
  const watch=(async()=>{for await(const msg of streams.omniscient){
    log.push(msg);
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
  const foeSide=reverse?'p1':'p2';
  return {won:winner===ownSide,turns,errors:trace.errors.length,own:sel(ownSide).chosen,ownLead:sel(ownSide).lead,
    foe:sel(foeSide).chosen,foeLead:sel(foeSide).lead,ownSide,log:log.join('\n')};
}
// The PR #58 cells, seeds identical to preview-threat-audit.js.
const CASES=[
  {id:'A_forcedA',group:'01_M7_golisopod_balance',gi:0,three:['Hydreigon','Primarina','Metagross'],rival:{foeForced:'forcedA'}},
  {id:'B_rivalThreatAware',group:'02_M7_lucarioZ_offense',gi:1,three:['Metagross','Primarina','Garchomp'],rival:{foePolicy:'threat-aware'}},
  {id:'B_rivalThreatAware_legacyThree',group:'02_M7_lucarioZ_offense',gi:1,three:['Garchomp','Hydreigon','Metagross'],rival:{foePolicy:'threat-aware'}},
  // Same rival three as A forcedA but the rival LEADS Primarina: is the
  // Metagross lead an error or a lead guess?
  {id:'A_forcedA_rivalPrimarinaLead',group:'01_M7_golisopod_balance',gi:0,three:['Hydreigon','Primarina','Metagross'],rival:{foeList:['Primarina','Golisopod','Garchomp']}},
  // B without Rotom-Wash vs the Corviknight cycle three (forcedB).
  {id:'B_forcedB_v2three',group:'02_M7_lucarioZ_offense',gi:1,three:['Metagross','Hydreigon','Garchomp'],rival:{foeForced:'forcedB'}},
  {id:'B_forcedB_rotomThree',group:'02_M7_lucarioZ_offense',gi:1,three:['Rotom-Wash','Metagross','Garchomp'],rival:{foeForced:'forcedB'}},
  // C: Charizard Y / X aces; Tyranitar and Garchomp leads.
  {id:'C_Y_forcedA_v2three',group:'03_M7_charizardY_offense',gi:2,three:['Metagross','Primarina','Garchomp'],rival:{foeForced:'forcedA'}},
  {id:'C_Y_forcedA_ttarThree',group:'03_M7_charizardY_offense',gi:2,three:['Tyranitar','Garchomp','Metagross'],rival:{foeForced:'forcedA'}},
  {id:'C_X_forcedA_v2three',group:'04_M7_charizardX_offense',gi:3,three:['Metagross','Primarina','Garchomp'],rival:{foeForced:'forcedA'}},
  {id:'C_X_forcedA_ttarThree',group:'04_M7_charizardX_offense',gi:3,three:['Tyranitar','Garchomp','Metagross'],rival:{foeForced:'forcedA'}},
  // Real case B public six, Indeedee leads (forcedA), item hypotheses.
  {id:'IndeedeeScarf_realThree',group:'H_realB_indeedee_scarf',gi:100,three:['Hydreigon','Metagross','Rotom-Wash'],rival:{foeForced:'forcedA'}},
  {id:'IndeedeeScarf_v2three',group:'H_realB_indeedee_scarf',gi:100,three:['Tyranitar','Metagross','Primarina'],rival:{foeForced:'forcedA'}},
  {id:'IndeedeeSash_realThree',group:'H_realB_indeedee_sash',gi:101,three:['Hydreigon','Metagross','Rotom-Wash'],rival:{foeForced:'forcedA'}},
  {id:'IndeedeeSash_v2three',group:'H_realB_indeedee_sash',gi:101,three:['Tyranitar','Metagross','Primarina'],rival:{foeForced:'forcedA'}},
];
async function runCase(sim,c,{keepLogs=1}={}){
  const g=findGroup(c.group),team=reportedLive();
  const rows=[];
  for(const lead of c.three){
    const ownForced=[lead,...c.three.filter(x=>x!==lead)];
    for(const base of SEED_BASES)for(let s=0;s<2;s++)for(const reverse of [false,true]){
      const seed=hashSeed(base+c.gi*1000+s*10);
      const foeForced=c.rival.foeList||(c.rival.foeForced?g[c.rival.foeForced]:null);
      const r=await battle(sim,structuredClone(team),structuredClone(g.team),seed,
        {ownForced,foeForced,foePolicy:c.rival.foePolicy||'legacy',reverse});
      const row={case:c.id,lead,ownForced,seed:seed.join('-'),seedBase:base,s,reverse,won:r.won,turns:r.turns,
        errors:r.errors,foe:r.foe,foeLead:r.foeLead};
      if(rows.filter(x=>x.lead===lead&&x.t1to4).length<keepLogs)row.t1to4=turnLines(r.log);
      rows.push(row);
    }
  }
  return rows;
}
async function main(){
  const sim=load();
  const out={showdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',format:FORMAT,seedBases:SEED_BASES,
    note:'Our three/lead forced; only the lead differs within a case. Baseline turn AI both sides. NOT a ladder win rate.',cases:{}};
  const only=process.env.CASES?new RegExp(process.env.CASES):null;
  for(const c of CASES.filter(c=>!only||only.test(c.id))){
    const rows=await runCase(sim,c,{keepLogs:Number(process.env.KEEP_LOGS||2)});
    if(rows.some(r=>r.errors))throw Error('choice errors in '+c.id);
    out.cases[c.id]={three:c.three,rival:c.rival,rows};
    for(const lead of c.three){const x=rows.filter(r=>r.lead===lead);
      console.log(c.id.padEnd(32),'lead',lead.padEnd(10),x.filter(r=>r.won).length+'/'+x.length,'foe',[...new Set(x.map(r=>r.foeLead+':'+r.foe.join('/')))].join(' ; '));}
  }
  const file=process.env.OUT||path.join(__dirname,'output','threat-lead-counterfactual.json');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(out,null,1));
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={battle,turnLines,runCase,CASES,SEED_BASES};
