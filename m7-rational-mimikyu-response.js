#!/usr/bin/env node
'use strict';
/**
 * Counterplay decision gate: compare two proposed M-8 sixes and the user's
 * actual six against an opposing Golisopod -> Mimikyu pivot, with Mimikyu
 * responding RATIONALLY rather than using Swords Dance unconditionally.
 *
 * Fixed opponent public six -> own three BEFORE force-selecting enemy three.
 * Every action is executed by pinned, actual Showdown M-C Battle.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {archetypes}=require('./fixtures');
const {makeThreeBattle}=require('./engine-three-branch');
const {FORMAT}=require('./engine-reference');
const sim=load(),base=reportedLive(),publicFoe=groups.find(g=>g.name==='01_M7_golisopod_balance');
assert.ok(publicFoe);
const foeThree=['Golisopod','Mimikyu','Garchomp']; // post-preview stress only
assert.ok(publicFoe.team.find(x=>x.species==='Garchomp')?.moves.includes('Earthquake'),
 'counter-switch must use real STAB Earthquake, not an artificially weak Dragon Claw');
const skel=structuredClone(archetypes.setup.find(x=>x.species==='Skeledirge'));
skel.item='Rocky Helmet';
const candidates=[
 {name:'live-wash',lead:'Rotom-Wash',first:'Hydro Pump',t2:'Thunderbolt',
  afterMimi:'Thunderbolt'},
 {name:'heat-only',lead:'Rotom-Heat',first:'Overheat',t2:'Thunderbolt',
  afterMimi:'Thunderbolt'},
 {name:'wash-skeledirge',lead:'Skeledirge',first:'Torch Song',t2:'Shadow Ball',
  afterMimi:'Shadow Ball'},
];
const foePolicies=[
 {name:'immediate-shadow-claw',second:'Shadow Claw',third:'Shadow Sneak'},
 {name:'immediate-play-rough',second:'Play Rough',third:'Shadow Sneak'},
 {name:'swords-dance',second:'Swords Dance',third:'Shadow Sneak'},
 {name:'switch-scarf-garchomp',second:'switch:Garchomp',third:'Earthquake'},
 {name:'switch-goli-back',second:'switch:Golisopod',third:'Sucker Punch',thirdMega:true}
];
const responses=[
 {name:'attack',moveT2:c=>c.t2},
 {name:'defensive-metagross',moveT2:()=> 'switch:Metagross'},
 {name:'will-o-wisp',moveT2:()=> 'Will-O-Wisp'},
];
function candidateTeam(c){
 const six=structuredClone(base);
 if(c.name==='heat-only'){
  const rot=six.find(x=>x.species==='Rotom-Wash');rot.species='Rotom-Heat';
  rot.moves=['Overheat','Volt Switch','Thunderbolt','Will-O-Wisp'];
 }
 if(c.name==='wash-skeledirge'){
  six[six.findIndex(x=>x.species==='Hydreigon')]=structuredClone(skel);
 }
 const errs=sim.TeamValidator.get(FORMAT).validateTeam(normalize(six))||[];
 if(errs.length)throw Error('M-C illegal '+c.name+': '+errs.join(' | '));
 return six;
}
function choice(side,desc,mega=false){
 if(desc.startsWith('switch:')){
  if(mega)throw Error('cannot mega on switch');
  const target=desc.slice(7),idx=side.pokemon.findIndex(x=>
   x.species.name===target||x.species.baseSpecies===target);
  if(idx<0)throw Error('not selected '+target);
  if(side.pokemon[idx].fainted||side.pokemon[idx].active)throw Error('invalid switch '+target);
  return 'switch '+(idx+1);
 }
 const index=side.active[0].moveSlots.findIndex(x=>
   x.id===side.battle.dex.moves.get(desc).id);
 if(index<0)throw Error('illegal move '+desc+' for '+side.active[0].species.name);
 return 'move '+(index+1)+(mega?' mega':'');
}
function snapshot(b){
 function read(s){
  return {active:s.active[0]?.species.name,
   selected:s.pokemon.slice(0,3).map(x=>({
    species:x.species.name,hp:x.hp,maxhp:x.maxhp,fainted:x.fainted,
    status:x.status,boosts:{...x.boosts}
   }))};
 }
 return {own:read(b.p1),foe:read(b.p2),requestState:b.requestState,ended:b.ended};
}
function findMon(side,name){
 return side.selected.find(x=>x.species===name||
   x.species.startsWith(name+'-'));
}
function execute(c,policy,response,seed){
 const ourThree=[c.lead,'Metagross','Primarina'];
 // Guaranteed preview-only own team selection. Do not use foeThree in its construction.
 const b=makeThreeBattle(sim,candidateTeam(c),publicFoe.team,{
  ownThree:ourThree,foeThree,seed:[2026,10,28,seed]});
 const steps=[[c.first,'switch:Mimikyu'],
  [response.moveT2(c),policy.second],
  [response.name==='defensive-metagross'?'Meteor Mash':c.afterMimi,policy.third]];
 const frames=[],log=[];
 try{
  for(let i=0;i<steps.length;i++){
   if(b.ended||b.requestState!=='move'||b.p1.active[0].fainted||b.p2.active[0].fainted){
    frames.push({turn:i+1,executed:false,reason:'pending replacement / game ended'});
    break;
   }
   const [ownAction,foeAction]=steps[i];
   const a=choice(b.p1,ownAction,i===2&&response.name==='defensive-metagross');
   const f=choice(b.p2,foeAction,i===2&&Boolean(policy.thirdMega));
   const from=b.log.length;
   b.makeChoices(a,f);
   const events=b.log.slice(from);
   frames.push({turn:i+1,executed:true,ownAction,foeAction,state:snapshot(b),
    events:events.filter(s=>/\|move\||\|switch\||\|-damage\||\|-miss\||\|-boost\||\|faint\||\|-status\||\|-start\||\|-end\|/.test(s))});
  }
  const last=snapshot(b),lead=findMon(last.own,c.lead),
    meta=findMon(last.own,'Metagross'),mimi=findMon(last.foe,'Mimikyu'),
    gol=findMon(last.foe,'Golisopod'),chomp=findMon(last.foe,'Garchomp');
  assert.ok(lead&&meta&&mimi&&gol&&chomp);
  // Ensure T1 pivot and Disguise took place, not an assumed free hit.
  assert.ok(frames[0].events.some(s=>s.includes('|switch|')&&s.includes('Mimikyu')));
  return {candidate:c.name,opponent:policy.name,response:response.name,seed,
   ourThree,foeThreeForStressOnly:[...foeThree],frames,
   completed:frames.filter(f=>f.executed).length,
   leadHP:lead.hp,leadFainted:lead.fainted,metaHP:meta.hp,
   mimikyuHP:mimi.hp,mimikyuFainted:mimi.fainted,mimikyuStatus:mimi.status,
   golisopodHP:gol.hp,garchompHP:chomp.hp,garchompFainted:chomp.fainted,
   ownActive:last.own.active,foeActive:last.foe.active,
   endReason:frames.find(f=>!f.executed)?.reason||''};
 }finally{b.destroy();}
}
function main(){
 const cases=[];
 for(const c of candidates)for(const p of foePolicies)for(const response of responses){
  // Defensive-Metgross is a switch on T2, not an arbitrary T3 win path;
  // all other plans require maintaining c.lead if possible.
  for(let seed=201;seed<=208;seed++){
   const r=execute(c,p,response,seed);cases.push(r);
  }
 }
 assert.equal(cases.length,360);
 const aggregate=candidates.map(c=>({
  candidate:c.name,
  policies:foePolicies.map(p=>({
   opponent:p.name,
   plans:responses.map(resp=>{
    const a=cases.filter(x=>x.candidate===c.name&&x.opponent===p.name&&x.response===resp.name);
    return {response:resp.name,total:a.length,
     completedAll3:a.filter(x=>x.completed===3).length,
     leadFainted:a.filter(x=>x.leadFainted).length,
     mimikyuFainted:a.filter(x=>x.mimikyuFainted).length,
     enemyMimikyuStatus:a.map(x=>x.mimikyuStatus),
     minLeadHP:Math.min(...a.map(x=>x.leadHP)),maxLeadHP:Math.max(...a.map(x=>x.leadHP)),
     minMetaHP:Math.min(...a.map(x=>x.metaHP)),maxMetaHP:Math.max(...a.map(x=>x.metaHP)),
     minMimikyuHP:Math.min(...a.map(x=>x.mimikyuHP)),
     maxMimikyuHP:Math.max(...a.map(x=>x.mimikyuHP)),
     minGolisopodHP:Math.min(...a.map(x=>x.golisopodHP)),
     minGarchompHP:Math.min(...a.map(x=>x.garchompHP)),
     maxGarchompHP:Math.max(...a.map(x=>x.garchompHP)),
     garchompFainted:a.filter(x=>x.garchompFainted).length,
     endReasons:[...new Set(a.map(x=>x.endReason).filter(Boolean))]};
   })
  }))
 }));
 const out={format:FORMAT,
  engineSHA:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
  publicEnemySix:publicFoe.team.map(x=>x.species),
  declaredOwnThree:'Lead form / Metagross / Primarina fixed before force-selecting assumed foe3',
  syntheticFoeThree:foeThree,
  limitation:'360 *scripted* branches reusing ONE hypothesized opponent set. Not independent battles, not actual opponent choices, not ladder winrate. Scripts may stop early if KO/forced replacement. T3 actions are fixed, not optimally adapted, so interpret only states that actually execute.',
  aggregate,cases};
 fs.mkdirSync('output/m7-roster-deltas',{recursive:true});
 fs.writeFileSync(path.join('output/m7-roster-deltas','rational-mimikyu-response.json'),JSON.stringify(out,null,2));
 console.log('M7_RATIONAL_MIMIKYU '+JSON.stringify(aggregate));
}
try{main();}catch(e){console.error(e.stack||e);process.exitCode=1;}
