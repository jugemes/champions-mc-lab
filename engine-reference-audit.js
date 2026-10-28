#!/usr/bin/env node
'use strict';
const {load}=require('./lab');
const {reportedLive}=require('./reported-live-roster-20261027');
const {groups}=require('./environment-m7-teams');
const {engineDamageSample}=require('./engine-reference');
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
