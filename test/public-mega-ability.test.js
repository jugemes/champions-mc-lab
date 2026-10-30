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

test('public Mega-Z ability survives switch-out and re-entry without a new detailschange',async()=>{
  // A Mega form returning from the bench is public on the switch line.
  const bot=await simulatePublicProtocol(
    '|switch|p2a: Garchomp|Garchomp, L50|185/185\n'+
    '|-ability|p2a: Garchomp|Sand Veil\n'+
    '|detailschange|p2a: Garchomp|Garchomp-Mega-Z, L50\n'+
    '|switch|p2a: Rotom|Rotom-Wash, L50|157/157\n'+
    '|switch|p2a: Garchomp|Garchomp-Mega-Z, L50|185/185\n');
  assert.equal(bot.foeActive,'Garchomp-Mega-Z');
  assert.equal(bot.foeAbility,'Levitate','switch back must re-infer the fixed Mega ability');
  const attacker=own.find(x=>x.species==='Garchomp');
  assert.equal(estimateDamage(dex,attacker,bot.foeActive,'Earthquake',{foeAbility:bot.foeAbility}).immune,true);
});

test('pinned Showdown Battle emits Mega-Z and its re-entry as public forme events',async()=>{
  const {engineBattle,padTo6,FILLER}=require('../hybrid01-audit');
  const {H}=require('../rational-cases');
  const base=own.find(x=>x.species==='Garchomp');
  const mega={...base,item:'Garchompite Z',ability:'Rough Skin',
    moves:['Earthquake','Dragon Claw','Swords Dance','Rock Slide']};
  const p1=padTo6(mega,FILLER());
  const p2=padTo6(H.corviknight,FILLER());
  const battle=engineBattle(sim,p1,p2,[2026,10,30,18],[
    ['move 1 mega','move 1'],
    ['switch 2','move 1'],
    ['switch 1','move 1'],
  ]);
  const events=battle.log.filter(l=>/^\|(switch|detailschange|drag|replace)\|p1a:/.test(l));
  assert.ok(events.length>=3,JSON.stringify(events));
  assert.ok(events.some(l=>l.includes('Garchomp-Mega-Z')),'engine must visibly expose Mega-Z form: '+events.join(' / '));
  const bot=new Bot(streamOf(events.join('\n')) ,dex,own,'p2',
    {choices:[],selections:[],errors:[]},null,null,{decisionPolicy:'rational2'});
  await bot.run();
  assert.equal(bot.foeActive,'Garchomp-Mega-Z','Mega-Z should be re-entered');
  assert.equal(bot.foeAbility,'Levitate','publicly fixed Mega ability after actual switch re-entry');
  assert.equal(estimateDamage(dex,own.find(x=>x.species==='Garchomp'),
    bot.foeActive,'Earthquake',{foeAbility:bot.foeAbility}).immune,true);
  battle.destroy();
});
