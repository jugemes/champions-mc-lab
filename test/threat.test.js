'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {publicThreat,defensiveCoverage}=require('../threat');
const {Bot}=require('../lab');
const {variants}=require('../fixtures');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
test('public Ghost STAB threatens a Ghost more than a neutral Steel/Fighting target',()=>{
  assert.ok(publicThreat(dex,'Gholdengo','Gholdengo')>publicThreat(dex,'Lucario','Gholdengo'));
});
test('Ice type coverage is not assumed if unknown: public STAB only',()=>{
  assert.ok(publicThreat(dex,'Salamence','Starmie')>0);
  assert.equal(publicThreat(dex,'Toxapex','UnknownThing'),0);
});
test('defensive coverage rewards at least one safer switch into same Ghost attacker',()=>{
  const ghost=['Gholdengo'];
  const vulnerable=[{species:'Gholdengo'},{species:'Gholdengo'},{species:'Gholdengo'}];
  const mixed=[{species:'Gholdengo'},{species:'Gholdengo'},{species:'Lucario'}];
  assert.ok(defensiveCoverage(dex,mixed,ghost)<defensiveCoverage(dex,vulnerable,ghost));
});
test('do not pivot a healthy Primarina recklessly to Ghost-vulnerable Gholdengo',()=>{
  const bot=new Bot(null,dex,variants.A_rillaboom,'p1',{choices:[],selections:[],errors:[]});
  bot.foeActive='Gholdengo';bot.turn=1;
  const req={active:[{trapped:false,moves:['Moonblast','Sparkling Aria','Aqua Jet','Encore']
    .map(move=>({move,id:move.toLowerCase().replace(/[^a-z]/g,''),pp:10,disabled:false}))}],
    side:{pokemon:[{details:'Primarina, L50',active:true,condition:'187/187'},
      {details:'Gholdengo, L50',active:false,condition:'164/164'},
      {details:'Skeledirge, L50',active:false,condition:'211/211'}]}};
  assert.match(bot.decide(req),/^move /);
});
