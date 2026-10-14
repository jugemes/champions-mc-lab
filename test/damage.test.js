'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {variants}=require('../fixtures');
const {knownStat,estimateDamage,incomingRisk,moveUtility}=require('../damage');
const {Bot}=require('../lab');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const st=variants.A_rillaboom[0],g=variants.A_rillaboom[3];
test('Champions HP and offensive stat-point ranges use M-C rules, not 252 EV math',()=>{
  assert.equal(knownStat(dex,st,'hp'),dex.species.get('Starmie').baseStats.hp+3+75);
  assert.equal(knownStat(dex,st,'spa'),dex.species.get('Starmie').baseStats.spa+32+20);
});
test('Air Balloon revealed on field makes Earthquake absolutely worthless, then popping restores coverage',()=>{
  const ch=variants.C_master[1];
  assert.equal(estimateDamage(dex,ch,'Gholdengo','Earthquake',{foeItem:'Air Balloon'}).max,0);
  assert.ok(estimateDamage(dex,ch,'Gholdengo','Earthquake',{foeItem:''}).min>0);
  assert.equal(moveUtility(dex,ch,'Gholdengo','Earthquake',{foeItem:'Air Balloon',foeHP:1}),0);
});
test('observed boosts change KO estimates, with Unaware overriding offensive boosts',()=>{
  const plain=estimateDamage(dex,g,'Gholdengo','Shadow Ball');
  const boosted=estimateDamage(dex,g,'Gholdengo','Shadow Ball',{boosts:{spa:2}});
  const unaware=estimateDamage(dex,g,'Gholdengo','Shadow Ball',{boosts:{spa:2},foeAbility:'Unaware'});
  assert.ok(boosted.mid>plain.mid*1.8);
  assert.equal(unaware.mid,plain.mid);
});
test('incoming observed attacks make vulnerable pivots riskier without peeking at enemy sets',()=>{
  const prim=variants.A_rillaboom.find(p=>p.species==='Primarina');
  const dirge=variants.A_rillaboom.find(p=>p.species==='Skeledirge');
  assert.ok(incomingRisk(dex,prim,'Gholdengo',{seenMoves:['Thunderbolt']})>=incomingRisk(dex,prim,'Gholdengo'));
  assert.equal(incomingRisk(dex,dirge,'Gholdengo',{foeBoosts:{spa:2}}),incomingRisk(dex,dirge,'Gholdengo'));
});
test('bot will not select a revealed Air Balloon immune ground move over a legal damaging alternative',()=>{
  const bot=new Bot(null,dex,variants.C_master,'p1',{choices:[],selections:[],errors:[]});
  bot.foeActive='Gholdengo';bot.foeItem='Air Balloon';bot.turn=2;
  const req={active:[{trapped:true,moves:['Earthquake','Dragon Claw','Rock Slide','Poison Jab'].map(x=>({move:x,id:x.toLowerCase().replace(/[^a-z]/g,''),pp:12,disabled:false}))}],side:{pokemon:[{details:'Garchomp, L50',active:true,condition:'185/185'}]}};
  assert.notEqual(bot.decide(req),'move 1');
});
