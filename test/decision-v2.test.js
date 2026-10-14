'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {evaluateMove}=require('../decision-v2');
const {variants}=require('../fixtures');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const st=variants.A_rillaboom[0],dirge=variants.A_rillaboom[4];
test('candidate v2 does not waste Choice Scarf Trick into a low HP boosted Volcarona',()=>{
  const state={ratio:1,foeHP:.22,foeBoosts:{spa:1,spe:1},available:st.moves,turn:4};
  assert.equal(evaluateMove(dex,st,'Volcarona','Trick',state),0);
  assert.ok(evaluateMove(dex,st,'Volcarona','Hydro Pump',state)>0);
});
test('candidate v2 does not Slack Off through an imminent foe KO',()=>{
  const st={ratio:.16,foeHP:.3,foeBoosts:{atk:2},available:dirge.moves,turn:5};
  assert.equal(evaluateMove(dex,dirge,'Swampert','Slack Off',st),0);
});
test('status scores can still reward setup versus passive pressure',()=>{
  const gold=variants.A_rillaboom.find(p=>p.species==='Gholdengo');
  const state={ratio:1,foeHP:1,available:gold.moves,turn:1};
  assert.ok(evaluateMove(dex,gold,'Toxapex','Nasty Plot',state)>0);
});