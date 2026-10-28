'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCases,aggregate,summarize}=require('../m8-baseline-core');
const {groups}=require('../environment-m7-teams');
const {reportedLive,UNVERIFIED}=require('../reported-live-roster-20261027');
test('exactly 14 independently documented sixes × two forced three sets × both sides',()=>{
 const c=createCases(groups);
 assert.equal(c.length,56);
 assert.equal(new Set(c.map(x=>x.group)).size,14);
 assert.equal(c.filter(x=>x.reversed).length,28);
 assert.equal(c.filter(x=>x.forcedKind==='forcedB').length,28);
 for(const x of c){
  assert.equal(x.publicSix.length,6);
  assert.equal(new Set(x.publicSix).size,6);
  assert.equal(x.enemyThree.length,3);
  assert.ok(x.enemyThree.every(n=>x.publicSix.includes(n)));
 }
});
test('no fabricated 14th team or illegal forced trio can silently pass',()=>{
 const bad=structuredClone(groups);
 bad[0].forcedA=['Golisopod','Golisopod','Mimikyu'];
 assert.throws(()=>createCases(bad),/Invalid forcedA/);
 const short=structuredClone(groups.slice(1));
 assert.throws(()=>createCases(short),/14 documented/);
});
test('unverified live property fields remain listed, not silently certified',()=>{
 const own=reportedLive();
 assert.deepEqual(own.map(x=>x.species),
  ['Metagross','Hydreigon','Primarina','Garchomp','Tyranitar','Rotom-Wash']);
 assert.ok(UNVERIFIED.some(x=>x.species==='Primarina'&&x.field==='ability'));
 assert.ok(UNVERIFIED.some(x=>x.species==='*'&&x.field==='ivs'));
});
test('aggregation reports divergences instead of declaring improved empirical winrate',()=>{
 const row=(name,old,newWin)=>({group:name,tags:['top-heavy'],forcedKind:'forcedA',
  reversed:false,enemyThreeAfterwards:['a','b','c'],
  old:{won:old,selected:['Hydreigon','Metagross','Primarina'],lead:'Hydreigon',
    ownLearned:0,foeLearned:0},
  mutualLearning:{won:newWin,selected:['Hydreigon','Metagross','Primarina'],
    ownLearned:1,foeLearned:2}});
 const s=summarize([row('g',true,false),row('g',false,true)]);
 assert.equal(s.cases,2);assert.equal(s.changedResults,2);
 assert.equal(s.winOld,1);assert.equal(s.winBoth,1);
 assert.equal(s.groupsRankedForReview[0].ownImmunityObservations,2);
 assert.equal(s.groupsRankedForReview[0].foeImmunityObservations,4);
 assert.equal(s.limitations.length,4);
});
