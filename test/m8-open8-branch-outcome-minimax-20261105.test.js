'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {chooseByBranchOutcomes}=require('../m8-open8-branch-outcome-minimax-20261105');
const ownSix=['a','b','c','d','e','f'],publicSix=['u','v','w','x','y','z'];
const branches=[{id:'u-v-w',three:['u','v','w']},{id:'u-x-y',three:['u','x','y']}];
const base={ownSix,publicSix,branches};
test('never ranks an untested lead or branch',()=>{
 const r=chooseByBranchOutcomes({...base,outcomes:[{three:['a','b','c'],lead:'a',branch:'u-v-w',score:1}]});
 assert.equal(r.selected,null);assert.equal(r.coverage.completeChoices,0);
});
test('branch-specific losses dominate a tempting average',()=>{
 const outcomes=[];
 for(const [three,lead,score] of [[['a','b','c'],'a',[1,0]],[['d','e','f'],'d',[0.6,0.6]]])
  branches.forEach((b,i)=>outcomes.push({three,lead,branch:b.id,score:score[i]}));
 const r=chooseByBranchOutcomes({...base,outcomes});
 assert.deepEqual(r.selected.three,['d','e','f']);assert.equal(r.selected.worst,0.6);assert.equal(r.coverage.completeChoices,2);
});
test('rejects hidden opponent outside public six and duplicate outcomes',()=>{
 assert.throws(()=>chooseByBranchOutcomes({...base,branches:[{id:'bad',three:['u','v','secret']}],outcomes:[]}),/Invalid pre-registered/);
 const o={three:['a','b','c'],lead:'a',branch:'u-v-w',score:1};
 assert.throws(()=>chooseByBranchOutcomes({...base,outcomes:[o,o]}),/Duplicate outcome/);
});
test('lead and enemy branch remain distinct dimensions',()=>{
 const outcomes=[];
 for(const lead of ['a','b'])for(const b of branches)outcomes.push({three:['a','b','c'],lead,branch:b.id,score:lead==='a'?(b.id==='u-v-w'?1:0):0.5});
 const r=chooseByBranchOutcomes({...base,outcomes});
 assert.equal(r.selected.lead,'b');assert.equal(r.selected.worst,0.5);
});
