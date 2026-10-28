'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {load}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {groups}=require('../environment-m7-teams');
const {robustLeadOutcomes,rankOpeningTrioLeads}=require('../engine-opening-ranker');
const sim=load(),own=reportedLive();
const publicSix=groups.find(g=>g.name==='01_M7_golisopod_balance').team.map(p=>p.species);
function fixture({move,hiddenThree,mega,score}) {
  return {
    assumedEnemyThree:hiddenThree,assumedEnemyLead:'Golisopod',
    enemyMega:mega,enemyFirstMove:'Swords Dance',
    ourFirstMove:move,
    ownFaintedCount:0,foeFaintedCount:score>=2?1:0,
    ownTeamRemaining:1,foeTeamRemaining:score>=2?0.7:1,
    foeAttackBoost:0,secondExecuted:false,secondSkipped:''
  };
}
test('conditional preview action must NOT depend on the enemy hidden backline or the unannounced Mega',()=>{
 const x=robustLeadOutcomes([
   fixture({move:'Flamethrower',hiddenThree:['Golisopod','Mimikyu','Garchomp'],mega:true,score:2}),
   fixture({move:'Flamethrower',hiddenThree:['Golisopod','Primarina','Garchomp'],mega:false,score:0}),
   fixture({move:'Dark Pulse',hiddenThree:['Golisopod','Mimikyu','Garchomp'],mega:true,score:0}),
   fixture({move:'Dark Pulse',hiddenThree:['Golisopod','Primarina','Garchomp'],mega:false,score:2})
 ]);
 assert.equal(x.length,1,'one public lead, not separate choices based on hidden backline');
 assert.equal(x[0].options.length,2);
 assert.equal(x[0].bestAvailableFirstAction.tested,2);
});
test('all-trio ranker yields distinct selected three, legal lead and scenario trace, not forced actual enemy selection',()=>{
 const r=rankOpeningTrioLeads(sim,own,publicSix,{maxScenes:2,limit:3});
 assert.equal(r.evaluated,3);
 assert.ok(r.top.length>0);
 for(const row of r.top){
   assert.equal(row.ownThree.length,3);
   assert.equal(new Set(row.ownThree).size,3);
   assert.equal(row.ownThree[0],row.lead);
   assert.ok(row.scenarioLeads.length>0);
   assert.ok(row.comparisons>0);
 }
});

test('incomplete Volt Switch pivot continuation is NOT credited as a superior two-turn payoff',()=>{
 const sample=(move,skipped,executed)=>({
  assumedEnemyLead:'Golisopod',assumedEnemyThree:['Golisopod','Mimikyu','Garchomp'],
  enemyMega:true,enemyFirstMove:'Swords Dance',ourFirstMove:move,
  ownFaintedCount:0,foeFaintedCount:0,ownTeamRemaining:1,
  foeTeamRemaining:0.8,foeAttackBoost:0,
  secondExecuted:executed,secondSkipped:skipped
 });
 const result=robustLeadOutcomes([
  sample('Volt Switch','lead-changed-or-forced-replacement',false),
  sample('Flamethrower','',true)
 ]);
 assert.equal(result.length,1);
 assert.equal(result[0].bestAvailableFirstAction.action,'Flamethrower');
 assert.equal(result[0].options.find(x=>x.action==='Volt Switch').complete,false);
 assert.equal(result[0].options.find(x=>x.action==='Volt Switch').adversarialWorst,null);
});
