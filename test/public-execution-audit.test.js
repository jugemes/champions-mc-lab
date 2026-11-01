'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {executedEvents,eventSignature}=require('../public-execution-audit');
test('public execution parser excludes preview and distinguishes moves, pivots, and forced drags',()=>{
  const log=[
    '|switch|p1a: Rotom-Wash|Rotom-Wash, L50|100/100',
    '|turn|1',
    '|move|p1a: Rotom-Wash|Thunderbolt|p2a: Swampert',
    '|switch|p2a: Gholdengo|Gholdengo, L50|100/100',
    '|turn|2',
    '|move|p2a: Gholdengo|Make It Rain|p1a: Rotom-Wash',
    '|drag|p1a: Primarina|Primarina, L50|100/100',
    '|turn|3',
    '|move|p1a: Primarina|Moonblast|p2a: Gholdengo'
  ].join('\n');
  const r=executedEvents(log,'p1','p2');
  assert.deepEqual(r.own,[
    {turn:1,kind:'move',actor:'Rotom-Wash',detail:'Thunderbolt'},
    {turn:2,kind:'drag',actor:'Primarina',detail:'Primarina'}
  ]);
  assert.deepEqual(r.rival,[
    {turn:1,kind:'switch',actor:'Gholdengo',detail:'Gholdengo'},
    {turn:2,kind:'move',actor:'Gholdengo',detail:'Make It Rain'}
  ]);
  assert.equal(eventSignature(r.own,1),'move:Rotom-Wash:Thunderbolt');
  assert.equal(eventSignature(r.own,2,{onlyMoves:true}),'');
  assert.equal(eventSignature(r.rival,2,{onlyMoves:true,includeActor:false}),'move:Make It Rain');
  assert.notEqual(eventSignature(r.own,1),eventSignature(r.rival,1));
});
test('public execution parser treats forced replacement and chosen switch as observations, not proven decisions',()=>{
  const r=executedEvents('|turn|1\n|switch|p1a: Garchomp|Garchomp, L50|100/100\n|turn|2\n|switch|p1a: Metagross|Metagross, L50|100/100','p1','p2');
  assert.equal(r.own.length,2);
  assert.ok(r.own.every(x=>x.kind==='switch'));
  assert.notEqual(eventSignature(r.own,1),eventSignature(r.own,2));
});

test('cant event is an observed inability to act, not a Bot choice',()=>{
  const log='|turn|1\n|cant|p1a: Garchomp|slp\n|move|p2a: Primarina|Moonblast|p1a: Garchomp';
  const r=executedEvents(log,'p1','p2');
  assert.equal(eventSignature(r.own,1),'cant:Garchomp:slp');
  assert.equal(eventSignature(r.own,1,{onlyMoves:true}),'');
  assert.equal(eventSignature(r.rival,1,{onlyMoves:true}),'move:Primarina:Moonblast');
});
