'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {mechanics}=require('../m8-golisopod-ironhead-rebuttal');
test('every explicitly Mega-Golisopod synthetic six tests immediate Iron Head, rather than only free setup',()=>{
 const sample=mechanics();
 assert.equal(sample.cases,6);
 for(const row of sample.results){
  assert.equal(row.outcomes.length,12);
  assert.equal(row.incoming.move,'Iron Head');
  assert.equal(row.incoming.ourForm,'Golisopod-Mega');
  assert.equal(row.incoming.opponentForm,'Primarina');
  assert.ok(row.incoming.fraction>0);
  const attack=row.outcomes.find(x=>x.ownMove==='Moonblast'&&x.enemyMove==='Iron Head');
  const setup=row.outcomes.find(x=>x.ownMove==='Moonblast'&&x.enemyMove==='Swords Dance');
  assert.ok(attack.events.some(x=>x.includes('|move|')&&x.includes('|Iron Head|')));
  assert.ok(setup.events.some(x=>x.includes('|move|')&&x.includes('|Swords Dance|')));
  assert.equal(setup.theirBoostAfter>0,true);
  assert.ok(attack.ourHPAfter<=setup.ourHPAfter);
 }
});
