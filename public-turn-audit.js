#!/usr/bin/env node
'use strict';
const {load}=require('./lab');
const {groups}=require('./environment-m7-teams');
const {reportedLive}=require('./reported-live-roster-20261027');
const {publicHypotheses}=require('./public-hypotheses');
const {publicMoveOutcomes}=require('./public-turn-options');
const sim=load(),own=reportedLive();
for(const group of groups){
 const six=group.team.map(s=>s.species);
 const hypotheses=publicHypotheses(sim,six,{limit:2});
 console.log('PUBLIC_HYPOTHESES '+JSON.stringify({name:group.name,publicSix:six,
   count:hypotheses.assumptions.length,
   items:hypotheses.assumptions.map(a=>a.team.map(t=>t.item)),
   sources:hypotheses.assumptions.map(a=>a.sources),
   prob:'none; this is not an empirical usage distribution'}));
}
const group=groups.find(x=>x.name==='01_M7_golisopod_balance');
const six=group.team.map(p=>p.species);
const results=publicMoveOutcomes(sim,own,six,{
 ourLead:'Hydreigon',opponentLead:'Golisopod',
 opponentMoves:['Swords Dance','Leech Life'],assumptions:1,seed:[2026,10,28,1]
});
console.log('PUBLIC_TURN_SUMMARY '+JSON.stringify({ourLead:results.ourLead,
 opponentLead:results.opponentLead,assumptions:results.assumptionsUsed,
 comparisons:results.comparisons,warning:results.warning}));
for(const move of ['Flamethrower','Draco Meteor']){
 const outcomes=results.cases.filter(x=>x.ownMove===move&&x.opponentMove==='Swords Dance');
 console.log('PUBLIC_TURN_BRANCH '+JSON.stringify({move,opponentHypothesis:'Swords Dance',
   branches:outcomes.map(x=>({enemyMega:x.opponentMega,enemyForm:x.foeForm,
    myRemaining:+x.ownHP.toFixed(3),foeRemaining:+x.foeHP.toFixed(3),
    foeFainted:x.foeFainted,foeAttackBoost:x.foeAttackBoost,
    source:x.source,events:x.events}))}));
}
