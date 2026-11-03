'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {classifyChoiceCorroboratedSwitches:classify}=require('../public-choice-causality');
test('corroborates submitted normal switch, not forced pivot, KO replacement or drag',()=>{
  const log=[
    '|switch|p1a: Rotom|Rotom-Wash, L50|100/100',
    '|switch|p2a: Gholdengo|Gholdengo, L50|100/100',
    '|turn|1',
    '|switch|p2a: Rillaboom|Rillaboom, L50|100/100',
    '|move|p1a: Rotom|Volt Switch|p2a: Rillaboom',
    '|switch|p1a: Metagross|Metagross, L50|100/100',
    '|turn|2',
    '|move|p2a: Rillaboom|Grassy Glide|p1a: Metagross',
    '|faint|p1a: Metagross',
    '|turn|3',
    '|switch|p1a: Primarina|Primarina, L50|100/100',
    '|drag|p2a: Skarmory|Skarmory, L50|100/100'
  ].join('\n');
  const choices=[
    {side:'p2',turn:1,choice:'switch 3',chosenSpecies:'Rillaboom',requestKind:'normal'},
    {side:'p1',turn:1,choice:'switch 2',chosenSpecies:'Metagross',requestKind:'forced'},
    {side:'p1',turn:3,choice:'switch 3',chosenSpecies:'Primarina',requestKind:'forced'}
  ];
  const r=classify(log,'p1','p2',choices,3);
  assert.deepEqual(r.own.map(x=>x.evidence),[
    'switch-on-forced-request','faint-replacement']);
  assert.deepEqual(r.rival.map(x=>x.evidence),[
    'bot-chose-switch-on-normal-request','forced-drag']);
  assert.equal(r.rival[0].botChoiceCorroborated,true);
  assert.ok(!r.own.some(x=>x.botChoiceCorroborated));
  const reversed=classify(log,'p2','p1',choices,3);
  assert.equal(reversed.own[0].botChoiceCorroborated,true);
});
test('does not invent choice cause from public switch or ambiguous duplicate traces',()=>{
  const log='|turn|1\n|switch|p2a: Rillaboom|Rillaboom, L50|100/100';
  assert.equal(classify(log,'p1','p2',[],1).rival[0].evidence,'unresolved');
  const choice={side:'p2',turn:1,choice:'switch 2',chosenSpecies:'Rillaboom',requestKind:'normal'};
  assert.equal(classify(log,'p1','p2',[choice,choice],1).rival[0].evidence,'unresolved');
  assert.equal(classify(log,'p1','p2',[{...choice,chosenSpecies:'Gholdengo'}],1).rival[0].evidence,'unresolved');
  assert.equal(classify(log,'p1','p2',[{...choice,requestKind:'preview'}],1).rival[0].evidence,'unresolved');
});
