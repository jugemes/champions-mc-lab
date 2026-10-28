'use strict';
const test=require('node:test'),assert=require('node:assert');
const {load}=require('../lab');
const {foeMegaForms,rankFoeMega}=require('../preview-foe-mega');
const {reportedLive}=require('../reported-live-roster-20261027');
const sim=load(),dex=sim.Dex.mod('champions');
test('foeMegaForms lists base then every Mega form; non-Mega species unchanged',()=>{
  assert.deepStrictEqual(foeMegaForms(dex,'Golisopod'),['Golisopod','Golisopod-Mega']);
  assert.deepStrictEqual(foeMegaForms(dex,'Charizard'),['Charizard','Charizard-Mega-X','Charizard-Mega-Y']);
  assert.deepStrictEqual(foeMegaForms(dex,'Mimikyu'),['Mimikyu']);
  assert.deepStrictEqual(foeMegaForms(dex,'Golisopod-Mega'),['Golisopod-Mega']);
});
test('rankFoeMega reads only six public species and returns 20 trios',()=>{
  const r=rankFoeMega(dex,reportedLive(),['Golisopod','Garchomp','Mimikyu','Hippowdon','Primarina','Gholdengo']);
  assert.strictEqual(r.length,20);
});
