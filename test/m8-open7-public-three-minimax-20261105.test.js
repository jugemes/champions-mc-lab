'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {choosePublicThree,combinations}=require('../m8-open7-public-three-minimax-20261105');
test('enumerates 20 legal selections from six',()=>assert.equal(combinations([0,1,2,3,4,5]).length,20));
test('cannot borrow answers from unselected members',()=>{
 const matrix=Array.from({length:6},()=>Array(6).fill(-2));
 for(let k=0;k<6;k++)matrix[k][k]=2;
 const x=choosePublicThree([0,1,2,3,4,5],[0,1,2,3,4,5],[[0,1,2],[3,4,5]],matrix);
 assert.equal(x.selected.worst,-2);
 assert.equal(x.ranked.length,20);
});
test('public six identical and branches identical means deterministic selection',()=>{
 const matrix=Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>i===j?3:0));
 const args=[[0,1,2,3,4,5],[0,1,2,3,4,5],[[0,1,2],[3,4,5]],matrix];
 assert.deepEqual(choosePublicThree(...args),choosePublicThree(...args));
});
test('rejects opponent hypotheses not belonging to public six',()=>{
 const matrix=Array.from({length:6},()=>Array(7).fill(0));
 assert.throws(()=>choosePublicThree([0,1,2,3,4,5],[0,1,2,3,4,5],[[0,1,6]],matrix),/public six/);
});

test('rejects duplicate public opponent entries',()=>{
 const m=Array.from({length:6},()=>Array(6).fill(0));
 assert.throws(()=>choosePublicThree([0,1,2,3,4,5],[0,1,2,3,4,4],[[0,1,2]],m),/distinct/);
});
test('rejects missing and nonfinite matchup values instead of ranking NaN',()=>{
 const m=Array.from({length:6},()=>Array(6).fill(0));
 m[5][4]=NaN;
 assert.throws(()=>choosePublicThree([0,1,2,3,4,5],[0,1,2,3,4,5],[[0,1,2]],m),/nonfinite/);
 m[5][4]=0;delete m[5][4];
 assert.throws(()=>choosePublicThree([0,1,2,3,4,5],[0,1,2,3,4,5],[[0,1,2]],m),/nonfinite/);
});
test('documents limitation: same union of enemy species hides branch synergy',()=>{
 const m=Array.from({length:6},(_,i)=>Array.from({length:6},(_,j)=>i===j?3:0));
 const own=[0,1,2,3,4,5],pub=[0,1,2,3,4,5];
 const a=choosePublicThree(own,pub,[[0,1,2],[3,4,5]],m);
 const b=choosePublicThree(own,pub,[[0,3,4],[1,2,5]],m);
 assert.equal(a.selected.worst,b.selected.worst);
 // This is a known inability of the independent 1v1 proxy, not a 3v3 pass.
});
