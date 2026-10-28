'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('../lab');
const {groups}=require('../environment-m7-teams');
const {reportedLive}=require('../reported-live-roster-20261027');
const {makeThreeBattle,twoTurnBranch}=require('../engine-three-branch');
const sim=load(),own=reportedLive();
const fixture=groups.find(g=>g.name==='01_M7_golisopod_balance');
const us=['Hydreigon','Garchomp','Tyranitar'];
const them=['Golisopod','Garchomp','Mimikyu'];
test('isolated Showdown 3v3 selects exactly specified lead/trio and not a hidden real team',()=>{
 const b=makeThreeBattle(sim,own,fixture.team,{
   ownThree:us,foeThree:them});
 try{
   assert.equal(b.p1.active[0].species.name,'Hydreigon');
   assert.equal(b.p2.active[0].species.name,'Golisopod');
   assert.ok(b.p1.pokemon.length>=3);
 }finally{b.destroy();}
});
test('Mega Golisopod survived landed Draco, then engine resolves next turn from true boosts/HP',()=>{
 const r=twoTurnBranch(sim,own,fixture.team,{
   ownThree:us,foeThree:them,seed:[2026,10,28,1],
   first:{own:'Draco Meteor',foe:'Swords Dance',foeMega:true},
   second:{own:'Flamethrower',foe:'Sucker Punch'}
 });
 assert.equal(r.firstAfter.assumedFoe.active,'Golisopod-Mega');
 assert.ok(r.firstAfter.assumedFoe.pokemon[0].hp>0);
 assert.ok(r.firstAfter.assumedFoe.pokemon[0].boosts.atk>=2);
 assert.equal(r.second.executed,true);
 assert.ok(r.events.second.some(x=>x.includes('|move|')));
});
test('Mega Golisopod dies to Flamethrower on first turn; do not illegally play extra turn',()=>{
 const r=twoTurnBranch(sim,own,fixture.team,{
   ownThree:us,foeThree:them,
   first:{own:'Flamethrower',foe:'Swords Dance',foeMega:true},
   second:{own:'Draco Meteor',foe:'Leech Life'}
 });
 assert.ok(r.firstAfter.assumedFoe.pokemon[0].fainted);
 assert.equal(r.second.executed,false);
 assert.equal(r.second.notExecutedReason,'faint-or-game-end');
});
test('rejects nonexistent selected species and illegal pre-selected trios',()=>{
 assert.throws(()=>makeThreeBattle(sim,own,fixture.team,{ownThree:us,foeThree:['Golisopod','Golisopod','Mimikyu']}),/three distinct/);
 assert.throws(()=>makeThreeBattle(sim,own,fixture.team,{ownThree:['Wooloo','Garchomp','Tyranitar'],foeThree:them}),/absent/);
});

test('planned switch to known selected teammate is a legal Showdown action, not an imagined replacement',()=>{
 const ownThree=['Rotom-Wash','Hydreigon','Tyranitar'];
 const r=twoTurnBranch(sim,own,fixture.team,{
   ownThree,foeThree:them,
   first:{own:'switch:Hydreigon',foe:'Swords Dance',foeMega:true},
   second:{own:'Flamethrower',foe:'Leech Life'}
 });
 assert.equal(r.firstAfter.own.active,'Hydreigon');
 assert.equal(r.firstAfter.assumedFoe.active,'Golisopod-Mega');
 assert.equal(r.second.executed,true);
 assert.ok(r.events.first.some(line=>line.includes('switch|')));
});
