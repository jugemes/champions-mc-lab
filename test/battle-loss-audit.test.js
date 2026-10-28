'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {publicTimeline,actionSummary,observedEvents,comparePair}=require('../battle-loss-audit');
test('post-match event filter rejects hidden requests and internal state lines',()=>{
 const result=publicTimeline([
  '|turn|1',
  '|request|{"side":{"pokemon":[{"moves":["HIDDEN"]}]}}',
  '|move|p1a: Hydreigon|Flamethrower|p2a: Golisopod',
  '|-damage|p2a: Golisopod|0 fnt',
  '|faint|p2a: Golisopod',
  '|turn|2','|switch|p2a: Mimikyu|Mimikyu, L50|100/100',
  '|win|candidate'
 ].join('\n'));
 assert.equal(result.turns.length,2);
 assert.ok(result.all.some(e=>e.kind==='move'));
 assert.equal(result.all.some(e=>e.kind==='request'),false);
 assert.equal(JSON.stringify(result).includes('HIDDEN'),false);
});
test('postgame opponent three are reported, never reintroduced as preview evaluation inputs',()=>{
 const make=(selected,lead,choice,log)=>({
  turns:2,log,trace:{
   choices:[{side:'p1',turn:1,choice}],
   selections:[{side:'p1',chosen:selected,lead},
     {side:'p2',chosen:['Golisopod','Mimikyu','Garchomp'],lead:'Golisopod'}]
  }
 });
 const a=make(['Hydreigon','Garchomp','Tyranitar'],'Hydreigon','move 3',
  '|turn|1\n|move|p1a: Hydreigon|Flamethrower|p2a: Golisopod');
 const b=make(['Rotom-Wash','Metagross','Hydreigon'],'Rotom-Wash','switch 3',
  '|turn|1\n|switch|p1a: Hydreigon|Hydreigon, L50|150/150');
 const report=comparePair(a,b,'p1');
 assert.equal(report.firstDifferentAction.actionIndex,0);
 assert.equal(report.before.lead,'Hydreigon');
 assert.deepEqual(report.after.foeSelectedOnlyKnownPostGame,['Golisopod','Mimikyu','Garchomp']);
 assert.equal(report.causes.opponentRationality.startsWith('undetermined'),true);
 assert.equal(report.timeline.old[0].events[0].kind,'turn');
});
test('setup and switches are counts only, not evidence of a rational move',()=>{
 const timeline=publicTimeline(
 '|turn|1\n|move|p2a: Golisopod|Swords Dance|p2a: Golisopod'+
 '\n|switch|p2a: Mimikyu|Mimikyu, L50|100/100\n|faint|p2a: Mimikyu');
 const m=observedEvents(timeline,'p2');
 assert.equal(m.moves,1);
 assert.equal(m.switches,1);
 assert.deepEqual(m.setupMoves,['Swords Dance']);
 assert.equal(m.faints,1);
 assert.deepEqual(actionSummary({choices:[{side:'p2',turn:1,choice:'move 2'}]},'p2'),
   [{turn:1,action:'move 2'}]);
});
