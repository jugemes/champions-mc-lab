'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const lab=require('../lab');
const {variants,archetypes}=require('../fixtures');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
test('Mega-form lookup resolves to its own base-species set (not first party slot)',()=>{
  const bot=new lab.Bot(null,dex,variants.A_rillaboom,'p1',{choices:[],selections:[],errors:[]});
  assert.equal(bot.getSet({details:'Lucario-Mega, L50, M'}).species,'Lucario');
  assert.equal(bot.getSet({details:'Starmie, L50'}).species,'Starmie');
  assert.throws(()=>bot.getSet({details:'Pikachu, L50'}),/No known set/);
});
test('priority is not blindly rewarded against bulky resisted targets',()=>{
  const luc=variants.A_rillaboom.find(x=>x.species==='Lucario');
  assert.ok(lab.matchup(dex,luc,'Toxapex','Close Combat')>lab.matchup(dex,luc,'Toxapex','Bullet Punch'));
});
test('Rocky Helmet penalizes contact move choices with known information',()=>{
  const bot=new lab.Bot(null,dex,variants.A_rillaboom,'p1',{choices:[],selections:[],errors:[]});
  bot.foeActive='Toxapex';bot.foeItem='Rocky Helmet';bot.turn=3;
  const req={active:[{trapped:true,moves:[
    {move:'Close Combat',id:'closecombat',pp:5,disabled:false},
    {move:'Meteor Mash',id:'meteormash',pp:5,disabled:false},
    {move:'Bullet Punch',id:'bulletpunch',pp:5,disabled:false},
    {move:'Swords Dance',id:'swordsdance',pp:5,disabled:false},
  ]}],side:{pokemon:[{details:'Lucario-Mega, L50',active:true,condition:'147/147'}]}};
  const choice=bot.decide(req);
  assert.notEqual(choice,'move 3','contact priority move should not be blindly favored versus Toxapex');
});
test('all fixed opponent scenarios are active in fixture data',()=>{
  for(const name of ['rain','setup','stall'])assert.equal(archetypes[name].length,6);
});
