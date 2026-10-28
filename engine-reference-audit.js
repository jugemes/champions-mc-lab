#!/usr/bin/env node
'use strict';
const {load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {engineDamageSample,engineTurnSample}=require('./engine-reference');
const {estimateDamage}=require('./damage');
const sim=load(),dex=sim.Dex.mod('champions');
const our=reportedLive(),op=groups.find(x=>x.name==='01_M7_golisopod_balance').team;
const cases=[
 {own:'Hydreigon',opp:'Golisopod',move:'Flamethrower'},
 {own:'Rotom-Wash',opp:'Golisopod',move:'Thunderbolt'}
];
for(const {own,opp,move} of cases){
 const baseline=engineDamageSample(sim,our,op,{ourLead:own,opponentLead:opp,move});
 const mega=engineDamageSample(sim,our,op,{ourLead:own,opponentLead:opp,move,opponentMega:true});
 const custom=estimateDamage(dex,our.find(p=>p.species===own),opp,move);
 console.log('ENGINE_PROOF '+JSON.stringify({scenario:'constructed M-7 Golisopod hypothesis',
  our:own,foe:opp,move,base:{species:baseline.opponentForm,damage:baseline.rawDamage,
    hp:baseline.opponentMaxHP,percent:+(100*baseline.fraction).toFixed(2)},
  mega:{species:mega.opponentForm,ability:mega.opponentAbility,damage:mega.rawDamage,
    hp:mega.opponentMaxHP,percent:+(100*mega.fraction).toFixed(2)},
  oldCustomMidPercent:+(100*custom.mid).toFixed(2),
  interpretation:'single Showdown engine noncrit sample; foe item/moves are explicitly assumed, not scouted'}));
}

let hitSeed=null;
for(let i=0;i<32;i++){
 const candidate=[2026,10,28,i];
 const t=engineTurnSample(sim,our,op,{
   ourLead:'Hydreigon',opponentLead:'Golisopod',ourMove:'Draco Meteor',
   opponentMove:'Swords Dance',opponentMega:true,seed:candidate
 });
 if(t.opponentAfter.hp>0&&t.opponentAfter.hp<t.opponentAfter.maxhp){
   hitSeed=candidate;break;
 }
}
if(!hitSeed)throw Error('No landed-but-nonlethal Draco scenario among 32 fixed seeds');
for(const move of ['Flamethrower','Draco Meteor']){
 const t=engineTurnSample(sim,our,op,{
   ourLead:'Hydreigon',opponentLead:'Golisopod',
   ourMove:move,opponentMove:'Swords Dance',opponentMega:true,seed:hitSeed
 });
 console.log('ENGINE_TURN '+JSON.stringify({
   case:'Hydreigon vs Mega Golisopod using Swords Dance',
   seed:hitSeed,move,
   ownRemaining:t.ourAfter.hp,ownMaxHP:t.ourAfter.maxhp,
   foeRemaining:t.opponentAfter.hp,foeMaxHP:t.opponentAfter.maxhp,
   foeAttackBoost:t.opponentAfter.boosts.atk,
   events:t.events,assumption:t.assumption,
   condition:'seed selected specifically for a landed Draco; no accuracy frequency is inferred'
 }));
}
