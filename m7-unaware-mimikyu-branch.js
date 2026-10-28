#!/usr/bin/env node
'use strict';
/**
 * Rival Mega-Golisopod can defensively pivot into Mimikyu. Counter an
 * enemy Swords Dance + Shadow Sneak with an OWN defensive answer, using
 * actual M-C turn engine rather than top-line win counts.
 */
const fs=require('node:fs'),path=require('node:path');
const {load,normalize}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {archetypes}=require('./fixtures');
const {makeThreeBattle}=require('./engine-three-branch');
const {FORMAT}=require('./engine-reference');
const sim=load(),live=reportedLive(),
    foe=groups.find(x=>x.name==='01_M7_golisopod_balance').team;
const tactics=[
 {name:'wash',first:'Hydro Pump',attack:'Thunderbolt',firstSpecies:'Rotom-Wash'},
 {name:'heat',first:'Overheat',attack:'Thunderbolt',firstSpecies:'Rotom-Heat'},
 {name:'wash-unaware-skeledirge',first:'Torch Song',attack:'Shadow Ball',firstSpecies:'Skeledirge'}
];
const sk=structuredClone(archetypes.setup.find(x=>x.species==='Skeledirge'));
sk.item='Rocky Helmet';
function team(t){
 const own=structuredClone(live);
 if(t.name==='heat'){
  const r=own.find(x=>x.species==='Rotom-Wash');
  r.species='Rotom-Heat';r.moves=['Overheat','Volt Switch','Thunderbolt','Will-O-Wisp'];
 }else if(t.firstSpecies==='Skeledirge'){
  own[own.findIndex(x=>x.species==='Hydreigon')]=structuredClone(sk);
 }
 const errs=sim.TeamValidator.get(FORMAT).validateTeam(normalize(own))||[];
 if(errs.length)throw Error('illegal '+t.name+': '+errs.join('|'));
 return own;
}
function choice(side,command){
 if(command.startsWith('switch:')){
  const species=command.slice(7),i=side.pokemon.findIndex(p=>p.species.name===species||
    p.species.baseSpecies===species);
  if(i<0||side.pokemon[i].fainted||side.pokemon[i].active)
   throw Error('bad switch: '+species);
  return 'switch '+(i+1);
 }
 const n=side.active[0].moveSlots.findIndex(x=>x.id===side.battle.dex.moves.get(command).id);
 if(n<0)throw Error('not active move: '+command);
 return 'move '+(n+1);
}
function snap(b){
 const side=s=>({
  active:s.active[0]?.species.name,
  selected:s.pokemon.slice(0,3).map(x=>({species:x.species.name,
   hp:x.hp,maxhp:x.maxhp,boosts:{...x.boosts},status:x.status,
   fainted:x.fainted}))
 });
 return {own:side(b.p1),foe:side(b.p2),requestState:b.requestState};
}
function sample(t,reply,seed){
 const own=team(t),ownThree=[t.firstSpecies,'Metagross','Primarina'];
 const foeThree=['Golisopod','Mimikyu','Garchomp'];
 const b=makeThreeBattle(sim,own,foe,{ownThree,foeThree,seed});
 try{
  const steps=[
   [t.first,'switch:Mimikyu'],
   [reply==='burn'?'Will-O-Wisp':t.attack,'Swords Dance'],
   [t.attack,'Shadow Sneak']
  ];
  const data=[];
  for(let i=0;i<steps.length;i++){
   if(b.ended||b.requestState!=='move'||b.p1.active[0].fainted||
    b.p2.active[0].fainted){
    data.push({turn:i+1,executed:false,reason:'battle needs replacement or ended'});break;
   }
   const [a,c]=steps[i],s=b.log.length;
   b.makeChoices(choice(b.p1,a),choice(b.p2,c));
   data.push({turn:i+1,executed:true,own:a,foe:c,
    state:snap(b),events:b.log.slice(s).filter(x=>
      /\|move\||\|switch\||\|-damage\||\|-status\||\|-boost\||\|faint\||\|-start\||\|-end\||\|-miss\|/.test(x))});
  }
  const fin=snap(b);
  return {treatment:t.name,reply,seed:seed[3],ownThree,foeThreePosthoc:foeThree,
   executed:data.filter(x=>x.executed).length,
   steps:data,final:fin,
   ownLeadHP:fin.own.selected[0].hp,ownLeadFaint:fin.own.selected[0].fainted,
   opponentMimikyuHP:fin.foe.selected[1].hp,
   opponentMimikyuFaint:fin.foe.selected[1].fainted,
   opponentMimikyuStatus:fin.foe.selected[1].status,
   untouchedGoliHP:fin.foe.selected[0].hp};
 }finally{b.destroy();}
}
const rows=[];
for(const t of tactics)
 for(const reply of ['burn','attack'])
  for(let i=0;i<8;i++)rows.push(sample(t,reply,[2026,10,28,170+i]));
const summary=tactics.map(t=>({
 treatment:t.name,
 replies:['burn','attack'].map(reply=>{
  const a=rows.filter(r=>r.treatment===t.name&&r.reply===reply);
  return {reply,total:a.length,
   finishedAll3:a.filter(r=>r.executed===3).length,
   ownFaint:a.filter(r=>r.ownLeadFaint).length,
   mimikyuFaint:a.filter(r=>r.opponentMimikyuFaint).length,
   burnApplied:a.filter(r=>r.opponentMimikyuStatus==='brn').length,
   minOwnHP:Math.min(...a.map(r=>r.ownLeadHP)),
   maxOwnHP:Math.max(...a.map(r=>r.ownLeadHP)),
   minMimikyuHP:Math.min(...a.map(r=>r.opponentMimikyuHP)),
   maxMimikyuHP:Math.max(...a.map(r=>r.opponentMimikyuHP))}
 })
}));
const output={summary,rows,format:FORMAT,
 pinnedShowdown:'3a766f2cfb5e51c1e428cfe87d0dba91a8f01640',
 note:'Scripted same enemy Goli->Mimikyu + Swords Dance + Shadow Sneak, enemy Goli remains at full HP and selected after own public-six trio. 8 fixed seeds; no entire match, usage frequencies or human winrates.'};
fs.mkdirSync('output/m7-roster-deltas',{recursive:true});
fs.writeFileSync(path.join('output/m7-roster-deltas','unaware-mimikyu-branches.json'),JSON.stringify(output,null,2));
console.log('M7_UNAWARE_MIMIKYU '+JSON.stringify(summary));
