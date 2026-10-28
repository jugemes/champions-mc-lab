#!/usr/bin/env node
'use strict';
/**
 * Lead minimax stress, NOT complete 3v3 win simulation:
 * compare public-six-selected Wash+Skeledirge+Metagross against
 * Heat+Metagross+Primarina facing three plausible opponent leads.
 *
 * Both our 3 and our LEAD are locked before the enemy's selected 3 and
 * lead are supplied as AFTERWARDS stress. At each *revealed* opposing
 * action the future script is a hypothetical legal response.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {load,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {archetypes}=require('./fixtures');
const {makeThreeBattle}=require('./engine-three-branch');
const {FORMAT}=require('./engine-reference');
const sim=load(),original=reportedLive(),
 group=groups.find(g=>g.name==='01_M7_golisopod_balance');
assert.ok(group);
const foe=structuredClone(group.team);
const goli=foe.find(x=>x.species==='Golisopod');
goli.moves[goli.moves.indexOf('Swords Dance')]='First Impression';
const foeErrors=sim.TeamValidator.get(FORMAT).validateTeam(normalize(foe))||[];
if(foeErrors.length)throw Error('Goli first-impression foil illegal: '+foeErrors.join('|'));
const sk=structuredClone(archetypes.setup.find(x=>x.species==='Skeledirge'));
sk.item='Rocky Helmet';
const options=[
 {name:'wash-skeledirge',three:['Rotom-Wash','Skeledirge','Metagross'],lead:'Rotom-Wash'},
 {name:'heat-hydreigon',three:['Rotom-Heat','Metagross','Primarina'],lead:'Rotom-Heat'}
];
function six(o){
 const ours=structuredClone(original);
 if(o.name==='wash-skeledirge'){
  ours[ours.findIndex(x=>x.species==='Hydreigon')]=structuredClone(sk);
 }else{
  const rot=ours.find(x=>x.species==='Rotom-Wash');
  rot.species='Rotom-Heat';
  rot.moves=['Overheat','Volt Switch','Thunderbolt','Will-O-Wisp'];
 }
 const errs=sim.TeamValidator.get(FORMAT).validateTeam(normalize(ours))||[];
 if(errs.length)throw Error('illegal six: '+errs.join('|'));
 return ours;
}
const plans=[
 {id:'goli-first-impression',enemyLead:'Golisopod',steps:{
  'wash-skeledirge':[['switch:Skeledirge','First Impression+mega'],
    ['Torch Song','switch:Mimikyu'],['Shadow Ball','Shadow Claw']],
  'heat-hydreigon':[['Overheat','First Impression+mega']]
 }},
 {id:'goli-switches-mimikyu',enemyLead:'Golisopod',steps:{
  'wash-skeledirge':[['switch:Skeledirge','switch:Mimikyu'],
    ['Torch Song','Shadow Claw'],['Shadow Ball','Shadow Sneak']],
  'heat-hydreigon':[['Overheat','switch:Mimikyu'],
    ['Thunderbolt','Shadow Claw'],['Thunderbolt','Shadow Sneak']]
 }},
 {id:'garchomp-scarf-earthquake',enemyLead:'Garchomp',steps:{
  'wash-skeledirge':[['Hydro Pump','Earthquake'],
    ['Hydro Pump','Earthquake'],['Hydro Pump','Earthquake']],
  'heat-hydreigon':[['Will-O-Wisp','Earthquake'],
    ['Overheat','Earthquake'],['Overheat','Earthquake']]
 }},
 {id:'mimikyu-immediate-shadowclaw',enemyLead:'Mimikyu',steps:{
  'wash-skeledirge':[['Will-O-Wisp','Shadow Claw'],
    ['Thunderbolt','Shadow Claw'],['Thunderbolt','Shadow Sneak']],
  'heat-hydreigon':[['Will-O-Wisp','Shadow Claw'],
    ['Thunderbolt','Shadow Claw'],['Thunderbolt','Shadow Sneak']]
 }},
 {id:'mimikyu-swordsdance',enemyLead:'Mimikyu',steps:{
  'wash-skeledirge':[['Will-O-Wisp','Swords Dance'],
    ['Thunderbolt','Shadow Claw'],['Thunderbolt','Shadow Sneak']],
  'heat-hydreigon':[['Will-O-Wisp','Swords Dance'],
    ['Thunderbolt','Shadow Claw'],['Thunderbolt','Shadow Sneak']]
 }}
];
function command(side,spec){
 const mega=spec.endsWith('+mega'),s=spec.replace('+mega','');
 if(s.startsWith('switch:')){
  if(mega)throw Error('switch+mega illegal');
  const target=s.slice(7),n=side.pokemon.findIndex(x=>
    x.species.name===target||x.species.baseSpecies===target);
  if(n<0||side.pokemon[n].active||side.pokemon[n].fainted)
    throw Error('invalid switch '+target);
  return 'switch '+(n+1);
 }
 const n=side.active[0].moveSlots.findIndex(x=>x.id===side.battle.dex.moves.get(s).id);
 if(n<0)throw Error('move absent '+s+' on '+side.active[0].species.name);
 return 'move '+(n+1)+(mega?' mega':'');
}
function snap(side){return side.pokemon.slice(0,3).map(x=>({
 species:x.species.name,hp:x.hp,maxhp:x.maxhp,active:x.active,
 fainted:x.fainted,status:x.status,boosts:{...x.boosts}}));}
function get(mons,s){return mons.find(x=>x.species===s||x.species.startsWith(s+'-'));}
function run(plan,o,seed){
 const ownSix=six(o);
 const enemyOrder=[plan.enemyLead,...['Golisopod','Garchomp','Mimikyu'].filter(x=>x!==plan.enemyLead)];
 const b=makeThreeBattle(sim,ownSix,foe,{
  ownThree:o.three,foeThree:enemyOrder,seed:[2026,10,28,seed]});
 try{
  assert.equal(b.p1.active[0].species.name,o.lead);
  const sequence=plan.steps[o.name],ticks=[];
  for(let i=0;i<sequence.length;i++){
   if(b.ended||b.requestState!=='move'||b.p1.active[0].fainted||b.p2.active[0].fainted){
    ticks.push({turn:i+1,executed:false,reason:'faint/force switch'});break;
   }
   const [a,c]=sequence[i],start=b.log.length;
   b.makeChoices(command(b.p1,a),command(b.p2,c));
   ticks.push({turn:i+1,executed:true,ownAction:a,foeAction:c,
    events:b.log.slice(start).filter(x=>/\|move\||\|switch\||\|-damage\||\|-miss\||\|faint\||\|-boost\||\|-status\|/.test(x))});
  }
  const our=snap(b.p1),theirs=snap(b.p2),rot=get(our,o.lead);
  assert.ok(rot);
  return {plan:plan.id,candidate:o.name,seed,ownChosen:o.three,
   opponentThreeStressAfterPreview:enemyOrder,completed:ticks.filter(x=>x.executed).length,
   our,theirs,ticks,
   rotomHP:rot.hp,rotomFainted:rot.fainted,
   metaHP:get(our,'Metagross')?.hp,
   skelHP:get(our,'Skeledirge')?.hp,
   goliHP:get(theirs,'Golisopod')?.hp,
   garchompHP:get(theirs,'Garchomp')?.hp,
   mimiHP:get(theirs,'Mimikyu')?.hp,
   foeActive:b.p2.active[0]?.species.name,ownActive:b.p1.active[0]?.species.name};
 }finally{b.destroy();}
}
const raw=[];
for(const plan of plans)for(const o of options)for(let seed=241;seed<=248;seed++)
 raw.push(run(plan,o,seed));
assert.equal(raw.length,80);
const summary=plans.map(p=>({
 plan:p.id,
 candidates:options.map(o=>{
  const a=raw.filter(x=>x.plan===p.id&&x.candidate===o.name);
  return {name:o.name,fullScript:a.filter(x=>x.completed===p.steps[o.name].length).length,
   seeds:a.length,leadKO:a.filter(x=>x.rotomFainted).length,
   ownLeadHP:a.map(x=>x.rotomHP),skelHP:a.map(x=>x.skelHP),
   enemyGoliHP:a.map(x=>x.goliHP),enemyGarchompHP:a.map(x=>x.garchompHP),
   enemyMimiHP:a.map(x=>x.mimiHP)};
 })
}));
const out={format:FORMAT,showdownSHA:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
 publicEnemySix:group.team.map(x=>x.species),
 previewOwnThree:options.map(x=>({name:x.name,three:x.three,lead:x.lead})),
 caveat:'Two predetermined public-six-selected teams, 5 scripted rational opponent lead/action hypotheses x 8 fixed seeds x 2 candidates. Only completed turns count. No hidden enemy three entered own preview; one synthetic rival set; this is not human ladder winrate or perfect-play minimax.',
 summary,raw};
fs.mkdirSync('output/m7-roster-deltas',{recursive:true});
fs.writeFileSync(path.join('output/m7-roster-deltas','wash-skeledirge-opening.json'),
 JSON.stringify(out,null,2));
console.log('M7_WASH_SKELEDIRGE_OPENING '+JSON.stringify(summary));
