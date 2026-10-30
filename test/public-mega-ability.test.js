'use strict';
// This is an isolated PUBLIC protocol event test. It does not read an
// opponent's private set, held item, selected bench or omniscient stream.
// Real Showdown Battle emission order is a separate integration check.
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const {Bot}=require('../lab');
const {reportedLive}=require('../reported-live-roster-20261027');
const {estimateDamage}=require('../damage');
const own=reportedLive();
function streamOf(text){
  return {async *[Symbol.asyncIterator](){yield text;}};
}
function simulatePublicProtocol(text){
  const b=new Bot(streamOf(text),dex,own,'p1',{choices:[],selections:[],errors:[]},null,null,{decisionPolicy:'rational2'});
  return b.run().then(()=>b);
}
test('public Garchomp Mega-Z forme event overwrites previously observed base ability with Levitate',async()=>{
  const sp=dex.species.get('Garchomp-Mega-Z');
  assert.ok(sp.exists&&sp.isMega,'pinned Showdown must contain the exact legal Mega-Z forme');
  assert.equal(sp.abilities['0'],'Levitate','public fixed Mega-Z ability');
  const bot=await simulatePublicProtocol(
    '|switch|p2a: Garchomp|Garchomp, L50|185/185\n'+
    '|-ability|p2a: Garchomp|Sand Veil\n'+
    '|detailschange|p2a: Garchomp|Garchomp-Mega-Z, L50\n');
  assert.equal(bot.foeActive,'Garchomp-Mega-Z');
  assert.equal(bot.foeAbility,'Levitate');
  const attacker=own.find(x=>x.species==='Garchomp');
  const hit=estimateDamage(dex,attacker,bot.foeActive,'Earthquake',{foeAbility:bot.foeAbility});
  assert.equal(hit.immune,true,'do not consider an Earthquake hit into publicly fixed Levitate');
});
test('a non-Mega forme change does not retain a previously disclosed stale ability',async()=>{
  const bot=await simulatePublicProtocol(
    '|switch|p2a: Zoroark|Zoroark, L50|150/150\n'+
    '|-ability|p2a: Zoroark|Illusion\n'+
    '|detailschange|p2a: Zoroark|Garchomp, L50\n');
  assert.equal(bot.foeActive,'Garchomp');
  assert.equal(bot.foeAbility,'','do not carry a previous form ability to a new non-Mega form');
});
