'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseArgs,matrix,resultRow}=require('../compare-all');
const {pool}=require('../optimize');
const {opponents}=require('../preview-opponents');
test('fair comparison includes all 14 teams and eight independently-previewed rivals',()=>{
 assert.equal(Object.keys(pool()).length,14);
 assert.equal(Object.keys(opponents).length,8);
});
test('comparator matches seats and seeds independent of candidate name',()=>{
 const cases=Object.keys(opponents);
 const rowsA=matrix(4,['A_rillaboom'],cases);
 const rowsB=matrix(4,['C_master'],cases);
 assert.deepEqual(rowsA,rowsB);
 assert.equal(rowsA.length,32);
 assert.deepEqual(rowsA.slice(0,4).map(x=>x.reverse),[false,true,false,true]);
});
test('same denominator, score and worst outcome are transparent',()=>{
 const wins={a:2,b:3},count={a:4,b:4};
 const r=resultRow('T',wins,count,0,{},{});assert.equal(r.wins,5);
 assert.equal(r.games,8);assert.equal(r.mean,5/8);
 assert.equal(r.worst,1/2);
 assert.equal(parseArgs(['--per-pair','250']).count,250);
 assert.throws(()=>parseArgs(['--per-pair','0']));
});