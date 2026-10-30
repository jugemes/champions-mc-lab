#!/usr/bin/env node
'use strict';
// PR #74 P0-A (ChatGPT review #5715279320 of PR #73): false negatives of
// encoreGuard 'speed' in real pinned-Showdown champions Battles, and the
// conservative 'speedSafe' fix. Each case scripts both sides for a few turns,
// records at OUR Encore decision what 'speed' / 'speedSafe' / v1 (true) would
// say from the bot's public state, and reads the engine's real outcome.
// Rival sets are legal variants of the A_golisopod fixture (TeamValidator).
// Mechanics probe, NOT a win-rate measurement.
//   SHOWDOWN_DIR=... OUT=output/encore-speed-safe.json node encore-speed-safe-audit.js
const fs=require('node:fs');
const path=require('node:path');
const {hashSeed,load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {caseList}=require('./legal-search-v2-compare');
const {battle,bench,nameOf}=require('./encore-lead-audit');
const FORMAT='gen9championsbssregmc';

function rivalTeam(edit){
  const team=structuredClone(caseList().find(c=>c.id==='A_golisopod').team);
  for(const [species,patch] of Object.entries(edit)){
    const i=team.findIndex(p=>p.species===species);
    if(i>=0)team[i]={...team[i],...patch};else team[team.findIndex(p=>p.species===patch.replaces)]={...patch,replaces:undefined};
  }
  return team.map(p=>{const {replaces,...rest}=p;return rest;});
}
const garchomp=reportedLive().find(p=>p.species==='Garchomp');
const CASES=[
  {id:'negprio_dragontail',why:'fresh surely-faster Garchomp picks Dragon Tail (-6)',
    rival:{Garchomp:{moves:['Earthquake','Dragon Claw','Rock Slide','Dragon Tail']}},
    foeThree:['Garchomp','Golisopod','Mimikyu'],ownThree:['Primarina','Metagross','Garchomp'],
    rivalPlan:{1:'Dragon Tail'},ownPlan:{1:'Encore'},encoreTurn:1,expect:'fail'},
  {id:'negprio_trickroom',why:'fresh surely-faster Mimikyu picks Trick Room (-7)',
    rival:{Mimikyu:{moves:['Play Rough','Shadow Sneak','Swords Dance','Trick Room']}},
    foeThree:['Mimikyu','Golisopod','Garchomp'],ownThree:['Primarina','Metagross','Garchomp'],
    rivalPlan:{1:'Trick Room'},ownPlan:{1:'Encore'},encoreTurn:1,expect:'fail'},
  {id:'cant_sleep_reentry',why:'non-Scarf Garchomp Rests, switches out, comes back asleep (public "slp" on the switch line): |cant|',
    rival:{Garchomp:{item:'Yache Berry',moves:['Earthquake','Dragon Claw','Rock Slide','Rest']}},
    foeThree:['Garchomp','Mimikyu','Golisopod'],ownThree:['Primarina','Metagross','Garchomp'],
    rivalPlan:{1:'Dragon Claw',2:'Rest',3:'>Mimikyu',4:'>Garchomp',5:'Dragon Claw'},
    ownPlan:{1:'Sparkling Aria',2:'Sparkling Aria',3:'Aqua Jet',4:'Aqua Jet',5:'Encore'},encoreTurn:5,expect:'fail'},
  {id:'ok_fast_no_risk',why:'fresh surely-faster Rotom-Wash (no negative-priority / failencore move in its legal pool) attacks first',
    rival:{'Rotom-Wash':{replaces:'Hippowdon',species:'Rotom-Wash',item:'Leftovers',ability:'Levitate',nature:'Timid',
      moves:['Hydro Pump','Volt Switch','Thunderbolt','Will-O-Wisp'],evs:{hp:2,atk:0,def:0,spa:32,spd:0,spe:32}}},
    foeThree:['Rotom-Wash','Golisopod','Mimikyu'],ownThree:['Primarina','Metagross','Garchomp'],
    rivalPlan:{1:'Thunderbolt'},ownPlan:{1:'Encore'},encoreTurn:1,expect:'start'},
  {id:'ok_v1_moved_before',why:'v1 normal case: Garchomp already used Rock Slide last turn, uses it again',
    rival:{},foeThree:['Garchomp','Golisopod','Mimikyu'],ownThree:['Primarina','Metagross','Garchomp'],
    rivalPlan:{1:'Rock Slide',2:'Rock Slide'},ownPlan:{1:'Aqua Jet',2:'Encore'},encoreTurn:2,expect:'start'},
];
function planScript(plan,probe){
  return (req,bot,info)=>{
    const p=plan[info.turn];if(!p)return null;
    if(p.startsWith('>')){const x=bench(req).find(y=>nameOf(y.p.details).startsWith(p.slice(1)));return x?'switch '+(x.i+1):null;}
    const i=req.active[0].moves.findIndex(m=>m.move===p&&!m.disabled);
    if(i<0)return null;
    if(probe&&p==='Encore')probe(req,bot,info);
    return 'move '+(i+1);
  };
}
function guardsAt(bot,req){
  const side=req.side.pokemon,my=bot.getSet(side.find(p=>p.active)),g=bot.encoreGuard,out={};
  for(const mode of [true,'speed','speedSafe']){bot.encoreGuard=mode;out[mode===true?'v1':mode]=bot.encoreWouldFail(my,side);}
  bot.encoreGuard=g;
  return {...out,foe:bot.foeActive,foeLastMoveTurn:bot.foeLastMoveTurn,foePublicStatus:bot.foePublicStatus,
    safeRisk:bot.encoreRiskCache?.[bot.dex.species.get(bot.foeActive).id]||[]};
}
function outcome(log,turn){
  const L=log.split('\n'),i=L.indexOf('|turn|'+turn),j=L.indexOf('|turn|'+(turn+1));
  const seg=L.slice(i,j>0?j:undefined);
  const k=seg.findIndex(l=>/^\|move\|p[12]a: Primarina\|Encore/.test(l));
  if(k<0)return {result:'no-encore',seg};
  const after=seg.slice(k+1);
  const result=/^\|-start\|p[12]a: [^|]*\|Encore$/.test(after.find(l=>/Encore$/.test(l)&&/^\|-start\|/.test(l))||'')?'start':
    after.some(l=>/^\|-fail\|/.test(l))||after.slice(0,1).some(l=>/\[still\]|\[notarget\]/.test(l))||seg[k].includes('[notarget]')?'fail':'none';
  return {result,seg};
}
async function runCase(sim,c,reverse){
  const rival=rivalTeam(c.rival);
  const v=new sim.TeamValidator(FORMAT).validateTeam(rival);
  if(v)throw Error(c.id+' illegal rival: '+v.join('; '));
  let probe=null;
  const r=await battle(sim,reportedLive(),rival,hashSeed(7740000+CASES.indexOf(c)),{ownThree:c.ownThree,foeThree:c.foeThree,reverse,
    script:planScript(c.rivalPlan),ownOptions:{script:planScript(c.ownPlan,(req,bot)=>{probe=guardsAt(bot,req);})}});
  const o=outcome(r.log,c.encoreTurn);
  return {id:c.id,why:c.why,reverse,expect:c.expect,engine:o.result,guards:probe,
    turnLog:o.seg.filter(l=>/^\|(move|cant|-fail|-start|-activate|switch|drag|-fieldstart)\|/.test(l))};
}
async function main(){
  const sim=load();const rows=[];
  for(const c of CASES)for(const reverse of [false,true])rows.push(await runCase(sim,c,reverse));
  const summary=rows.map(r=>({id:r.id,reverse:r.reverse,engine:r.engine,v1:r.guards?.v1,speed:r.guards?.speed,speedSafe:r.guards?.speedSafe}));
  // false negative = guard allowed (false) but the engine failed Encore
  const fn=m=>rows.filter(r=>r.engine==='fail'&&r.guards&&r.guards[m]===false).length;
  const fp=m=>rows.filter(r=>r.engine==='start'&&r.guards&&r.guards[m]===true).length;
  const out={showdown:process.env.SHOWDOWN_SHA||'see CI',format:FORMAT,rows,summary,
    falseNegatives:{v1:fn('v1'),speed:fn('speed'),speedSafe:fn('speedSafe')},falsePositives:{v1:fp('v1'),speed:fp('speed'),speedSafe:fp('speedSafe')}};
  if(process.env.OUT){fs.mkdirSync(path.dirname(process.env.OUT),{recursive:true});fs.writeFileSync(process.env.OUT,JSON.stringify(out,null,1));}
  console.table(summary);console.log('falseNegatives',out.falseNegatives,'falsePositives',out.falsePositives);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1);});
module.exports={CASES,runCase,rivalTeam,guardsAt};
