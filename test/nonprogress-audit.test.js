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
test('invalid sides and impossible thresholds fail safely',()=>{
 assert.throws(()=>auditRepeatedHealing('',{ownSide:'p3'}));
 assert.throws(()=>auditRepeatedHealing('',{minAttacks:0}));
});
