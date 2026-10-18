'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {provisional}=require('../provisional-rank-roster-20261018');
const {prelim,normalize}=require('../lab');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
test('four already-used candidate species plus Tyranitar and Wash Rotom have exact M-C legality',()=>{
 const t=provisional(); assert.equal(t.length,6);
 assert.deepEqual(t.map(x=>x.species),['Metagross','Hydreigon','Primarina','Garchomp','Tyranitar','Rotom-Wash']);
 assert.doesNotThrow(()=>prelim(t,'provisional_rank_20261018'));
 const issues=sim.TeamValidator.get('gen9championsbssregmc').validateTeam(normalize(t));
 assert.ok(!issues?.length,'M-C errors: '+JSON.stringify(issues));
});
test('provisional team has two distinct counter routes without relying on one mega switch',()=>{
 const t=provisional();
 assert.equal(t.filter(x=>x.item.endsWith('ite')).length,1);
 assert.ok(t.some(x=>x.species==='Tyranitar'&&x.ability==='Sand Stream'&&x.moves.includes('Stone Edge')));
 assert.ok(t.some(x=>x.species==='Rotom-Wash'&&x.ability==='Levitate'&&x.moves.includes('Thunderbolt')));
 assert.ok(t.some(x=>x.species==='Primarina'&&x.moves.includes('Encore')));
});