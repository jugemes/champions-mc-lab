#!/usr/bin/env node
'use strict';
/**
 * M-7 roster selection: actual Showdown 3-4 turn branch for Golisopod =>
 * Mimikyu pivot, without assuming the opponent stays against Overheat.
 *
 * For each candidate form, declare own three against PUBLIC six before
 * specifying private foe three. Foe set is explicitly synthetic and fixed.
 * No AI decisions, no human ladder estimate, no arbitrary hidden-data access.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {load,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {makeThreeBattle}=require('./engine-three-branch');
const {FORMAT}=require('./engine-reference');
const sim=load(),reported=reportedLive();
const rival=groups.find(x=>x.name==='01_M7_golisopod_balance');
assert.ok(rival);
const knownPublicSix=rival.team.map(x=>x.species);
const fixedRivalThree=['Golisopod','Mimikyu','Garchomp'];
const strategies=[
 {id:'mimikyu-playrough-then-shadowsneak',
  steps:[['MAIN','switch:Mimikyu'],['switch:Metagross','Play Rough'],['Meteor Mash+mega','Shadow Sneak']]},
 {id:'mimikyu-swordsdance-then-shadowsneak',
  steps:[['MAIN','switch:Mimikyu'],['switch:Metagross','Swords Dance'],['Meteor Mash+mega','Shadow Sneak']]},
 {id:'mimikyu-then-goli-switch-to-thunderpunch',
  steps:[['MAIN','switch:Mimikyu'],['switch:Metagross','Play Rough'],['Thunder Punch+mega','switch:Golisopod'],['Meteor Mash','Iron Head+mega']]},
 {id:'mimikyu-then-garchomp-switch-into-thunderpunch',
  steps:[['MAIN','switch:Mimikyu'],['switch:Metagross','Play Rough'],['Thunder Punch+mega','switch:Garchomp'],['switch:Rotom','Dragon Claw']]},
 {id:'mimikyu-switch-then-pivot-volt-switch',
  steps:[['MAIN','switch:Mimikyu'],['Volt Switch','Play Rough']]}
];
function own(form){
 const six=structuredClone(reported);
 const rot=six.find(x=>x.species==='Rotom-Wash');
 if(form==='heat'){
  rot.species='Rotom-Heat';
  rot.moves=['Overheat','Volt Switch','Thunderbolt','Will-O-Wisp'];
 }
 const err=sim.TeamValidator.get(FORMAT).validateTeam(normalize(six))||[];
 if(err.length)throw Error('illegal '+form+': '+err.join(' | '));
 return six;
}
function action(side,command,form){
 const token=command.replace('MAIN',form==='heat'?'Overheat':'Hydro Pump')
   .replace('switch:Rotom',form==='heat'?'switch:Rotom-Heat':'switch:Rotom-Wash');
 if(token.startsWith('switch:')){
  const target=token.slice(7);
  const i=side.pokemon.findIndex(p=>
   p.species.name===target||p.species.baseSpecies===target);
  if(i<0)throw Error('switch target absent from own preselected three: '+target);
  const mon=side.pokemon[i];
  if(mon.active||mon.fainted)throw Error('illegal scripted switch '+target);
  return 'switch '+(i+1);
 }
 const mega=token.endsWith('+mega'),move=token.replace('+mega','');
 const index=side.active[0].moveSlots.findIndex(m=>
  m.id===side.battle.dex.moves.get(move).id);
 if(index<0)throw Error('illegal scripted move '+move+' on '+side.active[0]?.species.name);
 return 'move '+(index+1)+(mega?' mega':'');
}
function snapshot(b){
 const side=s=>({active:s.active[0]?.species.name,
  selected:s.pokemon.slice(0,3).map(p=>({
   species:p.species.name,hp:p.hp,maxhp:p.maxhp,
   fainted:p.fainted,boosts:{...p.boosts},status:p.status
  }))});
 return {own:side(b.p1),foe:side(b.p2),requestState:b.requestState,
  ended:b.ended};
}
function run(form,strategy,seed){
 const six=own(form);
 // selection never uses fixedRivalThree; it's declared from public six only.
 const declaredOwnThree=[form==='heat'?'Rotom-Heat':'Rotom-Wash','Metagross','Primarina'];
 if(!knownPublicSix.includes('Golisopod')||!knownPublicSix.includes('Mimikyu'))
  throw Error('public six must contain pivot and mega threat');
 const b=makeThreeBattle(sim,six,rival.team,{
   ownThree:declaredOwnThree,foeThree:fixedRivalThree,seed
 });
 try{
  const steps=[],initial=snapshot(b);
  for(let i=0;i<strategy.steps.length;i++){
   if(b.ended||b.requestState!=='move'||b.p1.active[0].fainted||
       b.p2.active[0].fainted){
    steps.push({step:i+1,executed:false,reason:'pending-replacement-or-end',state:snapshot(b)});
    break;
   }
   const [a,c]=strategy.steps[i];
   const ownAction=action(b.p1,a,form),foeAction=action(b.p2,c,form);
   const start=b.log.length;
   b.makeChoices(ownAction,foeAction);
   steps.push({step:i+1,executed:true,ownAction,foeAction,
    state:snapshot(b),events:b.log.slice(start).filter(x=>
     /\|move\||\|switch\||\|-damage\||\|-start\||\|-end\||\|faint\||\|-boost\||\|detailschange\||\|-fail\||\|-miss\|/.test(x))});
  }
  return {form,strategy:strategy.id,seed,ownThree:declaredOwnThree,
   foeThreePosthoc:fixedRivalThree,initial,steps,final:snapshot(b)};
 }finally{b.destroy();}
}
function main(){
 const rows=[];
 for(const form of ['wash','heat'])
  for(const strategy of strategies)
   for(let i=0;i<8;i++)rows.push(run(form,strategy,[2026,10,28,i+40]));
 assert.equal(rows.length,80);
 for(const row of rows){
  const own=row.final.own.selected.find(p=>p.species.startsWith('Rotom-'));
  assert.ok(own,'known own form should survive as a team member');
  if(row.strategy.startsWith('mimikyu-')&&row.steps[0].executed){
   assert.ok(row.steps[0].events.some(x=>x.includes('|switch|')&&x.includes('Mimikyu')));
  }
 }
 const compact=rows.map(x=>{
  const active=x.final.own.active,foe=x.final.foe.active;
  const rot=x.final.own.selected.find(p=>p.species.startsWith('Rotom-'));
  const meta=x.final.own.selected.find(p=>p.species.startsWith('Metagross'));
  const goli=x.final.foe.selected.find(p=>p.species.startsWith('Golisopod'));
  const mimi=x.final.foe.selected.find(p=>p.species.startsWith('Mimikyu'));
  const shark=x.final.foe.selected.find(p=>p.species.startsWith('Garchomp'));
  return {form:x.form,strategy:x.strategy,seed:x.seed[3],
   executed:x.steps.filter(s=>s.executed).length,active,foe,
   rotHP:rot?.hp,metaHP:meta?.hp,goliHP:goli?.hp,mimikyuHP:mimi?.hp,
   chompHP:shark?.hp,rotBoosts:rot?.boosts,metaBoosts:meta?.boosts,
   request:x.final.requestState,
   didMimiDisguiseBreak:x.steps.some(s=>s.events?.some(e=>e.includes('Disguise'))),
   firstMoveMiss:x.steps[0].events?.some(e=>e.includes('|-miss|'))||false,
   reason:x.steps.find(s=>!s.executed)?.reason||''};
 });
 const summary=strategies.map(st=>({
  name:st.id,
  forms:['wash','heat'].map(form=>{
   const own=compact.filter(x=>x.strategy===st.id&&x.form===form);
   return {form,seeds:own.length,finishAll:own.filter(x=>x.executed===st.steps.length).length,
    minRotHP:Math.min(...own.map(x=>x.rotHP||0)),minMetaHP:Math.min(...own.map(x=>x.metaHP||0)),
    minMimikyuHP:Math.min(...own.map(x=>x.mimikyuHP||0)),
    maxMimikyuHP:Math.max(...own.map(x=>x.mimikyuHP||0)),
    missedT1:own.filter(x=>x.firstMoveMiss).length,
    observations:own};
  })
 }));
 const output={format:FORMAT,showdownSHA:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
  publicSix:knownPublicSix,
  ownPreview:'Rotom form + Metagross + Primarina, chosen before hidden rival three',
  foeThreeOnlyForScript:fixedRivalThree,summary,rows,
  caveat:'Synthetic fully specified sets and scripts, 8 fixed seeds each; no AI decision and no human rank win rate. Choice Scarf, Megas, switches and Disguise are engine-owned; T2 pending pivot is stopped rather than assumed legal.'};
 const dir='output/m7-roster-deltas';fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'mimikyu-three-turn-branches.json'),JSON.stringify(output,null,2));
 console.log('M7_MIMIKYU_MULTITURN '+JSON.stringify(summary));
}
try{main();}catch(e){console.error(e.stack||e);process.exitCode=1;}
