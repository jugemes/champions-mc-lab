'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {canSwitchAgainst}=require('../lab');
const {variants}=require('../fixtures');
const sim=require(path.join(process.env.SHOWDOWN_DIR,'dist/sim/index.js'));
const dex=sim.Dex.mod('champions');
const prim=variants.A_rillaboom.find(p=>p.species==='Primarina');
const ghost=variants.C_master.find(p=>p.species==='Gengar');
test('a publicly mega-evolved Gengar traps a non-Ghost; never issue switch',()=>{
  assert.equal(canSwitchAgainst(dex,{},prim,'Gengar-Mega'),false);
});
test('Shadow Tag does not trap a Ghost target and unknown normal Gengar is not assumed Mega',()=>{
  assert.equal(canSwitchAgainst(dex,{},ghost,'Gengar-Mega'),true);
  assert.equal(canSwitchAgainst(dex,{},prim,'Gengar'),true);
});
test('explicit active request trap or possible trap blocks voluntary swaps',()=>{
  assert.equal(canSwitchAgainst(dex,{trapped:true},prim,'Pelipper'),false);
  assert.equal(canSwitchAgainst(dex,{maybeTrapped:true},prim,'Pelipper'),false);
});
test('observed trapping ability is enough even before forme is known',()=>{
  assert.equal(canSwitchAgainst(dex,{},prim,'Gengar','Shadow Tag'),false);
});
