#!/usr/bin/env node
'use strict';
/**
 * Post-Mimikyu replacement counterexample for the proposed
 * Wash / Skeledirge / Mega Metagross three.
 * After a fully executed Goli -> Mimikyu pivot and Mimikyu KO, test whether
 * Goli's re-entry First Impression can pick off the chipped Skeledirge.
 * Exact Showdown move/forced-switch engine; no inferred 3v3 win.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {load,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {archetypes}=require('./fixtures');
const {makeThreeBattle}=require('./engine-three-branch');
const {FORMAT}=require('./engine-reference');
const sim=load(),ours=reportedLive(),foe=structuredClone(
 groups.find(x=>x.name==='01_M7_golisopod_balance').team);
const sk=structuredClone(archetypes.setup.find(x=>x.species==='Skeledirge'));sk.item='Rocky Helmet';
ours[ours.findIndex(x=>x.species==='Hydreigon')]=sk;
const gl=foe.find(x=>x.species==='Golisopod');
gl.moves[gl.moves.indexOf('Swords Dance')]='First Impression';
for(const [label,team] of [['own',ours],['foe',foe]]){
 const e=sim.TeamValidator.get(FORMAT).validateTeam(normalize(team))||[];
 if(e.length)throw Error(label+' illegal '+e.join('|'));
}
function move(side,s,mega=false){
 const idx=side.active[0].moveSlots.findIndex(x=>x.id===side.battle.dex.moves.get(s).id);
 if(idx<0)throw Error('absent move '+s);
 return 'move '+(idx+1)+(mega?' mega':'');
}
function sw(side,s){
 const index=side.pokemon.findIndex(x=>x.species.name===s||
 x.species.baseSpecies===s);
 if(index<0||side.pokemon[index].fainted||side.pokemon[index].active)
  throw Error('bad switch '+s);
 return 'switch '+(index+1);
}
function ss(b){
 const snap=s=>s.pokemon.slice(0,3).map(p=>({species:p.species.name,hp:p.hp,maxhp:p.maxhp,
  fainted:p.fainted,active:p.active}));
 return {requestState:b.requestState,ended:b.ended,
  our:snap(b.p1),foe:snap(b.p2),
  ourActive:b.p1.active[0]?.species.name,foeActive:b.p2.active[0]?.species.name};
}
function read(b,ours,mon){
 const side=ours?b.p1:b.p2;return side.pokemon.find(p=>
 p.species.name===mon||p.species.baseSpecies===mon);
}
function run(reentry,seed){
 const b=makeThreeBattle(sim,ours,foe,{
  ownThree:['Rotom-Wash','Skeledirge','Metagross'],
  foeThree:['Golisopod','Mimikyu','Garchomp'],
  seed:[2026,10,28,seed]});
 try{
  const steps=[],step=(name,a,c)=>{
   const from=b.log.length;b.makeChoices(a,c);
   steps.push({name,post:ss(b),events:b.log.slice(from).filter(x=>
    /\|move\||\|switch\||\|-damage\||\|-miss\||\|faint\||\|-start\||\|-end\|/.test(x))});
  };
  step('T1 both switch',sw(b.p1,'Skeledirge'),sw(b.p2,'Mimikyu'));
  step('T2 break disguise vs Shadow Claw',move(b.p1,'Torch Song'),move(b.p2,'Shadow Claw'));
  step('T3 shadow ball vs priority',move(b.p1,'Shadow Ball'),move(b.p2,'Shadow Sneak'));
  const mimikyu=read(b,false,'Mimikyu');
  if(!mimikyu.fainted)throw Error('This counterexample requires actual Mimikyu faint, not a predicted KO');
  const skelBefore=read(b,true,'Skeledirge').hp;
  if(b.requestState!=='switch')throw Error('Mimikyu faint must have forced an actual switch request: '+b.requestState);
  // Only opponent has a replacement choice; do not fabricate a free own swap.
  const forced=sw(b.p2,reentry);
  const switchLog=b.log.length;
  b.makeChoices('',forced);
  steps.push({name:'forced foe replacement',post:ss(b),events:b.log.slice(switchLog)});
  if(b.requestState!=='move')throw Error('mandatory replacement not resolved '+b.requestState);
  if(reentry==='Golisopod'){
   step('T4 sucker-punch bait vs reentry First Impression',
    move(b.p1,'Slack Off'),move(b.p2,'First Impression',true));
  }else{
   step('T4 levitate pivot vs scarf Earthquake',
    sw(b.p1,'Rotom-Wash'),move(b.p2,'Earthquake'));
   if(!b.ended&&b.requestState==='move'&&!b.p1.active[0].fainted&&!b.p2.active[0].fainted)
    step('T5 Hydro Pump vs choice-locked Earthquake',
     move(b.p1,'Hydro Pump'),move(b.p2,'Earthquake'));
  }
  const final=ss(b);
  return {reentry,seed,skelHPAfterMimikyu:skelBefore,
   skelHPFinal:read(b,true,'Skeledirge').hp,
   skelFainted:read(b,true,'Skeledirge').fainted,
   washHPFinal:read(b,true,'Rotom-Wash').hp,
   foeGoliHP:read(b,false,'Golisopod').hp,
   foeGarchompHP:read(b,false,'Garchomp').hp,
   req:b.requestState,steps,final};
 }finally{b.destroy();}
}
const rows=[];
for(const entry of ['Golisopod','Garchomp'])
 for(let seed=241;seed<=248;seed++)rows.push(run(entry,seed));
const summary=['Golisopod','Garchomp'].map(reentry=>{
 const x=rows.filter(r=>r.reentry===reentry);
 return {reentry,n:x.length,
  skelHPBefore:x.map(z=>z.skelHPAfterMimikyu),
  skelKO:x.filter(z=>z.skelFainted).length,
  skelAfter:x.map(z=>z.skelHPFinal),
  washAfter:x.map(z=>z.washHPFinal),
  foeGoli:x.map(z=>z.foeGoliHP),
  foeChomp:x.map(z=>z.foeGarchompHP),
  pending:x.map(z=>z.req)};
});
fs.mkdirSync('output/m7-roster-deltas',{recursive:true});
fs.writeFileSync(path.join('output/m7-roster-deltas','post-mimikyu-reentry.json'),
 JSON.stringify({format:FORMAT,engineSHA:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
  chosen3FromPublicSix:['Rotom-Wash','Skeledirge','Metagross'],
  enemyThreePosthoc:['Golisopod','Mimikyu','Garchomp'],
  explanation:'Explicit forced replacement after Mimikyu faint, then foe Golisopod priority First Impression or scarf Garchomp Earthquake. No complete ladder battle or assumption of 100% policy choice.',
  summary,rows},null,2));
console.log('M7_MIMIKYU_REENTRY '+JSON.stringify(summary));
