'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {classifyExecutedImmunities}=require('../public-immune-causality-audit');
test('separates surprise defender switch from stationary target and forced move',()=>{
 const log=[
  '|turn|1',
  '|switch|p2a: Umbreon|Umbreon, L50|100/100',
  '|move|p1a: Metagross|Psychic Fangs|p2a: Umbreon',
  '|-immune|p2a: Umbreon',
  '|turn|2',
  '|move|p1a: Rotom|Will-O-Wisp|p2a: Gholdengo',
  '|-immune|p2a: Gholdengo|[from] ability: Good as Gold',
  '|turn|3',
  '|move|p1a: Garchomp|Earthquake|p2a: Rotom',
  '|-immune|p2a: Rotom|[from] ability: Levitate'
 ].join('\n');
 const req=[
  {side:'p1',turn:1,locked:false,canSwitch:true},
  {side:'p1',turn:2,locked:false,canSwitch:true},
  {side:'p1',turn:3,locked:true,lockReason:'choice',canSwitch:true}
 ];
 const a=classifyExecutedImmunities(log,'p1','p2',req);
 assert.deepEqual(a.map(x=>x.classification),[
  'defender-changed-this-turn','unchanged-target-unforced-request','forced-request']);
 assert.equal(a[0].defenderChangeKind,'switch');
 assert.equal(a[1].reason,'[from] ability: Good as Gold');
 assert.equal(a[2].lockReason,'choice');
});
test('does not treat preview switch or enemy attack as own immunity',()=>{
 const log='|switch|p2a: Gholdengo|Gholdengo, L50|100/100\n'+
  '|turn|1\n|move|p2a: Gholdengo|Shadow Ball|p1a: Metagross\n'+
  '|move|p1a: Metagross|Psychic Fangs|p2a: Gholdengo\n'+
  '|-immune|p1a: Metagross';
 assert.deepEqual(classifyExecutedImmunities(log,'p1','p2',[]),[]);
});
test('missing request remains unclassified rather than an avoidable mistake',()=>{
 const log='|turn|1\n|move|p1a: Rotom|Will-O-Wisp|p2a: Gholdengo\n|-immune|p2a: Gholdengo';
 const a=classifyExecutedImmunities(log,'p1','p2',[]);
 assert.equal(a[0].classification,'unchanged-target-request-unknown');
});

test('side reversal and forced drag are observed as defender change, not known target',()=>{
 const log='|turn|4\n|drag|p1a: Umbreon|Umbreon, L50|90/100\n'+
  '|move|p2a: Metagross|Psychic Fangs|p1a: Umbreon\n|-immune|p1a: Umbreon';
 const a=classifyExecutedImmunities(log,'p2','p1',[{side:'p2',turn:4,locked:false,canSwitch:true}]);
 assert.equal(a.length,1);
 assert.equal(a[0].classification,'defender-changed-this-turn');
 assert.equal(a[0].defenderChangeKind,'drag');
});

test('prior-turn immunity is observable on the same active stint, not inferred on first use',()=>{
 const log=[
  '|switch|p2a: Gholdengo|Gholdengo, L50|100/100',
  '|turn|1',
  '|move|p1a: Rotom|Will-O-Wisp|p2a: Gholdengo',
  '|-immune|p2a: Gholdengo|[from] ability: Good as Gold',
  '|turn|2',
  '|move|p1a: Rotom|Will-O-Wisp|p2a: Gholdengo',
  '|-immune|p2a: Gholdengo|[from] ability: Good as Gold',
  '|turn|3',
  '|move|p1a: Rotom|Will-O-Wisp|p2a: Gholdengo',
  '|-immune|p2a: Gholdengo|[from] ability: Good as Gold'
 ].join('\n');
 const a=classifyExecutedImmunities(log,'p1','p2',[
  {side:'p1',turn:1,locked:false,canSwitch:true},
  {side:'p1',turn:2,locked:false,canSwitch:true},
  {side:'p1',turn:3,locked:false,canSwitch:true}
 ]);
 assert.deepEqual(a.map(x=>x.priorSameStintCount),[0,1,2]);
 assert.deepEqual(a.map(x=>x.previouslyObservedSameStintImmunity),[false,true,true]);
 assert.ok(a.every(x=>x.classification==='unchanged-target-unforced-request'));
 assert.ok(a.every(x=>x.observedOnly===true));
});
test('switch out and back, Illusion replace, form and ability changes invalidate prior immunity',()=>{
 const log=[
  '|turn|1','|move|p1a: Rotom|Will-O-Wisp|p2a: Gholdengo','|-immune|p2a: Gholdengo',
  '|turn|2','|switch|p2a: Umbreon|Umbreon, L50|100/100',
  '|turn|3','|switch|p2a: Gholdengo|Gholdengo, L50|100/100',
  '|move|p1a: Rotom|Will-O-Wisp|p2a: Gholdengo','|-immune|p2a: Gholdengo',
  '|turn|4','|replace|p2a: Gholdengo|Zoroark, L50|100/100',
  '|move|p1a: Rotom|Will-O-Wisp|p2a: Gholdengo','|-immune|p2a: Gholdengo',
  '|turn|5','|detailschange|p2a: Gholdengo|Gholdengo-Mega, L50',
  '|move|p1a: Rotom|Will-O-Wisp|p2a: Gholdengo','|-immune|p2a: Gholdengo',
  '|turn|6','|-ability|p2a: Gholdengo|Levitate',
  '|move|p1a: Rotom|Will-O-Wisp|p2a: Gholdengo','|-immune|p2a: Gholdengo'
 ].join('\n');
 const a=classifyExecutedImmunities(log,'p1','p2',[]);
 assert.equal(a.length,5);
 assert.ok(a.every(x=>x.previouslyObservedSameStintImmunity===false));
});
test('same-turn defender switch is still a switch surprise even after a prior immunity',()=>{
 const log=[
  '|turn|1','|move|p1a: Metagross|Psychic Fangs|p2a: Umbreon','|-immune|p2a: Umbreon',
  '|turn|2','|switch|p2a: Umbreon|Umbreon, L50|100/100',
  '|move|p1a: Metagross|Psychic Fangs|p2a: Umbreon','|-immune|p2a: Umbreon'
 ].join('\n');
 const a=classifyExecutedImmunities(log,'p1','p2',[]);
 assert.equal(a[1].classification,'defender-changed-this-turn');
 assert.equal(a[1].previouslyObservedSameStintImmunity,false);
});

test('prior-turn immunity tracking is symmetric for the opponent side',()=>{
 const log=[
  '|turn|1',
  '|move|p2a: Garchomp|Earthquake|p1a: Rotom',
  '|-immune|p1a: Rotom|[from] ability: Levitate',
  '|turn|2',
  '|move|p2a: Garchomp|Earthquake|p1a: Rotom',
  '|-immune|p1a: Rotom|[from] ability: Levitate'
 ].join('\n');
 const a=classifyExecutedImmunities(log,'p2','p1',[
  {side:'p2',turn:1,locked:false,canSwitch:true},
  {side:'p2',turn:2,locked:false,canSwitch:true}
 ]);
 assert.deepEqual(a.map(x=>x.priorSameStintCount),[0,1]);
 assert.equal(a[1].classification,'unchanged-target-unforced-request');
});
