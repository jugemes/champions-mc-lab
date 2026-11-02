'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditRepeatedHealing}=require('../nonprogress-audit');
const line=(t,ownMove,foeMove,ownHp,foeHp)=>[
  '|turn|'+t,
  '|move|p1a: Metagross|'+ownMove+'|p2a: Salamence',
  '|-damage|p2a: Salamence|'+foeHp+'/172',
  '|move|p2a: Salamence|'+foeMove+'|p2a: Salamence',
  '|-heal|p2a: Salamence|'+(foeHp+80)+'/172'
].join('\n');
test('10 repeated attacks vs 8 heal turns are candidate only, not proof of AI misplay',()=>{
  const log=['|switch|p1a: Metagross|Metagross, L50|157/157',
   '|switch|p2a: Salamence|Salamence, L50|172/172',
   '|turn|1','|move|p1a: Metagross|Psychic Fangs|p2a: Salamence',
   '|-damage|p2a: Salamence|77/172',
   '|move|p2a: Salamence|Dragon Dance|p2a: Salamence',
   ...Array.from({length:8},(_,i)=>line(i+2,'Psychic Fangs','Roost',77,77)),
   '|turn|10','|move|p1a: Metagross|Psychic Fangs|p2a: Salamence',
   '|-damage|p2a: Salamence|50/172'].join('\n');
  const result=auditRepeatedHealing(log);
  const f=result.findings.find(x=>x.attackSide==='p1');
  assert.ok(f,'must detect repeated attacking into repeated healing');
  assert.equal(f.attackTurns,10);
  assert.equal(f.healingTurns,8);
  assert.equal(f.recoveryMoveTurns,8);
  assert.equal(f.recoveryMoveLoopCandidate,true);
  assert.equal(f.repeatedMove,'Psychic Fangs');
  assert.equal(f.ppKnown,false);
  assert.equal(f.attackerEncoreObserved,false);
  assert.equal(f.attackerChoiceRevealed,false);
  assert.match(f.classification,/candidate-only/);
});
test('repeated effective attacks without healing are not called a stall',()=>{
 const log=['|switch|p1a: Metagross|Metagross, L50|157/157',
   '|switch|p2a: Salamence|Salamence, L50|172/172',
   ...[1,2,3,4].flatMap(t=>['|turn|'+t,
   '|move|p1a: Metagross|Meteor Mash|p2a: Salamence',
   '|-damage|p2a: Salamence|'+(172-t*35)+'/172'])].join('\n');
 assert.equal(auditRepeatedHealing(log).findings.length,0);
});
test('known Choice and public Encore are observed and not misclassified as free choices',()=>{
 const log=['|switch|p1a: Metagross|Metagross, L50|157/157',
   '|switch|p2a: Salamence|Salamence, L50|172/172',
   '|-item|p1a: Metagross|Choice Band',
   '|-start|p1a: Metagross|move: Encore',
   ...[1,2,3].flatMap(t=>['|turn|'+t,
   '|move|p1a: Metagross|Psychic Fangs|p2a: Salamence',
   '|-damage|p2a: Salamence|80/172',
   '|move|p2a: Salamence|Roost|p2a: Salamence',
   '|-heal|p2a: Salamence|160/172'])].join('\n');
 const x=auditRepeatedHealing(log).findings.find(f=>f.attackSide==='p1');
 assert.ok(x);
 assert.equal(x.attackerChoiceRevealed,true);
 assert.equal(x.attackerEncoreObserved,true);
 assert.equal(x.ppKnown,false);
});
test('opposing tactical switch interrupts one continuous repetition window',()=>{
 const log=['|switch|p1a: Metagross|Metagross, L50|157/157',
   '|switch|p2a: Salamence|Salamence, L50|172/172',
   ...[1,2,3].flatMap(t=>['|turn|'+t,
   '|move|p1a: Metagross|Psychic Fangs|p2a: Salamence',
   '|move|p2a: Salamence|Roost|p2a: Salamence',
   '|-heal|p2a: Salamence|160/172']),
   '|turn|4','|switch|p2a: Gholdengo|Gholdengo, L50|164/164',
   '|move|p1a: Metagross|Psychic Fangs|p2a: Gholdengo'].join('\n');
 const f=auditRepeatedHealing(log).findings;
 assert.equal(f.length,1);
 assert.equal(f[0].fromTurn,1);
 assert.equal(f[0].toTurn,3);
});
test('a publicly lost Choice item is not treated as a current lock',()=>{
 const log=['|switch|p1a: Garchomp|Garchomp, L50|180/180',
 '|switch|p2a: Salamence|Salamence, L50|172/172',
 '|-item|p1a: Garchomp|Choice Scarf',
 '|-enditem|p1a: Garchomp|Choice Scarf',
 ...[1,2,3].flatMap(t=>['|turn|'+t,
 '|move|p1a: Garchomp|Dragon Claw|p2a: Salamence',
 '|move|p2a: Salamence|Roost|p2a: Salamence',
 '|-heal|p2a: Salamence|170/172'])].join('\n');
 const f=auditRepeatedHealing(log).findings[0];
 assert.ok(f);
 assert.equal(f.attackerChoiceRevealed,false);
});

test('residual item healing is not misreported as a used recovery move',()=>{
 const log=['|switch|p1a: Metagross|Metagross, L50|157/157',
   '|switch|p2a: Umbreon|Umbreon, L50|172/172',
   ...[1,2,3,4].flatMap(t=>['|turn|'+t,
     '|move|p1a: Metagross|Psychic Fangs|p2a: Umbreon',
     '|-damage|p2a: Umbreon|120/172',
     '|move|p2a: Umbreon|Foul Play|p1a: Metagross',
     '|-heal|p2a: Umbreon|130/172|[from] item: Leftovers'])].join('\n');
 const f=auditRepeatedHealing(log).findings.find(x=>x.attackSide==='p1');
 assert.ok(f,'residual healing can still warrant an HP-progress audit');
 assert.equal(f.healingTurns,4);
 assert.equal(f.recoveryMoveTurns,0);
 assert.equal(f.otherHealingOnlyTurns,4);
 assert.equal(f.recoveryMoveLoopCandidate,false);
});
test('public Roost plus residual recovery is one recovery-move turn, not two',()=>{
 const log=['|switch|p1a: Metagross|Metagross, L50|157/157',
   '|switch|p2a: Salamence|Salamence, L50|172/172',
   ...[1,2,3].flatMap(t=>['|turn|'+t,
     '|move|p1a: Metagross|Psychic Fangs|p2a: Salamence',
     '|-damage|p2a: Salamence|70/172',
     '|move|p2a: Salamence|Roost|p2a: Salamence',
     '|-heal|p2a: Salamence|150/172|[from] move: Roost',
     '|-heal|p2a: Salamence|160/172|[from] item: Leftovers'])].join('\n');
 const f=auditRepeatedHealing(log).findings.find(x=>x.attackSide==='p1');
 assert.ok(f);
 assert.equal(f.healingTurns,3);
 assert.equal(f.recoveryMoveTurns,3);
 assert.equal(f.otherHealingOnlyTurns,0);
 assert.equal(f.recoveryMoveLoopCandidate,true);
});
test('invalid sides and impossible thresholds fail safely',()=>{
 assert.throws(()=>auditRepeatedHealing('',{ownSide:'p3'}));
 assert.throws(()=>auditRepeatedHealing('',{minAttacks:0}));
});

test('failed Roost plus residual Leftovers is not misattributed as Roost healing',()=>{
 const log=['|switch|p1a: Metagross|Metagross, L50|157/157',
   '|switch|p2a: Salamence|Salamence, L50|172/172',
   ...[1,2,3].flatMap(t=>['|turn|'+t,
     '|move|p2a: Salamence|Roost|p2a: Salamence',
     '|-fail|p2a: Salamence',
     '|move|p1a: Metagross|Psychic Fangs|p2a: Salamence',
     '|-damage|p2a: Salamence|100/172',
     '|-heal|p2a: Salamence|110/172|[from] item: Leftovers'])].join('\n');
 const f=auditRepeatedHealing(log).findings.find(x=>x.attackSide==='p1');
 assert.ok(f);
 assert.equal(f.healingTurns,3);
 assert.equal(f.recoveryMoveTurns,0,'Roost failed; Leftovers healing must not count as Roost');
 assert.equal(f.otherHealingOnlyTurns,3);
 assert.equal(f.recoveryMoveLoopCandidate,false);
});
test('a heal attributed to a different move is not counted as the used recovery move',()=>{
 const log=['|switch|p1a: Metagross|Metagross, L50|157/157',
   '|switch|p2a: Salamence|Salamence, L50|172/172',
   ...[1,2,3].flatMap(t=>['|turn|'+t,
     '|move|p1a: Metagross|Psychic Fangs|p2a: Salamence',
     '|-damage|p2a: Salamence|80/172',
     '|move|p2a: Salamence|Roost|p2a: Salamence',
     '|-heal|p2a: Salamence|130/172|[from] move: Strength Sap'])].join('\n');
 const f=auditRepeatedHealing(log).findings.find(x=>x.attackSide==='p1');
 assert.ok(f);
 assert.equal(f.recoveryMoveTurns,0);
 assert.equal(f.otherHealingOnlyTurns,3);
});
